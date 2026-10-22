/**
 * 宿主主题桥。
 *
 * 桌面层的明暗必须跟宿主一致——不能像第一版那样直接把 `data-ds-dark-theme`
 * 打到 body 上把浅色用户的界面拖成深色。正式入口是客户端的 `ctx.theme`：
 * `getTheme()` 给原始偏好与解析后的 `colorScheme`，`setTheme()` 是唯一的偏好
 * 写入口，`theme/change` 事件在宿主或系统切换时推送。宿主主题服务缺席时退回到
 * 「读 body 属性 + 监听 prefers-color-scheme」，功能等价但拿不到写入口。
 *
 * @module dsh-os/theme
 */

import type { Tone, ToneChoice } from './settings'

interface ThemeSnapshot {
	preference: string
	active: { colorScheme: 'light' | 'dark' }
}

interface ThemeService {
	getTheme: () => ThemeSnapshot
	setTheme: (id: string) => void
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
	private readonly service: ThemeService | undefined
	private readonly listeners = new Set<() => void>()
	private readonly disposers: (() => void)[] = []

	constructor(ctx: ThemeContext) {
		this.service = typeof ctx.theme?.getTheme === 'function' ? ctx.theme : undefined
		this.writable = Boolean(this.service)
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
