/**
 * 浏览器半边。
 *
 * 三件事：
 *   1. 判定"首页"——主视图没有会话，或持有的会话还是空白会话；
 *   2. 把字符场挂到 body 底下、把 frame 底色打透，让首页变成一块桌面；
 *   3. 在 `shell.overlay` 注册 HUD、在 `settings.section` 注册设置页。
 *
 * 组件不直接依赖任何 dsh 客户端包，只用结构化的 ctx，避免 link 安装时的
 * 模块解析问题。
 *
 * @module dsh-os/client
 */

import * as React from 'react'
import { createGlyphField, type FieldHandle } from './field/engine'
import { Boot } from './os/Boot'
import { Desktop, type DesktopActions } from './os/Desktop'
import { OsSettingsPanel } from './os/settings-panel'
import { inkPalette, paletteFor, paletteVars, SettingsStore, type Settings } from './settings'
import { CSS, STYLE_ID } from './styles'
import { basename } from './format'
import type { Geometry, HarnessSession, HarnessSnapshot, LedgerRow, LogLine, MetricsPayload } from './types'

const name = 'dsh-os'
const inject = ['slots', 'sessions', 'uiWorkspace']

const BOOT_KEY = 'dsh-os:booted'
const ENDPOINT = '/plugins/dsh-os/metrics'
const POLL_MS = 2000

const EMPTY_HARNESS: HarnessSnapshot = {
	total: 0,
	running: 0,
	blank: 0,
	workspaces: 0,
	workspace: '—',
	recent: [],
	context: null,
	model: 'default',
	ledger: [],
	totals: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
}

/** 会话列表服务的结构（只取用到的部分）。 */
interface SessionsSource {
	list: {
		getSnapshot: () => {
			ids: string[]
			byId: Record<string, any>
			projectionsBySession?: Record<string, { values?: any } | undefined>
		}
		subscribe: (listener: () => void) => () => void
	}
}

interface ClientContext {
	slots: {
		inject: (slot: string, factory: () => unknown) => () => void
		register: (entry: Record<string, unknown>, component: unknown) => () => void
	}
	sessions: SessionsSource
	uiWorkspace: { openSession: (id: string) => void }
	effect?: (dispose: () => () => void, label?: string) => () => void
}

interface Runtime {
	ctx: ClientContext
	session: Session
	settings: SettingsStore
}

/** 主视图当前持有的会话。 */
function currentSessionId(snapshot: { ids: string[]; byId: Record<string, any> }): string | null {
	for (const id of snapshot.ids) {
		const row = snapshot.byId[id]
		if (row && (row.retainedBy?.mainView ?? 0) > 0) return id
	}
	return null
}

/**
 * 首页判据：主视图没有会话，或持有的会话还是空白会话（hero 正在显示）。
 * 用户一旦发出第一条消息，blank 变假，桌面就退回普通界面。
 */
function isHome(snapshot: { ids: string[]; byId: Record<string, any> }): boolean {
	const id = currentSessionId(snapshot)
	if (id === null) return true
	return snapshot.byId[id]?.blank === true
}

function deriveHarness(snapshot: {
	ids: string[]
	byId: Record<string, any>
	projectionsBySession?: Record<string, { values?: any } | undefined>
}): HarnessSnapshot {
	const rows = snapshot.ids.map((id) => snapshot.byId[id]).filter((row): row is any => Boolean(row))
	if (rows.length === 0) return { ...EMPTY_HARNESS }
	const running = rows.filter((row) => row.running).length
	const blank = rows.filter((row) => row.blank).length
	const cwds = rows.map((row) => row.cwd).filter((value): value is string => Boolean(value))
	const recent: HarnessSession[] = rows
		.filter((row) => !row.blank && row.origin !== 'subagent')
		.sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))
		.slice(0, 5)
		.map((row) => ({
			id: row.id,
			title: row.title ?? row.displayTitle ?? row.id,
			running: Boolean(row.running),
			updatedAt: row.updatedAt ?? Date.now(),
			blank: Boolean(row.blank),
			workspace: row.cwd ?? '',
		}))

	// Token 账本：按会话聚合（投影里没有逐模型的归因，见 README）。
	const projections = (id: string): any =>
		snapshot.projectionsBySession?.[id]?.values ?? snapshot.byId[id]?.projectionValues ?? {}
	const ledger: LedgerRow[] = []
	let totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
	for (const row of rows) {
		if (row.origin === 'subagent') continue
		const values = projections(row.id)
		const usage = values.tokenUsage?.totals ?? {}
		const stats = values.sessionStats ?? {}
		const input = usage.uncachedInputTokens ?? 0
		const output = usage.outputTokens ?? 0
		const cacheRead = usage.cacheReadTokens ?? 0
		const cacheWrite = usage.cacheWriteTokens ?? 0
		if (input + output + cacheRead === 0) continue
		totals = {
			input: totals.input + input,
			output: totals.output + output,
			cacheRead: totals.cacheRead + cacheRead,
			cacheWrite: totals.cacheWrite + cacheWrite,
		}
		ledger.push({
			id: row.id,
			title: row.title ?? row.displayTitle ?? row.id,
			preset: typeof values.agentPreset === 'string' && values.agentPreset ? values.agentPreset : 'default',
			input,
			output,
			cacheRead,
			cacheRatio: input + cacheRead > 0 ? cacheRead / (input + cacheRead) : 0,
			tps: stats.decodeMs > 0 ? stats.decodeTokens / (stats.decodeMs / 1000) : null,
		})
	}
	ledger.sort((left, right) => right.input + right.output - (left.input + left.output))

	const activeId = currentSessionId(snapshot)
	const target =
		(activeId ? snapshot.byId[activeId] : null) ??
		rows.slice().sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))[0]
	const values = target ? projections(target.id) : {}
	const usage = values.tokenUsage as { totals?: Record<string, number> } | undefined
	const pressure = values.contextPressure as
		| { pressureTokens?: number; projectedTokens?: number; contextWindow?: number }
		| undefined
	const workspace = activeId ? snapshot.byId[activeId]?.cwd : recent[0]?.workspace
	return {
		total: rows.length,
		running,
		blank,
		workspaces: new Set(cwds).size,
		workspace: basename(workspace),
		recent,
		ledger: ledger.slice(0, 6),
		totals,
		model: typeof values.agentPreset === 'string' && values.agentPreset ? values.agentPreset : 'default',
		context: target
			? {
					sessionTitle: target.title ?? target.displayTitle ?? target.id,
					pressure: pressure?.pressureTokens ?? null,
					projected: pressure?.projectedTokens ?? null,
					window: pressure?.contextWindow ?? null,
					input: usage?.totals?.uncachedInputTokens ?? 0,
					output: usage?.totals?.outputTokens ?? 0,
					cacheRead: usage?.totals?.cacheReadTokens ?? 0,
					cacheWrite: usage?.totals?.cacheWriteTokens ?? 0,
				}
			: null,
	}
}

/** 量几何：中央列与 hero 在视口里的位置。找不到就给一个保守的整窗。 */
function measure(): Geometry {
	const view = { w: window.innerWidth, h: window.innerHeight }
	const colEl =
		document.querySelector('[class*="_centerCol"]') ??
		document.querySelector('[data-slot="root"] > div > :nth-child(2)') ??
		null
	const heroEl = document.querySelector('[class*="_composerHero"]')
	const box = (element: Element | null): { x: number; y: number; w: number; h: number } | null => {
		if (!element) return null
		const rect = element.getBoundingClientRect()
		if (rect.width < 40 || rect.height < 20) return null
		return { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
	}
	const col = box(colEl) ?? { x: 0, y: 0, w: view.w, h: view.h }
	return { col, hero: box(heroEl), view }
}

function prefersReducedMotion(): boolean {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * 首页的内容根节点自带不透明底色（`var(--dsw-alias-bg-base)`），会把字符场挡死。
 * 它的类名是 CSS Module 哈希、不可依赖，所以从 hero 往上走到中央列，把真正铺底的
 * 那几层标出来。
 */
function clearPaintLayers(active: boolean): void {
	for (const element of document.querySelectorAll('.dos-paint-through')) element.classList.remove('dos-paint-through')
	if (!active) return
	const hero = document.querySelector('[class*="_composerHero"]')
	const column = document.querySelector('[class*="_centerCol"]')
	let node: Element | null = hero?.parentElement ?? column
	while (node && node !== document.body) {
		const background = getComputedStyle(node).backgroundColor
		const opaque = background && background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent'
		const full = node.getBoundingClientRect().height >= (column?.getBoundingClientRect().height ?? 0) * 0.6
		if (opaque && full) node.classList.add('dos-paint-through')
		if (node === column) break
		node = node.parentElement
	}
}

/** 全息展台：去掉顶栏与任务栏后的中央区块。 */
function stageRect(geometry: Geometry): { x: number; y: number; w: number; h: number } {
	return {
		x: geometry.col.x,
		y: geometry.col.y + 46,
		w: geometry.col.w,
		h: Math.max(240, geometry.col.h - 120),
	}
}

/** hero 让位区：向外放宽一圈，让渐隐过渡自然。 */
function heroClearRect(geometry: Geometry): { x: number; y: number; w: number; h: number } | null {
	if (!geometry.hero) return null
	const { x, y, w, h } = geometry.hero
	return { x: x - 24, y: y - 24, w: w + 48, h: h + 48 }
}

function logLine(tag: string, msg: string, tone?: 'mag' | 'warn'): LogLine {
	return { at: Date.now(), tag, msg, tone }
}

/** 由真实变化生成控制台日志（节流，避免刷屏）。 */
function makeLogger() {
	let last = 0
	let lines: LogLine[] = [logLine('dsh-os', '1.0.0 · glyph field linked'), logLine('telemetry', `${ENDPOINT} online`)]
	return {
		get lines(): LogLine[] {
			return lines
		},
		push(tag: string, msg: string, tone?: 'mag' | 'warn'): boolean {
			const now = Date.now()
			if (now - last < 800) return false
			last = now
			lines = [...lines.slice(-39), { at: now, tag, msg, tone }]
			return true
		},
	}
}

/** 打开宿主设置面板：点侧边栏最下面那颗 Settings。 */
function openHostSettings(): void {
	const sidebar = document.querySelector('[class*="_sidebarCol"]')
	if (!sidebar) return
	const candidates = [...sidebar.querySelectorAll('button, [role="button"]')]
	const target = candidates.find((element) => /^(settings|设置)$/i.test((element.textContent ?? '').trim()))
	if (target instanceof HTMLElement) target.click()
}

/** 一次生命周期内共享的运行时：DOM 层、字段引擎、偏好。 */
class Session {
	readonly ctx: ClientContext
	readonly settings: SettingsStore
	layer: HTMLDivElement | null = null
	field: FieldHandle | null = null
	darkAdded = false
	active = false

	constructor(ctx: ClientContext, settings: SettingsStore) {
		this.ctx = ctx
		this.settings = settings
	}

	/** 进入"桌面"：打透 frame、上深色盘、挂字符场、上皮肤。 */
	activate(): void {
		if (this.active) return
		this.active = true
		document.documentElement.classList.add('dsh-os-live')
		clearPaintLayers(true)
		if (!document.body.hasAttribute('data-ds-dark-theme')) {
			document.body.setAttribute('data-ds-dark-theme', '')
			this.darkAdded = true
		}
		this.applyTheme()
		this.syncField()
	}

	deactivate(): void {
		if (!this.active) return
		this.active = false
		document.documentElement.classList.remove('dsh-os-live')
		this.applyTheme()
		if (this.darkAdded) {
			document.body.removeAttribute('data-ds-dark-theme')
			this.darkAdded = false
		}
		this.unmountField()
		clearPaintLayers(false)
	}

	/** 主题色写进 CSS 变量；字符场同步换图集。 */
	applyTheme(): void {
		const root = document.documentElement
		const settings = this.settings.value
		const palette = paletteFor(settings)
		if (this.active) {
			for (const [property, value] of Object.entries(paletteVars(palette))) root.style.setProperty(property, value)
		} else {
			for (const property of Object.keys(paletteVars(palette))) root.style.removeProperty(property)
		}
		root.classList.toggle('dsh-os-skin-sidebar', this.active && settings.skinSidebar)
		root.classList.toggle('dsh-os-skin-composer', this.active && settings.skinComposer)
		this.field?.setPalette(inkPalette(palette), palette.key)
	}

	/** 让字符场跟随图案设置：关就卸、换图案就重建。 */
	syncField(): void {
		if (!this.active) return
		const pattern = this.settings.value.pattern
		if (pattern === 'off') {
			this.unmountField()
			return
		}
		if (this.field) {
			this.unmountField()
		}
		this.mountField(pattern)
	}

	mountField(pattern: Settings['pattern']): void {
		if (this.layer || pattern === 'off') return
		const layer = document.createElement('div')
		layer.id = 'dsh-os-field'
		const canvas = document.createElement('canvas')
		layer.appendChild(canvas)
		document.body.appendChild(layer)
		this.layer = layer
		this.field = createGlyphField(canvas, { pattern, reduced: prefersReducedMotion() })
		this.field.setPalette(inkPalette(paletteFor(this.settings.value)), paletteFor(this.settings.value).key)
		const geometry = measure()
		this.field.setClearRect(heroClearRect(geometry))
		this.field.setStage(stageRect(geometry))
		this.field.start()
	}

	unmountField(): void {
		this.field?.destroy()
		this.field = null
		this.layer?.remove()
		this.layer = null
	}

	openSession(id: string): void {
		this.ctx.uiWorkspace.openSession(id)
	}
}

/** HUD 组件：所有状态都在这里，插槽只负责把 DOM 送进渲染树。 */
function DesktopView({ runtime }: { runtime: Runtime }): JSX.Element {
	const { session, settings: settingsStore } = runtime
	const settings = React.useSyncExternalStore(settingsStore.subscribe, () => settingsStore.value)
	const [metrics, setMetrics] = React.useState<MetricsPayload | null>(null)
	const [harness, setHarness] = React.useState<HarnessSnapshot>(EMPTY_HARNESS)
	const [geometry, setGeometry] = React.useState<Geometry>(() => measure())
	const [now, setNow] = React.useState(() => Date.now())
	const [fps, setFps] = React.useState(0)
	const [home, setHome] = React.useState(() => isHome(session.ctx.sessions.list.getSnapshot()))
	const [booting, setBooting] = React.useState(false)
	const [, forceLog] = React.useState(0)
	const logger = React.useRef(makeLogger())
	const previous = React.useRef<{ cpu: number; mem: number; net: number; runningIds: Set<string>; total: number }>({
		cpu: 0,
		mem: 0,
		net: 0,
		runningIds: new Set(),
		total: 0,
	})

	// 指标轮询：页面隐藏时停表。
	React.useEffect(() => {
		let alive = true
		let timer = 0
		const tick = async (): Promise<void> => {
			if (!alive) return
			if (document.hidden) {
				timer = window.setTimeout(tick, POLL_MS)
				return
			}
			try {
				const response = await fetch(ENDPOINT, { cache: 'no-store', credentials: 'same-origin' })
				if (response.ok) {
					const payload = (await response.json()) as MetricsPayload
					if (alive) setMetrics(payload)
				}
			} catch {
				/* 宿主端点暂不可用时保持上一帧 */
			}
			timer = window.setTimeout(tick, POLL_MS)
		}
		void tick()
		return () => {
			alive = false
			window.clearTimeout(timer)
		}
	}, [])

	// 会话快照订阅。
	React.useEffect(() => {
		const source = session.ctx.sessions.list
		const update = (): void => {
			const snapshot = source.getSnapshot()
			setHarness(deriveHarness(snapshot))
			setHome(isHome(snapshot))
		}
		update()
		return source.subscribe(update)
	}, [session])

	// 秒表：时钟与相对时间共用。
	React.useEffect(() => {
		const timer = window.setInterval(() => setNow(Date.now()), 1000)
		return () => window.clearInterval(timer)
	}, [])

	// 几何测量：hero 异步挂载且不一定触发列 resize，所以低频轮询兜底。
	React.useEffect(() => {
		const measureNow = (): void => setGeometry(measure())
		measureNow()
		window.addEventListener('resize', measureNow)
		const observer = new ResizeObserver(measureNow)
		const target = document.querySelector('[class*="_centerCol"]') ?? document.body
		observer.observe(target)
		const timer = window.setInterval(measureNow, 1200)
		return () => {
			window.removeEventListener('resize', measureNow)
			observer.disconnect()
			window.clearInterval(timer)
		}
	}, [home])

	// 激活 / 关闭：桌面层跟随首页状态与设置。
	React.useEffect(() => {
		if (home && settings.enabled) session.activate()
		else session.deactivate()
		session.applyTheme()
	}, [home, settings.enabled, settings.skinSidebar, settings.skinComposer, settings.accent, settings.custom, session])

	// 图案切换：重建字符场。
	React.useEffect(() => {
		session.syncField()
	}, [settings.pattern, home, settings.enabled, session])

	// 首屏开机自检。
	React.useEffect(() => {
		if (!home || !settings.enabled || !settings.boot) return
		if (window.sessionStorage.getItem(BOOT_KEY) === '1') return
		setBooting(true)
	}, [home, settings.enabled, settings.boot])

	// 字符场信号 + 让位区。
	React.useEffect(() => {
		if (!session.field) return
		session.field.setSignal({
			cpu: metrics?.cpu.total ?? 0,
			mem: metrics?.mem.percent ?? 0,
			rx: metrics?.net.rxBps ?? 0,
			tx: metrics?.net.txBps ?? 0,
			load: metrics?.load[0] ?? 0,
			running: harness.running,
		})
		session.field.setClearRect(heroClearRect(geometry))
		session.field.setStage(stageRect(geometry))
	}, [metrics, harness.running, geometry, settings.pattern, home])

	React.useEffect(() => {
		const timer = window.setInterval(() => setFps(session.field?.fps() ?? 0), 1000)
		return () => window.clearInterval(timer)
	}, [session, settings.pattern, home])

	// 真实变化 → 控制台日志。
	React.useEffect(() => {
		if (!metrics) return
		const before = previous.current
		let dirty = false
		const net = metrics.net.rxBps + metrics.net.txBps
		if (metrics.cpu.total >= 85 && before.cpu < 85) dirty = logger.current.push('cpu', `saturation ${Math.round(metrics.cpu.total)}%`, 'warn') || dirty
		if (metrics.mem.percent >= 88 && before.mem < 88) dirty = logger.current.push('mem', `pressure ${Math.round(metrics.mem.percent)}%`, 'warn') || dirty
		if (net > 3_000_000 && before.net <= 3_000_000) dirty = logger.current.push('net', `burst ${Math.round(net / 1024)}K/s`) || dirty
		if (metrics.node.lagMs > 45) dirty = logger.current.push('node', `event loop lag ${metrics.node.lagMs.toFixed(0)}ms`, 'warn') || dirty
		previous.current = { ...before, cpu: metrics.cpu.total, mem: metrics.mem.percent, net }
		if (dirty) forceLog((value) => value + 1)
	}, [metrics])

	React.useEffect(() => {
		const before = previous.current
		const runningIds = new Set(harness.recent.filter((row) => row.running).map((row) => row.id))
		const started = [...runningIds].filter((id) => !before.runningIds.has(id))
		const stopped = [...before.runningIds].filter((id) => !runningIds.has(id))
		let dirty = false
		for (const id of started) {
			const title = harness.recent.find((row) => row.id === id)?.title ?? id.slice(0, 8)
			dirty = logger.current.push('agent', `running · ${title}`, 'mag') || dirty
		}
		for (const id of stopped) {
			const title = harness.recent.find((row) => row.id === id)?.title ?? id.slice(0, 8)
			dirty = logger.current.push('agent', `idle · ${title}`) || dirty
		}
		if (harness.total !== before.total) {
			dirty = logger.current.push('session', `catalogue ${before.total} → ${harness.total}`) || dirty
		}
		previous.current = { ...before, runningIds, total: harness.total }
		if (dirty) forceLog((value) => value + 1)
	}, [harness])

	const actions: DesktopActions = {
		openSession: (id) => session.openSession(id),
		toggleField: () => settingsStore.set({ pattern: settings.pattern === 'off' ? 'rain' : 'off' }),
		replayBoot: () => {
			window.sessionStorage.setItem(BOOT_KEY, '1')
			setBooting(true)
		},
		hide: () => settingsStore.set({ enabled: false }),
		openSettings: () => openHostSettings(),
	}

	const finishBoot = (): void => {
		window.sessionStorage.setItem(BOOT_KEY, '1')
		setBooting(false)
	}

	return (
		<>
			<Desktop
				metrics={metrics}
				harness={harness}
				logs={logger.current.lines}
				settings={settings}
				geometry={geometry}
				now={now}
				fps={fps}
				active={home && settings.enabled}
				actions={actions}
			/>
			{booting && home && <Boot metrics={metrics} harness={harness} onDone={finishBoot} />}
		</>
	)
}

function installStyles(): () => void {
	const existing = document.getElementById(STYLE_ID)
	existing?.remove()
	const style = document.createElement('style')
	style.id = STYLE_ID
	style.textContent = CSS
	document.head.appendChild(style)
	return () => style.remove()
}

function installShortcuts(session: Session): () => void {
	const onKey = (event: KeyboardEvent): void => {
		if (event.isComposing || event.keyCode === 229) return
		const target = event.target as HTMLElement | null
		if (target && (target.isContentEditable || /input|textarea|select/i.test(target.tagName))) return
		if (event.key === '`' || event.key === '~') {
			event.preventDefault()
			session.settings.set({ enabled: !session.settings.value.enabled })
		}
	}
	document.addEventListener('keydown', onKey)
	return () => document.removeEventListener('keydown', onKey)
}

export function apply(ctx: ClientContext): void {
	const scope = globalThis as typeof globalThis & { __dshOs?: { dispose: () => void } }
	scope.__dshOs?.dispose()

	const disposeStyles = installStyles()
	const settings = new SettingsStore()
	const session = new Session(ctx, settings)
	const disposeShortcuts = installShortcuts(session)
	const runtime: Runtime = { ctx, session, settings }

	const disposeHud = ctx.slots.inject('shell.overlay', () =>
		ctx.slots.register(
			{
				name: 'shell.overlay',
				id: 'dsh-os',
				order: 4,
				inject: () => ({ runtime }),
			},
			DesktopView,
		),
	)

	const disposeSettings = ctx.slots.inject('settings.section', () =>
		ctx.slots.register(
			{
				name: 'settings.section',
				id: 'dsh-os',
				order: 88,
				label: () => 'Harness OS',
				inject: () => ({ store: settings }),
			},
			OsSettingsPanel,
		),
	)

	const onVisibility = (): void => {
		if (!session.field) return
		if (document.hidden) session.field.stop()
		else session.field.start()
	}
	document.addEventListener('visibilitychange', onVisibility)

	const dispose = (): void => {
		document.removeEventListener('visibilitychange', onVisibility)
		disposeShortcuts()
		disposeHud()
		disposeSettings()
		disposeStyles()
		session.deactivate()
		scope.__dshOs = undefined
	}
	scope.__dshOs = { dispose }
	;(window as typeof window & { __dshOsState?: () => unknown }).__dshOsState = () => ({
		home: isHome(ctx.sessions.list.getSnapshot()),
		settings: settings.value,
		active: session.active,
		field: Boolean(session.field),
		snapshot: ctx.sessions.list.getSnapshot(),
	})
	if (ctx.effect) ctx.effect(() => dispose, 'dsh-os: desktop')
}

export { inject, name }
