/**
 * 宿主半边：只做一件事——把本机真实读数变成一个 HTTP 端点。
 *
 *   GET /plugins/dsh-os/metrics → MetricsPayload
 *
 * 端点由浏览器半边轮询。系统读数来自 /proc 与 /sys，DSH 侧的会话与上下文
 * 数据由客户端自己从会话服务读，不从这里转发。
 *
 * @module dsh-os
 */

import { MetricsSampler } from './metrics.js'

const name = 'dsh-os'
const inject = ['webServer']

/** 路由处理：2 秒采样一次，请求只读快照。 */
function serveMetrics(sampler: MetricsSampler): (req: unknown, res: unknown) => void {
	return (_req, res) => {
		const response = res as {
			writeHead: (status: number, headers: Record<string, string>) => void
			end: (body: string) => void
		}
		let body: string
		try {
			body = JSON.stringify(sampler.snapshot())
		} catch (error) {
			response.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
			response.end(JSON.stringify({ error: String((error as Error)?.message ?? error) }))
			return
		}
		response.writeHead(200, {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'no-store',
		})
		response.end(body)
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
}

export { inject, name }
