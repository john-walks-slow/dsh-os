/**
 * 偏好与主题。
 *
 * 偏好存 localStorage（纯观感，不进宿主配置）；主题把一组十六进制色摊成
 * CSS 变量与字符场调色板，HUD、皮肤、字符场共用同一份色源。
 *
 * 调色板分深浅两套：深色是霓虹终端，浅色是纸面/蓝图——同一套语汇，两种墨。
 * 具体跟随宿主主题（见 theme.ts）还是由用户指定，由 `ToneChoice` 决定。
 *
 * @module dsh-os/settings
 */

export type Pattern = 'rain' | 'field' | 'dshchan' | 'off'
export type AccentName = 'dsh' | 'cyan' | 'magenta' | 'amber' | 'mono' | 'custom'
/** 实际使用的明暗墨色。 */
export type Tone = 'dark' | 'light'
/** 用户选择：跟随宿主，还是钉死一套。 */
export type ToneChoice = 'auto' | 'dark' | 'light'

export interface Settings {
	/** 首页是否进入 OS 桌面。 */
	enabled: boolean
	/** 背景动效。 */
	pattern: Pattern
	/** 主题色。 */
	accent: AccentName
	/** accent === 'custom' 时使用的颜色。 */
	custom: string
	/** 明暗：跟随宿主或钉死。 */
	tone: ToneChoice
	/** 开机自检动画。 */
	boot: boolean
	/** 原生输入框皮肤。 */
	skinComposer: boolean
	/** 模型账本窗格。 */
	ledger: boolean
	/** 账本口径：本工作区或全机。 */
	scope: 'space' | 'all'
}

export const DEFAULT_SETTINGS: Settings = {
	enabled: true,
	pattern: 'rain',
	accent: 'dsh',
	custom: '#5b8cff',
	tone: 'auto',
	boot: true,
	skinComposer: true,
	ledger: true,
	scope: 'space',
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

export const TONES: Record<ToneChoice, { label: string; blurb: string }> = {
	auto: { label: '跟随宿主', blurb: '宿主切深浅色时桌面一起换' },
	dark: { label: '深色', blurb: '霓虹终端 · 夜间' },
	light: { label: '浅色', blurb: '纸面蓝图 · 日间' },
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
	/** 明暗，决定中性与墨色的走向。 */
	tone: Tone
	/** 桌面底色。 */
	base: string
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

const INK_DARK: [number, number, number] = [10, 18, 34]
const PAPER: [number, number, number] = [255, 255, 255]

/**
 * 从主题色摊出整套调色板。
 *
 * 深色往"亮"走（白热 → 主色 → 深底），浅色反过来往"暗"走（近黑 → 主色 →
 * 淡到几乎融进纸面），这样字符场在两种底色上都不会糊成一片。
 */
export function paletteFor(settings: Settings, tone: Tone): Palette {
	const source = settings.accent === 'custom' ? settings.custom : ACCENTS[settings.accent].key
	const accent = settings.accent === 'custom' ? ACCENTS.dsh : ACCENTS[settings.accent]
	const key = parseHex(source)
	const hotRgb = parseHex(accent.hot)
	const warnRgb = parseHex(accent.warn)
	if (tone === 'light') {
		return {
			tone,
			key: toHex(mix(key, INK_DARK, 0.34)),
			hot: toHex(mix(hotRgb, INK_DARK, 0.55)),
			warn: toHex(mix(warnRgb, INK_DARK, 0.6)),
			ink: toHex(mix(INK_DARK, [255, 255, 255], 0.04)),
			whiteHot: toHex(mix(INK_DARK, [255, 255, 255], 0.03)),
			cyanBright: toHex(mix(key, INK_DARK, 0.42)),
			cyanMid: toHex(mix(key, INK_DARK, 0.18)),
			cyanDim: toHex(mix(key, PAPER, 0.42)),
			cyanDeep: toHex(mix(key, PAPER, 0.7)),
			slate: toHex(mix(key, PAPER, 0.55)),
			base: '#eef1f7',
		}
	}
	const white = [246, 252, 255] as [number, number, number]
	return {
		tone,
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
		base: '#04070b',
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

/**
 * 把调色板写成 CSS 变量。
 *
 * 深色/浅色不只是换墨，窗格底、描边、阴影、扫描线、hero 让位光晕的走向都要
 * 反过来，所以中性色也一并从这里出，样式表里不再写死深色值。
 */
export function paletteVars(palette: Palette): Record<string, string> {
	const key = parseHex(palette.key)
	const rgb = `${Math.round(key[0])},${Math.round(key[1])},${Math.round(key[2])}`
	const common = {
		'--dos-rgb': rgb,
		'--dos-cy': palette.key,
		'--dos-cy-dim': rgba(key, 0.46),
		'--dos-cy-faint': rgba(key, 0.16),
		'--dos-cy-glow': rgba(key, 0.5),
		'--dos-mag': palette.hot,
		'--dos-amber': palette.warn,
		'--dos-ink': palette.ink,
		'--dos-bg': palette.base,
	}
	if (palette.tone === 'light') {
		const inkRgb = parseHex(palette.ink)
		return {
			...common,
			'--dos-ink-dim': rgba(inkRgb, 0.78),
			'--dos-ink-faint': rgba(inkRgb, 0.58),
			'--dos-field-opacity': '.8',
			'--dos-edge': rgba(key, 0.34),
			'--dos-panel-line': rgba(key, 0.2),
			'--dos-scrim-a': 'rgba(250,252,255,.9)',
			'--dos-scrim-b': 'rgba(250,252,255,.62)',
			'--dos-scrim-c': 'rgba(250,252,255,.28)',
			'--dos-panel-bg': `linear-gradient(180deg, rgba(255,255,255,.72), transparent 30%), linear-gradient(180deg, rgba(252,253,255,.92), rgba(244,247,252,.94))`,
			'--dos-panel-shadow': 'inset 0 0 18px rgba(28,48,86,.05), 0 12px 26px -20px rgba(20,40,80,.55)',
			'--dos-bar-bg': 'rgba(250,252,255,.86)',
			'--dos-text-shadow': '0 1px 0 rgba(255,255,255,.55)',
			'--dos-chip-on-ink': '#f8fbff',
			'--dos-scan': 'rgba(24,40,70,.05)',
			'--dos-sheen': 'rgba(255,255,255,.5)',
			'--dos-vignette': 'radial-gradient(125% 95% at 50% 42%, transparent 42%, rgba(26,44,76,.16) 100%)',
			'--dos-field-scan': 'repeating-linear-gradient(180deg, rgba(30,50,86,.07) 0 1px, transparent 1px 3px)',
			'--dos-field-veil': 'radial-gradient(120% 90% at 50% 40%, rgba(246,249,253,.92) 0%, rgba(246,249,253,.6) 46%, rgba(246,249,253,0) 74%)',
			'--dos-glitch': 'rgba(20,40,80,.16)',
			'--dos-band': `linear-gradient(180deg, transparent, rgba(${rgb},.05) 45%, rgba(${rgb},.075) 50%, rgba(${rgb},.05) 55%, transparent)`,
			'--dos-band-blend': 'normal',
			'--dos-boot-bg': 'radial-gradient(120% 100% at 50% 42%, #f7f9fd 0%, #e7ecf5 70%)',
			'--dos-spark-glow': 'none',
			'--dos-led-shadow': '0 0 5px rgba(var(--dos-rgb),.38)',
			'--dos-corner': `rgba(${rgb},.06)`,
		}
	}
	return {
		...common,
		'--dos-ink-dim': rgba(mix(key, [255, 255, 255], 0.66), 0.74),
		'--dos-ink-faint': rgba(mix(key, [255, 255, 255], 0.55), 0.48),
		'--dos-field-opacity': '.94',
		'--dos-edge': rgba(key, 0.28),
		'--dos-panel-line': rgba(key, 0.16),
		'--dos-scrim-a': 'rgba(3,8,11,.86)',
		'--dos-scrim-b': 'rgba(3,8,11,.55)',
		'--dos-scrim-c': 'rgba(3,8,11,.25)',
		'--dos-panel-bg': `linear-gradient(180deg, rgba(${rgb},.05), transparent 22%), linear-gradient(180deg, rgba(5,13,17,.93), rgba(3,8,11,.95))`,
		'--dos-panel-shadow': 'inset 0 0 26px rgba(0,0,0,.55), 0 0 22px rgba(0,0,0,.35)',
		'--dos-bar-bg': 'rgba(3,8,11,.88)',
		'--dos-text-shadow': '0 1px 2px rgba(0,0,0,.75)',
		'--dos-chip-on-ink': '#041014',
		'--dos-scan': 'rgba(255,255,255,.024)',
		'--dos-sheen': 'rgba(var(--dos-rgb),.05)',
		'--dos-vignette': 'radial-gradient(120% 90% at 50% 42%, transparent 34%, rgba(0,0,0,.52) 100%)',
		'--dos-field-scan': 'repeating-linear-gradient(180deg, rgba(0,0,0,.22) 0 1px, transparent 1px 3px)',
		'--dos-field-veil': 'radial-gradient(58% 62% at 50% 46%, rgba(3,7,10,.86) 0%, rgba(3,7,10,.62) 52%, rgba(3,7,10,0) 78%)',
		'--dos-glitch': 'rgba(255,255,255,.06)',
		'--dos-band': `linear-gradient(180deg, transparent, rgba(${rgb},.02) 45%, rgba(${rgb},.045) 50%, rgba(${rgb},.02) 55%, transparent)`,
		'--dos-band-blend': 'screen',
		'--dos-boot-bg': 'radial-gradient(120% 100% at 50% 45%, #071319 0%, #020508 72%)',
		'--dos-spark-glow': `drop-shadow(0 0 3px rgba(${rgb},.55))`,
		'--dos-led-shadow': '0 0 7px var(--dos-cy)',
		'--dos-corner': `rgba(${rgb},.04)`,
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
