/**
 * HUD 的最小构件：窗格、ASCII 计量条、SVG 火花线、键值行。
 *
 * 全部只吃 props，不碰 store——预览页和真实插件用同一套。
 *
 * @module dsh-os/client/os/chrome
 */

import type { CSSProperties, ReactNode } from 'react'

type Tone = 'warn' | 'hot' | 'ok' | 'ghost'

/**
 * 字符计量条：`█` 是"已用"，`░` 是"剩余"。等宽字体下每个字符都是一格，
 * 所以宽度就是精度。
 */
export function Meter({ value, width = 12, tone }: { value: number; width?: number; tone?: Tone }): JSX.Element {
	const ratio = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)) / 100
	let filled = Math.round(ratio * width)
	if (value > 0 && filled === 0) filled = 1
	if (value >= 100) filled = width
	const auto: Tone | undefined = value >= 88 ? 'hot' : value >= 72 ? 'warn' : undefined
	return (
		<span className="dos-meter" data-tone={tone ?? auto}>
			<span className="on">{'█'.repeat(filled)}</span>
			<span className="off">{'░'.repeat(Math.max(0, width - filled))}</span>
		</span>
	)
}

/** 键值行：左标签、右数值。 */
export function Row({ label, value, tone }: { label: string; value: ReactNode; tone?: Tone }): JSX.Element {
	return (
		<div className="dos-row">
			<span className="dos-k">{label}</span>
			<span className="dos-v" data-tone={tone}>
				{value}
			</span>
		</div>
	)
}

/** 火花线：折线 + 极淡的面积，坐标归一化到 100×100。 */
export function Sparkline({ values, tone, height = 22 }: { values: number[]; tone?: 'mag'; height?: number }): JSX.Element {
	const points = values.length >= 2 ? values : [...values, ...values, 0]
	const max = Math.max(1, ...points)
	const step = 100 / Math.max(1, points.length - 1)
	const line = points.map((value, index) => `${(index * step).toFixed(2)},${(100 - (value / max) * 96).toFixed(2)}`).join(' ')
	const area = `0,100 ${line} 100,100`
	return (
		<svg className="dos-spark" data-tone={tone} viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height }} aria-hidden="true">
			<polygon points={area} />
			<polyline points={line} />
		</svg>
	)
}

/** 窗格：斜切角、角标、标题行。 */
export function Panel({
	title,
	meta,
	tone,
	style,
	children,
}: {
	title: string
	meta?: ReactNode
	tone?: 'mag'
	style?: CSSProperties
	children: ReactNode
}): JSX.Element {
	return (
		<section className="dos-panel" data-tone={tone} style={style}>
			<header className="dos-head">
				<b>{title}</b>
				<span className="dos-head-meta">{meta}</span>
			</header>
			<div className="dos-rule" />
			{children}
		</section>
	)
}

/** 副标题（窗格内的分组线）。 */
export function SubTitle({ children }: { children: ReactNode }): JSX.Element {
	return <div className="dos-sub">{children}</div>
}
