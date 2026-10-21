/**
 * 浏览器半边用到的数据结构。host 的 MetricsPayload 直接复用（type-only，
 * 不产生运行时依赖）；Harness 侧的统计由客户端从会话服务现算。
 *
 * @module dsh-os/client/types
 */

import type { MetricsPayload } from '../metrics.js'

export type { MetricsPayload }

/** 会话列表里的一行。 */
export interface HarnessSession {
	id: string
	title: string
	running: boolean
	updatedAt: number
	blank: boolean
	workspace: string
}

/** Token 账本里的一行（按会话聚合）。 */
export interface LedgerRow {
	id: string
	title: string
	preset: string
	input: number
	output: number
	cacheRead: number
	cacheRatio: number
	tps: number | null
}

/** 当前会话的上下文压力与累计 token。 */
export interface ContextStat {
	sessionTitle: string
	pressure: number | null
	projected: number | null
	window: number | null
	input: number
	output: number
	cacheRead: number
	cacheWrite: number
}

/** DSH 侧统计。 */
export interface HarnessSnapshot {
	total: number
	running: number
	blank: number
	workspaces: number
	workspace: string
	recent: HarnessSession[]
	context: ContextStat | null
	model: string
	ledger: LedgerRow[]
	totals: { input: number; output: number; cacheRead: number; cacheWrite: number }
}

/** 一条控制台日志。 */
export interface LogLine {
	at: number
	tag: string
	msg: string
	tone?: 'mag' | 'warn'
}

/** 用户偏好。 */
export interface Prefs {
	enabled: boolean
	field: boolean
	boot: boolean
}

/** 桌面几何：由 DOM 实测得出。 */
export interface Geometry {
	/** 中央列的视口矩形。 */
	col: { x: number; y: number; w: number; h: number }
	/** hero（输入区 + 标题）的矩形，用作字符场的"让位区"。 */
	hero: { x: number; y: number; w: number; h: number } | null
	/** 视口尺寸。 */
	view: { w: number; h: number }
}
