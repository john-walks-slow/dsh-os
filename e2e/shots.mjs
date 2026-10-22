/**
 * README 官方截图：对 e2e 实例按几套偏好各拍一张。
 *
 * 用 `npm run e2e:shots`（底层 dsh-e2e run）执行，产物写进 screenshots/。
 * 拍之前先播种展示夹具，账本与最近会话才有内容。
 *
 * e2e home 没有配置 provider，首页会弹一个"Add an API key"引导弹窗，它的遮罩
 * 会挡住任务栏 chip；先把弹窗关掉（关不掉就摘掉它自己）再操作。
 */
import { chromium } from '/usr/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
import { seedShowcase } from './lib/fixtures.mjs'

const port = process.env.DSH_E2E_PORT
const home = process.env.DSH_E2E_HOME
if (!port || !home) throw new Error('DSH_E2E_PORT / DSH_E2E_HOME 未注入：请用 dsh-e2e run 执行')
const url = `http://127.0.0.1:${port}/?token=${process.env.DSH_E2E_TOKEN || 'e2etest'}`

seedShowcase(home)
// 索引每 15s 增量刷新一轮，等它把新夹具吃进去再拍照
{
	const deadline = Date.now() + 40_000
	while (Date.now() < deadline) {
		const payload = await fetch(`http://127.0.0.1:${port}/plugins/dsh-os/harness`).then((response) => response.json()).catch(() => null)
		if ((payload?.store?.sessions ?? 0) >= 12) break
		await new Promise((resolve) => setTimeout(resolve, 1000))
	}
}

const SHOTS = [
	{ name: 'home-rain', width: 1440, height: 900, settings: { pattern: 'rain' }, chip: 'DARK' },
	{ name: 'home-light', width: 1440, height: 900, settings: { pattern: 'rain' }, chip: 'LIGHT' },
	{ name: 'home-field', width: 1440, height: 900, settings: { pattern: 'field' }, chip: 'DARK' },
	{ name: 'home-dshchan', width: 1440, height: 900, settings: { pattern: 'dshchan' }, chip: 'DARK' },
	{ name: 'home-mobile', width: 412, height: 915, settings: { pattern: 'rain' }, chip: 'DARK' },
]

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] })

/** 关掉未配置 provider 的引导弹窗：能点就点，点不掉就摘掉整个 overlay。 */
async function clearNotice(page) {
	for (const label of ['Configure later', 'Continue']) {
		const button = page.getByRole('button', { name: label, exact: true })
		if (await button.count()) await button.first().click({ timeout: 3000 }).catch(() => null)
	}
	await page.waitForTimeout(400)
	if ((await page.getByText('Add an API key', { exact: false }).count()) === 0) return
	await page.evaluate(() => {
		for (const overlay of document.querySelectorAll('div[role="presentation"]')) {
			if (overlay.querySelector('[class*="_mask_"]')) overlay.remove()
		}
	})
	await page.waitForTimeout(300)
}

async function prepare(shot) {
	const context = await browser.newContext({ viewport: { width: shot.width, height: shot.height }, deviceScaleFactor: 1 })
	await context.addInitScript(
		(settings) => {
			window.sessionStorage.setItem('dsh-os:booted', '1')
			localStorage.setItem('dsh-os:settings', JSON.stringify({ enabled: true, boot: false, scope: 'space', ...settings }))
		},
		shot.settings,
	)
	const page = await context.newPage()
	await page.goto(url, { waitUntil: 'domcontentloaded' })
	// 引导弹窗比页面加载晚几秒出现，先等页面与弹窗都落位
	await page.waitForTimeout(6500)
	await clearNotice(page)
	if (shot.chip) {
		// 明暗走任务栏 chip：它同时改宿主主题偏好，原生界面与桌面才不会一半深一半浅
		const chip = page.locator('.dos-taskbar').getByRole('button', { name: shot.chip, exact: true })
		await chip.click({ timeout: 8000 }).catch(() => null)
		await page.waitForTimeout(2200)
	}
	await page.waitForTimeout(2600)
	return { context, page }
}

for (const shot of SHOTS) {
	const { context, page } = await prepare(shot)
	await page.screenshot({ path: `screenshots/${shot.name}.png` })
	console.log(`✓ screenshots/${shot.name}.png`)
	await context.close()
}

// 开机自检：这张不跳过 POST 序列，等它演到中段
{
	const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
	await context.addInitScript(() => {
		localStorage.setItem('dsh-os:settings', JSON.stringify({ enabled: true, boot: true, scope: 'space', pattern: 'rain' }))
	})
	const page = await context.newPage()
	await page.goto(url, { waitUntil: 'domcontentloaded' })
	await page.waitForSelector('.dos-boot', { timeout: 15000 })
	await page.waitForTimeout(1200)
	await page.screenshot({ path: 'screenshots/boot.png' })
	console.log('✓ screenshots/boot.png')
	await context.close()
}

// 设置页那张不在这里拍：e2e 实例里点侧边栏 Settings 打不开宿主设置视图，
// 改用离线预览页 —— tools/preview.html?settings=1（见 README 的"开发"一节）。

await browser.close()
