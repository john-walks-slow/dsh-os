/**
 * dsh-os 首页桌面冒烟测试。
 *
 * 覆盖：夹具播种 → 开机自检 → 桌面层 → 字符场 → 账本真实数字与口径切换 →
 * 深浅色墨色 → 悬停读数 → 窄屏布局。只断言"看得见的行为与真实数字"。
 */
import { chromium } from '/usr/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { EXPECTED, seedFixtures } from './lib/fixtures.mjs'

const port = process.env.DSH_E2E_PORT
const home = process.env.DSH_E2E_HOME
if (!port || !home) throw new Error('DSH_E2E_PORT / DSH_E2E_HOME 未注入：请用 dsh-e2e run 执行')
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

async function fetchHarness(ws = '') {
	const response = await fetch(`http://127.0.0.1:${port}/plugins/dsh-os/harness${ws ? `?ws=${encodeURIComponent(ws)}` : ''}`)
	return response.json()
}

/**
 * 索引每 15s 增量刷新一次。清掉上一轮夹具（含截图用的展示夹具）之后，要等
 * 索引真的收敛到"只剩本轮夹具"的状态——展示夹具独有的 omni / lite 模型消失
 * 就是最干净的判据。
 */
async function waitForIndex() {
	const deadline = Date.now() + 50_000
	let last = null
	while (Date.now() < deadline) {
		last = await fetchHarness().catch(() => null)
		const models = last?.models?.all ?? []
		const clean = !models.some((row) => row.model === 'omni' || row.model === 'lite')
		if (last?.store?.ok && clean && last.all.running === EXPECTED.spaceRunning && last.all.subagents === EXPECTED.spaceSubagents) return last
		await new Promise((resolve) => setTimeout(resolve, 1500))
	}
	return last
}

console.log('seed fixtures')
seedFixtures(home)
const seeded = await waitForIndex()
check('宿主端点索引到夹具', seeded?.store?.sessions >= EXPECTED.allSessionsAtLeast, `sessions=${seeded?.store?.sessions}`)
check('索引已收敛到本轮夹具', !(seeded?.models?.all ?? []).some((row) => row.model === 'omni' || row.model === 'lite'), (seeded?.models?.all ?? []).map((row) => row.model).join(','))
check('全机口径含他处工作区', (seeded?.all?.sessions ?? 0) >= EXPECTED.allSessionsAtLeast, JSON.stringify(seeded?.all?.today))
check(
	'陈旧 open turn 不算在跑',
	seeded?.all?.running === EXPECTED.spaceRunning,
	`running=${seeded?.all?.running}`,
)
check('在飞的子代理单独计数', seeded?.all?.subagents === EXPECTED.spaceSubagents, `subagents=${seeded?.all?.subagents}`)
const spacePayload = await fetchHarness(EXPECTED.homeWorkspace)
// 隔离 home 里还会有 e2e 自己造的会话，所以只断言「夹具口径」而不是绝对条数
check(
	'工作区口径只算本工作区（空白会话不计入）',
	spacePayload.space.sessions >= EXPECTED.spaceSessions &&
		spacePayload.space.sessions < spacePayload.all.sessions,
	`space=${spacePayload.space.sessions} all=${spacePayload.all.sessions}`,
)
check(
	'他处工作区的模型不进本工作区账本',
	!spacePayload.models.space.some((row) => row.model === 'high') &&
		spacePayload.models.all.some((row) => row.model === 'high'),
	spacePayload.models.all.map((row) => row.model).join(','),
)
check(
	'ALL 口径的最近会话独立成列',
	spacePayload.sessionsAll.length > spacePayload.sessions.length,
	`${spacePayload.sessions.length} → ${spacePayload.sessionsAll.length}`,
)
check(
	'账本行优先指向用户会话而非子代理',
	spacePayload.models.space.find((row) => row.model === 'low')?.lastSessionId === 'e2e-fixture-bbb',
	spacePayload.models.space.map((row) => `${row.model}:${row.lastSessionId}`).join(' '),
)
check('工作区口径的模型表正确', spacePayload.models.space.map((row) => `${row.provider}/${row.model}`).join(',') === EXPECTED.spaceModels.join(','),
	spacePayload.models.space.map((row) => `${row.provider}/${row.model}`).join(','))
check('模型行带 lastSessionId（可点击回到会话）', spacePayload.models.space.every((row) => typeof row.lastSessionId === 'string' && row.lastSessionId.length > 0))

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
await page.waitForTimeout(6000)

console.log('desktop')
const desktop = await page.evaluate(() => ({
	live: document.documentElement.classList.contains('dsh-os-live'),
	tone: document.documentElement.getAttribute('data-dos-tone'),
	field: Boolean(document.querySelector('#dsh-os-field canvas')),
	panels: document.querySelectorAll('.dos-panel').length,
	ledgerRows: document.querySelectorAll('.dos-ledger-row').length,
	console: document.querySelectorAll('.dos-console').length,
	sidebarSkin: document.documentElement.classList.contains('dsh-os-skin-sidebar'),
	composerSkin: document.documentElement.classList.contains('dsh-os-skin-composer'),
	recent: document.querySelectorAll('.dos-session').length,
	workspace: window.__dshOsState?.().workspace,
	forceDark: document.body.hasAttribute('data-ds-dark-theme'),
	hostTone: window.__dshOsState?.().hostTone,
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
check('桌面层激活', desktop.live)
check('字符场已挂载并出字', desktop.field && desktop.pixels > 20, `bright=${desktop.pixels}`)
check('四块窗格齐全', desktop.panels >= 4, `panels=${desktop.panels}`)
check('模型账本有真实数据', desktop.ledgerRows >= 2, `rows=${desktop.ledgerRows}`)
check('最近会话列表有数据', desktop.recent >= 1, `rows=${desktop.recent}`)
check('模拟终端已移除', desktop.console === 0)
check('侧边栏皮肤已移除', !desktop.sidebarSkin)
check('输入框皮肤仍在', desktop.composerSkin)
check('明暗由宿主决定而非强行改宿主', desktop.forceDark === (desktop.hostTone === 'dark'), `force=${desktop.forceDark} host=${desktop.hostTone}`)
check('工作区判定命中夹具工作区', desktop.workspace === EXPECTED.homeWorkspace, `ws=${desktop.workspace}`)
await page.screenshot({ path: 'e2e-artifacts/home-dark-1440.png' })

console.log('layout budget')
// 面板是 overflow:hidden，装不下的行会被静默裁掉——这里守住"一行都不许被切"
for (const size of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 1100, height: 700 }]) {
	await page.setViewportSize(size)
	await page.waitForTimeout(1400)
	const clipped = await page.evaluate(() =>
		[...document.querySelectorAll('.dos-panel')]
			.filter((panel) => panel.scrollHeight > panel.clientHeight + 1)
			.map((panel) => panel.querySelector('.dos-head b')?.textContent ?? '?'),
	)
	check(`窗格内容不被静默裁掉 @ ${size.width}x${size.height}`, clipped.length === 0, clipped.join(','))
}
await page.setViewportSize({ width: 1440, height: 900 })
await page.waitForTimeout(1200)

console.log('ledger scope')
/** 「SESSIONS · RECENT」面板标题右侧的数字 = 当前口径下的会话条数。 */
const recentCount = () =>
	page.evaluate(() => {
		for (const panel of document.querySelectorAll('.dos-panel')) {
			if (panel.querySelector('.dos-head b')?.textContent?.includes('SESSIONS')) {
				// 计数可能写成 `3/8`（显示条数/总数），这里要的是原始文案
				return panel.querySelector('.dos-head-meta')?.textContent ?? ''
			}
		}
		return -1
	})
const railSessions = () =>
	page.evaluate(() => Number(document.querySelector('.dos-rail-stat b')?.textContent ?? -1))
const beforeScope = await recentCount()
const beforeRail = await railSessions()
await page.locator('.dos-taskbar').getByRole('button', { name: 'ALL', exact: true }).click()
await page.waitForTimeout(1500)
const afterScope = await recentCount()
const afterRail = await railSessions()
check(
	'ALL 口径扩到全机（会话变多）',
	afterScope !== beforeScope && afterRail > beforeRail,
	`panel ${beforeScope} → ${afterScope} · rail ${beforeRail} → ${afterRail}`,
)
await page.locator('.dos-taskbar').getByRole('button', { name: 'WS', exact: true }).click()
await page.waitForTimeout(1500)
check('WS 口径收回到本工作区', (await recentCount()) === beforeScope && (await railSessions()) === beforeRail)

console.log('ledger window')
await page.locator('.dos-head-meta .dos-seg').getByRole('button', { name: 'ALL', exact: true }).click()
const windowRows = await page.evaluate(() => document.querySelectorAll('.dos-ledger-row').length)
await page.getByRole('button', { name: '24H', exact: true }).click()
await page.waitForTimeout(800)
const windowRows24 = await page.evaluate(() => document.querySelectorAll('.dos-ledger-row').length)
check('时间窗切换会收敛到近期会话', windowRows24 <= windowRows, `${windowRows} → ${windowRows24}`)
check('24H 窗仍能看到本次夹具', windowRows24 >= 1, `rows=${windowRows24}`)

console.log('sparkline hover')
const spark = page.locator('.dos-spark').first()
await spark.hover({ position: { x: 40, y: 8 } })
await page.waitForTimeout(300)
check('火花线悬停出读数', (await page.locator('.dos-spark-tip').count()) > 0)

console.log('light tone')
await page.evaluate(() => {
	const raw = JSON.parse(localStorage.getItem('dsh-os:settings') ?? '{}')
	localStorage.setItem('dsh-os:settings', JSON.stringify({ ...raw, tone: 'light' }))
})
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(5000)
const light = await page.evaluate(() => {
	const canvas = document.querySelector('#dsh-os-field canvas')
	let sum = 0
	let count = 0
	if (canvas) {
		const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
		for (let index = 0; index < data.length; index += 4 * 97) {
			sum += (data[index] + data[index + 1] + data[index + 2]) / 3
			count += 1
		}
	}
	return {
		tone: document.documentElement.getAttribute('data-dos-tone'),
		brightness: count ? sum / count : 0,
		forceDark: document.body.hasAttribute('data-ds-dark-theme'),
		hostTone: window.__dshOsState?.().hostTone,
		panels: document.querySelectorAll('.dos-panel').length,
	}
})
check('浅色墨色生效', light.tone === 'light', `tone=${light.tone}`)
check('浅色底纸确实是亮的', light.brightness > 150, `brightness=${light.brightness.toFixed(0)}`)
check('浅色下仍不改写宿主主题', light.forceDark === (light.hostTone === 'dark'))
check('浅色下窗格照常渲染', light.panels >= 4, `panels=${light.panels}`)
await page.screenshot({ path: 'e2e-artifacts/home-light-1440.png' })

console.log('back to dark')
await page.evaluate(() => {
	const raw = JSON.parse(localStorage.getItem('dsh-os:settings') ?? '{}')
	localStorage.setItem('dsh-os:settings', JSON.stringify({ ...raw, tone: 'dark' }))
})
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(5000)
const dark = await page.evaluate(() => {
	const canvas = document.querySelector('#dsh-os-field canvas')
	let sum = 0
	let count = 0
	if (canvas) {
		const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
		for (let index = 0; index < data.length; index += 4 * 97) {
			sum += (data[index] + data[index + 1] + data[index + 2]) / 3
			count += 1
		}
	}
	return { tone: document.documentElement.getAttribute('data-dos-tone'), brightness: count ? sum / count : 0 }
})
check('深色墨色生效', dark.tone === 'dark')
check('深色底纸确实是暗的', dark.brightness < 40, `brightness=${dark.brightness.toFixed(0)}`)

console.log('shortcuts')
// 焦点若在输入框里，快捷键按设计让位给打字——先把焦点挪开
await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
await page.keyboard.press('Backquote')
await page.waitForTimeout(600)
check('` 关闭桌面层', await page.evaluate(() => !document.documentElement.classList.contains('dsh-os-live')))
await page.keyboard.press('Backquote')
await page.waitForTimeout(900)
check('` 恢复桌面层', await page.evaluate(() => document.documentElement.classList.contains('dsh-os-live')))

console.log('narrow')
await page.setViewportSize({ width: 412, height: 915 })
await page.waitForTimeout(1400)
const narrow = await page.evaluate(() => ({
	panels: document.querySelectorAll('.dos-panel').length,
	compact: document.querySelectorAll('.dos-compact').length,
	taskbar: Boolean(document.querySelector('.dos-taskbar')),
	overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
}))
check('窄屏收起窗格', narrow.panels === 0, `panels=${narrow.panels}`)
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
