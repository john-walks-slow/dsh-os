/**
 * 宿主半边的跨平台校验（Windows 真机 / CI 与本地 Linux 共用）。
 *
 * 直接加载构建后的 `lib/index.js`，用最小 ctx 拿到两个 HTTP 路由，然后：
 *   - 断言整机读数在"没有 /proc 与 /sys"的平台上仍有真实值（CPU、内存、磁盘）；
 *   - 断言能力位与平台一致，界面据此隐藏拿不到的行；
 *   - 往临时 DSH_HOME 写会话投影夹具，断言账本与 Windows 路径归一化。
 *
 * Windows 上 `C:\a\b` / `C:/A/B` 必须算同一个工作区——这是最容易在真机上
 * 静默出错、又最难在 Linux 开发机发现的一条。
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { cpus, tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../lib/index.js'

const win = process.platform === 'win32'
const home = mkdtempSync(join(tmpdir(), 'dsh-os host '))
const projDir = join(home, 'storages', 'session_projcache', 'sessions')
mkdirSync(projDir, { recursive: true })

const now = Date.now()
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

const ws = win ? 'C:\\Users\\runner\\Project' : join(home, 'Project')
const wsAlt = win ? 'C:/Users/Runner/Project' : ws
const wsOther = win ? 'C:\\Users\\runner\\Other' : join(home, 'Other')

const row = (value) => ({ ver: 1, seq: 20, val: value })

function record(cwd, model, input, output, ago, openTurn = false) {
	const lastPromptAt = now - ago
	return {
		version: 7,
		record: {
			identity: { formatVersion: 4, createdAt: lastPromptAt - HOUR, cwd },
			rows: {
				title: row(model),
				modelSelection: row({ lastUsed: { provider: 'cpa', model }, pending: null }),
				tokenUsage: row({
					totals: { uncachedInputTokens: input, outputTokens: output, cacheReadTokens: input * 4, cacheWriteTokens: 0 },
				}),
				sessionStats: row({ turns: 12, steps: 40, decodeMs: 600_000, decodeTokens: 60_000 }),
				contextPressure: row({ surfaceTokens: 40_000, pressureTokens: 60_000, contextWindow: 512_000 }),
				sessionListMetadata: row({ blank: false, lastPromptAt }),
				turnBoundary: row({ openTurnStartSeq: openTurn ? 5 : null, lastTurn: 4 }),
			},
		},
	}
}

function seed(id, cwd, model, input, output, ago, openTurn) {
	const path = join(projDir, `${id}.json`)
	writeFileSync(path, JSON.stringify(record(cwd, model, input, output, ago, openTurn)))
	const stamp = (now - ago) / 1000
	utimesSync(path, stamp, stamp)
}

seed('host-fixture-a', wsAlt, 'medium', 1_200_000, 240_000, 3 * HOUR)
seed('host-fixture-b', ws, 'low', 300_000, 40_000, 2 * 60_000, true)
seed('host-fixture-c', wsOther, 'high', 5_000_000, 900_000, 40 * DAY)

process.env.DSH_HOME = home

const routes = new Map()
const cleanups = []
const ctx = {
	webServer: {
		register: ({ path, handler }) => {
			routes.set(path, handler)
			return () => routes.delete(path)
		},
	},
	effect: (dispose) => {
		const cleanup = dispose()
		if (typeof cleanup === 'function') cleanups.push(cleanup)
		return () => cleanup?.()
	},
}
apply(ctx)

function call(pathname, search = '') {
	return new Promise((resolve, reject) => {
		const handler = routes.get(pathname)
		if (!handler) return reject(new Error(`route missing: ${pathname}`))
		handler(
			{ url: `${pathname}${search}` },
			{
				writeHead: () => {},
				end: (body) => {
					try {
						resolve(JSON.parse(body))
					} catch (error) {
						reject(error)
					}
				},
			},
		)
	})
}

const checks = []
function check(label, fn) {
	try {
		fn()
		checks.push({ label, ok: true })
		console.log(`  ✓ ${label}`)
	} catch (error) {
		checks.push({ label, ok: false, error })
		console.log(`  ✗ ${label} — ${error.message}`)
	}
}

async function waitForHarness(search = '') {
	const deadline = Date.now() + 15_000
	let last = null
	while (Date.now() < deadline) {
		last = await call('/plugins/dsh-os/harness', search)
		if (last.store?.ok && !last.store.partial && last.store.sessions >= 3) return last
		await new Promise((resolve) => setTimeout(resolve, 250))
	}
	return last
}

try {
	console.log(`host metrics · ${process.platform} ${process.arch}`)
	await new Promise((resolve) => setTimeout(resolve, 2300))
	const metrics = await call('/plugins/dsh-os/metrics')

	check('端点返回的是宿主真实平台', () => assert.equal(metrics.host.platform, process.platform))
	check('CPU 核心数与 os.cpus() 一致', () => {
		assert.equal(metrics.host.cores, cpus().length)
		assert.equal(metrics.cpu.cores.length, cpus().length)
		assert.equal(metrics.cpu.freqs.length, cpus().length)
	})
	check('CPU 占用是 0–100 的真实百分比', () => {
		assert.ok(metrics.cpu.total >= 0 && metrics.cpu.total <= 100, `cpu=${metrics.cpu.total}`)
	})
	check('内存有真实总量与占用率', () => {
		assert.ok(metrics.mem.total > 0)
		assert.ok(metrics.mem.percent >= 0 && metrics.mem.percent <= 100, `mem=${metrics.mem.percent}`)
	})
	check('磁盘能读到系统盘容量', () => {
		assert.ok(metrics.disk.total > 0, JSON.stringify(metrics.disk))
		assert.ok(metrics.disk.used >= 0 && metrics.disk.free >= 0)
	})
	check('宿主型号不是占位串（Windows 上尤其重要）', () => {
		assert.ok(typeof metrics.host.model === 'string' && metrics.host.model.length > 0)
		if (win) assert.ok(!/^ARM64\b/.test(metrics.host.model), metrics.host.model)
	})
	check('事件循环与 Node 运行时读数可用', () => {
		assert.ok(Number.isFinite(metrics.node.lagMs))
		assert.ok(Number.isFinite(metrics.node.elu))
		assert.ok(metrics.node.version.startsWith('v'))
	})

	if (win) {
		check('Windows 能力位：CPU 分核可用、/proc 与 /sys 行关闭', () => {
			assert.equal(metrics.cap.perCore, true)
			assert.equal(metrics.cap.freq, false)
			assert.equal(metrics.cap.net, false)
			assert.equal(metrics.cap.swap, false)
			assert.equal(metrics.cap.power, false)
			assert.equal(metrics.cap.proc, false)
			assert.equal(metrics.cap.load, false)
			assert.equal(metrics.cap.disk, true)
		})
		check('Windows 没有伪造 CPU 频率', () => {
			assert.ok(metrics.cpu.freqs.every((value) => value === null))
		})
	} else if (process.platform === 'linux') {
		check('Linux 能力位保持完整', () => {
			assert.equal(metrics.cap.perCore, true)
			assert.equal(metrics.cap.freq, true)
			assert.equal(metrics.cap.net, true)
			assert.equal(metrics.cap.proc, true)
			assert.equal(metrics.cap.disk, true)
		})
	}

	console.log('harness ledger')
	const payload = await waitForHarness()
	check('账本索引在临时 home 里收敛', () => {
		assert.equal(payload.store.ok, true, JSON.stringify(payload.store))
		assert.equal(payload.store.partial, false)
		assert.ok(payload.store.sessions >= 3, `sessions=${payload.store.sessions}`)
	})
	check('全机口径覆盖多个工作区', () => {
		assert.ok(payload.all.sessions >= 3)
		assert.ok(payload.models.all.some((row) => row.model === 'high'))
	})

	for (const query of [ws, wsAlt, `${ws}${win ? '\\' : '/'}`]) {
		const scoped = await waitForHarness(`?ws=${encodeURIComponent(query)}`)
		check(`工作区口径归一化：${query}`, () => {
			assert.equal(scoped.space.sessions, 2, JSON.stringify(scoped.space))
			assert.equal(scoped.scope.name.toLowerCase(), 'project')
			assert.equal(scoped.sessions.length, 2)
			assert.equal(scoped.all.sessions, payload.all.sessions)
			assert.ok(!scoped.models.space.some((row) => row.model === 'high'))
			assert.ok(scoped.models.space.some((row) => row.model === 'medium'))
			assert.ok(scoped.models.space.some((row) => row.model === 'low'))
		})
	}

	check('在跑会话按新鲜度判定', () => {
		assert.equal(payload.running.length, 1)
		assert.equal(payload.running[0].id, 'host-fixture-b')
	})
} finally {
	for (const cleanup of cleanups.reverse()) {
		try {
			cleanup()
		} catch {
			/* 清理失败不掩盖断言结果 */
		}
	}
	rmSync(home, { recursive: true, force: true })
}

const failed = checks.filter((entry) => !entry.ok)
if (failed.length > 0) {
	console.error(`\n${failed.length} 项失败`)
	process.exit(1)
}
console.log('\n全部通过')
