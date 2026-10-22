/**
 * 整套主题的色源。
 *
 * dsh-os 是一套**全应用主题**，不只是首页：这里定义两套墨色（深＝夜航终端玻璃、
 * 浅＝蓝图纸面），再由两层消费：
 *   1. `aliasLayer()` —— 覆盖 DSH 官方语义 token（`--dsw-alias-*`）与
 *      `--dsw-specific-*`，交给 `ctx.theme.overrideTokens()` 应用，从而改到会话流、
 *      侧边栏、代码块、弹窗、菜单等**所有**用 token 取色的界面；
 *   2. `skinVars()` —— 我们自己的 `--dos-*` 变量，供首页 HUD、字符场、会话遥测条使用。
 *
 * 两套墨色必须成对给出（深浅各一份），因为官方覆盖层会按当前配色方案取值——
 * 这样"跟随宿主明暗"是免费的：宿主切深色，我们的深色墨自动生效。
 *
 * @module dsh-os/skin/palette
 */

import type { Tone } from '../settings'

/** 一个配色方案下的全部槽位。 */
export interface Skin {
	tone: Tone
	/** 页面底。 */
	base: string
	/** 抬升面：卡片、输入框。 */
	layer1: string
	/** 卡片面。 */
	layer2: string
	/** 浮层面：popover、hover 底。 */
	layer3: string
	/** 菜单/弹窗面。 */
	overlay: string
	/** 凹面：代码块、内嵌片段。 */
	inset: string
	/** 四档描边（由淡到重）。 */
	hair: [string, string, string, string]
	/** 四档文字（主/次/辅/弱）。 */
	ink: [string, string, string, string]
	/** 主色与主色上的字。 */
	accent: string
	accentInk: string
	/** 主色的柔化底色（选中、hover 底）。 */
	accentSoft: string
	/** 语义色。 */
	success: string
	successSoft: string
	warn: string
	warnSoft: string
	danger: string
	dangerSoft: string
	/** 遮罩与浮空工具条的底（两套墨色下都要够沉）。 */
	scrim: string
	scrimSoft: string
	/** 侧边栏底。 */
	sidebar: string
	/** 代码块增益/删除行底。 */
	diffAdd: string
	diffDel: string
	/** 我们自己的玻璃面（HUD 窗格）。 */
	glass: string
	glassEdge: string
	/** 深色下的暗角与扫描线强度。 */
	isDark: boolean
}

function parseHex(value: string): [number, number, number] {
	const clean = value.replace('#', '')
	const full = clean.length === 3 ? clean.split('').map((char) => char + char).join('') : clean
	const number = Number.parseInt(full, 16)
	if (!Number.isFinite(number)) return [91, 140, 255]
	return [(number >> 16) & 255, (number >> 8) & 255, number & 255]
}

function hex(rgb: [number, number, number]): string {
	return `#${rgb.map((value) => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0')).join('')}`
}

function mix(a: string | [number, number, number], b: string | [number, number, number], t: number): string {
	const left = typeof a === 'string' ? parseHex(a) : a
	const right = typeof b === 'string' ? parseHex(b) : b
	return hex([left[0] + (right[0] - left[0]) * t, left[1] + (right[1] - left[1]) * t, left[2] + (right[2] - left[2]) * t])
}

function alpha(color: string, value: number): string {
	const [r, g, b] = parseHex(color)
	return `rgba(${r},${g},${b},${value})`
}

/** 主题色在浅色纸面上要压暗才够对比；深色下原样保留霓虹感。 */
export function accentFor(tone: Tone, accent: string): string {
	return tone === 'light' ? mix(accent, '#0a1220', 0.34) : accent
}

/** 摊出一套墨色。 */
export function skinFor(tone: Tone, accentHex: string): Skin {
	const accent = accentFor(tone, accentHex)
	if (tone === 'light') {
		return {
			tone,
			base: '#f4f6fa',
			layer1: '#ffffff',
			layer2: '#fbfcfe',
			layer3: '#f0f3f8',
			overlay: '#ffffff',
			inset: '#eef2f7',
			hair: ['rgba(14,25,45,.07)', 'rgba(14,25,45,.12)', 'rgba(14,25,45,.18)', 'rgba(14,25,45,.26)'],
			ink: ['#0f1826', '#48566c', '#6b7a90', '#93a0b1'],
			accent,
			accentInk: '#ffffff',
			accentSoft: alpha(accent, 0.12),
			success: '#12a465',
			successSoft: 'rgba(18,164,101,.12)',
			warn: '#a9761a',
			warnSoft: 'rgba(169,118,26,.14)',
			danger: '#c93a3a',
			dangerSoft: 'rgba(201,58,58,.12)',
			scrim: 'rgba(18,28,46,.28)',
			scrimSoft: 'rgba(18,28,46,.12)',
			sidebar: '#eef1f7',
			diffAdd: 'rgba(18,164,101,.12)',
			diffDel: 'rgba(201,58,58,.10)',
			glass: 'rgba(255,255,255,.9)',
			glassEdge: alpha(accent, 0.32),
			isDark: false,
		}
	}
	return {
		tone,
		base: '#070a10',
		layer1: '#0b0f17',
		layer2: '#10151f',
		layer3: '#161c28',
		overlay: '#121824',
		inset: '#0c1220',
		hair: ['rgba(255,255,255,.06)', 'rgba(255,255,255,.10)', 'rgba(255,255,255,.16)', 'rgba(255,255,255,.26)'],
		ink: ['#e8eef8', '#a9b6c9', '#78879e', '#56637a'],
		accent,
		accentInk: '#04101a',
		accentSoft: alpha(accent, 0.16),
		success: '#3ecf8e',
		successSoft: 'rgba(62,207,142,.14)',
		warn: '#e8b45c',
		warnSoft: 'rgba(232,180,92,.16)',
		danger: '#ff6f6f',
		dangerSoft: 'rgba(255,111,111,.14)',
		scrim: 'rgba(3,6,11,.72)',
		scrimSoft: 'rgba(3,6,11,.42)',
		sidebar: '#080c14',
		diffAdd: 'rgba(62,207,142,.12)',
		diffDel: 'rgba(255,111,111,.12)',
		glass: 'rgba(9,13,21,.88)',
		glassEdge: alpha(accent, 0.3),
		isDark: true,
	}
}

/**
 * 代码高亮（shiki）两套配色。
 *
 * shiki 的 12 个 token 是写死色、不吃 alias，所以想"代码块也是这套主题"就必须
 * 显式覆盖。深色走低饱和霓虹，浅色走印刷感的深色墨。
 */
function syntaxFor(tone: Tone): Record<string, string> {
	if (tone === 'light') {
		return {
			'--shiki-foreground': '#0f1826',
			'--shiki-token-comment': '#8b98a9',
			'--shiki-token-keyword': '#b3245f',
			'--shiki-token-string': '#16794a',
			'--shiki-token-string-expression': '#1f8a55',
			'--shiki-token-function': '#3050b0',
			'--shiki-token-constant': '#a05a10',
			'--shiki-token-parameter': '#a04c14',
			'--shiki-token-punctuation': '#5a6678',
			'--shiki-token-link': '#0b6ea8',
		}
	}
	return {
		'--shiki-foreground': '#e8eef8',
		'--shiki-token-comment': '#56637a',
		'--shiki-token-keyword': '#ef7fa8',
		'--shiki-token-string': '#7ddca8',
		'--shiki-token-string-expression': '#a8e08a',
		'--shiki-token-function': '#8fb8ff',
		'--shiki-token-constant': '#e8b45c',
		'--shiki-token-parameter': '#f0a878',
		'--shiki-token-punctuation': '#8b98a9',
		'--shiki-token-link': '#6fd8ff',
	}
}

type Modes = { light: string; dark: string }

/** 同一个值在两套墨色下都用（形状、比例这类与明暗无关的 token）。 */
function both(value: string): Modes {
	return { light: value, dark: value }
}

function pair(dark: string, light: string): Modes {
	return { dark, light }
}

/**
 * 官方语义 token 覆盖层。
 *
 * 只覆盖会影响观感的语义 token；表里没有的（例如某些版本新增的 token）就让它
 * 落回 DSH 自己的底色——中性灰在两套墨色下都不会突兀。这样主题不怕上游加字段。
 */
export function themeLayer(accentHex: string): Record<string, Modes> {
	const dark = skinFor('dark', accentHex)
	const light = skinFor('light', accentHex)
	const table: Record<string, Modes> = {}

	const set = (name: string, d: string, l: string): void => {
		table[name] = pair(d, l)
	}
	const same = (name: string, value: string): void => {
		table[name] = both(value)
	}

	// ── 面 ────────────────────────────────────────────────────────────────
	set('--dsw-alias-bg-base', dark.base, light.base)
	set('--dsw-alias-bg-layer-1', dark.layer1, light.layer1)
	set('--dsw-alias-bg-layer-2', dark.layer2, light.layer2)
	set('--dsw-alias-bg-layer-3', dark.layer3, light.layer3)
	set('--dsw-alias-bg-overlay', dark.overlay, light.overlay)
	set('--dsw-alias-bg-module-platform', dark.layer2, light.layer3)
	set('--dsw-alias-bg-multi-select', dark.layer3, light.layer3)
	set('--dsw-alias-bg-skeleton', 'rgba(255,255,255,.06)', 'rgba(14,25,45,.06)')
	set('--dsw-alias-bg-document-preview', dark.inset, light.layer1)
	set('--dsw-alias-bg-document-selection', alpha(dark.accent, 0.3), alpha(light.accent, 0.22))
	set('--dsw-alias-bg-mask-1', 'rgba(3,6,11,.5)', 'rgba(18,28,46,.22)')
	set('--dsw-alias-bg-mask-2', 'rgba(3,6,11,.28)', 'rgba(18,28,46,.12)')
	set('--dsw-alias-bg-mask-3', 'rgba(3,6,11,.72)', 'rgba(18,28,46,.34)')
	set('--dsw-alias-bg-mask-drop', 'rgba(12,18,30,.72)', 'rgba(255,255,255,.72)')
	same('--dsw-alias-bg-mask-photo', 'rgba(2,4,8,.88)')

	// ── 描边 ──────────────────────────────────────────────────────────────
	set('--dsw-alias-border-l1', dark.hair[0], light.hair[0])
	set('--dsw-alias-border-l2', dark.hair[1], light.hair[1])
	set('--dsw-alias-border-l2-darkmode-thin', dark.hair[0], light.hair[0])
	set('--dsw-alias-border-l3', dark.hair[2], light.hair[2])
	set('--dsw-alias-border-l4', dark.hair[3], light.hair[3])
	set('--dsw-alias-border-inverted', 'rgba(255,255,255,.08)', 'rgba(255,255,255,.12)')
	set('--dsw-alias-border-inverted2', 'rgba(255,255,255,.14)', 'rgba(255,255,255,.2)')

	// ── 字 ────────────────────────────────────────────────────────────────
	set('--dsw-alias-label-primary', dark.ink[0], light.ink[0])
	set('--dsw-alias-label-primary-bluish', dark.ink[0], light.ink[0])
	set('--dsw-alias-label-primary-dimmed', dark.ink[1], light.ink[0])
	// contrast 面在深色下是亮底、浅色下是暗底，字必须跟着反向（写反了就是白底白字）
	set('--dsw-alias-label-primary-inverted', '#0a0f19', '#f7faff')
	set('--dsw-alias-label-primary-foreground', dark.accentInk, light.accentInk)
	set('--dsw-alias-label-secondary', dark.ink[1], light.ink[1])
	set('--dsw-alias-label-tertiary', dark.ink[2], light.ink[2])
	set('--dsw-alias-label-caption', dark.ink[3], light.ink[3])
	set('--dsw-alias-label-dimmed', dark.ink[3], light.ink[3])
	set('--dsw-alias-label-document-preview', dark.ink[1], light.ink[1])
	set('--dsw-alias-label-deep-diving', dark.accent, light.accent)
	set('--dsw-alias-label-deep-diving-shimmer', alpha(dark.accent, 0.45), alpha(light.accent, 0.35))
	set('--dsw-alias-label-shimmer', 'rgba(255,255,255,.06)', 'rgba(14,25,45,.06)')
	set('--dsw-alias-label-primary-inverted-foreground', '#0a0f19', '#f7faff')
	set('--dsw-alias-link', dark.accent, light.accent)
	set('--dsw-alias-brand-primary', dark.accent, light.accent)
	set('--dsw-alias-brand-primary-invert', dark.accentInk, light.accentInk)
	set('--dsw-alias-brand-primary-new-colorprimary-new-color', dark.accent, light.accent)
	set('--dsw-alias-brand-text', dark.ink[0], light.ink[0])

	// ── 交互底 ────────────────────────────────────────────────────────────
	set('--dsw-alias-interactive-bg-hover', 'rgba(255,255,255,.06)', 'rgba(14,25,45,.05)')
	set('--dsw-alias-interactive-bg-active', 'rgba(255,255,255,.11)', 'rgba(14,25,45,.09)')
	set('--dsw-alias-interactive-bg-hover-accent', alpha(dark.accent, 0.16), alpha(light.accent, 0.12))
	set('--dsw-alias-interactive-bg-hover-solid', dark.layer3, light.layer3)
	set('--dsw-alias-interactive-bg-hover-danger', alpha(dark.danger, 0.16), alpha(light.danger, 0.1))

	// ── 按钮 ──────────────────────────────────────────────────────────────
	set('--dsw-alias-button-primary-fill', dark.accent, light.accent)
	set('--dsw-alias-button-primary-hover', mix(dark.accent, '#ffffff', 0.18), mix(light.accent, '#000000', 0.14))
	set('--dsw-alias-button-primary-dimmed', alpha(dark.accent, 0.4), alpha(light.accent, 0.3))
	set('--dsw-alias-button-contrast-fill', dark.ink[0], light.ink[0])
	set('--dsw-alias-button-elevated-fill', dark.layer2, light.layer1)
	set('--dsw-alias-button-floating-fill', dark.layer3, light.layer1)
	set('--dsw-alias-button-floating-hover', dark.layer3, light.layer3)
	set('--dsw-alias-button-ghost-active-fill', alpha(dark.accent, 0.14), alpha(light.accent, 0.1))
	set('--dsw-alias-button-ghost-active-border', dark.accent, light.accent)
	set('--dsw-alias-button-ghost-active-hover', alpha(dark.accent, 0.2), alpha(light.accent, 0.16))
	set('--dsw-alias-button-info-fill', dark.accent, light.accent)
	set('--dsw-alias-button-info-hover', mix(dark.accent, '#ffffff', 0.18), mix(light.accent, '#000000', 0.14))
	same('--dsw-alias-button-tool-bar-fill', 'rgba(12,16,24,.62)')
	same('--dsw-alias-button-tool-bar-hover', 'rgba(12,16,24,.78)')
	same('--dsw-alias-button-tool-bar-fill-invisible', 'rgba(12,16,24,.35)')

	// ── markdown / 代码 ───────────────────────────────────────────────────
	set('--dsw-alias-markdown-code-block', dark.inset, light.inset)
	set('--dsw-alias-markdown-code-block-banner', dark.layer2, light.layer3)
	set('--dsw-alias-markdown-inline-code', dark.layer3, light.inset)
	set('--dsw-alias-markdown-code-segment-selected', dark.layer1, light.layer1)
	set('--dsw-alias-markdown-code-segment-unselected', dark.inset, light.layer3)
	set('--dsw-alias-markdown-citation', dark.layer3, light.layer3)
	set('--dsw-alias-markdown-placeholder', dark.ink[3], light.ink[3])
	set('--dsw-alias-markdown-tag', dark.layer3, light.layer3)
	set('--dsw-alias-turn-trigger-bg', dark.inset, light.inset)
	set('--dsw-alias-turn-trigger-bg-hover', dark.layer3, light.layer3)

	// ── diff ──────────────────────────────────────────────────────────────
	set('--dsw-alias-code-diff-added', dark.diffAdd, light.diffAdd)
	set('--dsw-alias-code-diff-deleted', dark.diffDel, light.diffDel)
	set('--dsw-alias-file-diff-added-bg', 'rgba(62,207,142,.10)', 'rgba(18,164,101,.09)')
	set('--dsw-alias-file-diff-added-gutter', 'rgba(62,207,142,.16)', 'rgba(18,164,101,.13)')
	set('--dsw-alias-file-diff-added-marker', dark.success, light.success)
	set('--dsw-alias-file-diff-deleted-bg', 'rgba(255,111,111,.10)', 'rgba(201,58,58,.08)')
	set('--dsw-alias-file-diff-deleted-gutter', 'rgba(255,111,111,.16)', 'rgba(201,58,58,.12)')
	set('--dsw-alias-file-diff-deleted-marker', dark.danger, light.danger)

	// ── 状态 ──────────────────────────────────────────────────────────────
	set('--dsw-alias-state-success-primary', dark.success, light.success)
	set('--dsw-alias-state-success-secondary', dark.success, light.success)
	set('--dsw-alias-state-success-tertiary', dark.successSoft, light.successSoft)
	set('--dsw-alias-state-error-primary', dark.danger, light.danger)
	set('--dsw-alias-state-error-secondary', dark.danger, light.danger)
	set('--dsw-alias-state-warn-primary', dark.warn, light.warn)
	set('--dsw-alias-state-warn-secondary', dark.warn, light.warn)
	set('--dsw-alias-state-warn-tertiary', dark.warnSoft, light.warnSoft)
	set('--dsw-alias-state-warn-label', dark.warn, light.warn)
	set('--dsw-alias-state-business-primary', dark.accent, light.accent)
	set('--dsw-alias-state-business-tertiary', alpha(dark.accent, 0.16), alpha(light.accent, 0.12))
	set('--dsw-alias-state-idle-primary', dark.ink[3], light.ink[3])

	// ── 浮层 ──────────────────────────────────────────────────────────────
	set('--dsw-alias-toast-bg', '#141b28', '#1a2333')
	same('--dsw-alias-toast-label', '#eef4ff')
	set('--dsw-alias-tooltip-bg', '#141b28', '#1a2333')
	same('--dsw-alias-tooltip-key-bg', 'rgba(255,255,255,.16)')
	set('--dsw-alias-menu-group-header-fill', 'rgba(16,21,31,.94)', 'rgba(244,246,250,.94)')
	set('--dsw-alias-menu-icon', dark.ink[1], light.ink[1])
	set('--dsw-alias-settings-card-fill', dark.layer2, light.layer1)
	set('--dsw-alias-settings-card-stroke', dark.hair[2], light.hair[2])
	set('--dsw-alias-switch-thumb', dark.ink[0], light.layer1)
	set('--dsw-alias-onboarding-accent', dark.accent, light.accent)
	set('--dsw-alias-onboarding-secondary-fill', dark.layer3, light.layer1)
	set('--dsw-alias-onboarding-card-fill', 'rgba(16,21,31,.8)', 'rgba(255,255,255,.8)')
	set('--dsw-alias-onboarding-checkbox-border', dark.hair[2], light.hair[2])

	// ── 滚动条 ────────────────────────────────────────────────────────────
	set('--dsw-alias-scrollbar-bg-l1', 'rgba(255,255,255,.08)', 'rgba(14,25,45,.1)')
	set('--dsw-alias-scrollbar-bg-l2', 'rgba(255,255,255,.12)', 'rgba(14,25,45,.14)')
	set('--dsw-alias-scrollbar-hover-l1', 'rgba(255,255,255,.2)', 'rgba(14,25,45,.22)')
	set('--dsw-alias-scrollbar-hover-l2', 'rgba(255,255,255,.26)', 'rgba(14,25,45,.3)')

	// ── specific 层：产品特定面（不在 alias 体系里，但同样是官方变量）────
	set('--dsw-specific-sidebar-fill', dark.sidebar, light.sidebar)
	set('--dsw-specific-bubble', alpha(dark.accent, 0.18), alpha(light.accent, 0.12))
	set('--dsw-specific-bubble-highlight', alpha(dark.accent, 0.3), alpha(light.accent, 0.2))
	set('--dsw-specific-input-major', dark.layer1, light.layer1)
	set('--dsw-specific-selector', dark.layer3, light.layer3)
	set('--dsw-specific-tip', dark.layer3, light.layer3)
	set('--dsw-specific-login-input', dark.layer2, light.layer1)
	set('--dsw-specific-sidebar-nav-item-hover', 'rgba(255,255,255,.06)', 'rgba(14,25,45,.05)')
	set('--dsw-specific-sidebar-nav-item-active', 'rgba(255,255,255,.1)', 'rgba(14,25,45,.08)')
	set('--dsw-specific-sidebar-nav-item-active-accent', alpha(dark.accent, 0.18), alpha(light.accent, 0.12))
	set('--dsw-menu-surface-fill', 'rgba(18,24,36,.86)', 'rgba(255,255,255,.86)')
	set('--dsw-specific-menu', 'rgba(18,24,36,.86)', 'rgba(255,255,255,.86)')

	// ── 组件引用了但 theme 从未定义的 alias：补上，顺手救活几处 hover 与错误文案 ──
	set('--dsw-alias-bg-l1', dark.layer1, light.layer1)
	set('--dsw-alias-bg-l2', dark.layer2, light.layer2)
	set('--dsw-alias-bg-layer-4', dark.layer3, light.layer3)
	set('--dsw-alias-fill-l1', dark.layer2, light.layer2)
	set('--dsw-alias-fill-l2', dark.layer3, light.layer3)
	set('--dsw-alias-fill-tertiary', 'rgba(255,255,255,.1)', 'rgba(14,25,45,.08)')
	set('--dsw-alias-fill-tsp-secondary', 'rgba(255,255,255,.16)', 'rgba(14,25,45,.12)')
	set('--dsw-alias-label-error', dark.danger, light.danger)
	set('--dsw-alias-label-quaternary', dark.ink[3], light.ink[3])
	set('--dsw-alias-separator-primary', dark.hair[1], light.hair[1])

	// ── 形状：方圆感与圆角阶梯（一个 token 改全局）────────────────────────
	same('--dsw-corner-shape', 'round')
	same('--dsw-radius-xs', '2px')
	same('--dsw-radius-sm', '3px')
	same('--dsw-radius-md', '4px')
	same('--dsw-radius-lg', '6px')
	same('--dsw-radius-xl', '8px')
	same('--dsw-radius-panel', '10px')

	// ── 高度与玻璃：把 DSH 的大阴影换成"细描边 + 极浅投影"的仪器感 ────────
	set('--dsw-elevation-stroke-color', dark.hair[1], light.hair[1])
	same('--dsw-elevation-stroke', '0 0 0 .5px var(--dsw-elevation-stroke-color)')
	set(
		'--dsw-elevation-panel',
		'var(--dsw-elevation-stroke), 0 10px 30px -22px rgba(0,0,0,.9)',
		'var(--dsw-elevation-stroke), 0 10px 30px -24px rgba(20,40,80,.5)',
	)
	set(
		'--dsw-elevation-prominent',
		'var(--dsw-elevation-stroke), 0 18px 48px -28px rgba(0,0,0,.95)',
		'var(--dsw-elevation-stroke), 0 18px 48px -30px rgba(20,40,80,.55)',
	)
	set(
		'--dsw-elevation-soft',
		'var(--dsw-elevation-stroke), 0 6px 20px -14px rgba(0,0,0,.8)',
		'var(--dsw-elevation-stroke), 0 6px 20px -16px rgba(20,40,80,.45)',
	)
	same('--dsw-mask-blur', 'blur(8px)')
	same('--dsw-menu-backdrop-filter', 'blur(16px) saturate(1.12)')

	// ── 组件级 dark 分支直接吃 static 灰阶（deliverables / plan / schedule /
	//    sidebar-right），alias 覆盖管不到，只能点杀这几个灰阶 ──────────────
	set('--dsw-static-neutral-50', dark.layer1, light.layer2)
	set('--dsw-static-neutral-100', dark.layer2, light.layer3)
	set('--dsw-static-neutral-700', dark.ink[2], light.ink[2])
	set('--dsw-static-neutral-800', dark.layer2, light.layer3)
	set('--dsw-static-neutral-850', dark.layer1, light.layer2)

	// ── DSH 自己的品牌蓝：不跟着改的话，标签页下划线、发送键之类会留一手旧蓝 ──
	set('--dsw-static-deepseek-400', mix(dark.accent, '#ffffff', 0.22), mix(light.accent, '#ffffff', 0.18))
	set('--dsw-static-deepseek-450', dark.accent, mix(light.accent, '#ffffff', 0.08))
	set('--dsw-static-deepseek-500', mix(dark.accent, '#000000', 0.1), light.accent)
	set('--dsw-static-deepseek-600', mix(dark.accent, '#000000', 0.24), mix(light.accent, '#000000', 0.16))
	set('--dsw-static-blue-500', dark.accent, light.accent)

	// ── 代码高亮 ──────────────────────────────────────────────────────────
	const syntaxDark = syntaxFor('dark')
	const syntaxLight = syntaxFor('light')
	for (const name of Object.keys(syntaxDark)) set(name, syntaxDark[name]!, syntaxLight[name] ?? syntaxDark[name]!)

	return table
}

/** 我们自己的变量：首页 HUD、字符场、会话遥测条共用。 */
export function skinVars(tone: Tone, accentHex: string): Record<string, string> {
	const skin = skinFor(tone, accentHex)
	const [r, g, b] = parseHex(skin.accent)
	const rgb = `${r},${g},${b}`
	return {
		'--dos-rgb': rgb,
		'--dos-cy': skin.accent,
		'--dos-cy-dim': alpha(skin.accent, 0.46),
		'--dos-cy-faint': alpha(skin.accent, 0.16),
		'--dos-mag': skin.danger,
		'--dos-amber': skin.warn,
		'--dos-ok': skin.success,
		'--dos-bg': skin.base,
		'--dos-ink': skin.ink[0],
		'--dos-ink-dim': alpha(skin.ink[1], 0.95),
		'--dos-ink-faint': alpha(skin.ink[1], 0.66),
		'--dos-edge': skin.glassEdge,
		'--dos-panel-line': skin.hair[1],
		'--dos-panel-bg': `linear-gradient(180deg, ${alpha(skin.accent, 0.05)}, transparent 30%), ${skin.glass}`,
		'--dos-panel-shadow': skin.isDark
			? 'inset 0 0 24px rgba(0,0,0,.45), 0 10px 26px -22px rgba(0,0,0,.9)'
			: 'inset 0 0 18px rgba(28,48,86,.04), 0 12px 26px -22px rgba(20,40,80,.45)',
		'--dos-bar-bg': skin.isDark ? 'rgba(7,10,16,.9)' : 'rgba(250,252,255,.92)',
		'--dos-scrim-a': skin.isDark ? 'rgba(7,10,16,.88)' : 'rgba(250,252,255,.9)',
		'--dos-scrim-b': skin.isDark ? 'rgba(7,10,16,.58)' : 'rgba(250,252,255,.62)',
		'--dos-scrim-c': skin.isDark ? 'rgba(7,10,16,.24)' : 'rgba(250,252,255,.28)',
		'--dos-chip-on-ink': skin.accentInk,
		'--dos-text-shadow': skin.isDark ? '0 1px 2px rgba(0,0,0,.7)' : '0 1px 0 rgba(255,255,255,.5)',
		'--dos-scan': skin.isDark ? 'rgba(255,255,255,.022)' : 'rgba(24,40,70,.05)',
		'--dos-sheen': skin.isDark ? `rgba(${rgb},.05)` : 'rgba(255,255,255,.5)',
		'--dos-vignette': skin.isDark
			? 'radial-gradient(120% 90% at 50% 42%, transparent 34%, rgba(0,0,0,.5) 100%)'
			: 'radial-gradient(125% 95% at 50% 42%, transparent 42%, rgba(26,44,76,.14) 100%)',
		'--dos-field-scan': skin.isDark
			? 'repeating-linear-gradient(180deg, rgba(0,0,0,.22) 0 1px, transparent 1px 3px)'
			: 'repeating-linear-gradient(180deg, rgba(30,50,86,.06) 0 1px, transparent 1px 3px)',
		'--dos-field-veil': skin.isDark
			? 'radial-gradient(58% 62% at 50% 46%, rgba(6,9,15,.88) 0%, rgba(6,9,15,.62) 52%, rgba(6,9,15,0) 78%)'
			: 'radial-gradient(120% 90% at 50% 40%, rgba(244,246,250,.92) 0%, rgba(244,246,250,.6) 46%, rgba(244,246,250,0) 74%)',
		'--dos-field-opacity': skin.isDark ? '.94' : '.8',
		'--dos-band': skin.isDark
			? `linear-gradient(180deg, transparent, ${alpha(skin.accent, 0.03)} 45%, ${alpha(skin.accent, 0.05)} 50%, ${alpha(skin.accent, 0.03)} 55%, transparent)`
			: `linear-gradient(180deg, transparent, ${alpha(skin.accent, 0.05)} 45%, ${alpha(skin.accent, 0.07)} 50%, ${alpha(skin.accent, 0.05)} 55%, transparent)`,
		'--dos-band-blend': skin.isDark ? 'screen' : 'normal',
		'--dos-boot-bg': skin.isDark
			? 'radial-gradient(120% 100% at 50% 45%, #0a121b 0%, #04070c 72%)'
			: 'radial-gradient(120% 100% at 50% 42%, #f7f9fd 0%, #e7ecf5 70%)',
		'--dos-spark-glow': skin.isDark ? `drop-shadow(0 0 3px ${alpha(skin.accent, 0.55)})` : 'none',
		'--dos-led-shadow': skin.isDark ? `0 0 7px ${skin.accent}` : `0 0 5px ${alpha(skin.accent, 0.38)}`,
		'--dos-mass-color': skin.ink[0],
		'--dos-mass-color-dim': skin.ink[1],
		'--dos-strip-bg': skin.isDark ? 'rgba(8,12,20,.86)' : 'rgba(255,255,255,.86)',
	}
}

/** 字符场图集用的墨色（顺序与引擎里的 DEFAULT_INKS 对齐）。 */
export function inkPaletteFor(tone: Tone, accentHex: string): string[] {
	const skin = skinFor(tone, accentHex)
	if (tone === 'light') {
		return [
			skin.ink[0],
			mix(skin.accent, '#0a1220', 0.3),
			skin.accent,
			mix(skin.accent, '#ffffff', 0.35),
			mix(skin.danger, '#0a1220', 0.4),
			mix(skin.warn, '#0a1220', 0.45),
			mix(skin.accent, '#ffffff', 0.62),
		]
	}
	return [
		mix(skin.accent, '#ffffff', 0.72),
		skin.accent,
		mix(skin.accent, '#000000', 0.36),
		mix(skin.accent, '#000000', 0.66),
		skin.danger,
		skin.warn,
		mix(skin.accent, '#000000', 0.82),
	]
}
