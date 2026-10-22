/**
 * 会话投影索引：把 DSH 落在磁盘上的会话投影缓存读成一份可聚合的监控数据。
 *
 * 客户端从会话服务拿到的是「列表级」投影键，`tokenUsage` / `sessionStats` 这类
 * 昂贵键必须先显式 refresh 才有值——所以首页在没有任何活跃会话时永远是 0。
 * 真实数据在 `<DSH_HOME>/storages/session_projcache/`：每个历史会话一个检查点
 * JSON，含全量投影行。
 *
 * 代价是这里得自己 stat + 解析 3000+ 个文件，因此：
 *   - 首轮分批（每 tick ≤200 个文件），用 setImmediate 让出事件循环，不长时间
 *     独占 DSH 主进程；
 *   - 之后每 intervalMs 只 stat 一遍，mtime/size 未变就跳过解析；
 *   - 单文件损坏只影响它自己，整轮刷新永不抛异常，出错走 warn 与 store.error。
 *
 * 缓存有 per-record 与 single 两代布局、version 见过 5 和 7，字段一律容错读取：
 * 取不到就是 0 / 空串 / false。
 *
 * @module dsh-os/harness
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BATCH_SIZE = 200
const DEFAULT_INTERVAL_MS = 15000
const DAY_MS = 24 * 60 * 60 * 1000
/**
 * 判「此刻在飞」的新鲜度阈值：长轮次里 DSH 会周期性写检查点，mtime 跟着刷新，
 * 所以 mtime 还新就说明 turn 真在跑；超过这个时间没再写入，那条 openTurn /
 * active 只是一条断掉或中断的历史记录。
 */
const LIVE_MS = 20 * 60 * 1000
/** 最近会话与运行列表的条数上限。 */
const RECENT_LIMIT = 8

export interface UsageTotals {
	sessions: number
	input: number
	output: number
	cacheRead: number
	cacheWrite: number
}

export interface WindowedUsage {
	h24: UsageTotals
	d7: UsageTotals
	all: UsageTotals
}

export interface ScopeStats {
	sessions: number
	active: number
	running: number
	subagents: number
	blank: number
	/** 今日会话及其真实消耗；缓存重读单独一栏，UI 里和新 token 分开显示。 */
	today: { sessions: number; input: number; output: number; cacheRead: number }
	lastActiveAt: number
	tokens: { input: number; output: number; cacheRead: number; cacheWrite: number }
	windows: WindowedUsage
	topModel: string | null
}

export interface ModelUsageRow {
	model: string
	provider: string
	sessions: number
	input: number
	output: number
	cacheRead: number
	cacheWrite: number
	tps: number | null
	cacheRatio: number
	lastAt: number
	/**
	 * 该模型下最近活动的会话 id，客户端点行时直接打开它；优先挑用户会面对的
	 * 会话（非子代理、非空白），没有才退回子代理/空白会话。
	 */
	lastSessionId: string | null
	windows: WindowedUsage
}

export interface HarnessSessionRow {
	id: string
	title: string
	cwd: string
	workspace: string
	model: string
	input: number
	output: number
	cacheRead: number
	running: boolean
	subagentActive: boolean
	subagents: number
	subagent: boolean
	updatedAt: number
	blank: boolean
}

export interface HarnessPayload {
	t: number
	store: { ok: boolean; root: string; sessions: number; scannedAt: number; partial: boolean; error: string | null }
	scope: { path: string; name: string }
	space: ScopeStats
	all: ScopeStats
	models: { space: ModelUsageRow[]; all: ModelUsageRow[] }
	/** 工作区口径的最近会话。 */
	sessions: HarnessSessionRow[]
	/** 全机口径的最近会话，客户端切到 ALL 时用它。 */
	sessionsAll: HarnessSessionRow[]
	running: HarnessSessionRow[]
}

export type StorageLayout = 'per-record' | 'single' | 'missing'

/** 索引里的一条会话，字段已从投影行里拍平。 */
interface SessionRecord {
	id: string
	title: string
	cwd: string
	provider: string
	model: string
	input: number
	output: number
	cacheRead: number
	cacheWrite: number
	decodeMs: number
	decodeTokens: number
	createdAt: number
	lastPromptAt: number
	lastActiveAt: number
	/** 投影里的原始标志（openTurnStartSeq != null）：是否在飞还要在 snapshot 时看新鲜度。 */
	openTurn: boolean
	subagent: boolean
	/** 原始的 subagentTiming.active / pendingTurnStart 标志，同样只是原始状态。 */
	subagentBusy: boolean
	subagents: number
	blank: boolean
	mtimeMs: number
	size: number
}

type Dict = Record<string, unknown>

/** 按模型聚合时的中间态：行本身 + 用来算 TPS 的解码耗时 + lastSessionId 的两档候选。 */
interface ModelBucket {
	row: ModelUsageRow
	decodeMs: number
	decodeTokens: number
	/** 「用户会面对的会话」（非子代理、非空白）里最近的那个。 */
	lastUserAt: number
	/** 后备候选：全是子代理/空白会话时才用它。 */
	fallbackAt: number
	fallbackSessionId: string | null
}

function dict(value: unknown): Dict | null {
	return typeof value === 'object' && value !== null ? (value as Dict) : null
}

function count(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function text(value: unknown): string {
	return typeof value === 'string' ? value : ''
}

/** 取一行投影的 `val`；行缺失或结构异常都当没有。 */
function rowValue(rows: Dict, key: string): unknown {
	return dict(rows[key])?.val
}

function shortError(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error)
	return message.split('\n')[0].slice(0, 200)
}

/** 展示用模型名：`provider/model`，缺哪半边就只用另半边。 */
function modelLabel(record: SessionRecord): string {
	if (record.provider && record.model) return `${record.provider}/${record.model}`
	return record.model || record.provider
}

function usageOf(row: ModelUsageRow): number {
	return row.input + row.output + row.cacheRead
}

/** 在飞 = 投影标记还没收尾，且检查点足够新（见 LIVE_MS）。 */
function isRunning(record: SessionRecord, now: number): boolean {
	return record.openTurn && now - record.lastActiveAt < LIVE_MS
}

/** 子代理在飞：同一套新鲜度判据，压的是子代理计时行。 */
function isSubagentBusy(record: SessionRecord, now: number): boolean {
	return record.subagentBusy && now - record.lastActiveAt < LIVE_MS
}

/** 会话列表口径：子代理与空白会话不进列表（总量与模型统计仍然含它们）。 */
function listable(record: SessionRecord): boolean {
	return !record.subagent && !record.blank
}

function emptyTotals(): UsageTotals {
	return { sessions: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
}

function addUsage(target: UsageTotals, record: SessionRecord, counted: boolean): void {
	if (counted) target.sessions += 1
	target.input += record.input
	target.output += record.output
	target.cacheRead += record.cacheRead
	target.cacheWrite += record.cacheWrite
}

function startOfToday(now: number): number {
	const midnight = new Date(now)
	midnight.setHours(0, 0, 0, 0)
	return midnight.getTime()
}

/** per-record 布局的单条记录，或 single 布局里 `tables.sessions[id]` 的值。 */
function parseSession(id: string, json: unknown, mtimeMs: number, size: number): SessionRecord {
	const root = dict(json)
	// v7 有 record 包裹，旧记录直接是 { identity, rows }。
	const record = dict(root?.record) ?? root ?? {}
	const identity = dict(record.identity) ?? {}
	const rows = dict(record.rows) ?? {}

	const totals = dict(dict(rowValue(rows, 'tokenUsage'))?.totals) ?? {}
	const stats = dict(rowValue(rows, 'sessionStats')) ?? {}
	const meta = dict(rowValue(rows, 'sessionListMetadata')) ?? {}
	const boundary = dict(rowValue(rows, 'turnBoundary'))
	const lastUsed = dict(dict(rowValue(rows, 'modelSelection'))?.lastUsed)
	const subagentRow = dict(rowValue(rows, 'subagent'))
	const subagentIdentity = dict(subagentRow?.identity)
	const timing = dict(rowValue(rows, 'subagentTiming'))
	const catalog = dict(dict(rowValue(rows, 'subagentCatalog'))?.head)
	const children = catalog?.values

	const fallbackTitle = text(dict(dict(rowValue(rows, 'titleInput'))?.first)?.text).split('\n')[0].trim()
	const createdAt = count(identity.createdAt)
	const lastPromptAt = count(meta.lastPromptAt)

	return {
		id,
		title: text(rowValue(rows, 'title')) || fallbackTitle,
		cwd: text(identity.cwd),
		provider: text(lastUsed?.provider),
		model: text(lastUsed?.model),
		input: count(totals.uncachedInputTokens),
		output: count(totals.outputTokens),
		cacheRead: count(totals.cacheReadTokens),
		cacheWrite: count(totals.cacheWriteTokens),
		decodeMs: count(stats.decodeMs),
		decodeTokens: count(stats.decodeTokens),
		createdAt,
		lastPromptAt,
		// 投影里没有「最后活动时间」这个键，用 最后提问 / 创建 / 文件 mtime 三者取大；
		// stat 的 mtimeMs 带亚毫秒小数，对外的时间戳统一取整。
		lastActiveAt: Math.max(lastPromptAt, createdAt, Math.floor(mtimeMs)),
		openTurn: boundary?.openTurnStartSeq != null,
		subagent: subagentIdentity !== null && Object.keys(subagentIdentity).length > 0,
		subagentBusy: timing?.active != null || timing?.pendingTurnStart != null,
		subagents: Array.isArray(children) ? children.length : 0,
		blank: meta.blank === true,
		mtimeMs,
		size,
	}
}

/**
 * 时间窗按会话的 `lastActiveAt` 归窗，而不是按轮次——投影缓存是按会话聚合的，
 * 一个跨天会话的 token 会整体落在它最后活动的那一窗里。所以三个窗口是近似值。
 *
 * 总量与模型统计都包含子代理会话的用量（那是真实消耗），只有 sessions 列表排除它们。
 * 空白会话反过来：用量照算，但不计入任何会话数——它只是「开过又没说话」的壳，
 * 单独由 blank 计数，界面另开一格显示。
 */
function aggregate(rows: SessionRecord[], now: number, models: ModelUsageRow[]): ScopeStats {
	const midnight = startOfToday(now)
	const h24 = emptyTotals()
	const d7 = emptyTotals()
	const all = emptyTotals()
	let active = 0
	let running = 0
	let subagents = 0
	let blank = 0
	let lastActiveAt = 0
	let todaySessions = 0
	let todayInput = 0
	let todayOutput = 0
	let todayCacheRead = 0

	for (const record of rows) {
		// 空白会话只是「开过又没说话」的壳：不计入任何会话数，但它的用量照算（本来就是 0）。
		const counted = !record.blank
		addUsage(all, record, counted)
		if (record.lastActiveAt >= now - DAY_MS) addUsage(h24, record, counted)
		if (record.lastActiveAt >= now - 7 * DAY_MS) {
			addUsage(d7, record, counted)
			if (counted) active += 1
		}
		if (record.lastActiveAt >= midnight) {
			if (counted) todaySessions += 1
			todayInput += record.input
			todayOutput += record.output
			todayCacheRead += record.cacheRead
		}
		if (isRunning(record, now)) running += 1
		if (record.subagent && isSubagentBusy(record, now)) subagents += 1
		if (record.blank) blank += 1
		if (record.lastActiveAt > lastActiveAt) lastActiveAt = record.lastActiveAt
	}

	return {
		sessions: all.sessions,
		active,
		running,
		subagents,
		blank,
		today: { sessions: todaySessions, input: todayInput, output: todayOutput, cacheRead: todayCacheRead },
		lastActiveAt,
		tokens: { input: all.input, output: all.output, cacheRead: all.cacheRead, cacheWrite: all.cacheWrite },
		windows: { h24, d7, all },
		topModel: models[0] ? modelRowLabel(models[0]) : null,
	}
}

function modelRowLabel(row: ModelUsageRow): string {
	if (row.provider && row.model) return `${row.provider}/${row.model}`
	return row.model || row.provider
}

/** 按 provider/model 聚合账本；零用量会话不进表，按 token 降序。 */
function buildModels(rows: SessionRecord[], now: number): ModelUsageRow[] {
	const buckets = new Map<string, ModelBucket>()

	for (const record of rows) {
		if (record.input + record.output + record.cacheRead === 0) continue
		const key = `${record.provider}\u0000${record.model}`
		let bucket = buckets.get(key)
		if (!bucket) {
			bucket = {
				row: {
					model: record.model,
					provider: record.provider,
					sessions: 0,
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					tps: null,
					cacheRatio: 0,
					lastAt: 0,
					lastSessionId: null,
					windows: { h24: emptyTotals(), d7: emptyTotals(), all: emptyTotals() },
				},
				decodeMs: 0,
				decodeTokens: 0,
				lastUserAt: 0,
				fallbackAt: 0,
				fallbackSessionId: null,
			}
			buckets.set(key, bucket)
		}
		const row = bucket.row
		// 与 ScopeStats 同口径：blank 会话的用量算，但不占会话数。
		const counted = !record.blank
		if (counted) row.sessions += 1
		row.input += record.input
		row.output += record.output
		row.cacheRead += record.cacheRead
		row.cacheWrite += record.cacheWrite
		if (record.lastActiveAt > row.lastAt) row.lastAt = record.lastActiveAt
		if (listable(record)) {
			if (record.lastActiveAt > bucket.lastUserAt) {
				bucket.lastUserAt = record.lastActiveAt
				row.lastSessionId = record.id
			}
		} else if (record.lastActiveAt > bucket.fallbackAt) {
			bucket.fallbackAt = record.lastActiveAt
			bucket.fallbackSessionId = record.id
		}
		bucket.decodeMs += record.decodeMs
		bucket.decodeTokens += record.decodeTokens
		addUsage(row.windows.all, record, counted)
		if (record.lastActiveAt >= now - DAY_MS) addUsage(row.windows.h24, record, counted)
		if (record.lastActiveAt >= now - 7 * DAY_MS) addUsage(row.windows.d7, record, counted)
	}

	const list: ModelUsageRow[] = []
	for (const bucket of buckets.values()) {
		const row = bucket.row
		row.tps = bucket.decodeMs > 0 ? bucket.decodeTokens / (bucket.decodeMs / 1000) : null
		row.cacheRatio = row.input + row.cacheRead > 0 ? row.cacheRead / (row.input + row.cacheRead) : 0
		if (row.lastSessionId === null) row.lastSessionId = bucket.fallbackSessionId
		list.push(row)
	}
	list.sort(
		(left, right) =>
			usageOf(right) - usageOf(left) ||
			left.model.localeCompare(right.model) ||
			left.provider.localeCompare(right.provider),
	)
	return list
}

function toSessionRow(record: SessionRecord, now: number): HarnessSessionRow {
	return {
		id: record.id,
		title: record.title || record.id,
		cwd: record.cwd,
		workspace: record.cwd ? basename(record.cwd) : '',
		model: modelLabel(record),
		input: record.input,
		output: record.output,
		cacheRead: record.cacheRead,
		running: isRunning(record, now),
		subagentActive: isSubagentBusy(record, now),
		subagents: record.subagents,
		subagent: record.subagent,
		updatedAt: record.lastActiveAt,
		blank: record.blank,
	}
}

function byLastActive(rows: SessionRecord[], now: number): HarnessSessionRow[] {
	return rows
		.slice()
		.sort((left, right) => right.lastActiveAt - left.lastActiveAt)
		.slice(0, RECENT_LIMIT)
		.map((record) => toSessionRow(record, now))
}

/** 插件从 profile 里被 link 时，模块路径上就有 `profiles`，它的父目录即 DSH_HOME。 */
function findProfileHome(): string | null {
	let dir = dirname(fileURLToPath(import.meta.url))
	for (;;) {
		if (existsSync(join(dir, 'profiles'))) return dir
		const parent = dirname(dir)
		if (parent === dir) return null
		dir = parent
	}
}

export function resolveStorageRoot(home?: string): { home: string; root: string; layout: StorageLayout } {
	const base = home || process.env.DSH_HOME || findProfileHome() || join(homedir(), '.dsh')
	const root = join(base, 'storages')
	const layout: StorageLayout = existsSync(join(root, 'session_projcache', 'sessions'))
		? 'per-record'
		: existsSync(join(root, 'session_projcache.json'))
			? 'single'
			: 'missing'
	return { home: base, root, layout }
}

export class HarnessIndex {
	private readonly storageRoot: string
	private readonly layout: StorageLayout
	private readonly intervalMs: number
	private readonly warn: (message: string) => void
	private readonly records = new Map<string, SessionRecord>()
	/** 待解析队列：首轮装全部文件，之后只装 mtime/size 变了的。 */
	private queue: string[] = []
	private pumping = false
	private disposed = false
	private found = false
	private rounds = 0
	private scannedAt = 0
	private error: string | null = null
	/** 本轮里解析失败的文件（单个坏文件不该抹掉整轮的成果，但也不能当作没发生）。 */
	private fileError: string | null = null
	private timer: ReturnType<typeof setInterval> | null = null
	/** single 布局只有一个文件，用它的 stat 判断要不要重解析。 */
	private singleStamp: { mtimeMs: number; size: number } | null = null

	constructor(options: { home?: string; intervalMs?: number; warn?: (message: string) => void } = {}) {
		const resolved = resolveStorageRoot(options.home)
		this.storageRoot = resolved.root
		this.layout = resolved.layout
		this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS
		this.warn = options.warn ?? (() => {})
	}

	start(): void {
		if (this.timer !== null || this.disposed) return
		if (this.layout === 'missing') {
			// 没有缓存可读：ok=false，但仍然让 partial 收尾，界面才不会一直转圈。
			this.error = `找不到会话投影缓存：${this.storageRoot}`
			this.warn(`[dsh-os] ${this.error}`)
			this.found = true
			this.scannedAt = Date.now()
			return
		}
		this.refresh()
		this.timer = setInterval(() => this.refresh(), this.intervalMs)
	}

	stop(): void {
		this.disposed = true
		if (this.timer !== null) {
			clearInterval(this.timer)
			this.timer = null
		}
	}

	/** 纯内存聚合，同步返回；workspace 是绝对路径 cwd，给了就只算它的空间。 */
	snapshot(workspace?: string): HarnessPayload {
		const now = Date.now()
		const rows = [...this.records.values()]
		const path = workspace ?? ''
		const spaceRows = path ? rows.filter((record) => record.cwd === path) : rows

		const modelsAll = buildModels(rows, now)
		const all = aggregate(rows, now, modelsAll)
		const modelsSpace = path ? buildModels(spaceRows, now) : modelsAll
		const space = path ? aggregate(spaceRows, now, modelsSpace) : all
		const sessionsAll = byLastActive(rows.filter(listable), now)

		return {
			t: now,
			store: {
				ok: this.layout !== 'missing' && this.rounds > 0,
				root: this.storageRoot,
				sessions: rows.length,
				scannedAt: this.scannedAt,
				partial: !this.found,
				error: this.error,
			},
			scope: { path, name: path ? basename(path) : '' },
			space,
			all,
			models: { space: modelsSpace, all: modelsAll },
			sessions: path ? byLastActive(spaceRows.filter(listable), now) : sessionsAll,
			sessionsAll,
			running: byLastActive(rows.filter((record) => !record.blank && isRunning(record, now)), now),
		}
	}

	root(): string {
		return this.storageRoot
	}

	private refresh(): void {
		if (this.disposed) return
		try {
			if (this.layout === 'single') {
				this.refreshSingle()
				return
			}
			const dir = join(this.storageRoot, 'session_projcache', 'sessions')
			const keys = readdirSync(dir)
				.filter((name) => name.endsWith('.json'))
				.map((name) => name.slice(0, -'.json'.length))
			const present = new Set(keys)
			for (const key of this.records.keys()) {
				if (!present.has(key)) this.records.delete(key)
			}
			if (!this.found) {
				// 首轮整份入队后分批解析；期间到点的刷新直接跳过，否则会把解析进度冲掉。
				if (this.pumping) return
				this.fileError = null
				this.queue = keys
				this.pump()
				return
			}
			this.fileError = null
			for (const key of keys) {
				const record = this.records.get(key)
				const stat = statSync(join(dir, `${key}.json`))
				if (!record || record.mtimeMs !== stat.mtimeMs || record.size !== stat.size) this.queue.push(key)
			}
			if (this.queue.length > 0) this.pump()
			else this.finish()
		} catch (error) {
			this.fail(error)
		}
	}

	private refreshSingle(): void {
		const file = join(this.storageRoot, 'session_projcache.json')
		let stamp: { mtimeMs: number; size: number }
		try {
			const stat = statSync(file)
			stamp = { mtimeMs: stat.mtimeMs, size: stat.size }
		} catch (error) {
			// 缓存文件被删掉了：行数据不再可信，清空。
			this.records.clear()
			this.singleStamp = null
			this.fail(error)
			return
		}
		if (this.found && this.singleStamp && this.singleStamp.mtimeMs === stamp.mtimeMs && this.singleStamp.size === stamp.size) {
			this.finish()
			return
		}
		try {
			const tables = dict(dict(JSON.parse(readFileSync(file, 'utf8')))?.tables)
			const sessions = dict(tables?.sessions) ?? {}
			this.records.clear()
			for (const [id, value] of Object.entries(sessions)) this.records.set(id, parseSession(id, value, stamp.mtimeMs, stamp.size))
			this.singleStamp = stamp
			this.finish()
		} catch (error) {
			// 解析失败保留上一轮数据，别把好数据换成空。
			this.fail(error)
		}
	}

	/** 分批解析：每 tick 最多 BATCH_SIZE 个文件，其余交给下一轮事件循环。 */
	private pump(): void {
		if (this.pumping) return
		this.pumping = true
		const step = (): void => {
			try {
				for (const key of this.queue.splice(0, BATCH_SIZE)) this.index(key)
				if (this.disposed) {
					this.pumping = false
					return
				}
				if (this.queue.length > 0) {
					setImmediate(step)
					return
				}
				this.pumping = false
				this.found = true
				this.finish()
			} catch (error) {
				this.pumping = false
				this.fail(error)
			}
		}
		step()
	}

	private index(key: string): void {
		const file = join(this.storageRoot, 'session_projcache', 'sessions', `${key}.json`)
		try {
			const stat = statSync(file)
			const record = parseSession(key, JSON.parse(readFileSync(file, 'utf8')), stat.mtimeMs, stat.size)
			this.records.set(key, record)
		} catch (error) {
			// 单个文件坏掉不牵连整轮：丢掉它的旧数据，把原因留给 store.error。
			this.records.delete(key)
			this.fileError = `${key}: ${shortError(error)}`
			this.warn(`[dsh-os] 会话投影解析失败 ${this.fileError}`)
		}
	}

	private finish(): void {
		this.scannedAt = Date.now()
		this.found = true
		this.rounds += 1
		// 整轮没出错就只剩单文件的问题，两者都要如实报到 store.error。
		this.error = this.fileError
	}

	private fail(error: unknown): void {
		this.error = shortError(error)
		this.warn(`[dsh-os] 会话投影索引刷新失败：${this.error}`)
	}
}
