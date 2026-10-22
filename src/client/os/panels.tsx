/**
 * 四块窗格：SYS · MONITOR、WORKSPACE · OVERVIEW、SESSIONS · RECENT、MODEL · LEDGER。
 *
 * 数据全部来自真实读数：整机读数来自宿主 metrics 端点，会话与 token 口径来自
 * 会话投影索引（`harness` 端点）。没有读数时显示 `--`，不编造占位数字。
 *
 * @module dsh-os/client/os/panels
 */

import type { CSSProperties } from 'react'
import { ago, bytes, duration, percent, rate, shorten, tokens } from '../format'
import type { HarnessPayload, HarnessSessionRow, LedgerWindow, MetricsPayload, ModelUsageRow, ScopeStats } from '../types'
import { Meter, Panel, Row, Seg, Sparkline, SubTitle } from './chrome'

function averageFreq(freqs: (number | null)[] | undefined): number | null {
	const known = (freqs ?? []).filter((value): value is number => typeof value === 'number' && value > 0)
	if (known.length === 0) return null
	return Math.round(known.reduce((sum, value) => sum + value, 0) / known.length)
}

/** 缓存命中率：读缓存 / (未缓存输入 + 读缓存)。 */
function cacheRatio(stats: { input: number; cacheRead: number }): number {
	const total = stats.input + stats.cacheRead
	return total > 0 ? (stats.cacheRead / total) * 100 : 0
}

/**
 * 窗格高度决定画几行。
 *
 * 面板是 `overflow: hidden`，装不下的行会被静默裁掉——那比主动少画一行更糟，
 * 用户会以为数据就长这样。所以按实测的每行高度算预算，再按重要性逐个放行：
 * 频率/架构 → 网络 → Swap/磁盘 → 负载 → 运行时长；分核数量不同，预算也跟着变。
 *
 * 常数是等宽字体下的实测量（16px = 14px 行高 + 2px 间距、分核每行 12px、
 * 外框标题与各分隔线合计 42px，含几像素余量），为的是绝不出现"半行被切掉"。
 */
const ROW_H = 16

function systemRows(
	height: number,
	cores: number,
	caps: { freq: boolean; swap: boolean; net: boolean; load: boolean },
): Set<string> {
	const cpuBlock = ROW_H * 2 + Math.ceil(Math.max(1, cores) / 2) * 12
	const memBlock = ROW_H * 2 + 3
	let budget = height - 42 - cpuBlock - memBlock
	const rows = new Set<string>()
	const want: [string, number, boolean][] = [
		['freq', ROW_H, caps.freq],
		['arch', ROW_H, true],
		['net', ROW_H * 2, caps.net],
		['swap', ROW_H, caps.swap],
		['disk', ROW_H, true],
		['load', ROW_H, caps.load],
		['up', ROW_H, true],
	]
	for (const [key, cost, allow] of want) {
		if (!allow || cost > budget) continue
		budget -= cost
		rows.add(key)
	}
	return rows
}

/** 左侧：整机实时读数。 */
export function SystemPanel({
	metrics,
	style,
	fps,
	height = 260,
}: {
	metrics: MetricsPayload | null
	style?: CSSProperties
	fps?: number
	height?: number
}): JSX.Element {
	const cpu = metrics?.cpu.total ?? 0
	const cores = metrics?.cpu.cores ?? []
	const freq = averageFreq(metrics?.cpu.freqs)
	const memPercent = metrics?.mem.percent ?? 0
	const swapUsed = metrics ? metrics.mem.swapTotal - metrics.mem.swapFree : 0
	const swapPercent = metrics && metrics.mem.swapTotal > 0 ? (swapUsed / metrics.mem.swapTotal) * 100 : 0
	const diskPercent = metrics && metrics.disk.total > 0 ? (metrics.disk.used / metrics.disk.total) * 100 : 0
	const netValues = (metrics?.history.rx ?? []).map((value, index) => value + (metrics?.history.tx?.[index] ?? 0))
	// 平台拿不到的行整行不画：宁可少一行，也别挂一排 `--`
	const cap = metrics?.cap
	const rows = systemRows(
		height,
		cores.length || metrics?.host.cores || 1,
		{
			freq: cap ? cap.freq : true,
			swap: cap ? cap.swap : true,
			net: cap ? cap.net : true,
			load: cap ? cap.load : true,
		},
	)
	const showFreq = rows.has('freq')
	const showArch = rows.has('arch')
	const showSwap = rows.has('swap')
	const showDisk = rows.has('disk')
	const showNet = rows.has('net')
	const showLoad = rows.has('load')
	const showUp = rows.has('up')
	const showPower = cap ? cap.power : true
	return (
		<Panel title="SYS · MONITOR" meta={fps ? `FLD ${fps}FPS` : 'LIVE'} style={style}>
			<div className="dos-stack">
				<div className="dos-row">
					<span className="dos-k">CPU</span>
					<span className="dos-v" data-tone={cpu >= 88 ? 'hot' : cpu >= 72 ? 'warn' : undefined}>
						{metrics ? percent(cpu) : '--'}
					</span>
				</div>
				<div className="dos-row">
					<Meter value={cpu} width={17} />
					<span className="dos-v">
						<small>{cores.length || metrics?.host.cores || '--'}C</small>
					</span>
				</div>
			</div>
			<div className="dos-cores">
				{cores.map((value, index) => (
					<div className="dos-core" key={index}>
						<i>{index}</i>
						<Meter value={value} width={4} tone={value >= 85 ? 'hot' : undefined} />
						<span>{Math.round(value)}</span>
					</div>
				))}
			</div>
			{showFreq && (
				<div className="dos-row">
					<span className="dos-k">FREQ</span>
					<span className="dos-v">
						{freq ? `${freq}MHz` : '--'}
						<small>{metrics?.power.cpuTempC ? ` ${metrics.power.cpuTempC.toFixed(1)}°C` : ''}</small>
					</span>
				</div>
			)}
			{showArch && (
				<div className="dos-row">
					<span className="dos-k">ARCH</span>
					<span className="dos-v">
						<small>
							{metrics ? `${metrics.host.platform} · ${metrics.host.arch}` : '--'}
							{showNet ? '' : ' · node:os'}
						</small>
					</span>
				</div>
			)}
			<div className="dos-rule" />
			<div className="dos-stack">
				<div className="dos-row">
					<span className="dos-k">MEM</span>
					<span className="dos-v" data-tone={memPercent >= 88 ? 'hot' : memPercent >= 75 ? 'warn' : undefined}>
						{metrics ? percent(memPercent) : '--'}
					</span>
				</div>
				<div className="dos-row">
					<Meter value={memPercent} width={17} />
					<span className="dos-v">
						<small>{metrics ? `${bytes(metrics.mem.used * 1024)}/${bytes(metrics.mem.total * 1024)}` : '--'}</small>
					</span>
				</div>
			</div>
			{showSwap && (
				<div className="dos-row">
					<span className="dos-k">SWP</span>
					<span className="dos-v">
						<Meter value={swapPercent} width={5} tone="ghost" />
						<small> {metrics ? `${bytes(swapUsed * 1024)}/${bytes(metrics.mem.swapTotal * 1024)}` : '--'}</small>
					</span>
				</div>
			)}
			{showDisk && (
				<div className="dos-row">
					<span className="dos-k">DSK</span>
					<span className="dos-v">
						<Meter value={diskPercent} width={5} tone={diskPercent > 90 ? 'hot' : 'ghost'} />
						<small> {metrics ? `${bytes(metrics.disk.used)}/${bytes(metrics.disk.total)}` : '--'}</small>
					</span>
				</div>
			)}
			<div className="dos-rule" />
			{showNet && (
				<>
					<div className="dos-row">
						<span className="dos-k">NET</span>
						<span className="dos-v">
							<small>{metrics?.net.iface ?? '--'}</small> ↓{metrics ? rate(metrics.net.rxBps) : '--'} ↑
							{metrics ? rate(metrics.net.txBps) : '--'}
						</span>
					</div>
					<Sparkline values={netValues} height={16} format={(value) => rate(value)} />
				</>
			)}
			{showLoad && (
				<div className="dos-row">
					<span className="dos-k">LOAD</span>
					<span className="dos-v">{metrics ? metrics.load.map((value) => value.toFixed(2)).join(' ') : '-- -- --'}</span>
				</div>
			)}
			{showUp && (
				<div className="dos-row">
					<span className="dos-k">UP</span>
					<span className="dos-v">
						<small>{metrics ? duration(metrics.host.uptimeSec) : '--'}</small>
						{showPower && metrics?.power.batteryPercent !== null && metrics?.power.batteryPercent !== undefined ? (
							<small> · bat {metrics.power.batteryPercent}%</small>
						) : null}
					</span>
				</div>
			)}
		</Panel>
	)
}

/** 右上：当前工作区的会话总览 + Node 运行时。 */
export function WorkspacePanel({
	harness,
	metrics,
	scope,
	style,
	compact,
	now,
}: {
	harness: HarnessPayload
	metrics: MetricsPayload | null
	scope: 'space' | 'all'
	style?: CSSProperties
	compact?: boolean
	now: number
}): JSX.Element {
	const stats: ScopeStats = scope === 'all' ? harness.all : harness.space
	const node = metrics?.node
	const busy = stats.running > 0 || stats.subagents > 0
	const label = scope === 'all' ? 'ALL WORKSPACES' : harness.scope.name || '—'
	return (
		<Panel
			title="WORKSPACE · OVERVIEW"
			meta={
				<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
					<i className="dos-led" data-tone={busy ? 'hot' : 'idle'} data-pulse={busy ? '1' : undefined} />
					{busy ? 'BUSY' : 'IDLE'}
				</span>
			}
			style={style}
		>
			<Row label={scope === 'all' ? 'SCOPE' : 'WORKSPACE'} value={shorten(label, 18)} />
			<Row
				label="SESSIONS"
				value={
					<>
						{stats.sessions}
						<small> · {stats.active} in 7d</small>
					</>
				}
			/>
			<Row
				label="NOW"
				value={
					<>
						{stats.running}
						<small> running · {stats.subagents} sub</small>
					</>
				}
				tone={busy ? 'ok' : undefined}
			/>
			<div className="dos-rule" />
			<Row
				label="TODAY"
				value={
					<>
						{tokens(stats.today.input + stats.today.output)}
						<small> new · {tokens(stats.today.cacheRead)} cached · {stats.today.sessions} sess</small>
					</>
				}
			/>
			<Row
				label="TOKENS"
				value={
					<>
						{tokens(stats.tokens.input)}
						<small> in / {tokens(stats.tokens.output)} out</small>
					</>
				}
			/>
			<Row label="CACHE" value={percent(cacheRatio(stats.tokens))} tone={cacheRatio(stats.tokens) > 80 ? 'ok' : undefined} />
			{!compact && (
				<Row
					label="LAST"
					value={
						<>
							{stats.lastActiveAt ? ago(stats.lastActiveAt, now) : '--'}
							<small> · {stats.topModel ? shorten(stats.topModel, 14) : '--'}</small>
						</>
					}
				/>
			)}
			{!compact && (
				<div className="dos-row">
					<span className="dos-k">RUNTIME</span>
					<span className="dos-v">
						<small>
							rss {node ? bytes(node.rss) : '--'} · loop {node ? `${node.lagMs.toFixed(1)}ms` : '--'} ·{' '}
							{metrics?.cap?.proc === false ? 'n/a' : `${metrics?.proc.total ?? '--'} proc`}
						</small>
					</span>
				</div>
			)}
		</Panel>
	)
}

/** 左下：工作区最近会话，点击直接打开。 */
export function SessionsPanel({
	sessions,
	style,
	onOpen,
	now,
	compact,
}: {
	sessions: HarnessSessionRow[]
	style?: CSSProperties
	onOpen: (id: string) => void
	now: number
	compact?: boolean
}): JSX.Element {
	const limit = compact ? 2 : 3
	const shown = Math.min(limit, sessions.length)
	return (
		<Panel title="SESSIONS · RECENT" meta={shown === sessions.length ? `${sessions.length}` : `${shown}/${sessions.length}`} style={style}>
			{sessions.length === 0 ? (
				<div className="dos-row">
					<span className="dos-k">no sessions yet</span>
				</div>
			) : (
				sessions.slice(0, limit).map((session) => (
					<div
						className="dos-session"
						key={session.id}
						onClick={() => onOpen(session.id)}
						role="button"
						tabIndex={0}
						title={`${session.title}\n${session.cwd}\n${session.model} · in ${session.input} / out ${session.output}`}
						onKeyDown={(event) => {
							if (event.key === 'Enter') onOpen(session.id)
						}}
					>
						<i
							className="dos-led"
							data-tone={session.running || session.subagentActive ? 'hot' : 'idle'}
							data-pulse={session.running || session.subagentActive ? '1' : undefined}
						/>
						<span className="t">{shorten(session.title, 20)}</span>
						<span className="m">{shorten(session.model.split('/').pop() ?? session.model, 8)}</span>
						<span className="tok">{tokens(session.input + session.output)}</span>
						<span className="age">{ago(session.updatedAt, now)}</span>
					</div>
				))
			)}
			<div className="dos-spacer" />
			<div className="dos-row">
				<span className="dos-k">cwd</span>
				<span className="dos-v">
					<small>{shorten(sessions[0]?.cwd ?? '—', 26)}</small>
				</span>
			</div>
		</Panel>
	)
}

/** 索引的新鲜度：一分钟内报秒，之后报相对时间。 */
function scanAge(scannedAt: number): string {
	if (!scannedAt) return '--'
	const seconds = Math.max(0, Math.round((Date.now() - scannedAt) / 1000))
	return seconds < 60 ? `${seconds}s 前` : `${ago(scannedAt)} 前`
}

/** 度量记录可能没有 modelSelection（大量 one-shot 子代理如此），给个不会撒谎的占位名。 */
function modelLabel(row: ModelUsageRow): string {
	if (row.provider && row.model) return `${row.provider}/${row.model}`
	return row.model || row.provider || 'unknown'
}

const WINDOWS: { key: LedgerWindow; label: string; hint: string }[] = [
	{ key: 'h24', label: '24H', hint: '最近 24 小时内有过活动的会话' },
	{ key: 'd7', label: '7D', hint: '最近 7 天内有过活动的会话' },
	{ key: 'all', label: 'ALL', hint: '全部历史会话' },
]

/**
 * 底部宽窗格：按模型聚合的 token 账本。
 *
 * 点一行 = 回到该模型最近用过的那个会话——账本不只是报表，也是入口。
 */
export function ModelLedgerPanel({
	harness,
	models,
	stats,
	window,
	onWindow,
	scope,
	onOpen,
	style,
	compact,
}: {
	harness: HarnessPayload
	models: ModelUsageRow[]
	stats: ScopeStats
	window: LedgerWindow
	onWindow: (next: LedgerWindow) => void
	scope: 'space' | 'all'
	onOpen: (id: string) => void
	style?: CSSProperties
	compact?: boolean
}): JSX.Element {
	const usage = stats.windows[window]
	const peak = Math.max(1, ...models.map((row) => row.input + row.output + row.cacheRead))
	const visible = compact ? models.slice(0, 3) : models.slice(0, 4)
	const ratio = cacheRatio({ input: usage.input, cacheRead: usage.cacheRead })
	return (
		<Panel
			title="MODEL · LEDGER"
			meta={
				<span className="dos-meta-row">
					<span className="dos-scope">{scope === 'all' ? 'ALL' : 'WS'}</span>
					<Seg options={WINDOWS} value={window} onPick={onWindow} label="账本时间窗" />
				</span>
			}
			style={style}
		>
			<div className="dos-ledger">
				<div className="dos-ledger-head">
					<span>model</span>
					<span className="n">sess</span>
					<span className="n">input</span>
					<span className="n">output</span>
					<span className="n">cache</span>
					<span className="n">tps</span>
					<span className="n">share</span>
				</div>
				{visible.length === 0 ? (
					<div className="dos-ledger-empty">
						{harness.store.ok ? '该时间窗内没有 token 记录' : `投影缓存不可用${harness.store.error ? ` · ${harness.store.error}` : ''}`}
					</div>
				) : (
					visible.map((row) => {
						const total = row.input + row.output + row.cacheRead
						const label = modelLabel(row)
						return (
							<div
								className="dos-ledger-row"
								key={`${row.provider}/${row.model}`}
								data-clickable={row.lastSessionId ? '1' : undefined}
								onClick={() => row.lastSessionId && onOpen(row.lastSessionId)}
								role={row.lastSessionId ? 'button' : undefined}
								tabIndex={row.lastSessionId ? 0 : undefined}
								title={`${label}\n${row.sessions} sessions · 最近 ${ago(row.lastAt)}${row.lastSessionId ? '\n点击回到该模型最近用过的会话' : ''}`}
								onKeyDown={(event) => {
									if (event.key === 'Enter' && row.lastSessionId) onOpen(row.lastSessionId)
								}}
							>
								<span className="t">{shorten(label, compact ? 20 : 30)}</span>
								<span className="n">{row.sessions}</span>
								<span className="n">{tokens(row.input)}</span>
								<span className="n">{tokens(row.output)}</span>
								<span className="n">{percent(row.cacheRatio * 100)}</span>
								<span className="n">{row.tps !== null ? row.tps.toFixed(0) : '--'}</span>
								<span className="n">
									<Meter value={(total / peak) * 100} width={6} tone="ghost" />
								</span>
							</div>
						)
					})
				)}
				<div className="dos-ledger-total">
					<span>total</span>
					<span className="n">{usage.sessions}</span>
					<span className="n">{tokens(usage.input)}</span>
					<span className="n">{tokens(usage.output)}</span>
					<span className="n">{percent(ratio)}</span>
					<span className="n" />
					<span className="n" />
				</div>
			</div>
			{!compact && (
				<>
					<SubTitle>
						{tokens(usage.cacheRead)} cached reads · 索引 {harness.store.ok ? harness.store.sessions : '--'} 条 ·{' '}
						{scanAge(harness.store.scannedAt)}
					</SubTitle>
				</>
			)}
		</Panel>
	)
}

export { WINDOWS }
