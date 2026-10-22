/**
 * 会话内遥测条。
 *
 * 首页那套 HUD 在真正干活时会退场，于是主题就只剩"换了颜色"。这条 20px 的窄带
 * 补上缺口：它在会话视图顶端，贴着中央列的顶边，给出**此刻**最该知道的几个数
 * ——模型、上下文压力、本会话累计 token、缓存命中、解码速度、运行状态。
 *
 * 设计约束（"绚丽但不打扰"）：
 *   - 只有 20px，默认单行；不遮挡正文（宿主会话流顶部本来就有留白，条子落在
 *     标题行与正文之间，必要时由结构样式给它让出 padding）；
 *   - 不写动画、不用亮色大色块，只有极细的分隔点与一条 ASCII 压力计；
 *   - 需要更多信息时点一下展开成一张小卡（上下文构成、用量明细），再点收起。
 *
 * 数据来自会话服务：当前会话的 `projectionValues` / `projectionsBySession`
 * （打开中的会话是有值的）。拿不到就退化成只显示标题与运行状态。
 *
 * @module dsh-os/skin/strip
 */

import { useLayoutEffect, useRef, useState } from 'react'
import { ago, duration, percent, shorten, tokens } from '../format'

/** 会话服务里我们用到的那一小块。 */
export interface StripSession {
	id: string
	title?: string
	displayTitle?: string
	cwd?: string
	running?: boolean
	blank?: boolean
	updatedAt?: number
	projectionValues?: Record<string, unknown>
}

export interface StripData {
	id: string
	title: string
	workspace: string
	running: boolean
	model: string | null
	preset: string | null
	input: number
	output: number
	cacheRead: number
	cacheWrite: number
	decodeMs: number
	decodeTokens: number
	turns: number
	pressure: number | null
	projected: number | null
	window: number | null
	breakdown: { label: string; tokens: number }[]
	updatedAt: number
}

function numberAt(source: unknown, ...path: string[]): number | null {
	let node: unknown = source
	for (const key of path) {
		if (typeof node !== 'object' || node === null) return null
		node = (node as Record<string, unknown>)[key]
	}
	return typeof node === 'number' && Number.isFinite(node) ? node : null
}

function stringAt(source: unknown, ...path: string[]): string | null {
	let node: unknown = source
	for (const key of path) {
		if (typeof node !== 'object' || node === null) return null
		node = (node as Record<string, unknown>)[key]
	}
	return typeof node === 'string' && node.length > 0 ? node : null
}

const BREAKDOWN_LABELS: Record<string, string> = {
	systemPrompt: 'system',
	tools: 'tools',
	messages: 'messages',
	attachments: 'attachments',
	summary: 'summary',
	free: 'free',
	reserved: 'reserved',
}

/** 把会话行投影成遥测条要的数字；缺什么都退化成 null / 0，不编造。 */
export function readStrip(session: StripSession | null): StripData | null {
	if (!session || session.blank) return null
	const values = (session.projectionValues ?? {}) as Record<string, unknown>
	// tokenUsage 在客户端投影里是扁平对象，在磁盘检查点里是 { totals, last }；两种都认
	const usage = (values.tokenUsage ?? {}) as Record<string, unknown>
	const totals = ((usage.totals ?? usage) ?? {}) as Record<string, unknown>
	const stats = (values.sessionStats ?? {}) as Record<string, unknown>
	const pressure = (values.contextPressure ?? {}) as Record<string, unknown>
	const model = (values.modelSelection ?? {}) as Record<string, unknown>
	const breakdownRaw = (values.contextBreakdown ?? {}) as Record<string, unknown>
	const segments: { label: string; tokens: number }[] = []
	const push = (key: string, value: unknown): void => {
		if (typeof value !== 'number' || value <= 0) return
		segments.push({ label: BREAKDOWN_LABELS[key] ?? key, tokens: value })
	}
	for (const [key, value] of Object.entries(breakdownRaw)) {
		if (typeof value === 'number') push(key, value)
		else if (typeof value === 'object' && value !== null) {
			const inner = (value as Record<string, unknown>).tokens
			push(key, inner)
		}
	}
	segments.sort((left, right) => right.tokens - left.tokens)
	return {
		id: session.id,
		title: session.title ?? session.displayTitle ?? session.id,
		workspace: (session.cwd ?? '').split('/').filter(Boolean).pop() ?? '',
		running: session.running === true,
		model: stringAt(model, 'lastUsed', 'model'),
		preset: stringAt(values, 'agentPreset'),
		input: numberAt(totals, 'uncachedInputTokens') ?? 0,
		output: numberAt(totals, 'outputTokens') ?? 0,
		cacheRead: numberAt(totals, 'cacheReadTokens') ?? 0,
		cacheWrite: numberAt(totals, 'cacheWriteTokens') ?? 0,
		decodeMs: numberAt(stats, 'decodeMs') ?? 0,
		decodeTokens: numberAt(stats, 'decodeTokens') ?? 0,
		turns: numberAt(stats, 'turns') ?? 0,
		pressure: numberAt(pressure, 'pressureTokens'),
		projected: numberAt(pressure, 'projectedTokens'),
		window: numberAt(pressure, 'contextWindow'),
		breakdown: segments.slice(0, 6),
		updatedAt: session.updatedAt ?? Date.now(),
	}
}

function pressurePercent(data: StripData): number {
	const used = data.projected ?? data.pressure
	if (!used || !data.window) return 0
	return (used / data.window) * 100
}

function tps(data: StripData): number | null {
	return data.decodeMs > 0 ? data.decodeTokens / (data.decodeMs / 1000) : null
}

function cacheRatio(data: StripData): number {
	const total = data.input + data.cacheRead
	return total > 0 ? (data.cacheRead / total) * 100 : 0
}

/** ASCII 压力计：字符即精度，和首页用同一套语汇。 */
function Gauge({ value, width = 8 }: { value: number; width?: number }): JSX.Element {
	const ratio = Math.max(0, Math.min(100, value)) / 100
	let filled = Math.round(ratio * width)
	if (value > 0 && filled === 0) filled = 1
	const tone = value >= 88 ? 'hot' : value >= 70 ? 'warn' : undefined
	return (
		<span className="dos-strip-gauge" data-tone={tone}>
			<span className="on">{'▮'.repeat(filled)}</span>
			<span className="off">{'▯'.repeat(Math.max(0, width - filled))}</span>
		</span>
	)
}

export function SessionStrip({
	data,
	now,
	tone,
	onTone,
	onOpenSettings,
}: {
	data: StripData
	now: number
	/** 当前明暗选择（auto / dark / light）。 */
	tone: 'auto' | 'dark' | 'light'
	onTone: (next: 'auto' | 'dark' | 'light') => void
	onOpenSettings: () => void
}): JSX.Element {
	const [open, setOpen] = useState(false)
	const [pinned, setPinned] = useState(false)
	const cardRef = useRef<HTMLDivElement>(null)
	const seatRef = useRef<HTMLDivElement>(null)

	// 展开时把明细卡的高度写进 CSS 变量：会话流从**顶部**让出这段高度
	// （滚动容器是 flex 子项，margin-top 压缩的是它的可视高度，下缘不动，
	// 所以最新一条消息不会被挤走，也没有任何正文被浮层压住）。
	useLayoutEffect(() => {
		const root = document.documentElement
		if (!open) {
			root.removeAttribute('data-dos-strip-card')
			root.style.removeProperty('--dos-strip-room')
			return
		}
		const card = cardRef.current
		if (!card) return
		// 卡片高度会随投影刷新而变（上下文构成的行数），用 ResizeObserver 跟住它，
		// 否则让出的空间会偏小，正文又会被压住。
		const sync = (): void => {
			root.style.setProperty('--dos-strip-room', `${Math.round(21 + card.getBoundingClientRect().height + 10)}px`)
		}
		sync()
		root.setAttribute('data-dos-strip-card', '')
		const observer = new ResizeObserver(sync)
		observer.observe(card)
		return () => {
			observer.disconnect()
			root.removeAttribute('data-dos-strip-card')
			root.style.removeProperty('--dos-strip-room')
		}
	}, [open])

	// 明细卡是"临时浮层"：点外面或开始滚动就收起。
	useLayoutEffect(() => {
		if (!open) return
		const close = (event: Event): void => {
			if (event.type === 'pointerdown' && seatRef.current?.contains(event.target as Node)) return
			setOpen(false)
		}
		window.addEventListener('pointerdown', close, true)
		window.addEventListener('wheel', close, { passive: true })
		window.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') setOpen(false)
		})
		return () => {
			window.removeEventListener('pointerdown', close, true)
			window.removeEventListener('wheel', close)
		}
	}, [open])
	const percentUsed = pressurePercent(data)
	const speed = tps(data)
	const cache = cacheRatio(data)

	return (
		<div className="dos-strip" ref={seatRef} data-open={open ? '1' : undefined} data-pinned={pinned ? '1' : undefined}>
			<div className="dos-strip-bar">
				<i className="dos-led" data-tone={data.running ? 'hot' : 'idle'} data-pulse={data.running ? '1' : undefined} />
				<span className="dos-strip-model">{data.model ? shorten(data.model, 12) : data.preset ?? 'default'}</span>
				{data.workspace && <span className="dos-strip-dim">{data.workspace}</span>}
				<span className="dos-strip-sep">│</span>
				<Gauge value={percentUsed} />
				<span className="dos-strip-num" data-tone={percentUsed >= 88 ? 'hot' : percentUsed >= 70 ? 'warn' : undefined}>
					{percentUsed > 0 ? percent(percentUsed) : '--'}
				</span>
				{data.window && (
					<span className="dos-strip-dim">
						{tokens(data.projected ?? data.pressure ?? 0)}/{tokens(data.window)}
					</span>
				)}
				<span className="dos-strip-sep">│</span>
				<span className="dos-strip-dim">in</span>
				<span className="dos-strip-num">{tokens(data.input)}</span>
				<span className="dos-strip-dim">out</span>
				<span className="dos-strip-num">{tokens(data.output)}</span>
				{cache > 0 && (
					<>
						<span className="dos-strip-dim">cache</span>
						<span className="dos-strip-num">{percent(cache)}</span>
					</>
				)}
				{speed !== null && (
					<>
						<span className="dos-strip-sep">│</span>
						<span className="dos-strip-num">{speed.toFixed(0)}</span>
						<span className="dos-strip-dim">tps</span>
					</>
				)}
				<span className="dos-strip-spacer" />
				<span className="dos-strip-dim">{ago(data.updatedAt, now)}</span>
				<button
					type="button"
					className="dos-strip-toggle"
					aria-expanded={open}
					title={open ? '收起用量明细' : '展开用量明细'}
					onClick={() => setOpen((value) => !value)}
				>
					{open ? '▾' : '▸'}
				</button>
			</div>
			{open && (
				<div className="dos-strip-card" ref={cardRef}>
					<div className="dos-strip-card-head">
						<b>{shorten(data.title, 46)}</b>
						<span>
							{data.turns} turns · {data.preset ?? 'default'}
							{pinned ? ' · 固定' : ''}
						</span>
					</div>
					<div className="dos-strip-grid">
						<div>
							<span className="k">context</span>
							<b>{pressurePercent(data) > 0 ? percent(pressurePercent(data)) : '--'}</b>
							<small>
								{data.window ? `${tokens(data.projected ?? data.pressure ?? 0)} / ${tokens(data.window)}` : 'no window'}
							</small>
						</div>
						<div>
							<span className="k">input</span>
							<b>{tokens(data.input)}</b>
							<small>uncached</small>
						</div>
						<div>
							<span className="k">output</span>
							<b>{tokens(data.output)}</b>
							<small>{data.turns} turns</small>
						</div>
						<div>
							<span className="k">cache r/w</span>
							<b>{tokens(data.cacheRead)}</b>
							<small>w {tokens(data.cacheWrite)}</small>
						</div>
						<div>
							<span className="k">decode</span>
							<b>{speed !== null ? `${speed.toFixed(1)} tps` : '--'}</b>
							<small>{data.decodeMs > 0 ? duration(data.decodeMs / 1000) : 'no data'}</small>
						</div>
						<div>
							<span className="k">age</span>
							<b>{ago(data.updatedAt, now)}</b>
							<small>{new Date(data.updatedAt).toLocaleTimeString()}</small>
						</div>
					</div>
					{data.breakdown.length > 0 && (
						<>
							<div className="dos-strip-rule" />
							<div className="dos-strip-breakdown">
								{data.breakdown.map((segment) => {
									const share = data.pressure ? (segment.tokens / data.pressure) * 100 : 0
									return (
										<div className="dos-strip-seg" key={segment.label}>
											<span className="dos-strip-seg-label">{segment.label}</span>
											<span className="dos-strip-seg-bar" style={{ width: `${Math.max(2, Math.min(100, share))}%` }} />
											<span className="dos-strip-seg-num">{tokens(segment.tokens)}</span>
										</div>
									)
								})}
							</div>
						</>
					)}
					<div className="dos-strip-rule" />
					<div className="dos-strip-card-foot">
						<button type="button" className="dos-strip-action" onClick={() => setPinned((value) => !value)}>
							{pinned ? '取消固定' : '固定展开'}
						</button>
						{/* 干活时也要能换墨：任务栏只在首页出现，这里补一组 */}
						<span className="dos-strip-seg-switch">
							{(['auto', 'dark', 'light'] as const).map((key) => (
								<button
									key={key}
									type="button"
									className="dos-strip-action"
									data-on={tone === key ? '1' : '0'}
									onClick={() => onTone(key)}
								>
									{key === 'auto' ? 'SYS' : key === 'dark' ? 'DARK' : 'LIGHT'}
								</button>
							))}
						</span>
						<button type="button" className="dos-strip-action" onClick={onOpenSettings}>
							桌面设置
						</button>
						<span className="dos-strip-dim">{shorten(data.id, 22)}</span>
					</div>
				</div>
			)}
		</div>
	)
}
