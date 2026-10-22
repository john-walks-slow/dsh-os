/**
 * 宿主半边：两件事——把本机真实读数变成 HTTP 端点，把会话投影缓存索引成账本端点。
 *
 *   GET /plugins/dsh-os/metrics  → MetricsPayload（整机读数）
 *   GET /plugins/dsh-os/harness  → HarnessPayload（?ws=<cwd> 限定工作区）
 *
 * 端点由浏览器半边轮询。系统读数来自 /proc 与 /sys（非 Linux 走 node:os），
 * 会话与 token 口径来自 DSH 自己的投影缓存——浏览器手里的会话列表快照只有
 * 列表级投影，拿不到 token 用量。
 *
 * @module dsh-os
 */

import { HarnessIndex, type HarnessPayload } from './harness.js'
import { MetricsSampler } from './metrics.js'

const name = 'dsh-os'
const inject = ['webServer']

interface RouteResponse {
	writeHead: (status: number, headers: Record<string, string>) => void
	end: (body: string) => void
}

interface RouteRequest {
	url?: string
}

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }

function reply(res: unknown, payload: unknown, status = 200): void {
	const response = res as RouteResponse
	response.writeHead(status, JSON_HEADERS)
	response.end(JSON.stringify(payload))
}

/** 从请求行里取 `?ws=`；解不开就当没给（等于全机口径）。 */
function workspaceOf(req: unknown): string {
	const url = (req as RouteRequest | undefined)?.url
	if (!url) return ''
	try {
		return new URL(url, 'http://localhost').searchParams.get('ws') ?? ''
	} catch {
		return ''
	}
}

/** 路由处理：2 秒采样一次，请求只读快照。 */
function serveMetrics(sampler: MetricsSampler): (req: unknown, res: unknown) => void {
	return (_req, res) => {
		try {
			reply(res, sampler.snapshot())
		} catch (error) {
			reply(res, { error: String((error as Error)?.message ?? error) }, 500)
		}
	}
}

/** 账本路由：索引在后台维护，请求只做内存聚合。 */
function serveHarness(index: HarnessIndex): (req: unknown, res: unknown) => void {
	return (req, res) => {
		let payload: HarnessPayload
		try {
			payload = index.snapshot(workspaceOf(req))
		} catch (error) {
			reply(res, { error: String((error as Error)?.message ?? error) }, 500)
			return
		}
		reply(res, payload)
	}
}

interface WebServerLike {
	register: (route: { kind: 'exact'; path: string; handler: (req: unknown, res: unknown) => void }) => () => void
}

interface HostContext {
	webServer: WebServerLike
	effect: (dispose: () => () => void, label: string) => () => void
}

export function apply(ctx: HostContext): void {
	const sampler = new MetricsSampler()
	ctx.effect(() => {
		sampler.start()
		return () => sampler.stop()
	}, 'dsh-os: metrics sampler')

	ctx.effect(
		() =>
			ctx.webServer.register({
				kind: 'exact',
				path: '/plugins/dsh-os/metrics',
				handler: serveMetrics(sampler),
			}),
		'dsh-os: metrics route',
	)

	const harness = new HarnessIndex()
	ctx.effect(() => {
		harness.start()
		return () => harness.stop()
	}, 'dsh-os: session index')

	ctx.effect(
		() =>
			ctx.webServer.register({
				kind: 'exact',
				path: '/plugins/dsh-os/harness',
				handler: serveHarness(harness),
			}),
		'dsh-os: harness route',
	)
}

export { inject, name }
