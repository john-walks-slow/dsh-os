/**
 * /proc 与 /sys 的最小只读读取层。
 *
 * 数值单位在这里就归一：字节、千字节、秒、摄氏度。上层不再做换算，
 * 免得同一个换算在几处各写一遍。
 *
 * @module dsh-os/procfs
 */

import { readdirSync, readFileSync, statfsSync } from 'node:fs'
import { cpus, freemem, hostname, loadavg, networkInterfaces, platform, release, totalmem, uptime } from 'node:os'

/** 一次 CPU 时间片读数（jiffies）。 */
export interface CpuTimes {
	user: number
	nice: number
	system: number
	idle: number
	iowait: number
	irq: number
	softirq: number
	steal: number
}

/** 整机 CPU 时间片，逐核 + 汇总。 */
export interface CpuSnapshot {
	cores: CpuTimes[]
	total: CpuTimes
}

/** 内存读数，单位 KB（与 /proc/meminfo 一致）。 */
export interface MemSnapshot {
	total: number
	available: number
	free: number
	buffers: number
	cached: number
	dirty: number
	swapTotal: number
	swapFree: number
	slab: number
}

/** 网卡累计计数。 */
export interface NetSnapshot {
	iface: string
	rxBytes: number
	txBytes: number
	rxPackets: number
	txPackets: number
}

/** 磁盘占用，单位字节。 */
export interface DiskSnapshot {
	total: number
	used: number
	free: number
}

/** 温度与电池。 */
export interface PowerSnapshot {
	cpuTempC: number | null
	batteryPercent: number | null
	batteryTempC: number | null
	batteryStatus: string | null
}

/** 单个进程的资源占用（CPU 为两次采样差值）。 */
export interface ProcessRow {
	pid: number
	comm: string
	cpuPercent: number
	rssKb: number
}

/** 宿主与内核的静态事实，进程生命周期内只读一次。 */
export interface HostFacts {
	hostname: string
	kernel: string
	platform: string
	arch: string
	model: string
	cores: number
	memTotalKb: number
	uptimeSec: number
}

function readText(path: string): string | null {
	try {
		return readFileSync(path, 'utf8')
	} catch {
		return null
	}
}

function readNumber(path: string): number | null {
	const text = readText(path)
	if (text === null) return null
	const value = Number.parseFloat(text)
	return Number.isFinite(value) ? value : null
}

/** 平台能力：界面上没有数据的行直接不画。 */
export interface PlatformCaps {
	perCore: boolean
	freq: boolean
	swap: boolean
	net: boolean
	disk: boolean
	power: boolean
	proc: boolean
	load: boolean
}

export function platformCaps(): PlatformCaps {
	const linux = platform() === 'linux'
	return {
		perCore: cpus().length > 0,
		freq: linux,
		swap: linux,
		net: linux,
		disk: true,
		power: linux,
		proc: linux,
		load: platform() !== 'win32',
	}
}

/** 磁盘根：Windows 用系统盘，其余用 /。 */
export function diskRoot(): string {
	if (platform() !== 'win32') return '/'
	const drive = process.env.SystemDrive ?? 'C:'
	return `${drive}\\`
}

/** 用 node:os 的累计时间片兜底，Windows / macOS 上也能算 CPU 占用。 */
export function readCpuTimesFromOs(): CpuSnapshot | null {
	const list = cpus()
	if (list.length === 0) return null
	interface OsTimes {
		user: number
		nice?: number
		sys: number
		idle: number
		irq?: number
	}
	const toTimes = (times: OsTimes): CpuTimes => ({
		user: times.user,
		nice: times.nice ?? 0,
		system: times.sys,
		idle: times.idle,
		iowait: 0,
		irq: times.irq ?? 0,
		softirq: 0,
		steal: 0,
	})
	const cores = list.map((core) => toTimes(core.times))
	const total = cores.reduce(
		(sum, core) => ({
			user: sum.user + core.user,
			nice: sum.nice + core.nice,
			system: sum.system + core.system,
			idle: sum.idle + core.idle,
			iowait: 0,
			irq: sum.irq + core.irq,
			softirq: 0,
			steal: 0,
		}),
		{ user: 0, nice: 0, system: 0, idle: 0, iowait: 0, irq: 0, softirq: 0, steal: 0 },
	)
	return { cores, total }
}

/** 读取 /proc/stat 的 CPU 时间片；非 Linux 或读不到时退回 node:os。 */
export function readCpuTimes(): CpuSnapshot | null {
	const text = readText('/proc/stat')
	if (!text) return readCpuTimesFromOs()
	const cores: CpuTimes[] = []
	let total: CpuTimes | null = null
	for (const line of text.split('\n')) {
		if (!line.startsWith('cpu')) break
		const parts = line.trim().split(/\s+/)
		const name = parts[0]
		if (name !== 'cpu' && !/^cpu\d+$/.test(name)) continue
		const values = parts.slice(1, 9).map((value) => Number.parseInt(value, 10) || 0)
		const times: CpuTimes = {
			user: values[0] ?? 0,
			nice: values[1] ?? 0,
			system: values[2] ?? 0,
			idle: values[3] ?? 0,
			iowait: values[4] ?? 0,
			irq: values[5] ?? 0,
			softirq: values[6] ?? 0,
			steal: values[7] ?? 0,
		}
		if (name === 'cpu') total = times
		else cores.push(times)
	}
	if (!total) return null
	return { cores, total }
}

/** 逐核频率（MHz）；非 Linux 或读不到的核心用 null。 */
export function readCpuFreqs(coreCount: number): (number | null)[] {
	if (platform() !== 'linux') return new Array(coreCount).fill(null)
	const freqs: (number | null)[] = []
	for (let index = 0; index < coreCount; index += 1) {
		const khz = readNumber(`/sys/devices/system/cpu/cpu${index}/cpufreq/scaling_cur_freq`)
		freqs.push(khz === null ? null : Math.round(khz / 1000))
	}
	return freqs
}

/** 读取 /proc/meminfo；非 Linux 时用 node:os 的总量/可用量兜底。 */
export function readMem(): MemSnapshot | null {
	const text = readText('/proc/meminfo')
	if (!text) {
		const total = Math.round(totalmem() / 1024)
		const free = Math.round(freemem() / 1024)
		if (total <= 0) return null
		return { total, available: free, free, buffers: 0, cached: 0, dirty: 0, swapTotal: 0, swapFree: 0, slab: 0 }
	}
	const fields = new Map<string, number>()
	for (const line of text.split('\n')) {
		const match = /^(\w+):\s+(\d+)/.exec(line)
		if (match) fields.set(match[1]!, Number.parseInt(match[2]!, 10))
	}
	const pick = (key: string): number => fields.get(key) ?? 0
	const cached = pick('Cached') + pick('SReclaimable') - pick('Shmem')
	return {
		total: pick('MemTotal'),
		available: pick('MemAvailable'),
		free: pick('MemFree'),
		buffers: pick('Buffers'),
		cached: Math.max(cached, 0),
		dirty: pick('Dirty'),
		swapTotal: pick('SwapTotal'),
		swapFree: pick('SwapFree'),
		slab: pick('Slab'),
	}
}

/** 选择主用网卡：优先 wlan0，其次第一个非 lo 且有流量的接口。 */
export function pickIface(): string {
	const text = readText('/proc/net/dev')
	if (!text) {
		// 非 Linux 没有 /proc/net/dev：退到 node:os 的接口名，仅用于显示
		for (const [name, addresses] of Object.entries(networkInterfaces())) {
			if (addresses?.some((address) => !address.internal)) return name
		}
		return '—'
	}
	let fallback = 'lo'
	for (const line of text.split('\n').slice(2)) {
		const match = /^\s*([^:]+):/.exec(line)
		if (!match) continue
		const name = match[1]!.trim()
		if (name === 'lo') continue
		if (name === 'wlan0') return name
		if (fallback === 'lo') fallback = name
	}
	return fallback
}

/** 读取指定网卡的累计计数。 */
export function readNet(iface: string): NetSnapshot | null {
	const text = readText('/proc/net/dev')
	if (!text) return null
	for (const line of text.split('\n').slice(2)) {
		const match = /^\s*([^:]+):\s*(.*)$/.exec(line)
		if (!match || match[1]!.trim() !== iface) continue
		const values = match[2]!.trim().split(/\s+/).map((value) => Number.parseInt(value, 10) || 0)
		return {
			iface,
			rxBytes: values[0] ?? 0,
			rxPackets: values[1] ?? 0,
			txBytes: values[8] ?? 0,
			txPackets: values[9] ?? 0,
		}
	}
	return null
}

/** 读取根分区占用。 */
export function readDisk(path = diskRoot()): DiskSnapshot | null {
	try {
		const stats = statfsSync(path)
		const total = stats.blocks * stats.bsize
		const free = stats.bavail * stats.bsize
		return { total, free, used: total - free }
	} catch {
		return null
	}
}

const CPU_TEMP_HINTS = ['cpu', 'soc', 'apc', 'tsens', 'gpu', 'ddr', 'board']

/** 读取 CPU/SoC 温度与电池信息；读不到就是 null，不做降级猜测。 */
export function readPower(): PowerSnapshot {
	if (platform() !== 'linux') return { cpuTempC: null, batteryPercent: null, batteryTempC: null, batteryStatus: null }
	let cpuTempC: number | null = null
	try {
		for (const zone of readdirSync('/sys/class/thermal')) {
			if (!zone.startsWith('thermal_zone')) continue
			const type = (readText(`/sys/class/thermal/${zone}/type`) ?? '').trim().toLowerCase()
			const milli = readNumber(`/sys/class/thermal/${zone}/temp`)
			if (milli === null || milli <= 0) continue
			if (!CPU_TEMP_HINTS.some((hint) => type.includes(hint))) continue
			const celsius = milli / 1000
			if (celsius > 0 && celsius < 130 && (cpuTempC === null || celsius < cpuTempC)) cpuTempC = celsius
		}
	} catch {
		/* /sys 不可读时保持 null */
	}
	const batteryPercent = readNumber('/sys/class/power_supply/battery/capacity')
	const batteryTempRaw = readNumber('/sys/class/power_supply/battery/temp')
	const batteryStatus = (readText('/sys/class/power_supply/battery/status') ?? '').trim() || null
	return {
		cpuTempC: cpuTempC === null ? null : Math.round(cpuTempC * 10) / 10,
		batteryPercent: batteryPercent === null ? null : Math.round(batteryPercent),
		batteryTempC: batteryTempRaw === null ? null : Math.round((batteryTempRaw / 10) * 10) / 10,
		batteryStatus,
	}
}

/** 读取一个进程的 RSS（KB）与 comm。 */
function readProcBasics(pid: number): { comm: string; rssKb: number; ticks: number } | null {
	const stat = readText(`/proc/${pid}/stat`)
	if (!stat) return null
	const open = stat.indexOf('(')
	const close = stat.lastIndexOf(')')
	if (open < 0 || close < 0) return null
	const comm = stat.slice(open + 1, close)
	const rest = stat.slice(close + 2).split(/\s+/)
	// rest[0] 是 state，utime/stime 在整体字段里的下标 11/12 → rest 下标 11/12
	const utime = Number.parseInt(rest[11] ?? '0', 10) || 0
	const stime = Number.parseInt(rest[12] ?? '0', 10) || 0
	const rssPages = Number.parseInt(rest[21] ?? '0', 10) || 0
	return { comm, rssKb: (rssPages * 4096) / 1024, ticks: utime + stime }
}

/** 进程采样器：持有上一次的 CPU ticks，用于算差值占用率。 */
export class ProcessSampler {
	private previous = new Map<number, number>()
	private previousAt = 0

	/** 采样一次进程表，返回按 CPU 降序的前 limit 行。 */
	sample(limit = 6): { rows: ProcessRow[]; count: number; threads: number } {
		const now = Date.now()
		const elapsedSec = this.previousAt === 0 ? 0 : (now - this.previousAt) / 1000
		const clk = 100
		let pids: string[]
		try {
			pids = readdirSync('/proc').filter((name) => /^\d+$/.test(name))
		} catch {
			return { rows: [], count: 0, threads: 0 }
		}
		const next = new Map<number, number>()
		const rows: ProcessRow[] = []
		let threads = 0
		for (const name of pids) {
			const pid = Number.parseInt(name, 10)
			const basics = readProcBasics(pid)
			if (!basics) continue
			next.set(pid, basics.ticks)
			threads += 1
			const before = this.previous.get(pid)
			const cpuPercent =
				before === undefined || elapsedSec <= 0
					? 0
					: Math.max(0, ((basics.ticks - before) / clk / elapsedSec) * 100)
			rows.push({ pid, comm: basics.comm, cpuPercent, rssKb: Math.round(basics.rssKb) })
		}
		this.previous = next
		this.previousAt = now
		rows.sort((left, right) => right.cpuPercent - left.cpuPercent || right.rssKb - left.rssKb)
		return { rows: rows.slice(0, limit), count: rows.length, threads }
	}
}

/** /proc/cpuinfo 里能读到的 SoC 标识；非 Linux 直接用 node:os 的型号。 */
function readCpuModel(): string {
	const text = readText('/proc/cpuinfo') ?? ''
	for (const key of ['Hardware', 'model name', 'Processor', 'cpu model']) {
		const match = new RegExp(`^${key}\\s*:\\s*(.+)$`, 'm').exec(text)
		if (match?.[1]?.trim()) return match[1].trim()
	}
	const osModel = cpus()[0]?.model
	return osModel && osModel !== 'unknown' ? osModel : `ARM64 ${cpus().length}-core`
}

let facts: HostFacts | null = null

/** 宿主静态事实（只读一次并缓存）。 */
export function hostFacts(): HostFacts {
	if (facts) return facts
	const model = readCpuModel()
	facts = {
		hostname: hostname(),
		kernel: release(),
		platform: platform(),
		arch: process.arch,
		model: model.replace(/\s+/g, ' ').trim(),
		cores: cpus().length,
		memTotalKb: Math.round(totalmem() / 1024),
		uptimeSec: Math.round(uptime()),
	}
	return facts
}

/** 进程数（/proc 下的数字目录）。 */
export function readProcessCount(): number {
	try {
		return readdirSync('/proc').filter((name) => /^\d+$/.test(name)).length
	} catch {
		return 0
	}
}

/** /proc/loadavg 的 runnable/total 字段。 */
export function readRunQueue(): { running: number; total: number } {
	const text = readText('/proc/loadavg')
	if (!text) return { running: 0, total: 0 }
	const match = /(\d+)\/(\d+)/.exec(text)
	return { running: match ? Number.parseInt(match[1]!, 10) : 0, total: match ? Number.parseInt(match[2]!, 10) : 0 }
}

/** 系统负载与运行时长；Windows 没有 loadavg，返回零并由界面隐藏该行。 */
export function readLoad(): { load: [number, number, number]; uptimeSec: number } {
	const [one = 0, five = 0, fifteen = 0] = loadavg()
	const text = readText('/proc/uptime')
	const uptimeSec = text ? Number.parseFloat(text.split(/\s+/)[0] ?? '0') : uptime()
	return { load: [one, five, fifteen], uptimeSec: Math.round(uptimeSec) }
}
