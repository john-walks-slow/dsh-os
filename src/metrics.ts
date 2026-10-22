/**
 * 指标采样器：每 2 秒推进一格，压缩成一份给前端的快照。
 *
 * 采样与读取分开：定时器负责推进状态（两次读数作差），HTTP 请求只读
 * 最近一次结果。这样轮询频率不影响速率计算，也不会把 CPU 差值算两遍。
 *
 * @module dsh-os/metrics
 */

import { performance } from 'node:perf_hooks'
import type { CpuSnapshot, CpuTimes, DiskSnapshot, HostFacts, MemSnapshot, NetSnapshot, PlatformCaps, PowerSnapshot, ProcessRow } from './procfs.js'
import {
	hostFacts,
	platformCaps,
	pickIface,
	ProcessSampler,
	readCpuFreqs,
	readCpuTimes,
	readDisk,
	readLoad,
	readMem,
	readNet,
	readPower,
	readProcessCount,
	readRunQueue,
} from './procfs.js'

const TICK_MS = 2000
const HISTORY = 90

/** 前端消费的完整快照。 */
export interface MetricsPayload {
	t: number
	host: HostFacts
	/** 当前平台能拿到哪些数据，界面据此隐藏整行。 */
	cap: PlatformCaps
	cpu: {
		total: number
		cores: number[]
		freqs: (number | null)[]
		user: number
		system: number
		iowait: number
		steal: number
	}
	mem: MemSnapshot & { used: number; percent: number }
	load: [number, number, number]
	net: { iface: string; rxBps: number; txBps: number; rxTotal: number; txTotal: number }
	disk: DiskSnapshot
	power: PowerSnapshot
	proc: { total: number; running: number; tasks: number; top: ProcessRow[] }
	node: {
		pid: number
		rss: number
		heapUsed: number
		heapTotal: number
		external: number
		uptimeSec: number
		lagMs: number
		elu: number
		version: string
	}
	history: { at: number[]; cpu: number[]; mem: number[]; rx: number[]; tx: number[] }
}

function busyOf(times: CpuTimes): number {
	return times.user + times.nice + times.system + times.irq + times.softirq + times.steal
}

function totalOf(times: CpuTimes): number {
	return busyOf(times) + times.idle + times.iowait
}

function percentOf(previous: CpuTimes, current: CpuTimes): number {
	const totalDelta = totalOf(current) - totalOf(previous)
	if (totalDelta <= 0) return 0
	const busyDelta = busyOf(current) - busyOf(previous)
	return Math.min(100, Math.max(0, (busyDelta / totalDelta) * 100))
}

function round(value: number, digits = 1): number {
	const factor = 10 ** digits
	return Math.round(value * factor) / factor
}

/** 环形缓冲：固定长度，push 覆盖最旧。 */
class Ring {
	private values: number[] = []

	constructor(private readonly size: number) {}

	push(value: number): void {
		this.values.push(value)
		if (this.values.length > this.size) this.values.shift()
	}

	list(): number[] {
		return this.values.slice()
	}
}

/** 采样器本体。 */
export class MetricsSampler {
	private timer: ReturnType<typeof setInterval> | null = null
	private readonly processes = new ProcessSampler()
	private previousCpu: CpuSnapshot | null = null
	private previousNet: NetSnapshot | null = null
	private previousNetAt = 0
	private iface = pickIface()
	private cpuPercent = 0
	private corePercents: number[] = []
	private cpuBreakdown = { user: 0, system: 0, iowait: 0, steal: 0 }
	private netRates = { rxBps: 0, txBps: 0 }
	private procInfo: { total: number; running: number; tasks: number; top: ProcessRow[] } = {
		total: 0,
		running: 0,
		tasks: 0,
		top: [],
	}
	private lagMs = 0
	private tickCount = 0
	private readonly history = {
		at: new Ring(HISTORY),
		cpu: new Ring(HISTORY),
		mem: new Ring(HISTORY),
		rx: new Ring(HISTORY),
		tx: new Ring(HISTORY),
	}

	start(): void {
		if (this.timer) return
		this.prime()
		this.timer = setInterval(() => this.tick(), TICK_MS)
		this.timer.unref?.()
	}

	stop(): void {
		if (!this.timer) return
		clearInterval(this.timer)
		this.timer = null
	}

	/** 先建立基线，让第一份快照就有历史点。 */
	private prime(): void {
		this.previousCpu = readCpuTimes()
		this.previousNet = readNet(this.iface)
		this.previousNetAt = performance.now()
		this.processes.sample()
		this.tick()
	}

	private tick(): void {
		const now = performance.now()
		const cpu = readCpuTimes()
		if (cpu && this.previousCpu) {
			this.cpuPercent = round(percentOf(this.previousCpu.total, cpu.total))
			this.corePercents = cpu.cores.map((core, index) => {
				const before = this.previousCpu?.cores[index]
				return before ? round(percentOf(before, core)) : 0
			})
			const totalDelta = Math.max(1, totalOf(cpu.total) - totalOf(this.previousCpu.total))
			const share = (keys: (keyof CpuTimes)[]): number => {
				const before = this.previousCpu?.total
				if (!before) return 0
				const delta = keys.reduce((sum, key) => sum + (cpu.total[key] - before[key]), 0)
				return round((delta / totalDelta) * 100)
			}
			this.cpuBreakdown = {
				user: share(['user', 'nice']),
				system: share(['system', 'irq', 'softirq']),
				iowait: share(['iowait']),
				steal: share(['steal']),
			}
		}
		if (cpu) {
			this.previousCpu = cpu
		}

		const net = readNet(this.iface)
		if (net && this.previousNet) {
			const seconds = Math.max(0.2, (now - this.previousNetAt) / 1000)
			this.netRates = {
				rxBps: Math.max(0, Math.round((net.rxBytes - this.previousNet.rxBytes) / seconds)),
				txBps: Math.max(0, Math.round((net.txBytes - this.previousNet.txBytes) / seconds)),
			}
		}
		if (net) {
			this.previousNet = net
			this.previousNetAt = now
		}

		if (this.tickCount % 3 === 0) {
			const sampled = this.processes.sample(6)
			const queue = readRunQueue()
			this.procInfo = { total: sampled.count, running: queue.running, tasks: sampled.threads, top: sampled.rows }
		}
		this.tickCount += 1

		// 事件循环延迟：10ms 定时器的实际抖动。
		const scheduled = performance.now()
		setTimeout(() => {
			this.lagMs = round(Math.max(0, performance.now() - scheduled - 10), 1)
		}, 10).unref?.()

		const mem = readMem()
		this.history.at.push(Math.round(Date.now()))
		this.history.cpu.push(this.cpuPercent)
		this.history.mem.push(mem ? round(((mem.total - mem.available) / mem.total) * 100) : 0)
		this.history.rx.push(this.netRates.rxBps)
		this.history.tx.push(this.netRates.txBps)
	}

	/** 最近一次采样的完整快照。 */
	snapshot(): MetricsPayload {
		const facts = hostFacts()
		const mem = readMem() ?? {
			total: facts.memTotalKb,
			available: facts.memTotalKb,
			free: 0,
			buffers: 0,
			cached: 0,
			dirty: 0,
			swapTotal: 0,
			swapFree: 0,
			slab: 0,
		}
		const load = readLoad()
		const disk = readDisk() ?? { total: 0, used: 0, free: 0 }
		const net = readNet(this.iface)
		const memory = {
			...mem,
			used: mem.total - mem.available,
			percent: mem.total > 0 ? round(((mem.total - mem.available) / mem.total) * 100) : 0,
		}
		const usage = process.memoryUsage()
		const elu = performance.eventLoopUtilization()
		return {
			t: Date.now(),
			host: { ...facts, uptimeSec: load.uptimeSec },
			cap: platformCaps(),
			cpu: {
				total: this.cpuPercent,
				cores: this.corePercents,
				freqs: readCpuFreqs(facts.cores),
				...this.cpuBreakdown,
			},
			mem: memory,
			load: load.load,
			net: {
				iface: this.iface,
				rxBps: this.netRates.rxBps,
				txBps: this.netRates.txBps,
				rxTotal: net?.rxBytes ?? 0,
				txTotal: net?.txBytes ?? 0,
			},
			disk,
			power: readPower(),
			proc: { ...this.procInfo, total: this.procInfo.total || readProcessCount() },
			node: {
				pid: process.pid,
				rss: usage.rss,
				heapUsed: usage.heapUsed,
				heapTotal: usage.heapTotal,
				external: usage.external,
				uptimeSec: Math.round(process.uptime()),
				lagMs: this.lagMs,
				elu: round(elu.utilization * 100),
				version: process.version,
			},
			history: {
				at: this.history.at.list(),
				cpu: this.history.cpu.list(),
				mem: this.history.mem.list(),
				rx: this.history.rx.list(),
				tx: this.history.tx.list(),
			},
		}
	}
}
