import { chromium } from '/usr/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'
const file = process.argv[2]
const w = Number(process.argv[3] || 1440), h = Number(process.argv[4] || 900)
const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const page = await browser.newPage({ viewport: { width: w, height: h } })
await page.goto(file, { waitUntil: 'load' })
await page.waitForTimeout(1800)
const out = await page.evaluate(() => [...document.querySelectorAll('.dos-panel, .dos-console, .dos-compact, .dos-taskbar, .dos-rail')].map((el) => {
  const r = el.getBoundingClientRect()
  return { cls: String(el.className).split(' ')[0], rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], scroll: el.scrollHeight, client: el.clientHeight, over: el.scrollHeight > el.clientHeight + 1, right: Math.round(r.right) }
}))
console.log(JSON.stringify(out, null, 0))
await browser.close()
