/**
 * 桌面：顶栏、四块窗格（SYS / WORKSPACE / SESSIONS / MODEL·LEDGER）与任务栏。
 *
 * 位置全部从实测几何推出来——中央列在哪、hero 占多高，窗格就贴着让出来的
 * 空白放；空间不够时先撤模型账本，再退化成一条压缩状态条。
 *
 * @module dsh-os/os/Desktop
 */

import type { CSSProperties } from 'react'
import { clock, date, duration, percent, tokens } from '../format'
import type { Settings, ToneChoice } from '../settings'
import type { Geometry, HarnessPayload, LedgerWindow, LogLine, MetricsPayload } from '../types'
import { ModelLedgerPanel, SessionsPanel, SystemPanel, WorkspacePanel } from './panels'
import { Seg } from './chrome'

export interface DesktopActions {
	openSession: (id: string) => void
	toggleField: () => void
	replayBoot: () => void
	openSettings: () => void
	setScope: (scope: 'space' | 'all') => void
	setTone: (tone: ToneChoice) => void
	setWindow: (window: LedgerWindow) => void
}

export interface DesktopProps {
	metrics: MetricsPayload | null
	harness: HarnessPayload
	logs: LogLine[]
	settings: Settings
	geometry: Geometry
	now: number
	fps: number
	window: LedgerWindow
	active: boolean
	actions: DesktopActions
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))

/** 一个窗格的绝对定位盒子。 */
function box(x: number, y: number, w: number, h: number): CSSProperties {
	return { left: Math.round(x), top: Math.round(y), width: Math.round(w), height: Math.round(h) }
}

const TONE_OPTIONS: { key: ToneChoice; label: string; hint: string }[] = [
	{ key: 'auto', label: 'SYS', hint: '跟随宿主主题' },
	{ key: 'dark', label: 'DARK', hint: '霓虹终端' },
	{ key: 'light', label: 'LIGHT', hint: '纸面蓝图' },
]

export function Desktop({
	metrics,
	harness,
	logs,
	settings,
	geometry,
	now,
	fps,
	window,
	active,
	actions,
}: DesktopProps): JSX.Element {
	const { col, hero } = geometry
	const narrow = col.w < 640
	const dense = col.w < 780 || col.h < 640
	const railTop = col.y + 9
	const contentStart = railTop + 33
	const heroTop = hero ? hero.y : col.y + col.h * 0.42
	const panelHeight = clamp(heroTop - contentStart - 16, 150, 286)
	const panelWidth = clamp(col.w * 0.245, 224, 292)
	const taskbarHeight = 26
	const listHeight = dense ? 58 : 156
	const bottomTop = col.y + col.h - taskbarHeight - listHeight - 12
	const leftX = col.x + 16
	const rightX = col.x + col.w - 16 - panelWidth
	const ledgerWidth = col.w - 32 - panelWidth - 10
	const showLedger = !dense && settings.ledger && ledgerWidth >= 420
	const compact = panelHeight < 272

	const scope = settings.scope
	const stats = scope === 'all' ? harness.all : harness.space
	const models = scope === 'all' ? harness.models.all : harness.models.space
	const sessions = scope === 'all' ? harness.sessionsAll : harness.sessions
	const busy = stats.running > 0 || stats.subagents > 0
	const lastLog = logs[logs.length - 1]

	return (
		<div className="dos-root" data-phase={active ? 'live' : 'off'}>
			{/* 顶栏 */}
			<div className="dos-rail" style={{ left: Math.round(col.x + 56), top: Math.round(railTop), width: Math.round(col.w - 112) }}>
				<div className="dos-rail-left">
					<span className="dos-mark">
						▚▞ <b>DSH-OS</b>
					</span>
					{!narrow && <span className="dos-mark-sub">deepseek harness · operating system</span>}
				</div>
				<div className="dos-rail-mid" />
				<div className="dos-rail-right">
					<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }} data-tone={busy ? 'hot' : undefined}>
						<i className="dos-led" data-tone={busy ? 'hot' : 'idle'} data-pulse={busy ? '1' : undefined} />
						{stats.running} run
					</span>
					<span className="dos-rail-stat">
						<b>{stats.sessions}</b> sess
					</span>
					{!narrow && (
						<span className="dos-rail-stat">
							<b>{tokens(stats.today.input + stats.today.output)}</b> tok today
						</span>
					)}
					<span className="dos-clock">{clock(now)}</span>
					{!narrow && <span>{date(now)}</span>}
				</div>
			</div>

			{/* 宽屏：四块窗格 */}
			{!dense && (
				<>
					<SystemPanel metrics={metrics} fps={fps} height={panelHeight} style={box(leftX, contentStart, panelWidth, panelHeight)} />
					<WorkspacePanel
						harness={harness}
						metrics={metrics}
						scope={scope}
						now={now}
						compact={compact}
						style={box(rightX, contentStart, panelWidth, panelHeight)}
					/>
					<SessionsPanel
						sessions={sessions}
						now={now}
						onOpen={actions.openSession}
						compact={listHeight < 100}
						style={box(leftX, bottomTop, panelWidth, listHeight)}
					/>
					{showLedger && (
						<ModelLedgerPanel
							harness={harness}
							models={models}
							stats={stats}
							window={window}
							onWindow={actions.setWindow}
							scope={scope}
							onOpen={actions.openSession}
							compact={listHeight < 100}
							style={box(leftX + panelWidth + 10, bottomTop, ledgerWidth, listHeight)}
						/>
					)}
				</>
			)}

			{/* 窄屏：两条压缩状态 */}
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
							SESS <b>{stats.running}/{stats.sessions}</b>
						</span>
						<span className="sep">|</span>
						<span>
							TOK <b>{tokens(stats.today.input + stats.today.output)}</b>
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
						<span className="dos-ticker">{lastLog?.msg ?? 'telemetry'}</span>
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
					▚ DSH-OS {!narrow && <span style={{ color: 'var(--dos-ink-faint)' }}>2.0</span>}
				</span>
				<button className="dos-chip" data-on={settings.pattern !== 'off' ? '1' : '0'} onClick={actions.toggleField} type="button">
					field
				</button>
				<button className="dos-chip" onClick={actions.openSettings} type="button">
					settings
				</button>
				{!narrow && (
					<>
						<button className="dos-chip" onClick={actions.replayBoot} type="button">
							boot
						</button>
						<Seg
							options={[
								{ key: 'space' as const, label: 'WS', hint: '只看当前工作区' },
								{ key: 'all' as const, label: 'ALL', hint: '全机所有工作区' },
							]}
							value={scope}
							onPick={actions.setScope}
							label="统计口径"
						/>
						<Seg options={TONE_OPTIONS} value={settings.tone} onPick={actions.setTone} label="明暗" />
						<span className="dos-ticker">{lastLog ? `${clock(lastLog.at)} · ${lastLog.msg}` : 'telemetry 2s'}</span>
						<span className="dos-keys">
							<kbd>`</kbd> toggle
							<kbd>esc</kbd> skip
						</span>
					</>
				)}
				{narrow && (
					<span className="dos-keys" style={{ marginLeft: 'auto' }}>
						<kbd>`</kbd>
					</span>
				)}
			</div>
		</div>
	)
}
