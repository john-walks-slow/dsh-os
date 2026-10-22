/**
 * 浏览器半边。
 *
 * 四件事：
 *   1. 判定"首页"——主视图没有会话，或持有的会话还是空白会话；
 *   2. 把字符场挂到 body 底下、把 frame 底色打透，让首页变成一块桌面；
 *   3. 跟随宿主主题切换深浅墨色；
 *   4. 在 `shell.overlay` 注册 HUD、在 `settings.section` 注册设置页。
 *
 * 组件不直接依赖任何 dsh 客户端包，只用结构化的 ctx，避免 link 安装时的
 * 模块解析问题。
 *
 * @module dsh-os/client
 */

import * as React from 'react'
import { createGlyphField, type FieldHandle } from './field/engine'
import { emptyHarness, fetchHarness } from './harness'
import { Boot } from './os/Boot'
import { Desktop, type DesktopActions } from './os/Desktop'
import { OsSettingsPanel } from './os/settings-panel'
import { accentOf, SettingsStore, type Settings } from './settings'
import { inkPaletteFor, skinVars, themeLayer } from './skin/palette'
import { readStrip, SessionStrip, type StripData } from './skin/strip'
import { CSS, STYLE_ID } from './styles'
import { HostTheme, resolveTone } from './theme'
import type { Geometry, HarnessPayload, LedgerWindow, LogLine, MetricsPayload } from './types'

const name = 'dsh-os'
const inject = ['slots', 'sessions', 'uiWorkspace', 'theme']

const BOOT_KEY = 'dsh-os:booted'
const METRICS_ENDPOINT = '/plugins/dsh-os/metrics'
const METRICS_MS = 2000
const HARNESS_MS = 5000

/** 会话列表服务的结构（只取用到的部分）。 */
interface SessionsSource {
	list: {
		getSnapshot: () => {
			ids: string[]
			byId: Record<string, any>
			projectionsBySession?: Record<string, { values?: any; state?: string } | undefined>
		}
		subscribe: (listener: () => void) => () => void
	}
}

interface ClientContext {
	slots: {
		inject: (slot: string, factory: () => unknown) => () => void
		register: (entry: Record<string, unknown>, component: unknown) => () => void
	}
	sessions: SessionsSource & { refreshProjections?: (id: string) => Promise<void> }
	uiWorkspace: { openSession: (id: string) => void }
	theme?: { getTheme: () => { preference: string; active: { colorScheme: 'light' | 'dark' } }; setTheme: (id: string) => void }
	on?: (event: string, listener: (snapshot: any) => void) => unknown
	effect?: (dispose: () => (() => void) | void, label?: string) => () => void
}

interface Runtime {
	ctx: ClientContext
	session: Session
	settings: SettingsStore
	theme: HostTheme
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

/**
 * 当前工作区：主视图持有的会话优先，其次是 hero 正在准备的空白会话，
 * 最后退回最近动过的工作区。桌面上的账本口径、"最近会话"都跟着它走。
 */
function currentWorkspace(snapshot: { ids: string[]; byId: Record<string, any> }): string {
	const rows = snapshot.ids.map((id) => snapshot.byId[id]).filter((row): row is any => Boolean(row?.cwd))
	if (rows.length === 0) return ''
	const retained = rows.find((row) => (row.retainedBy?.mainView ?? 0) > 0)
	if (retained) return retained.cwd as string
	const blanks = rows.filter((row) => row.blank)
	const pool = blanks.length > 0 ? blanks : rows
	return pool.slice().sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))[0]?.cwd ?? ''
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
	return { col, hero: box(heroEl), session: box(document.querySelector('[data-conversation-scroll]')), view }
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

/** 由真实变化生成任务栏滚动条（节流，避免刷屏）。 */
function makeLogger() {
	let last = 0
	let lines: LogLine[] = [logLine('dsh-os', '2.0 · session index linked'), logLine('telemetry', `${METRICS_ENDPOINT} online`)]
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

/** 一次生命周期内共享的运行时：DOM 层、字段引擎、偏好、宿主主题。 */
class Session {
	readonly ctx: ClientContext
	readonly settings: SettingsStore
	readonly theme: HostTheme
	layer: HTMLDivElement | null = null
	field: FieldHandle | null = null
	active = false

	constructor(ctx: ClientContext, settings: SettingsStore, theme: HostTheme) {
		this.ctx = ctx
		this.settings = settings
		this.theme = theme
	}

	/** 进入"桌面"：打透 frame、上墨色、挂字符场、上皮肤。 */
	activate(): void {
		if (this.active) return
		this.active = true
		document.documentElement.classList.add('dsh-os-live')
		clearPaintLayers(true)
		this.applyTheme()
		this.syncField()
	}

	deactivate(): void {
		if (!this.active) return
		this.active = false
		document.documentElement.classList.remove('dsh-os-live')
		this.applyTheme()
		this.unmountField()
		clearPaintLayers(false)
	}

	/** 全应用皮肤 + 我们自己的变量；字符场同步换图集与底纸。 */
	applyTheme(): void {
		const root = document.documentElement
		const settings = this.settings.value
		const tone = resolveTone(settings.tone, this.theme.tone)
		const accent = accentOf(settings)
		root.dataset.dosTone = tone
		root.classList.toggle('dsh-os-theme', settings.skin)
		root.classList.toggle('dsh-os-skin-composer', settings.skinComposer)

		if (settings.skin && this.theme.skin) {
			this.theme.applySkin(themeLayer(accent))
		} else {
			this.theme.clearSkin()
		}

		const vars = skinVars(tone, accent)
		if (settings.enabled || settings.skin) {
			for (const [property, value] of Object.entries(vars)) root.style.setProperty(property, value)
		} else {
			for (const property of Object.keys(vars)) root.style.removeProperty(property)
		}
		if (!settings.enabled && !settings.skin) root.removeAttribute('data-dos-tone')

		this.field?.setSurface(tone)
		this.field?.setPalette(inkPaletteFor(tone, accent), accent)
	}

	/** 让字符场跟随图案设置：关就卸、换图案就重建。 */
	syncField(): void {
		if (!this.active) return
		const pattern = this.settings.value.pattern
		if (this.field) this.unmountField()
		if (pattern === 'off') return
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
		const settings = this.settings.value
		const tone = resolveTone(settings.tone, this.theme.tone)
		const accent = accentOf(settings)
		this.field.setSurface(tone)
		this.field.setPalette(inkPaletteFor(tone, accent), accent)
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
	const { session, settings: settingsStore, theme: hostTheme } = runtime
	const settings = React.useSyncExternalStore(settingsStore.subscribe, () => settingsStore.value)
	// 宿主主题变化也要重渲：桌面明暗由它决定。
	React.useSyncExternalStore(hostTheme.subscribe, () => hostTheme.tone)
	const [metrics, setMetrics] = React.useState<MetricsPayload | null>(null)
	const [harness, setHarness] = React.useState<HarnessPayload>(() => emptyHarness())
	const [geometry, setGeometry] = React.useState<Geometry>(() => measure())
	const [now, setNow] = React.useState(() => Date.now())
	const [fps, setFps] = React.useState(0)
	const [ledgerWindow, setLedgerWindow] = React.useState<LedgerWindow>('all')
	const [home, setHome] = React.useState(() => isHome(session.ctx.sessions.list.getSnapshot()))
	const [workspace, setWorkspace] = React.useState(() => currentWorkspace(session.ctx.sessions.list.getSnapshot()))
	const [strip, setStrip] = React.useState<StripData | null>(null)
	const [activeId, setActiveId] = React.useState<string | null>(() => currentSessionId(session.ctx.sessions.list.getSnapshot()))
	const [booting, setBooting] = React.useState(false)
	const [, forceLog] = React.useState(0)
	const logger = React.useRef(makeLogger())
	const previous = React.useRef<{ cpu: number; mem: number; net: number; runningIds: Set<string>; sessions: number }>({
		cpu: 0,
		mem: 0,
		net: 0,
		runningIds: new Set(),
		sessions: 0,
	})
	const live = home && settings.enabled
	const showStrip = !home && settings.strip && strip !== null
	const liveRef = React.useRef(live)
	liveRef.current = live

	// 整机指标轮询：页面隐藏或不在首页时停表。
	React.useEffect(() => {
		let alive = true
		let timer = 0
		const tick = async (): Promise<void> => {
			if (!alive) return
			if (document.hidden || !liveRef.current) {
				timer = window.setTimeout(tick, METRICS_MS)
				return
			}
			try {
				const response = await fetch(METRICS_ENDPOINT, { cache: 'no-store', credentials: 'same-origin' })
				if (response.ok) {
					const payload = (await response.json()) as MetricsPayload
					if (alive) setMetrics(payload)
				}
			} catch {
				/* 宿主端点暂不可用时保持上一帧 */
			}
			timer = window.setTimeout(tick, METRICS_MS)
		}
		void tick()
		return () => {
			alive = false
			window.clearTimeout(timer)
		}
	}, [])

	// 会话账本轮询：口径随当前工作区变化。
	React.useEffect(() => {
		let alive = true
		let timer = 0
		const tick = async (): Promise<void> => {
			if (!alive) return
			if (!liveRef.current) {
				timer = window.setTimeout(tick, HARNESS_MS)
				return
			}
			try {
				const payload = await fetchHarness(workspace)
				if (alive && payload) setHarness(payload)
			} catch {
				/* 同上：端点不可用就保持上一帧 */
			}
			timer = window.setTimeout(tick, HARNESS_MS)
		}
		void tick()
		return () => {
			alive = false
			window.clearTimeout(timer)
		}
	}, [workspace])

	// 会话快照订阅：首页判据与当前工作区都从这里来。
	React.useEffect(() => {
		const source = session.ctx.sessions.list
		const update = (): void => {
			const snapshot = source.getSnapshot()
			setHome(isHome(snapshot))
			setWorkspace(currentWorkspace(snapshot))
			const id = currentSessionId(snapshot)
			setActiveId(id)
			const row = id ? snapshot.byId[id] : null
			const projections = id ? snapshot.projectionsBySession?.[id]?.values : undefined
			setStrip(
				row
					? readStrip({
							...row,
							projectionValues: { ...(row.projectionValues ?? {}), ...(projections ?? {}) },
						} as never)
					: null,
			)
		}
		update()
		return source.subscribe(update)
	}, [session])

	// 打开中的会话：请宿主把昂贵投影（tokenUsage / contextPressure / sessionStats）
	// 算出来——列表级快照只带廉价键，遥测条要的是这些。
	React.useEffect(() => {
		if (home || !activeId) return
		const poke = (): void => {
			void session.ctx.sessions.refreshProjections?.(activeId).catch(() => undefined)
		}
		poke()
		const timer = window.setInterval(poke, 20_000)
		return () => window.clearInterval(timer)
	}, [home, activeId, session])

	// 遥测条出现时给会话流让出高度（结构样式按这个属性加 padding）。
	React.useEffect(() => {
		document.documentElement.toggleAttribute('data-dos-strip', showStrip)
		return () => document.documentElement.removeAttribute('data-dos-strip')
	}, [showStrip])

	// 调试/测试钩子：把当前会话的投影状态摊出来（遥测条的取数是否到位一眼可查）。
	React.useEffect(() => {
		;(window as typeof window & { __dshOsStrip?: () => unknown }).__dshOsStrip = () => {
			const snapshot = session.ctx.sessions.list.getSnapshot()
			const id = currentSessionId(snapshot)
			const block = id ? snapshot.projectionsBySession?.[id] : undefined
			return {
				activeId: id,
				stripReady: strip !== null,
				state: block?.state ?? null,
				keys: block?.values ? Object.keys(block.values) : [],
				tokenUsage: (block?.values as Record<string, unknown> | undefined)?.tokenUsage ?? null,
				hasRefresh: typeof session.ctx.sessions.refreshProjections === 'function',
			}
		}
	}, [session, strip])

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
		if (live) session.activate()
		else session.deactivate()
		session.applyTheme()
	}, [live, settings.enabled, settings.skin, settings.accent, settings.custom, settings.tone, settings.skinComposer, session, hostTheme.tone])

	// 图案切换：重建字符场。
	React.useEffect(() => {
		session.syncField()
	}, [settings.pattern, live, session])

	// 首屏开机自检。
	React.useEffect(() => {
		if (!live || !settings.boot) return
		if (window.sessionStorage.getItem(BOOT_KEY) === '1') return
		setBooting(true)
	}, [live, settings.boot])

	// 字符场信号 + 让位区。
	React.useEffect(() => {
		if (!session.field) return
		session.field.setSignal({
			cpu: metrics?.cpu.total ?? 0,
			mem: metrics?.mem.percent ?? 0,
			rx: metrics?.net.rxBps ?? 0,
			tx: metrics?.net.txBps ?? 0,
			load: metrics?.load[0] ?? 0,
			running: harness.all.running,
		})
		session.field.setClearRect(heroClearRect(geometry))
		session.field.setStage(stageRect(geometry))
	}, [metrics, harness.all.running, geometry, settings.pattern, live])

	React.useEffect(() => {
		const timer = window.setInterval(() => setFps(session.field?.fps() ?? 0), 1000)
		return () => window.clearInterval(timer)
	}, [session, settings.pattern, live])

	// 真实变化 → 滚动事件。
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
		const runningIds = new Set(harness.running.map((row) => row.id))
		let dirty = false
		for (const row of harness.running) {
			if (before.runningIds.has(row.id)) continue
			dirty = logger.current.push('agent', `running · ${row.title}`, 'mag') || dirty
		}
		for (const id of before.runningIds) {
			if (runningIds.has(id)) continue
			dirty = logger.current.push('agent', `idle · ${id.slice(0, 8)}`) || dirty
		}
		if (harness.all.sessions !== before.sessions) {
			dirty = logger.current.push('index', `catalogue ${before.sessions} → ${harness.all.sessions}`) || dirty
		}
		previous.current = { ...before, runningIds, sessions: harness.all.sessions }
		if (dirty) forceLog((value) => value + 1)
	}, [harness])

	const actions: DesktopActions = {
		openSession: (id) => session.openSession(id),
		toggleField: () => settingsStore.set({ pattern: settings.pattern === 'off' ? 'rain' : 'off' }),
		replayBoot: () => {
			window.sessionStorage.setItem(BOOT_KEY, '1')
			setBooting(true)
		},
		openSettings: () => openHostSettings(),
		setScope: (scope) => settingsStore.set({ scope }),
		setTone: (tone) => {
			settingsStore.set({ tone })
			hostTheme.set(tone)
		},
		setWindow: setLedgerWindow,
	}

	const finishBoot = (): void => {
		window.sessionStorage.setItem(BOOT_KEY, '1')
		setBooting(false)
	}

	return (
		<>
			{showStrip && geometry.session && (
				<div
					className="dos-strip-seat"
					style={{
						position: 'fixed',
						left: Math.round(geometry.session.x + 6),
						top: Math.round(geometry.session.y + 3),
						width: Math.round(geometry.session.w - 12),
						pointerEvents: 'none',
						zIndex: 21,
					}}
				>
					<SessionStrip
						data={strip}
						now={now}
						tone={settings.tone}
						onTone={(tone) => actions.setTone(tone)}
						onOpenSettings={openHostSettings}
					/>
				</div>
			)}
			<Desktop
				metrics={metrics}
				harness={harness}
				logs={logger.current.lines}
				settings={settings}
				geometry={geometry}
				now={now}
				fps={fps}
				window={ledgerWindow}
				active={live}
				actions={actions}
			/>
			{booting && live && <Boot metrics={metrics} harness={harness} onDone={finishBoot} />}
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
	const theme = new HostTheme(ctx)
	const session = new Session(ctx, settings, theme)
	const disposeShortcuts = installShortcuts(session)
	const runtime: Runtime = { ctx, session, settings, theme }

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
		theme.dispose()
		scope.__dshOs = undefined
	}
	scope.__dshOs = { dispose }
	;(window as typeof window & { __dshOsState?: () => unknown }).__dshOsState = () => ({
		home: isHome(ctx.sessions.list.getSnapshot()),
		workspace: currentWorkspace(ctx.sessions.list.getSnapshot()),
		settings: settings.value,
		active: session.active,
		field: Boolean(session.field),
		tone: resolveTone(settings.value.tone, theme.tone),
		hostTone: theme.tone,
		skinLayer: theme.skin,
	})
	if (ctx.effect) ctx.effect(() => dispose, 'dsh-os: desktop')
}

export { inject, name }
