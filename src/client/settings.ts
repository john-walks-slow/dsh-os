/**
 * 偏好与主题。
 *
 * 偏好存 localStorage（纯观感，不进宿主配置）；主题把一组十六进制色摊成
 * CSS 变量与字符场调色板，HUD、皮肤、字符场共用同一份色源。
 *
 * @module dsh-os/settings
 */

export type Pattern = 'rain' | 'field' | 'dshchan' | 'off'
export type AccentName = 'dsh' | 'cyan' | 'magenta' | 'amber' | 'mono' | 'custom'

export interface Settings {
	/** 首页是否进入 OS 桌面。 */
	enabled: boolean
	/** 背景动效。 */
	pattern: Pattern
	/** 主题色。 */
	accent: AccentName
	/** accent === 'custom' 时使用的颜色。 */
	custom: string
	/** 开机自检动画。 */
	boot: boolean
	/** 原生侧边栏皮肤。 */
	skinSidebar: boolean
	/** 原生输入框皮肤。 */
	skinComposer: boolean
	/** Token 账本窗格。 */
	ledger: boolean
}

export const DEFAULT_SETTINGS: Settings = {
	enabled: true,
	pattern: 'rain',
	accent: 'dsh',
	custom: '#5b8cff',
	boot: true,
	skinSidebar: true,
	skinComposer: true,
	ledger: true,
}

export const ACCENTS: Record<Exclude<AccentName, 'custom'>, { key: string; hot: string; warn: string; ink: string }> = {
	dsh: { key: '#5b8cff', hot: '#ff6ea9', warn: '#ffc061', ink: '#e8efff' },
	cyan: { key: '#2ee8d4', hot: '#ff4a9a', warn: '#ffb454', ink: '#d8f6f0' },
	magenta: { key: '#ff5ea8', hot: '#6fd8ff', warn: '#ffc46b', ink: '#ffe9f4' },
	amber: { key: '#ffb454', hot: '#ff6b6b', warn: '#ffe08a', ink: '#fff3e0' },
	mono: { key: '#c9d8d4', hot: '#8fa4a0', warn: '#dcc78f', ink: '#f2fffb' },
}

export const PATTERNS: Record<Pattern, { label: string; blurb: string }> = {
	rain: { label: 'rain', blurb: '稀疏字符雨 · 干净' },
	dshchan: { label: 'dsh-chan', blurb: '3D 旋转 DSH 娘 · 动态' },
	field: { label: 'field', blurb: '等高线拓扑 · 迷幻' },
	off: { label: 'off', blurb: '纯色桌面' },
}

export interface Palette {
	key: string
	hot: string
	warn: string
	ink: string
	cyanBright: string
	cyanMid: string
	cyanDim: string
	cyanDeep: string
	whiteHot: string
	slate: string
}

const STORAGE_KEY = 'dsh-os:settings'

function parseHex(value: string): [number, number, number] {
	const clean = value.replace('#', '')
	const full = clean.length === 3 ? clean.split('').map((char) => char + char).join('') : clean
	const number = Number.parseInt(full, 16)
	if (!Number.isFinite(number)) return [91, 140, 255]
	return [(number >> 16) & 255, (number >> 8) & 255, number & 255]
}

function toHex(rgb: [number, number, number]): string {
	return `#${rgb.map((value) => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0')).join('')}`
}

function scale(rgb: [number, number, number], factor: number): [number, number, number] {
	return [rgb[0] * factor, rgb[1] * factor, rgb[2] * factor]
}

function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
	return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function rgba(rgb: [number, number, number], alpha: number): string {
	return `rgba(${Math.round(rgb[0])},${Math.round(rgb[1])},${Math.round(rgb[2])},${alpha})`
}

/** 从主题色摊出整套调色板。 */
export function paletteFor(settings: Settings): Palette {
	const source = settings.accent === 'custom' ? settings.custom : ACCENTS[settings.accent].key
	const accent = settings.accent === 'custom' ? ACCENTS.dsh : ACCENTS[settings.accent]
	const key = parseHex(source)
	const white = [246, 252, 255] as [number, number, number]
	return {
		key: toHex(key),
		hot: accent.hot,
		warn: accent.warn,
		ink: accent.ink,
		whiteHot: toHex(mix(key, white, 0.72)),
		cyanBright: toHex(key),
		cyanMid: toHex(scale(key, 0.64)),
		cyanDim: toHex(scale(key, 0.34)),
		cyanDeep: toHex(scale(key, 0.19)),
		slate: toHex(scale(key, 0.24)),
	}
}

/** 字符场图集用的墨色（顺序与引擎里的 INKS 对齐）。 */
export function inkPalette(palette: Palette): string[] {
	return [
		palette.whiteHot,
		palette.cyanBright,
		palette.cyanMid,
		palette.cyanDim,
		palette.hot,
		palette.warn,
		palette.cyanDeep,
	]
}

/** 把调色板写成 CSS 变量。 */
export function paletteVars(palette: Palette): Record<string, string> {
	const key = parseHex(palette.key)
	return {
		'--dos-rgb': `${Math.round(key[0])},${Math.round(key[1])},${Math.round(key[2])}`,
		'--dos-cy': palette.key,
		'--dos-cy-dim': rgba(key, 0.42),
		'--dos-cy-faint': rgba(key, 0.14),
		'--dos-cy-glow': rgba(key, 0.5),
		'--dos-mag': palette.hot,
		'--dos-amber': palette.warn,
		'--dos-ink': palette.ink,
		'--dos-ink-dim': rgba(mix(key, [255, 255, 255], 0.62), 0.6),
		'--dos-ink-faint': rgba(mix(key, [255, 255, 255], 0.5), 0.34),
		'--dos-edge': rgba(key, 0.28),
		'--dos-panel-line': rgba(key, 0.16),
	}
}

export function readSettings(): Settings {
	try {
		const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Settings>
		return { ...DEFAULT_SETTINGS, ...raw }
	} catch {
		return { ...DEFAULT_SETTINGS }
	}
}

export function writeSettings(settings: Settings): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
	} catch {
		/* 隐私模式下写不进去，内存态继续工作 */
	}
}

/** 极小的外部 store：HUD 与设置页共享同一份真相。 */
export class SettingsStore {
	value: Settings
	private listeners = new Set<() => void>()

	constructor() {
		this.value = readSettings()
	}

	reset = (): void => {
		this.value = { ...DEFAULT_SETTINGS }
		writeSettings(this.value)
		for (const listener of this.listeners) listener()
	}

	set = (partial: Partial<Settings>): void => {
		this.value = { ...this.value, ...partial }
		writeSettings(this.value)
		for (const listener of this.listeners) listener()
	}

	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener)
		return () => {
			this.listeners.delete(listener)
		}
	}
}
