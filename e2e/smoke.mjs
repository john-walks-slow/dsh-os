/**
 * dsh-os 首页冒烟测试。
 *
 * 覆盖：开机自检 → 桌面层 → 背景字符场 → `~` 开关 → FIELD 开关 → 窄屏布局。
 * 只断言"看得见的行为"，不碰内部状态。
 */
import { chromium } from '/usr/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'

const port = process.env.DSH_E2E_PORT
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

async function dismissNotices(page) {
	for (const label of ['Continue', 'Configure later']) {
		const button = page.getByText(label, { exact: true })
		if (await button.count()) {
			await button.first().click()
			await page.waitForTimeout(500)
		}
	}
}

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const errors = []
page.on('console', (message) => {
	if (message.type() === 'error') errors.push(message.text())
})
page.on('pageerror', (error) => errors.push(error.message))

console.log('boot')
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.dos-boot', { timeout: 15000 }).catch(() => null)
const bootShown = (await page.locator('.dos-boot').count()) > 0
if (bootShown) await page.screenshot({ path: 'e2e-artifacts/boot.png' })
check('开机自检出现', bootShown)
await page.keyboard.press('Escape')
await page.waitForTimeout(1200)
check('按键可跳过自检', (await page.locator('.dos-boot').count()) === 0)

await dismissNotices(page)
await page.waitForTimeout(1800)

console.log('desktop')
const desktop = await page.evaluate(() => ({
	live: document.documentElement.classList.contains('dsh-os-live'),
	dark: document.body.hasAttribute('data-ds-dark-theme'),
	field: Boolean(document.querySelector('#dsh-os-field canvas')),
	panels: document.querySelectorAll('.dos-panel').length,
	phase: document.querySelector('.dos-root')?.getAttribute('data-phase'),
	ledger: Boolean(document.querySelector('.dos-ledger')),
	skins: {
		sidebar: document.documentElement.classList.contains('dsh-os-skin-sidebar'),
		composer: document.documentElement.classList.contains('dsh-os-skin-composer'),
	},
	pattern: window.__dshOsState?.().settings?.pattern,
	pixels: (() => {
		const canvas = document.querySelector('#dsh-os-field canvas')
		if (!canvas) return 0
		const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
		let bright = 0
		for (let index = 0; index < data.length; index += 4 * 53) {
			if (Math.max(data[index], data[index + 1], data[index + 2]) > 90) bright += 1
		}
		return bright
	})(),
}))
check('桌面层激活', desktop.live && desktop.phase === 'live')
check('深色盘接管首页', desktop.dark)
check('字符场已挂载并出字', desktop.field && desktop.pixels > 20, `bright=${desktop.pixels}`)
check('窗格已渲染', desktop.panels >= 3, `panels=${desktop.panels}`)
check('Token 账本已挂载', desktop.ledger)
check('原生皮肤已启用', desktop.skins.sidebar && desktop.skins.composer)
check('默认背景为干净字符雨', desktop.pattern === 'rain', `pattern=${desktop.pattern}`)
await page.screenshot({ path: 'e2e-artifacts/home-1440.png' })

console.log('shortcuts')
await page.keyboard.press('Backquote')
await page.waitForTimeout(600)
const off = await page.evaluate(() => ({
	live: document.documentElement.classList.contains('dsh-os-live'),
	field: Boolean(document.querySelector('#dsh-os-field canvas')),
	dark: document.body.hasAttribute('data-ds-dark-theme'),
}))
check('` 关闭桌面层', !off.live && !off.field && !off.dark)
await page.keyboard.press('Backquote')
await page.waitForTimeout(600)
check('` 恢复桌面层', await page.evaluate(() => document.documentElement.classList.contains('dsh-os-live')))

console.log('field chip')
await page.getByRole('button', { name: 'field', exact: true }).click()
await page.waitForTimeout(500)
check('FIELD 只关字符场', await page.evaluate(() => !document.querySelector('#dsh-os-field canvas') && document.documentElement.classList.contains('dsh-os-live')))
await page.getByRole('button', { name: 'field', exact: true }).click()
await page.waitForTimeout(700)
check('FIELD 重新开启字符场', await page.evaluate(() => Boolean(document.querySelector('#dsh-os-field canvas'))))

console.log('narrow')
await page.setViewportSize({ width: 412, height: 915 })
await page.waitForTimeout(1200)
const narrow = await page.evaluate(() => ({
	panels: document.querySelectorAll('.dos-panel').length,
	compact: document.querySelectorAll('.dos-compact').length,
	taskbar: Boolean(document.querySelector('.dos-taskbar')),
	overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
}))
check('窄屏收起两侧窗格', narrow.panels === 0, `panels=${narrow.panels}`)
check('窄屏显示压缩状态条', narrow.compact >= 1 && narrow.taskbar)
check('窄屏无横向溢出', !narrow.overflow)
await page.screenshot({ path: 'e2e-artifacts/home-412.png' })

check('无控制台错误', errors.length === 0, errors.slice(0, 3).join(' | '))
await browser.close()

if (failures.length > 0) {
	console.error(`\n${failures.length} 项失败`)
	for (const failure of failures) console.error(` - ${failure}`)
	process.exit(1)
}
console.log('\n全部通过')
