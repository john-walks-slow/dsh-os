/**
 * 账本数据的前端入口：轮询宿主端点，并把"加载中"降级成一份空载荷。
 *
 * 数据源是宿主侧的会话投影索引（覆盖全部历史会话），不是浏览器手里的会话
 * 列表快照——后者只有列表级投影，拿不到 token 用量。
 *
 * @module dsh-os/client/harness
 */

import type { HarnessPayload } from '../harness.js'

export const HARNESS_ENDPOINT = '/plugins/dsh-os/harness'

/** 端点不可用时的占位：界面照常画，数字显示 `--`。 */
export function emptyHarness(): HarnessPayload {
	const emptyTotals = { sessions: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
	const emptyStats = {
		sessions: 0,
		active: 0,
		running: 0,
		subagents: 0,
		blank: 0,
		today: { sessions: 0, input: 0, output: 0, cacheRead: 0 },
		lastActiveAt: 0,
		tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		windows: { h24: emptyTotals, d7: emptyTotals, all: emptyTotals },
		topModel: null,
	}
	return {
		t: 0,
		store: { ok: false, root: '', sessions: 0, scannedAt: 0, partial: true, error: null },
		scope: { path: '', name: '' },
		space: emptyStats,
		all: emptyStats,
		models: { space: [], all: [] },
		sessions: [],
		sessionsAll: [],
		running: [],
	}
}

/** 拉一次账本；失败返回 null，由调用方保留上一帧。 */
export async function fetchHarness(workspace: string): Promise<HarnessPayload | null> {
	const query = workspace ? `?ws=${encodeURIComponent(workspace)}` : ''
	const response = await fetch(`${HARNESS_ENDPOINT}${query}`, { cache: 'no-store', credentials: 'same-origin' })
	if (!response.ok) return null
	return (await response.json()) as HarnessPayload
}
