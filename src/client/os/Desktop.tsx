/**
 * 桌面：顶栏、三块窗格（SYS / LEDGER / HARNESS）、底部控制台与任务栏。
 *
 * 位置全部从实测几何推出来——中央列在哪、hero 占多高，窗格就贴着让出来的
 * 空白放；空间不够时先撤 LEDGER，再撤两侧窗格，退化成一条压缩状态条。
 *
 * @module dsh-os/os/Desktop
 */

import type { CSSProperties } from 'react'
import { clock, date, duration, percent } from '../format'
import type { Settings } from '../settings'
import type { Geometry, HarnessSnapshot, LogLine, MetricsPayload } from '../types'
import { ConsolePanel, HarnessPanel, LedgerPanel, SessionsPanel, SystemPanel } from './panels'

export interface DesktopActions {
	openSession: (id: string) => void
	toggleField: () => void
	replayBoot: () => void
	hide: () => void
	openSettings: () => void
}

export interface DesktopProps {
	metrics: MetricsPayload | null
	harness: HarnessSnapshot
	logs: LogLine[]
	settings: Settings
	geometry: Geometry
	now: number
	fps: number
	active: boolean
	actions: DesktopActions
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))

/** 一个窗格的绝对定位盒子。 */
function box(x: number, y: number, w: number, h: number): CSSProperties {
	return { left: Math.round(x), top: Math.round(y), width: Math.round(w), height: Math.round(h) }
}

export function Desktop({ metrics, harness, logs, settings, geometry, now, fps, active, actions }: DesktopProps): JSX.Element {
	const { col, hero } = geometry
	const narrow = col.w < 640
	const dense = col.w < 780 || col.h < 640
	const railTop = col.y + 9
	const contentStart = railTop + 33
	const heroTop = hero ? hero.y : col.y + col.h * 0.42
	const panelHeight = clamp(heroTop - contentStart - 16, 150, 286)
	const panelWidth = clamp(col.w * 0.245, 224, 292)
	const taskbarHeight = 26
	const consoleHeight = dense ? 58 : 124
	const bottomTop = col.y + col.h - taskbarHeight - consoleHeight - 12
	const leftX = col.x + 16
	const rightX = col.x + col.w - 16 - panelWidth
	const gap = col.w - 32 - panelWidth * 2
	const ledgerWidth = Math.min(560, gap - 20)
	const showLedger = !dense && settings.ledger && gap >= 380 && settings.pattern !== 'dshchan'
	const compact = panelHeight < 272

	const context = harness.context
	const contextPercent =
		context && context.window && (context.projected ?? context.pressure)
			? ((context.projected ?? context.pressure ?? 0) / context.window) * 100
			: 0

	return (
		<div className="dos-root" data-phase={active ? 'live' : 'off'}>
			{/* 顶栏 */}
			<div className="dos-rail" style={{ left: Math.round(col.x + 56), top: Math.round(railTop), width: Math.round(col.w - 112) }}>
				<div className="dos-rail-left">
					<span className="dos-mark">▚▞ <b>DSH-OS</b></span>
					<span className="dos-mark-sub">deepseek harness · operating system</span>
				</div>
				<div className="dos-rail-mid" />
				<div className="dos-rail-right">
					<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
						<i className="dos-led" data-tone="ok" /> sys online
					</span>
					{!narrow && (
						<>
							<span>{metrics ? `pid ${metrics.node.pid}` : 'pid --'}</span>
							<span>{metrics?.net.iface ?? 'net --'}</span>
							<span>{metrics ? `up ${duration(metrics.host.uptimeSec)}` : 'up --'}</span>
						</>
					)}
					<span className="dos-clock">{clock(now)}</span>
					{!narrow && <span>{date(now)}</span>}
				</div>
			</div>

			{/* 宽屏：三块窗格 */}
			{!dense && (
				<>
					<SystemPanel metrics={metrics} fps={fps} compact={compact} style={box(leftX, contentStart, panelWidth, panelHeight)} />
					<HarnessPanel harness={harness} metrics={metrics} fps={fps} compact={compact} style={box(rightX, contentStart, panelWidth, panelHeight)} />
					{showLedger && (
						<LedgerPanel
							rows={harness.ledger}
							totals={harness.totals}
							onOpen={actions.openSession}
							compact={panelHeight < 260}
							style={box(leftX + panelWidth + (gap - ledgerWidth) / 2, contentStart, ledgerWidth, panelHeight)}
						/>
					)}
					<SessionsPanel
						sessions={harness.recent}
						onOpen={actions.openSession}
						compact={consoleHeight < 100}
						style={box(leftX, bottomTop, panelWidth, consoleHeight)}
					/>
					<ConsolePanel logs={logs} now={now} style={box(leftX + panelWidth + 10, bottomTop, col.w - 32 - panelWidth - 10, consoleHeight)} />
				</>
			)}

			{/* 窄屏：一条压缩状态 + 控制台 */}
			{dense && (
				<>
					<div className="dos-compact" style={box(leftX, contentStart, col.w - 32, 20)}>
						<span>
							CPU <b>{metrics ? percent(metrics.cpu.total) : '--'}</b>
						</span>
						<span className="sep">|</span>
						<span>
							MEM <b>{metrics ? percent(metrics.mem.percent) : '--'}</b>
						</span>
						<span className="sep">|</span>
						<span>
							SESS <b>{harness.running}/{harness.total}</b>
						</span>
						<span className="sep">|</span>
						<span>
							CTX <b>{contextPercent > 0 ? percent(contextPercent) : '--'}</b>
						</span>
						{!narrow && (
							<>
								<span className="sep">|</span>
								<span>
									FLD <b>{fps ? `${fps}fps` : 'idle'}</b>
								</span>
							</>
						)}
					</div>
					<div className="dos-compact" style={{ ...box(leftX, bottomTop, col.w - 32, 20), justifyContent: 'space-between' }}>
						<span className="dos-ticker">{logs[logs.length - 1]?.msg ?? 'telemetry'}</span>
						<span>
							UP <b>{metrics ? duration(metrics.host.uptimeSec) : '--'}</b>
						</span>
					</div>
				</>
			)}

			{/* 任务栏 */}
			<div
				className="dos-taskbar"
				style={{ left: Math.round(col.x), top: Math.round(col.y + col.h - taskbarHeight), width: Math.round(col.w) }}
			>
				<span className="dos-mark" style={{ fontSize: 10 }}>
					▚ DSH-OS {!narrow && <span style={{ color: 'var(--dos-ink-faint)' }}>1.0</span>}
				</span>
				<button className="dos-chip" data-on={settings.pattern !== 'off' ? '1' : '0'} onClick={actions.toggleField} type="button">
					field
				</button>
				{!narrow && (
					<button className="dos-chip" onClick={actions.replayBoot} type="button">
						boot
					</button>
				)}
				<button className="dos-chip" onClick={actions.openSettings} type="button">
					settings
				</button>
				{!narrow && (
					<span className="dos-ticker">
						{logs[logs.length - 1] ? `${clock(logs[logs.length - 1]!.at)} · ${logs[logs.length - 1]!.msg}` : ''}
					</span>
				)}
				{narrow ? (
					<span className="dos-keys" style={{ marginLeft: 'auto' }}>
						<kbd>`</kbd>
					</span>
				) : (
					<span className="dos-keys">
						<kbd>`</kbd> toggle
						<kbd>esc</kbd> skip
					</span>
				)}
			</div>
		</div>
	)
}
