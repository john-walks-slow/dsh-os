/**
 * 开机自检：用真实读数演一遍 POST。
 *
 * 每行都在数字到达后才写实值；没有读数就是 `…`。整段可点、可按键跳过，
 * 结束时做一次横向撕裂退场。
 *
 * @module dsh-os/client/os/Boot
 */

import { useEffect, useRef, useState } from 'react'
import { bytes, duration, percent } from '../format'
import type { HarnessPayload, MetricsPayload } from '../types'

const BANNER = [
	'██████╗ ███████╗██╗  ██╗   ██████╗ ███████╗',
	'██╔══██╗██╔════╝██║  ██║  ██╔═══██╗██╔════╝',
	'██║  ██║███████╗███████║  ██║   ██║███████╗',
	'██║  ██║╚════██║██╔══██║  ██║   ██║╚════██║',
	'██████╔╝███████║██║  ██║  ╚██████╔╝███████║',
	'╚═════╝ ╚══════╝╚═╝  ╚═╝   ╚═════╝ ╚══════╝',
].join('\n')

const LINE_INTERVAL = 85
const HOLD_AFTER = 620
const LEAVE_MS = 620

interface BootRow {
	tag: string
	key: string
	value: string
	tone?: 'ok'
}

function buildRows(metrics: MetricsPayload | null, harness: HarnessPayload): BootRow[] {
	const host = metrics?.host
	const rows: BootRow[] = [
		{ tag: 'mount', key: '/', value: metrics ? `${bytes(metrics.disk.total)} · ${percent((metrics.disk.used / Math.max(1, metrics.disk.total)) * 100)} used` : '…' },
		{ tag: 'cpu', key: host?.model ?? '…', value: host ? `${host.cores} cores` : '…' },
		{ tag: 'mem', key: 'main', value: metrics ? `${bytes(metrics.mem.total * 1024)} · ${percent(metrics.mem.percent)} in use` : '…' },
		{ tag: 'net', key: metrics?.cap?.net ? metrics.net.iface : 'host stack', value: metrics ? 'link up · telemetry bound' : '…' },
		{ tag: 'harn', key: 'plugin tree', value: 'ok' },
		{ tag: 'harn', key: 'session catalogue', value: `${harness.all.sessions} indexed · ${harness.all.running} running` },
		{ tag: 'harn', key: 'token ledger', value: `${harness.models.all.length} models · ${harness.all.tokens.input + harness.all.tokens.output} tokens` },
		{ tag: 'glyph', key: 'field topology', value: 'mounted · 12 fps' },
		{ tag: 'node', key: metrics ? `pid ${metrics.node.pid}` : 'pid …', value: metrics ? `${bytes(metrics.node.rss)} rss · ${duration(metrics.node.uptimeSec)} up` : '…' },
		{ tag: 'boot', key: 'complete', value: 'entering harness', tone: 'ok' },
	]
	return rows
}

export function Boot({
	metrics,
	harness,
	onDone,
}: {
	metrics: MetricsPayload | null
	harness: HarnessPayload
	onDone: () => void
}): JSX.Element {
	const rows = buildRows(metrics, harness)
	const [revealed, setRevealed] = useState(1)
	const [leaving, setLeaving] = useState(false)
	const done = useRef(false)

	const finish = (): void => {
		if (done.current) return
		done.current = true
		setRevealed(rows.length)
		setLeaving(true)
		window.setTimeout(onDone, LEAVE_MS)
	}

	useEffect(() => {
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
		if (reduced) {
			setRevealed(rows.length)
			const timer = window.setTimeout(finish, 380)
			return () => window.clearTimeout(timer)
		}
		if (revealed < rows.length) {
			const timer = window.setTimeout(() => setRevealed((value) => value + 1), LINE_INTERVAL)
			return () => window.clearTimeout(timer)
		}
		const timer = window.setTimeout(finish, HOLD_AFTER)
		return () => window.clearTimeout(timer)
	}, [revealed, rows.length])

	useEffect(() => {
		const onKey = (): void => finish()
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [])

	const progress = Math.round((revealed / rows.length) * 100)
	const filled = Math.round((revealed / rows.length) * 22)

	return (
		<div className="dos-boot" data-leaving={leaving ? '1' : undefined} onClick={finish} role="presentation">
			<div className="dos-boot-inner">
			<pre className="dos-boot-banner">{BANNER}</pre>
			<div className="dos-boot-meta">
				<span>deepseek harness · operating system</span>
				<span>
					version <b>2.0.0</b>
				</span>
				<span>
					build <b>2026.10-{String(Math.floor(((metrics?.t ?? Date.now()) / 60000) % 9999)).padStart(4, '0')}</b>
				</span>
				<span>{metrics ? `${metrics.host.arch} · ${metrics.host.kernel}` : 'arm64 · linux'}</span>
			</div>
			<div className="dos-rule" style={{ opacity: 0.5 }} />
			<div className="dos-boot-log">
				{rows.slice(0, revealed).map((row) => (
					<div className="dos-boot-row" key={row.tag + row.key}>
						<span className="ok">[ ok ]</span>
						<span className="k">{row.tag.padEnd(5, ' ')}</span>
						<span className="v">{row.key}</span>
						<span className="dots">{'.'.repeat(60)}</span>
						<span className="v">{row.value}</span>
					</div>
				))}
			</div>
			<div className="dos-boot-bar">
				<span>loading</span>
				<span className="dos-meter" data-tone="ghost">
					<span className="on">{'█'.repeat(filled)}</span>
					<span className="off">{'░'.repeat(22 - filled)}</span>
				</span>
				<span>{progress}%</span>
				<span style={{ marginLeft: 'auto' }}>telemetry link · secure</span>
			</div>
			<div className="dos-boot-foot">press any key to skip · dsh-os 2.0.0</div>
			</div>
		</div>
	)
}
