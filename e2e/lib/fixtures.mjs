/**
 * e2e 固定的会话投影夹具。
 *
 * 账本读的是 `<DSH_HOME>/storages/session_projcache/sessions/*.json`，而 e2e 用的
 * 是隔离 home，天然一条记录都没有。这里手写几条形状正确的检查点，覆盖：
 * 两个工作区、三个模型、一条新鲜的在跑会话、一条超过新鲜度阈值的中断会话、
 * 一条正在飞的子代理会话、一条 40 天前的老会话。
 *
 * @module dsh-os/e2e/fixtures
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const HOME_WORKSPACE = '/root/projects/dsh-os'
export const OTHER_WORKSPACE = '/root/e2e-other-workspace'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * 每条夹具：工作区、模型、用量、最近活动距今多久、是否 open turn、
 * 是否子代理会话、文件 mtime 距今多久（默认与最近活动一致）。
 */
const FIXTURES = [
	{
		id: 'e2e-fixture-aaa',
		cwd: HOME_WORKSPACE,
		title: 'fixture · medium 记账会话',
		provider: 'cpa',
		model: 'medium',
		input: 1_200_000,
		output: 240_000,
		cacheRead: 9_000_000,
		ago: 3 * HOUR,
		decodeMs: 2_105_000,
		decodeTokens: 240_000,
	},
	{
		id: 'e2e-fixture-bbb',
		cwd: HOME_WORKSPACE,
		title: 'fixture · low 正在跑',
		provider: 'cpa',
		model: 'low',
		input: 300_000,
		output: 40_000,
		cacheRead: 2_000_000,
		ago: 2 * MINUTE,
		openTurn: true,
	},
	{
		id: 'e2e-fixture-ccc',
		cwd: OTHER_WORKSPACE,
		title: 'fixture · 别的工作区',
		provider: 'cpa',
		model: 'high',
		input: 5_000_000,
		output: 900_000,
		cacheRead: 20_000_000,
		ago: 40 * DAY,
	},
	{
		id: 'e2e-fixture-ddd',
		cwd: HOME_WORKSPACE,
		title: 'fixture · 中断的子代理',
		provider: 'cpa',
		model: 'low',
		input: 1_000_000,
		output: 100_000,
		cacheRead: 0,
		ago: 2 * HOUR,
		openTurn: true,
		subagent: true,
		subagentActive: true,
	},
	{
		id: 'e2e-fixture-eee',
		cwd: HOME_WORKSPACE,
		title: 'fixture · 在飞的子代理',
		provider: 'cpa',
		model: 'low',
		input: 500_000,
		output: 60_000,
		cacheRead: 800_000,
		ago: MINUTE,
		openTurn: true,
		subagent: true,
		subagentActive: true,
	},
]

function row(value, seq = 20) {
	return { ver: 1, seq, val: value }
}

function recordOf(fixture, now) {
	const lastPromptAt = now - fixture.ago
	const age = fixture.ageMs ?? fixture.ago
	return {
		version: 7,
		record: {
			identity: { formatVersion: 4, createdAt: lastPromptAt - HOUR, cwd: fixture.cwd, isSeeded: fixture.subagent === true },
			rows: {
				title: row(fixture.title),
				agentPreset: row(fixture.subagent ? 'reviewer' : 'standard'),
				modelSelection: row({ lastUsed: { provider: fixture.provider, model: fixture.model }, pending: null }),
				tokenUsage: row({
					totals: {
						uncachedInputTokens: fixture.input,
						outputTokens: fixture.output,
						cacheReadTokens: fixture.cacheRead,
						cacheWriteTokens: 0,
					},
				}),
				sessionStats: row({
					turns: 12,
					steps: 40,
					decodeMs: fixture.decodeMs ?? 600_000,
					decodeTokens: fixture.decodeTokens ?? 60_000,
				}),
				contextPressure: row({ surfaceTokens: 40_000, pressureTokens: 60_000, contextWindow: 512_000 }),
				sessionListMetadata: row({ blank: false, lastPromptAt }),
				turnBoundary: row({ openTurnStartSeq: fixture.openTurn ? 5 : null, lastTurn: fixture.openTurn ? 3 : 4 }),
				subagent: row(fixture.subagent ? { identity: { mode: 'one-shot', label: fixture.title, seq: 3 } } : {}),
				subagentTiming: row({ active: fixture.subagentActive ? { since: lastPromptAt, through: lastPromptAt + MINUTE } : null }),
				subagentCatalog: row({
					head: fixture.subagent
						? undefined
						: { values: [{ childId: 'e2e-fixture-eee', label: 'fixture child' }] },
				}),
			},
		},
		__ageMs: age,
	}
}

/** 清掉上一轮留下的夹具（含截图用的展示夹具），让断言不受历史影响。 */
export function resetFixtures(home) {
	const dir = join(home, 'storages', 'session_projcache', 'sessions')
	try {
		for (const name of readdirSync(dir)) {
			if (/^(e2e-fixture-|show-)/.test(name)) rmSync(join(dir, name), { force: true })
		}
	} catch {
		/* 目录还不存在就没什么可清的 */
	}
}

/** 把夹具写进隔离 home 的投影缓存目录。 */
export function seedFixtures(home) {
	resetFixtures(home)
	const dir = join(home, 'storages', 'session_projcache', 'sessions')
	mkdirSync(dir, { recursive: true })
	const now = Date.now()
	for (const fixture of FIXTURES) {
		const payload = recordOf(fixture, now)
		const age = payload.__ageMs
		delete payload.__ageMs
		const path = join(dir, `${fixture.id}.json`)
		writeFileSync(path, JSON.stringify(payload))
		const stamp = (now - age) / 1000
		utimesSync(path, stamp, stamp)
	}
}

export const EXPECTED = {
	homeWorkspace: HOME_WORKSPACE,
	otherWorkspace: OTHER_WORKSPACE,
	/** dsh-os 口径：aaa + bbb + ddd + eee（子代理也计入用量）。 */
	spaceSessions: 4,
	/** 新且在跑的：bbb + eee；ddd 的 open turn 已过期不算。 */
	spaceRunning: 2,
	/** 在飞的子代理：eee。 */
	spaceSubagents: 1,
	/** 最近会话列表（排除子代理与空白）：aaa、bbb。 */
	spaceRecent: ['e2e-fixture-aaa', 'e2e-fixture-bbb'],
	spaceModels: ['cpa/medium', 'cpa/low'],
	allModelsIncludes: 'cpa/high',
	spaceSessionsCount: 4,
	allSessionsAtLeast: 5,
}

/**
 * 展示用夹具：比冒烟夹具更丰富（多模型、多工作区、一条在跑、两条在飞子代理），
 * 只为 README 截图服务——账本要有多行、最近会话要填满，图才有说服力。
 */
const SHOWCASE = [
	['show-medium-1', HOME_WORKSPACE, '首页 HUD 重构与深浅色适配', 'cpa', 'medium', 4_820_000, 612_000, 96_400_000, 26 * MINUTE, 186_000],
	['show-medium-2', HOME_WORKSPACE, '会话投影索引与账本口径', 'cpa', 'medium', 2_140_000, 288_000, 41_200_000, 3 * HOUR, 74_000],
	['show-low-1', HOME_WORKSPACE, '排队中的 lint 清理', 'cpa', 'low', 620_000, 84_000, 5_400_000, 41 * MINUTE, 22_000],
	['show-omni-1', HOME_WORKSPACE, '字符场引擎调参', 'cpa', 'omni', 1_960_000, 402_000, 12_800_000, 9 * HOUR, 96_000],
	['show-high-1', HOME_WORKSPACE, '跨平台兜底与 Windows 路径', 'cpa', 'high', 890_000, 176_000, 8_600_000, 2 * DAY, 41_000],
	['show-child-1', HOME_WORKSPACE, 'reviewer · 代码检视', 'cpa', 'low', 340_000, 46_000, 1_200_000, 2 * MINUTE, 9_000, true, true],
	['show-child-2', HOME_WORKSPACE, 'explore · 定位端点注册', 'cpa', 'low', 180_000, 22_000, 640_000, 40_000, 5_000, true, true],
	['show-other-1', OTHER_WORKSPACE, '代理节点健康检查', 'cpa', 'lite', 3_400_000, 520_000, 62_000_000, 5 * HOUR, 132_000],
	['show-other-2', OTHER_WORKSPACE, '订阅模板更新', 'cpa', 'lite', 780_000, 120_000, 9_800_000, 3 * DAY, 28_000],
]

/** 写展示夹具（覆盖冒烟夹具之外的内容）。 */
export function seedShowcase(home) {
	resetFixtures(home)
	const dir = join(home, 'storages', 'session_projcache', 'sessions')
	mkdirSync(dir, { recursive: true })
	const now = Date.now()
	for (const [id, cwd, title, provider, model, input, output, cacheRead, ago, decodeTokens, subagent, subagentActive] of SHOWCASE) {
		const fixture = {
			id,
			cwd,
			title,
			provider,
			model,
			input,
			output,
			cacheRead,
			ago,
			openTurn: subagent === true,
			subagent: subagent === true,
			subagentActive: subagentActive === true,
			decodeMs: (decodeTokens / 90) * 1000,
			decodeTokens,
		}
		const payload = recordOf(fixture, now)
		const age = payload.__ageMs
		delete payload.__ageMs
		const path = join(dir, `${id}.json`)
		writeFileSync(path, JSON.stringify(payload))
		const stamp = (now - age) / 1000
		utimesSync(path, stamp, stamp)
	}
}

/**
 * 把一段**真实会话日志**搬进隔离 home，好让截图里出现真正的消息流。
 *
 * 会话在 DSH 里是"日志文件 + 工作区登记"两处：日志要在
 * `sessions/<cwd key>/<id>/`，id 还要出现在 `storages/workspace.json` 的
 * `sessionIds` 里，否则侧边栏根本不列。只有本机存在该工作区的历史时才做得到，
 * 所以找不到就静默跳过——截图脚本允许在没有历史的环境里降级。
 */
export function seedConversation(home, workspace = HOME_WORKSPACE) {
	// 目录名是 DSH 对 cwd 的编码，规则不值得在客户端复刻一遍：
	// 隔离 home 里已经有一个同名目录（它自己的工作区），直接拿来当 key。
	const key = existingSessionKey(home)
	if (!key) return null
	const source = join(homedir(), '.dsh', 'sessions', key)
	if (!existsSync(source)) return null
	const candidates = readdirSync(source)
		.filter((name) => name.startsWith('session-'))
		.map((name) => {
			const dir = join(source, name)
			const log = join(dir, 'session.v4.jsonl.zstd')
			return existsSync(log) ? { name, dir, log } : null
		})
		.filter(Boolean)
		.sort((left, right) => statSize(right.log) - statSize(left.log))
	if (candidates.length === 0) return null
	const picked = candidates[0]
	const target = join(home, 'sessions', key, picked.name)
	mkdirSync(target, { recursive: true })
	copyFileSync(picked.log, join(target, 'session.v4.jsonl.zstd'))
	registerSession(home, picked.name)
	return picked.name
}

/** 隔离 home 里装会话的那个目录名（DSH 对 cwd 的编码）。 */
function existingSessionKey(home) {
	const root = join(home, 'sessions')
	if (!existsSync(root)) return null
	return readdirSync(root).find((name) => name.startsWith('-')) ?? null
}

function statSize(path) {
	try {
		return readFileSync(path).length
	} catch {
		return 0
	}
}

/** 把会话 id 登记进隔离 home 的工作区表（顺序即 DSH 的展示顺序）。 */
function registerSession(home, sessionId) {
	const path = join(home, 'storages', 'workspace.json')
	if (!existsSync(path)) return
	const table = JSON.parse(readFileSync(path, 'utf8'))
	for (const record of Object.values(table.tables?.workspaces ?? {})) {
		if (record.path !== HOME_WORKSPACE) continue
		if (!record.sessionIds.includes(sessionId)) record.sessionIds.push(sessionId)
	}
	writeFileSync(path, JSON.stringify(table, null, 2))
}

