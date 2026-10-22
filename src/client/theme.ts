/**
 * 宿主主题桥 + 全应用皮肤层。
 *
 * 明暗必须跟宿主一致——不能像第一版那样直接把 `data-ds-dark-theme` 打到 body
 * 上把浅色用户的界面拖成深色。正式入口是客户端的 `ctx.theme`：`getTheme()` 给原始
 * 偏好与解析后的 `colorScheme`，`setTheme()` 是唯一的偏好写入口，`theme/change`
 * 事件在宿主或系统切换时推送。
 *
 * 换肤走**官方覆盖层** `overrideTokens(source, tokens)`：它把我们的取值作为
 * 内联 CSS 变量叠在当前主题之上，按配色方案挑 light/dark 那一份，卸载时自动还原。
 * 所以"跟随宿主明暗"是免费的，也不必和原生样式打架。
 *
 * 宿主主题服务缺席时退回到「读 body 属性 + 监听 prefers-color-scheme」，此时
 * 换肤不可用（`skin` 为 false）。
 *
 * @module dsh-os/theme
 */

import type { Tone, ToneChoice } from './settings'

/** 官方覆盖层的 token 形态：两套配色方案各一份。 */
export interface TokenModes {
	light: string
	dark: string
}

interface ThemeSnapshot {
	preference: string
	active: { colorScheme: 'light' | 'dark' }
}

interface ThemeTokenModes {
	light: string
	dark: string
}

interface ThemeService {
	getTheme: () => ThemeSnapshot
	setTheme: (id: string) => void
	overrideTokens?: (source: string, tokens: Record<string, ThemeTokenModes>) => () => void
	exportInspectTokens?: () => { name: string; description?: string; cssVariable?: string }[]
}

interface ThemeContext {
	theme?: ThemeService
	on?: (event: string, listener: (snapshot: ThemeSnapshot) => void) => unknown
}

function systemTone(): Tone {
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function domTone(): Tone {
	if (document.body.hasAttribute('data-ds-dark-theme')) return 'dark'
	if (document.documentElement.getAttribute('data-ds-theme-source') === 'dark') return 'dark'
	return systemTone()
}

/** 宿主题的只读投影 + 偏好写入口。 */
export class HostTheme {
	/** 宿主当前解析出的实际明暗。 */
	tone: Tone
	/** 宿主保存的原始偏好（可能是 `system`）。 */
	preference: ToneChoice
	/** 是否能替宿主改偏好（宿主主题服务在就有）。 */
	readonly writable: boolean
	/** 是否能叠官方 token 覆盖层（全应用换肤的唯一正路）。 */
	readonly skin: boolean
	private readonly service: ThemeService | undefined
	private skinLayer: (() => void) | null = null
	private readonly listeners = new Set<() => void>()
	private readonly disposers: (() => void)[] = []

	constructor(ctx: ThemeContext) {
		this.service = typeof ctx.theme?.getTheme === 'function' ? ctx.theme : undefined
		this.writable = Boolean(this.service)
		this.skin = typeof this.service?.overrideTokens === 'function'
		const snapshot = this.service?.getTheme()
		this.tone = snapshot ? snapshot.active.colorScheme : domTone()
		this.preference = snapshot && snapshot.preference !== 'system' ? (snapshot.preference as ToneChoice) : 'auto'

		if (this.service && ctx.on) {
			const off = ctx.on('theme/change', (snapshot) => {
				const next = snapshot.active.colorScheme
				const preference: ToneChoice = snapshot.preference === 'system' ? 'auto' : (snapshot.preference as ToneChoice)
				if (next === this.tone && preference === this.preference) return
				this.tone = next
				this.preference = preference
				this.emit()
			})
			if (typeof off === 'function') this.disposers.push(off as () => void)
		} else {
			this.watchDom()
		}
	}

	/**
	 * 叠上/替换我们的主题层。
	 *
	 * 同一 source 再调一次会整层替换（官方语义），所以改主题色时直接重调即可，
	 * 不需要先卸载。
	 */
	applySkin(tokens: Record<string, TokenModes>): boolean {
		if (!this.service?.overrideTokens) return false
		this.skinLayer = this.service.overrideTokens('dsh-os', tokens)
		return true
	}

	/** 摘掉主题层，回到 DSH 原生配色。 */
	clearSkin(): void {
		this.skinLayer?.()
		this.skinLayer = null
	}

	/** 没有宿主服务时的兜底：盯 body 属性与系统配色。 */
	private watchDom(): void {
		const media = window.matchMedia('(prefers-color-scheme: dark)')
		const sync = (): void => {
			const next = domTone()
			if (next === this.tone) return
			this.tone = next
			this.emit()
		}
		const observer = new MutationObserver(sync)
		observer.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })
		const rootObserver = new MutationObserver(sync)
		rootObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-ds-theme-source'] })
		media.addEventListener('change', sync)
		this.disposers.push(() => {
			observer.disconnect()
			rootObserver.disconnect()
			media.removeEventListener('change', sync)
		})
	}

	/** 替宿主改主题偏好；没有写入口时什么都不做。 */
	set(choice: ToneChoice): void {
		this.service?.setTheme(choice === 'auto' ? 'system' : choice)
	}

	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener)
		return () => {
			this.listeners.delete(listener)
		}
	}

	dispose(): void {
		this.clearSkin()
		for (const dispose of this.disposers) dispose()
		this.disposers.length = 0
		this.listeners.clear()
	}

	private emit(): void {
		for (const listener of this.listeners) listener()
	}
}

/** 用户选择 × 宿主实际 → 最终墨色。 */
export function resolveTone(choice: ToneChoice, host: Tone): Tone {
	return choice === 'auto' ? host : choice
}
