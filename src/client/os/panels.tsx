/**
 * 四块窗格：SYS.MONITOR、HARNESS.CORE、SESSIONS、CONSOLE。
 *
 * 数据全部来自真实读数；没有读数时显示 `--`，不编造占位数字。
 *
 * @module dsh-os/client/os/panels
 */

import type { CSSProperties } from 'react'
import { ago, basename, bytes, clock, duration, percent, rate, shorten, tokens } from '../format'
import type { ContextStat, HarnessSession, HarnessSnapshot, LedgerRow, LogLine, MetricsPayload } from '../types'
import { Meter, Panel, Row, Sparkline, SubTitle } from './chrome'

function averageFreq(freqs: (number | null)[] | undefined): number | null {
	const known = (freqs ?? []).filter((value): value is number => typeof value === 'number' && value > 0)
	if (known.length === 0) return null
	return Math.round(known.reduce((sum, value) => sum + value, 0) / known.length)
}

/** 左侧：整机实时读数。 */
export function SystemPanel({
	metrics,
	style,
	fps,
	compact,
}: {
	metrics: MetricsPayload | null
	style?: CSSProperties
	fps?: number
	compact?: boolean
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
	const showFreq = cap ? cap.freq : true
	const showSwap = cap ? cap.swap : true
	const showNet = cap ? cap.net : true
	const showLoad = cap ? cap.load : true
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
			<div className="dos-row">
				<span className="dos-k">ARCH</span>
				<span className="dos-v">
					<small>{metrics ? `${metrics.host.platform} · ${metrics.host.arch}` : '--'}</small>
				</span>
			</div>
			{!showNet && (
				<div className="dos-row">
					<span className="dos-k">MODE</span>
					<span className="dos-v">
						<small>portable · node:os</small>
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
			<div className="dos-row">
				<span className="dos-k">DSK</span>
				<span className="dos-v">
					<Meter value={diskPercent} width={5} tone={diskPercent > 90 ? 'hot' : 'ghost'} />
					<small> {metrics ? `${bytes(metrics.disk.used)}/${bytes(metrics.disk.total)}` : '--'}</small>
				</span>
			</div>
			<div className="dos-rule" />
			{showNet && (
				<>
					<div className="dos-row">
						<span className="dos-k">NET</span>
						<span className="dos-v">
							<small>{metrics?.net.iface ?? '--'}</small> ↓{metrics ? rate(metrics.net.rxBps) : '--'} ↑{metrics ? rate(metrics.net.txBps) : '--'}
						</span>
					</div>
					<Sparkline values={netValues} height={16} />
				</>
			)}
			{showLoad && (
				<div className="dos-row">
					<span className="dos-k">LOAD</span>
					<span className="dos-v">{metrics ? metrics.load.map((value) => value.toFixed(2)).join(' ') : '-- -- --'}</span>
				</div>
			)}
			{!compact && showPower && (
			<div className="dos-row">
				<span className="dos-k">BAT</span>
				<span className="dos-v">
					{metrics?.power.batteryPercent !== null && metrics?.power.batteryPercent !== undefined
						? `${metrics.power.batteryPercent}%`
						: '--'}
					<small>
						{' '}
						{metrics?.power.batteryStatus ?? ''}
						{metrics?.power.batteryTempC ? ` ${metrics.power.batteryTempC.toFixed(1)}°C` : ''}
					</small>
				</span>
			</div>
			)}
		</Panel>
	)
}

function contextLine(context: ContextStat | null): { percent: number; label: string } {
	if (!context || (!context.pressure && !context.projected)) return { percent: 0, label: '--' }
	const used = context.projected ?? context.pressure ?? 0
	const window = context.window ?? 0
	return {
		percent: window > 0 ? (used / window) * 100 : 0,
		label: window > 0 ? `${tokens(used)}/${tokens(window)}` : tokens(used),
	}
}

/** 右侧：DSH 侧统计。 */
export function HarnessPanel({
	harness,
	metrics,
	style,
	fps,
	compact,
}: {
	harness: HarnessSnapshot
	metrics: MetricsPayload | null
	style?: CSSProperties
	fps?: number
	compact?: boolean
}): JSX.Element {
	const context = contextLine(harness.context)
	const node = metrics?.node
	const heapPercent = node && node.heapTotal > 0 ? (node.heapUsed / node.heapTotal) * 100 : 0
	return (
		<Panel
			title="HARNESS · CORE"
			meta={
				<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
					<i className="dos-led" data-tone={harness.running > 0 ? 'hot' : 'idle'} data-pulse={harness.running > 0 ? '1' : undefined} />
					{harness.running > 0 ? 'BUSY' : 'IDLE'}
				</span>
			}
			style={style}
			tone={harness.running > 0 ? undefined : undefined}
		>
			<Row
				label="SESSIONS"
				value={
					<>
						{harness.running}
						<small> running / {harness.total} total</small>
					</>
				}
				tone={harness.running > 0 ? 'ok' : undefined}
			/>
			<Row label="WORKSPACE" value={shorten(harness.workspace, 18)} />
			<Row label="PRESET" value={shorten(harness.model, 18)} />
			<div className="dos-rule" />
			<SubTitle>Context pressure</SubTitle>
			<div className="dos-row">
				<span className="dos-k">{shorten(harness.context?.sessionTitle ?? 'no session', 14)}</span>
				<span className="dos-v" data-tone={context.percent >= 85 ? 'hot' : context.percent >= 65 ? 'warn' : undefined}>
					{context.percent > 0 ? percent(context.percent) : '--'}
				</span>
			</div>
			<div className="dos-row">
				<Meter value={context.percent} width={18} />
				<span className="dos-v">
					<small>{context.label}</small>
				</span>
			</div>
			<div className="dos-grid2">
				<Row label="IN" value={tokens(harness.context?.input)} />
				<Row label="OUT" value={tokens(harness.context?.output)} />
				<Row label="CACHE R" value={tokens(harness.context?.cacheRead)} />
				{!compact && <Row label="CACHE W" value={tokens(harness.context?.cacheWrite)} />}
			</div>
			<div className="dos-rule" />
			<SubTitle>Runtime · node {node ? node.version.replace('v', '') : '--'}</SubTitle>
			<Row
				label="RSS"
				value={
					<>
						{node ? bytes(node.rss) : '--'}
						<small> heap {node ? percent(heapPercent) : '--'}</small>
					</>
				}
			/>
			<Row
				label="LOOP"
				value={
					<>
						{node ? `${node.lagMs.toFixed(1)}ms` : '--'}
						<small> elu {node ? `${Math.round(node.elu)}%` : '--'}</small>
					</>
				}
				tone={node && node.lagMs > 40 ? 'warn' : undefined}
			/>
			<Row label="UPTIME" value={metrics ? duration(metrics.host.uptimeSec) : '--'} />
			{!compact && (metrics?.cap?.proc !== false) && (
				<Row label="PROCS" value={<>{metrics?.proc.total ?? '--'} <small>runq {metrics?.proc.running ?? '--'}</small></>} />
			)}
			{!compact && <div className="dos-spacer" />}
			{!compact && (
				<div className="dos-row">
					<span className="dos-k">GLYPH</span>
					<span className="dos-v">
						<small>topology {fps ? `${fps}fps` : 'idle'}</small>
					</span>
				</div>
			)}
		</Panel>
	)
}

/** 左下：最近会话，可点击打开。 */
export function SessionsPanel({
	sessions,
	style,
	onOpen,
	compact,
}: {
	sessions: HarnessSession[]
	style?: CSSProperties
	onOpen: (id: string) => void
	compact?: boolean
}): JSX.Element {
	return (
		<Panel title="SESSIONS · RECENT" meta={`${sessions.length}`} style={style}>
			{sessions.length === 0 ? (
				<div className="dos-row">
					<span className="dos-k">no sessions recorded</span>
				</div>
			) : (
				sessions.slice(0, compact ? 3 : 4).map((session, index) => (
					<div
						className="dos-session"
						key={session.id}
						onClick={() => onOpen(session.id)}
						role="button"
						tabIndex={0}
						onKeyDown={(event) => {
							if (event.key === 'Enter') onOpen(session.id)
						}}
					>
						<span className="idx">{String(index + 1).padStart(2, '0')}</span>
						<i
							className="dos-led"
							data-tone={session.running ? 'hot' : 'idle'}
							data-pulse={session.running ? '1' : undefined}
						/>
						<span className="t">{shorten(session.title, 22)}</span>
						<span className="age">{ago(session.updatedAt)}</span>
					</div>
				))
			)}
			<div className="dos-spacer" />
			<div className="dos-row">
				<span className="dos-k">cwd</span>
				<span className="dos-v">
					<small>{shorten(basename(sessions[0]?.workspace), 24)}</small>
				</span>
			</div>
		</Panel>
	)
}

/** 底部：滚动控制台。 */
export function ConsolePanel({
	logs,
	style,
	now,
}: {
	logs: LogLine[]
	style?: CSSProperties
	now: number
}): JSX.Element {
	return (
		<section className="dos-console" style={style}>
			{logs.slice(-4).map((line, index, visible) => (
				<div
					className="dos-console-line"
					key={`${line.at}-${index}`}
					data-tone={line.tone}
					data-fresh={index === visible.length - 1 ? '1' : undefined}
				>
					<span className="ts">{clock(line.at)}</span>
					<span className="tag">{line.tag}</span>
					<span className="msg">{line.msg}</span>
				</div>
			))}
			<div className="dos-prompt">
				<span>dsh@harness</span>
				<span className="path">:~$</span>
				<span className="dos-cursor" />
				<span className="path" style={{ marginLeft: 8 }}>
					{clock(now)} · telemetry 2s · glyph field linked
				</span>
			</div>
		</section>
	)
}

/** 顶栏中部：按会话聚合的 token 账本。 */
export function LedgerPanel({
	rows,
	totals,
	style,
	onOpen,
	compact,
}: {
	rows: LedgerRow[]
	totals: { input: number; output: number; cacheRead: number; cacheWrite: number }
	style?: CSSProperties
	onOpen: (id: string) => void
	compact?: boolean
}): JSX.Element {
	const cacheRatio =
		totals.input + totals.cacheRead > 0 ? (totals.cacheRead / (totals.input + totals.cacheRead)) * 100 : 0
	const visible = compact ? rows.slice(0, 4) : rows
	return (
		<Panel title="TOKEN · LEDGER" meta={`${rows.length} SESSIONS`} style={style}>
			<div className="dos-ledger">
				<div className="dos-ledger-head">
					<span>session</span>
					<span>preset</span>
					<span className="n">input</span>
					<span className="n">output</span>
					<span className="n">cache</span>
					<span className="n">tps</span>
				</div>
				{visible.length === 0 ? (
					<div className="dos-ledger-empty">尚无 token 投影 · 打开一个会话后开始记账</div>
				) : (
					visible.map((row) => (
						<div className="dos-ledger-row" key={row.id} onClick={() => onOpen(row.id)} role="button" tabIndex={0}
							onKeyDown={(event) => {
								if (event.key === 'Enter') onOpen(row.id)
							}}
						>
							<span className="t">{shorten(row.title, compact ? 22 : 34)}</span>
							<span className="p">{row.preset}</span>
							<span className="n">{tokens(row.input)}</span>
							<span className="n">{tokens(row.output)}</span>
							<span className="n">{row.cacheRatio > 0 ? percent(row.cacheRatio * 100) : '--'}</span>
							<span className="n">{row.tps !== null ? row.tps.toFixed(0) : '--'}</span>
						</div>
					))
				)}
				<div className="dos-ledger-total">
					<span>total</span>
					<span />
					<span className="n">{tokens(totals.input)}</span>
					<span className="n">{tokens(totals.output)}</span>
					<span className="n">{cacheRatio > 0 ? percent(cacheRatio) : '--'}</span>
					<span className="n" />
				</div>
			</div>
		</Panel>
	)
}
