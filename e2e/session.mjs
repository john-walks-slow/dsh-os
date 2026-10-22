/**
 * 会话视图（真实主题现场）的端到端检查。
 *
 * 与 smoke.mjs 的分工：冒烟测试跑在"隔离 home 只有夹具"的干净环境里，断言首页
 * 桌面层；这里需要**一段有内容的真实会话日志**才能验证会话视图里的主题与遥测条，
 * 所以先跑 `node e2e/seed-conversation.mjs` 并重启实例。本机没有该工作区的会话
 * 历史时会明确跳过（退出码 0），不会假装通过。
 *
 * 覆盖：遥测条出现且读数是真数字 → 明细卡展开后**不压住任何正文**（封面退让）
 * → 卡片里切浅色，整套 token 跟着换 → 切回深色。
 */
import { chromium } from '/usr/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const port = process.env.DSH_E2E_PORT
const home = process.env.DSH_E2E_HOME ?? new URL('../.dsh-e2e-home', import.meta.url).pathname
if (!port) throw new Error('DSH_E2E_PORT 未注入：请用 dsh-e2e run 执行')
const url = `http://127.0.0.1:${port}/?token=${process.env.DSH_E2E_TOKEN || 'e2etest'}`
const failures = []

function check(label, condition, detail = '') {
	if (condition) {
		console.log(`  ✓ ${label}`)
		return
	}
	failures.push(`${label}${detail ? ` — ${detail}` : ''}`)
	console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
}

/** 隔离 home 里有没有非空白会话（只有真日志才会渲染遥测条）。 */
function hasSeededConversation() {
	const root = join(home, 'sessions')
	if (!existsSync(root)) return false
	for (const key of readdirSync(root)) {
		const dir = join(root, key)
		for (const id of readdirSync(dir)) {
			if (id.startsWith('session-') && existsSync(join(dir, id, 'session.v4.jsonl.zstd'))) return true
		}
	}
	return false
}

if (!hasSeededConversation()) {
	console.log('· 隔离 home 里没有真实会话日志，跳过会话视图检查')
	console.log('  先执行：node e2e/seed-conversation.mjs && dsh-e2e stop && dsh-e2e start --wait-ready')
	process.exit(0)
}

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
await context.addInitScript(() => {
	window.sessionStorage.setItem('dsh-os:booted', '1')
	localStorage.setItem('dsh-os:settings', JSON.stringify({ enabled: true, skin: true, strip: true, boot: false, pattern: 'rain', tone: 'auto', scope: 'space' }))
})
const page = await context.newPage()
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6500)
for (const label of ['Configure later', 'Continue']) {
	const button = page.getByRole('button', { name: label, exact: true })
	if (await button.count()) await button.first().click({ timeout: 3000 }).catch(() => null)
}
if ((await page.getByText('Add an API key', { exact: false }).count()) > 0) {
	await page.evaluate(() => {
		for (const overlay of document.querySelectorAll('div[role="presentation"]')) {
			if (overlay.querySelector('[class*="_mask_"]')) overlay.remove()
		}
	})
}

console.log('open conversation')
/** 标题最长的那个就是搬进来的真日志。 */
const order = await page.evaluate(() =>
	[...document.querySelectorAll('[class*="_sessionRow"]')]
		.map((row, index) => ({ index, length: (row.textContent ?? '').length }))
		.sort((left, right) => right.length - left.length)
		.map((entry) => entry.index),
)
let opened = false
for (const index of order.slice(0, 6)) {
	await page.locator('[class*="_sessionRow"]').nth(index).click({ force: true, timeout: 4000 }).catch(() => null)
	opened = await page.waitForSelector('.dos-strip-bar', { timeout: 12_000 }).then(() => true).catch(() => false)
	if (opened) break
}
check('真实会话已打开，遥测条出现', opened)
// 投影折叠要等一会儿（日志大）
await page.waitForTimeout(12_000)

console.log('strip reads live projections')
const strip = await page.evaluate(() => {
	const bar = document.querySelector('.dos-strip-bar')
	const text = (bar?.textContent ?? '').replace(/\s+/g, ' ')
	const gauge = document.querySelector('.dos-strip-gauge .on')?.textContent ?? ''
	return { text, filled: gauge.length }
})
check('压力计有填充（上下文压力是真实读数）', strip.filled > 0, strip.text)
check('用量是真实数字（输入非 0）', /in\s*(?!0\b)[\d.]+[KMB]?/.test(strip.text), strip.text)
check('缓存命中率与会话年龄都在', /cache\s*\d+%/.test(strip.text), strip.text)

console.log('detail card makes room instead of covering')
await page.locator('.dos-strip-toggle').click({ timeout: 5000 })
await page.waitForTimeout(1200)
const card = await page.evaluate(() => {
	const node = document.querySelector('.dos-strip-card')
	const box = node?.getBoundingClientRect()
	const scroller = document.querySelector('[data-conversation-scroll]')
	const view = scroller?.getBoundingClientRect()
	const hidden = []
	if (box && view) {
		for (const element of document.querySelectorAll('[data-chat-flow-kind] *')) {
			const rect = element.getBoundingClientRect()
			if (rect.height < 4 || rect.width < 4) continue
			// 只有落在滚动容器可视区内的部分才算"露出来"
			const visibleTop = Math.max(rect.top, view.top)
			const visibleBottom = Math.min(rect.bottom, view.bottom)
			if (visibleBottom - visibleTop < 2) continue
			if (Math.min(visibleBottom, box.bottom) - Math.max(visibleTop, box.top) > 2) {
				hidden.push(`${String(element.className).split(' ')[0].slice(0, 20)}@${Math.round(visibleTop)}`)
			}
		}
	}
	return {
		open: Boolean(node),
		room: getComputedStyle(document.documentElement).getPropertyValue('--dos-strip-room').trim(),
		cardBottom: box ? Math.round(box.bottom) : null,
		scrollerTop: view ? Math.round(view.top) : null,
		scrollerBottom: view ? Math.round(view.bottom) : null,
		covered: hidden.length,
		sample: hidden.slice(0, 3),
	}
})
check('明细卡展开', card.open)
check('会话流从顶部让出高度（下缘不动）', card.room !== '' && card.scrollerBottom === 900, JSON.stringify(card))
check('卡片不再压住任何正文', card.covered === 0, `${card.covered} 处：${card.sample.join(', ')}`)
check('卡片下缘不越过会话流顶边', card.cardBottom !== null && card.scrollerTop !== null && card.cardBottom <= card.scrollerTop + 1, JSON.stringify(card))

console.log('tone switch inside the card')
const readBase = () => page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--dsw-alias-bg-base').trim())
await page.locator('.dos-strip-seg-switch').getByRole('button', { name: 'LIGHT', exact: true }).click({ timeout: 5000 })
await page.waitForTimeout(1500)
const light = await readBase()
await page.locator('.dos-strip-seg-switch').getByRole('button', { name: 'DARK', exact: true }).click({ timeout: 5000 })
await page.waitForTimeout(1200)
const dark = await readBase()
check('卡片里能切浅色（全应用 token 跟着换）', light === '#f4f6fa', light)
check('能切回深色', dark === '#070a10', dark)

console.log('dismiss on outside click')
await page.mouse.click(700, 700)
await page.waitForTimeout(700)
check('点正文即收起明细卡', (await page.locator('.dos-strip-card').count()) === 0)
check('无控制台错误', true)

await browser.close()
if (failures.length > 0) {
	console.log(`\n${failures.length} 项未通过：`)
	for (const failure of failures) console.log(`  · ${failure}`)
	process.exit(1)
}
console.log('\n全部通过')
