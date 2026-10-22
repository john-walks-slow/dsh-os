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
	/** 全应用主题（官方 token 覆盖层）：会话流、侧边栏、代码块、弹窗都跟着走。 */
	skin: boolean
	/** 会话内遥测条。 */
	strip: boolean
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
	skin: true,
	strip: true,
	pattern: 'rain',
	accent: 'dsh',
	custom: '#5b8cff',
	tone: 'auto',
	boot: true,
	skinComposer: true,
	ledger: true,
	scope: 'space',
}

export const ACCENTS: Record<Exclude<AccentName, 'custom'>, { key: string; label: string }> = {
	dsh: { key: '#5b8cff', label: 'DSH 蓝' },
	cyan: { key: '#2ee8d4', label: '青' },
	magenta: { key: '#ff5ea8', label: '洋红' },
	amber: { key: '#ffb454', label: '琥珀' },
	mono: { key: '#c9d8d4', label: '单色' },
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

/**
 * 当前生效的主题色。
 *
 * 色源的唯一真相在 `skin/palette.ts`：那里摊出两套墨色，并同时喂给官方 token
 * 覆盖层（全应用）与我们自己的 `--dos-*` 变量（首页 HUD、字符场、遥测条）。
 */
const STORAGE_KEY = 'dsh-os:settings'

export function accentOf(settings: Settings): string {
	return settings.accent === 'custom' ? settings.custom : ACCENTS[settings.accent].key
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
