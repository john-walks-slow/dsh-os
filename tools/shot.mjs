import { chromium } from '/usr/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs'

const url = process.argv[2]
const out = process.argv[3]
const w = Number(process.argv[4] || 1440)
const h = Number(process.argv[5] || 900)
const wait = Number(process.argv[6] || 3500)

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
const logs = []
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push('[' + m.type() + '] ' + m.text()) })
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message))
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(wait)
await page.screenshot({ path: out })
console.log(logs.join('\n') || '(no console errors)')
await browser.close()
