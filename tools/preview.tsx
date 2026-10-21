/**
 * 设计预览页：用一份假数据把 Desktop + 字符场渲染出来，方便截图迭代。
 * 不参与插件产物。?pattern=rain|field|off  ?accent=dsh|cyan|magenta|amber|mono  ?settings=1
 */
import { createRoot } from 'react-dom/client'
import { useEffect, useRef } from 'react'
import { createGlyphField } from '../src/client/field/engine'
import { Desktop } from '../src/client/os/Desktop'
import { Boot } from '../src/client/os/Boot'
import { OsSettingsPanel } from '../src/client/os/settings-panel'
import { inkPalette, paletteFor, paletteVars, SettingsStore, type Settings } from '../src/client/settings'
import { CSS, STYLE_ID } from '../src/client/styles'
import type { Geometry, HarnessSnapshot, LogLine, MetricsPayload } from '../src/client/types'

const style = document.createElement('style')
style.id = STYLE_ID
style.textContent = CSS
document.head.appendChild(style)

const params = new URLSearchParams(location.search)
const view = { w: innerWidth, h: innerHeight }
const heroW = Math.min(806, view.w - 40)
const hero = { x: (view.w - heroW) / 2, y: Math.round(view.h * 0.42), w: heroW, h: 238 }
const geometry: Geometry = { col: { x: 0, y: 0, w: view.w, h: view.h }, hero, view }

const store = new SettingsStore()
store.value = {
  ...store.value,
  pattern: (params.get('pattern') as Settings['pattern']) ?? 'rain',
  accent: (params.get('accent') as Settings['accent']) ?? 'dsh',
  boot: params.has('boot'),
  enabled: true,
  skinSidebar: true,
  skinComposer: true,
  ledger: true,
}
const settings = store.value
const palette = paletteFor(settings)
for (const [property, value] of Object.entries(paletteVars(palette))) document.documentElement.style.setProperty(property, value)

const history = (base: number, amp: number): number[] =>
  Array.from({ length: 60 }, (_, index) => Math.max(0, base + Math.sin(index / 5) * amp + Math.sin(index / 2.3) * amp * 0.4))

const metrics: MetricsPayload = {
  t: Date.now(),
  host: { hostname: 'workstation', kernel: '6.8.0-generic', platform: 'linux', arch: 'x64', model: 'Generic x86_64', cores: 8, memTotalKb: 16777216, uptimeSec: 7936 },
  cpu: { total: 37.4, cores: [27.2, 24.4, 21.6, 27.7, 4.9, 2.9, 9.8, 18.2], freqs: [691, 691, 691, 691, 2246, 2246, 2246, 845], user: 9.5, system: 5.6, iowait: 0.2, steal: 0 },
  mem: { total: 16777216, available: 6133156, free: 1441028, buffers: 1316, cached: 5276972, dirty: 2276, swapTotal: 8388604, swapFree: 6771300, slab: 467196, used: 10639892, percent: 63.4 },
  load: [0.82, 1.16, 1.39],
  net: { iface: 'wlan0', rxBps: 10832, txBps: 524718, rxTotal: 442987828, txTotal: 1149402353 },
  disk: { total: 114896646144, used: 99338899456, free: 15557746688 },
  power: { cpuTempC: 45.8, batteryPercent: 86, batteryTempC: 35.2, batteryStatus: 'Discharging' },
  proc: { total: 953, running: 5, tasks: 953, top: [] },
  node: { pid: 4558, rss: 486_000_000, heapUsed: 210_000_000, heapTotal: 320_000_000, external: 40_000_000, uptimeSec: 29410, lagMs: 0.4, elu: 3.2, version: 'v22.23.2' },
  history: { at: history(0, 1), cpu: history(30, 18), mem: history(70, 3), rx: history(300_000, 240_000), tx: history(240_000, 180_000) },
}

const now = Date.now()
const harness: HarnessSnapshot = {
  total: 27,
  running: 1,
  blank: 3,
  workspaces: 9,
  workspace: 'dsh-os',
  model: 'medium',
  recent: [
    { id: 'a', title: 'dsh-os: cyberpunk home page', running: true, updatedAt: now - 20_000, blank: false, workspace: '/root/projects/dsh-os' },
    { id: 'b', title: 'fix token meter projection', running: false, updatedAt: now - 3_600_000, blank: false, workspace: '/root/projects/dsh-os' },
    { id: 'c', title: 'stage-ai reader refactor', running: false, updatedAt: now - 7_200_000, blank: false, workspace: '/root/projects/stage-ai' },
    { id: 'd', title: 'luna 记忆整理', running: false, updatedAt: now - 86_400_000, blank: false, workspace: '/root/agents/luna' },
  ],
  ledger: [
    { id: 'a', title: 'dsh-os: cyberpunk home page', preset: 'medium', input: 1_240_000, output: 38_400, cacheRead: 1_100_000, cacheRatio: 0.89, tps: 41 },
    { id: 'b', title: 'fix token meter projection', preset: 'medium', input: 640_000, output: 24_100, cacheRead: 512_000, cacheRatio: 0.8, tps: 38 },
    { id: 'c', title: 'stage-ai reader refactor', preset: 'high', input: 512_000, output: 19_800, cacheRead: 480_000, cacheRatio: 0.94, tps: 22 },
    { id: 'd', title: 'luna 记忆整理', preset: 'low', input: 220_000, output: 12_400, cacheRead: 190_000, cacheRatio: 0.86, tps: 55 },
  ],
  totals: { input: 3_912_000, output: 128_400, cacheRead: 3_420_000, cacheWrite: 96_000 },
  context: { sessionTitle: 'dsh-os: cyberpunk home page', pressure: 84_200, projected: 91_600, window: 128_000, input: 1_240_000, output: 38_400, cacheRead: 1_200_000, cacheWrite: 42_000 },
}

const logs: LogLine[] = [
  { at: now - 14_000, tag: 'sys', msg: 'cpu 17% · mem 72% · net ↓10.8K/s ↑524K/s' },
  { at: now - 9_000, tag: 'agent', msg: 'running · dsh-os: cyberpunk home page', tone: 'mag' },
  { at: now - 4_000, tag: 'glyph', msg: 'field topology rebuilt · 1136 cells' },
  { at: now - 1_000, tag: 'node', msg: 'event loop lag 0.4ms · rss 486M' },
]

function App(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!canvasRef.current || settings.pattern === 'off') return
    const field = createGlyphField(canvasRef.current, { pattern: settings.pattern })
    field.setPalette(inkPalette(palette), palette.key)
    field.setSignal({ cpu: metrics.cpu.total, mem: metrics.mem.percent, rx: metrics.net.rxBps, tx: metrics.net.txBps, load: metrics.load[0], running: 1 })
    field.setClearRect({ x: hero.x - 24, y: hero.y - 24, w: hero.w + 48, h: hero.h + 48 })
    field.setStage({ x: 0, y: 46, w: view.w, h: view.h - 120 })
    field.start()
    return () => field.destroy()
  }, [])

  if (params.has('settings')) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#fff', overflow: 'auto', padding: '32px 48px', fontFamily: 'sans-serif' }}>
        <OsSettingsPanel store={store} />
      </div>
    )
  }

  return (
    <>
      {settings.pattern !== 'off' && (
        <div id="dsh-os-field">
          <canvas ref={canvasRef} />
        </div>
      )}
      <div
        style={{
          position: 'fixed', left: hero.x, top: hero.y + 40, width: hero.w, height: 120,
          display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 22,
          color: 'rgba(var(--dos-rgb),.45)', fontFamily: 'ui-monospace, monospace', fontSize: 13,
          letterSpacing: '.06em', background: 'linear-gradient(180deg, rgba(6,12,19,.96), rgba(3,7,12,.98))',
          border: '1px solid rgba(var(--dos-rgb),.35)', borderRadius: 2, boxShadow: '0 24px 60px -30px #000, 0 0 24px -8px var(--dos-cy)',
        }}
      >
        Describe what you want to build, / commands, @ files or sessions
      </div>
      <Desktop
        metrics={metrics} harness={harness} logs={logs} settings={settings} geometry={geometry}
        now={now} fps={10} active
        actions={{ openSession: () => {}, toggleField: () => {}, replayBoot: () => {}, hide: () => {}, openSettings: () => {} }}
      />
      {settings.boot && <Boot metrics={metrics} harness={harness} onDone={() => {}} />}
    </>
  )
}

createRoot(document.getElementById('stage')!).render(<App />)
