/**
 * HUD 的最小构件：窗格、ASCII 计量条、可悬停的 SVG 火花线、分段选择器、键值行。
 *
 * 全部只吃 props，不碰 store——预览页和真实插件用同一套。
 *
 * @module dsh-os/client/os/chrome
 */

import { useState, type CSSProperties, type ReactNode } from 'react'

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

/**
 * 火花线：折线 + 极淡的面积，坐标归一化到 100×100。
 *
 * 鼠标移入时按横坐标定位到最近的一格，画一条游标并在右上角给出该点读数——
 * 静态折线只能看趋势，能读出"那一刻是多少"才算仪表。
 */
export function Sparkline({
	values,
	tone,
	height = 22,
	format = (value) => value.toFixed(0),
}: {
	values: number[]
	tone?: 'mag'
	height?: number
	format?: (value: number) => string
}): JSX.Element {
	const [hover, setHover] = useState<number | null>(null)
	const points = values.length >= 2 ? values : [...values, ...values, 0]
	const max = Math.max(1, ...points)
	const step = 100 / Math.max(1, points.length - 1)
	const line = points.map((value, index) => `${(index * step).toFixed(2)},${(100 - (value / max) * 96).toFixed(2)}`).join(' ')
	const area = `0,100 ${line} 100,100`
	const cursor = hover === null ? null : { x: hover * step, y: 100 - ((points[hover] ?? 0) / max) * 96 }

	return (
		<div className="dos-spark-wrap">
			<svg
				className="dos-spark"
				data-tone={tone}
				viewBox="0 0 100 100"
				preserveAspectRatio="none"
				style={{ height }}
				aria-hidden="true"
				onMouseMove={(event) => {
					const rect = event.currentTarget.getBoundingClientRect()
					const ratio = (event.clientX - rect.left) / Math.max(1, rect.width)
					setHover(Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))))
				}}
				onMouseLeave={() => setHover(null)}
			>
				<polygon points={area} />
				<polyline points={line} />
				{cursor && <line className="dos-spark-cursor" x1={cursor.x} x2={cursor.x} y1={0} y2={100} />}
				{cursor && <circle className="dos-spark-dot" cx={cursor.x} cy={cursor.y} r={3} />}
			</svg>
			{hover !== null && <span className="dos-spark-tip">{format(points[hover] ?? 0)}</span>}
		</div>
	)
}

/** 分段选择器：一排小 chip，当前项高亮。 */
export function Seg<T extends string>({
	options,
	value,
	onPick,
	label,
}: {
	options: { key: T; label: string; hint?: string }[]
	value: T
	onPick: (key: T) => void
	label?: string
}): JSX.Element {
	return (
		<span className="dos-seg" role="group" aria-label={label}>
			{options.map((option) => (
				<button
					key={option.key}
					type="button"
					className="dos-seg-item"
					data-on={option.key === value ? '1' : '0'}
					title={option.hint}
					onClick={() => onPick(option.key)}
				>
					{option.label}
				</button>
			))}
		</span>
	)
}

/** 窗格：斜切角、角标、标题行。 */
export function Panel({
	title,
	meta,
	tone,
	style,
	children,
	onClick,
}: {
	title: string
	meta?: ReactNode
	tone?: 'mag'
	style?: CSSProperties
	children: ReactNode
	onClick?: () => void
}): JSX.Element {
	return (
		<section className="dos-panel" data-tone={tone} style={style} onClick={onClick}>
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
