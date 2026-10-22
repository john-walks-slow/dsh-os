/**
 * 浏览器半边用到的数据结构。宿主的 MetricsPayload / HarnessPayload 直接复用
 * （type-only，不产生运行时依赖）。
 *
 * @module dsh-os/client/types
 */

import type { MetricsPayload } from '../metrics.js'

export type { MetricsPayload }
export type { HarnessPayload, HarnessSessionRow, ModelUsageRow, ScopeStats, UsageTotals, WindowedUsage } from '../harness.js'

/** 一条控制台日志（任务栏滚动条用）。 */
export interface LogLine {
	at: number
	tag: string
	msg: string
	tone?: 'mag' | 'warn'
}

/** 桌面几何：由 DOM 实测得出。 */
export interface Geometry {
	/** 中央列的视口矩形。 */
	col: { x: number; y: number; w: number; h: number }
	/** hero（输入区 + 标题）的矩形，用作字符场的"让位区"。 */
	hero: { x: number; y: number; w: number; h: number } | null
	/** 会话视图滚动区的矩形（在会话里才有），遥测条贴着它的顶边。 */
	session: { x: number; y: number; w: number; h: number } | null
	/** 视口尺寸。 */
	view: { w: number; h: number }
}

/** 账本时间窗。 */
export type LedgerWindow = 'h24' | 'd7' | 'all'
