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
import type { Geometry, HarnessPayload, HarnessSessionRow, LogLine, MetricsPayload, ModelUsageRow, ScopeStats } from '../src/client/types'

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
  tone: (params.get('tone') as Settings['tone']) ?? 'dark',
  boot: params.has('boot'),
  enabled: true,
  skinComposer: true,
  ledger: true,
  scope: 'space',
}
const settings = store.value
const tone = settings.tone === 'auto' ? 'dark' : settings.tone
document.documentElement.dataset.dosTone = tone
const palette = paletteFor(settings, tone)
for (const [property, value] of Object.entries(paletteVars(palette))) document.documentElement.style.setProperty(property, value)

// ?win=1 模拟没有 /proc、/sys 的平台（Windows/macOS）下的布局
const winMode = params.get('win') === '1'

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
  cap: { perCore: true, freq: !winMode, swap: !winMode, net: !winMode, disk: true, power: !winMode, proc: !winMode, load: !winMode },
}
if (winMode) {
  metrics.net = { iface: '—', rxBps: 0, txBps: 0, rxTotal: 0, txTotal: 0 }
  metrics.cpu.freqs = metrics.cpu.freqs.map(() => null)
  metrics.power = { cpuTempC: null, batteryPercent: null, batteryTempC: null, batteryStatus: null }
  metrics.proc = { total: 0, running: 0, tasks: 0, top: [] }
}

const now = Date.now()
const HOUR = 3_600_000
const DAY = 24 * HOUR

function totals(sessions: number, input: number, output: number, cacheRead: number) {
  return { sessions, input, output, cacheRead, cacheWrite: 0 }
}

function stats(over: Partial<ScopeStats>): ScopeStats {
  const base: ScopeStats = {
    sessions: 27,
    active: 14,
    running: 1,
    subagents: 2,
    blank: 3,
    today: { sessions: 6, input: 3_140_000, output: 248_000, cacheRead: 12_400_000 },
    lastActiveAt: now - 40_000,
    tokens: { input: 41_200_000, output: 3_840_000, cacheRead: 168_000_000, cacheWrite: 96_000 },
    windows: {
      h24: totals(6, 3_140_000, 248_000, 12_400_000),
      d7: totals(14, 12_800_000, 980_000, 52_000_000),
      all: totals(27, 41_200_000, 3_840_000, 168_000_000),
    },
    topModel: 'cpa/medium',
  }
  return { ...base, ...over }
}

function models(over: Partial<ModelUsageRow>[] = []): ModelUsageRow[] {
  return over.map((row) => ({
    model: 'medium',
    provider: 'cpa',
    sessions: 12,
    input: 18_400_000,
    output: 1_640_000,
    cacheRead: 76_000_000,
    cacheWrite: 0,
    tps: 62,
    cacheRatio: 0.8,
    lastAt: now - 40_000,
    lastSessionId: 'a',
    windows: {
      h24: totals(4, 2_400_000, 180_000, 9_100_000),
      d7: totals(9, 8_200_000, 640_000, 31_000_000),
      all: totals(12, 18_400_000, 1_640_000, 76_000_000),
    },
    ...row,
  })) as ModelUsageRow[]
}

function sessions(ids: string[]): HarnessSessionRow[] {
  const pool: HarnessSessionRow[] = [
    { id: 'a', title: 'dsh-os 首页 HUD 重构', cwd: '/root/projects/dsh-os', workspace: 'dsh-os', model: 'cpa/medium', input: 5_420_000, output: 612_000, cacheRead: 42_000_000, running: true, subagentActive: false, subagents: 2, subagent: false, updatedAt: now - 40_000, blank: false },
    { id: 'b', title: '会话投影索引与账本口径', cwd: '/root/projects/dsh-os', workspace: 'dsh-os', model: 'cpa/medium', input: 2_140_000, output: 288_000, cacheRead: 18_200_000, running: false, subagentActive: false, subagents: 0, subagent: false, updatedAt: now - 3 * HOUR, blank: false },
    { id: 'c', title: '排队中的 lint 清理', cwd: '/root/projects/dsh-os', workspace: 'dsh-os', model: 'cpa/low', input: 620_000, output: 84_000, cacheRead: 4_400_000, running: false, subagentActive: false, subagents: 0, subagent: false, updatedAt: now - 9 * HOUR, blank: false },
    { id: 'd', title: '代理节点健康检查', cwd: '/root/projects/proxy', workspace: 'proxy', model: 'cpa/lite', input: 3_400_000, output: 520_000, cacheRead: 26_000_000, running: false, subagentActive: false, subagents: 0, subagent: false, updatedAt: now - 5 * HOUR, blank: false },
  ]
  return ids.map((id) => pool.find((row) => row.id === id)!).filter(Boolean)
}

const harness: HarnessPayload = {
  t: now,
  store: { ok: true, root: '/root/.dsh/storages', sessions: 3487, scannedAt: now - 8_000, partial: false, error: null },
  scope: { path: '/root/projects/dsh-os', name: 'dsh-os' },
  space: stats({ sessions: 9, active: 4, running: 2, subagents: 2 }),
  all: stats({}),
  models: {
    space: models([
      { model: 'medium', sessions: 4, input: 7_560_000, output: 900_000, cacheRead: 60_200_000, tps: 74, cacheRatio: 0.89 },
      { model: 'omni', sessions: 1, input: 1_960_000, output: 402_000, cacheRead: 8_600_000, tps: 90, cacheRatio: 0.81 },
      { model: 'low', sessions: 3, input: 1_140_000, output: 152_000, cacheRead: 4_800_000, tps: 98, cacheRatio: 0.81 },
      { model: 'high', sessions: 1, input: 890_000, output: 176_000, cacheRead: 6_400_000, tps: 44, cacheRatio: 0.88 },
    ]),
    all: models([
      { model: 'lite', provider: 'cpa', sessions: 792, input: 412_000_000, output: 24_800_000, cacheRead: 1_240_000_000, tps: 76, cacheRatio: 0.75 },
      { model: 'medium', sessions: 711, input: 388_000_000, output: 28_400_000, cacheRead: 1_180_000_000, tps: 114, cacheRatio: 0.75 },
      { model: 'omni', sessions: 505, input: 240_000_000, output: 18_200_000, cacheRead: 720_000_000, tps: 196, cacheRatio: 0.75 },
      { model: 'high', sessions: 343, input: 180_000_000, output: 14_800_000, cacheRead: 520_000_000, tps: 88, cacheRatio: 0.74 },
      { model: '', provider: '', sessions: 472, input: 160_000_000, output: 12_400_000, cacheRead: 480_000_000, tps: 64, cacheRatio: 0.75 },
    ]),
  },
  sessions: sessions(['a', 'b', 'c']),
  sessionsAll: sessions(['a', 'b', 'c', 'd']),
  running: sessions(['a']).map((row) => ({ ...row, running: true })),
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
    field.setSurface(tone)
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
        now={now} fps={10} active window="all"
        actions={{
          openSession: () => {},
          toggleField: () => {},
          replayBoot: () => {},
          openSettings: () => {},
          setScope: (scope) => store.set({ scope }),
          setTone: (next) => store.set({ tone: next }),
          setWindow: () => {},
        }}
      />
      {settings.boot && <Boot metrics={metrics} harness={harness} onDone={() => {}} />}
    </>
  )
}

createRoot(document.getElementById('stage')!).render(<App />)
