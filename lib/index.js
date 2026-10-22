// src/harness.ts
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
var BATCH_SIZE = 200;
var DEFAULT_INTERVAL_MS = 15e3;
var DAY_MS = 24 * 60 * 60 * 1e3;
var LIVE_MS = 20 * 60 * 1e3;
var RECENT_LIMIT = 8;
function dict(value) {
  return typeof value === "object" && value !== null ? value : null;
}
function count(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
function text(value) {
  return typeof value === "string" ? value : "";
}
function rowValue(rows, key) {
  return dict(rows[key])?.val;
}
function shortError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0].slice(0, 200);
}
function modelLabel(record) {
  if (record.provider && record.model) return `${record.provider}/${record.model}`;
  return record.model || record.provider;
}
function usageOf(row) {
  return row.input + row.output + row.cacheRead;
}
function isRunning(record, now) {
  return record.openTurn && now - record.lastActiveAt < LIVE_MS;
}
function isSubagentBusy(record, now) {
  return record.subagentBusy && now - record.lastActiveAt < LIVE_MS;
}
function listable(record) {
  return !record.subagent && !record.blank;
}
function emptyTotals() {
  return { sessions: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
}
function addUsage(target, record, counted) {
  if (counted) target.sessions += 1;
  target.input += record.input;
  target.output += record.output;
  target.cacheRead += record.cacheRead;
  target.cacheWrite += record.cacheWrite;
}
function startOfToday(now) {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  return midnight.getTime();
}
function parseSession(id, json, mtimeMs, size) {
  const root = dict(json);
  const record = dict(root?.record) ?? root ?? {};
  const identity = dict(record.identity) ?? {};
  const rows = dict(record.rows) ?? {};
  const totals = dict(dict(rowValue(rows, "tokenUsage"))?.totals) ?? {};
  const stats = dict(rowValue(rows, "sessionStats")) ?? {};
  const meta = dict(rowValue(rows, "sessionListMetadata")) ?? {};
  const boundary = dict(rowValue(rows, "turnBoundary"));
  const lastUsed = dict(dict(rowValue(rows, "modelSelection"))?.lastUsed);
  const subagentRow = dict(rowValue(rows, "subagent"));
  const subagentIdentity = dict(subagentRow?.identity);
  const timing = dict(rowValue(rows, "subagentTiming"));
  const catalog = dict(dict(rowValue(rows, "subagentCatalog"))?.head);
  const children = catalog?.values;
  const fallbackTitle = text(dict(dict(rowValue(rows, "titleInput"))?.first)?.text).split("\n")[0].trim();
  const createdAt = count(identity.createdAt);
  const lastPromptAt = count(meta.lastPromptAt);
  return {
    id,
    title: text(rowValue(rows, "title")) || fallbackTitle,
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
    size
  };
}
function aggregate(rows, now, models) {
  const midnight = startOfToday(now);
  const h24 = emptyTotals();
  const d7 = emptyTotals();
  const all = emptyTotals();
  let active = 0;
  let running = 0;
  let subagents = 0;
  let blank = 0;
  let lastActiveAt = 0;
  let todaySessions = 0;
  let todayInput = 0;
  let todayOutput = 0;
  let todayCacheRead = 0;
  for (const record of rows) {
    const counted = !record.blank;
    addUsage(all, record, counted);
    if (record.lastActiveAt >= now - DAY_MS) addUsage(h24, record, counted);
    if (record.lastActiveAt >= now - 7 * DAY_MS) {
      addUsage(d7, record, counted);
      if (counted) active += 1;
    }
    if (record.lastActiveAt >= midnight) {
      if (counted) todaySessions += 1;
      todayInput += record.input;
      todayOutput += record.output;
      todayCacheRead += record.cacheRead;
    }
    if (isRunning(record, now)) running += 1;
    if (record.subagent && isSubagentBusy(record, now)) subagents += 1;
    if (record.blank) blank += 1;
    if (record.lastActiveAt > lastActiveAt) lastActiveAt = record.lastActiveAt;
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
    topModel: models[0] ? modelRowLabel(models[0]) : null
  };
}
function modelRowLabel(row) {
  if (row.provider && row.model) return `${row.provider}/${row.model}`;
  return row.model || row.provider;
}
function buildModels(rows, now) {
  const buckets = /* @__PURE__ */ new Map();
  for (const record of rows) {
    if (record.input + record.output + record.cacheRead === 0) continue;
    const key = `${record.provider}\0${record.model}`;
    let bucket = buckets.get(key);
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
          windows: { h24: emptyTotals(), d7: emptyTotals(), all: emptyTotals() }
        },
        decodeMs: 0,
        decodeTokens: 0,
        lastUserAt: 0,
        fallbackAt: 0,
        fallbackSessionId: null
      };
      buckets.set(key, bucket);
    }
    const row = bucket.row;
    const counted = !record.blank;
    if (counted) row.sessions += 1;
    row.input += record.input;
    row.output += record.output;
    row.cacheRead += record.cacheRead;
    row.cacheWrite += record.cacheWrite;
    if (record.lastActiveAt > row.lastAt) row.lastAt = record.lastActiveAt;
    if (listable(record)) {
      if (record.lastActiveAt > bucket.lastUserAt) {
        bucket.lastUserAt = record.lastActiveAt;
        row.lastSessionId = record.id;
      }
    } else if (record.lastActiveAt > bucket.fallbackAt) {
      bucket.fallbackAt = record.lastActiveAt;
      bucket.fallbackSessionId = record.id;
    }
    bucket.decodeMs += record.decodeMs;
    bucket.decodeTokens += record.decodeTokens;
    addUsage(row.windows.all, record, counted);
    if (record.lastActiveAt >= now - DAY_MS) addUsage(row.windows.h24, record, counted);
    if (record.lastActiveAt >= now - 7 * DAY_MS) addUsage(row.windows.d7, record, counted);
  }
  const list = [];
  for (const bucket of buckets.values()) {
    const row = bucket.row;
    row.tps = bucket.decodeMs > 0 ? bucket.decodeTokens / (bucket.decodeMs / 1e3) : null;
    row.cacheRatio = row.input + row.cacheRead > 0 ? row.cacheRead / (row.input + row.cacheRead) : 0;
    if (row.lastSessionId === null) row.lastSessionId = bucket.fallbackSessionId;
    list.push(row);
  }
  list.sort(
    (left, right) => usageOf(right) - usageOf(left) || left.model.localeCompare(right.model) || left.provider.localeCompare(right.provider)
  );
  return list;
}
function toSessionRow(record, now) {
  return {
    id: record.id,
    title: record.title || record.id,
    cwd: record.cwd,
    workspace: record.cwd ? basename(record.cwd) : "",
    model: modelLabel(record),
    input: record.input,
    output: record.output,
    cacheRead: record.cacheRead,
    running: isRunning(record, now),
    subagentActive: isSubagentBusy(record, now),
    subagents: record.subagents,
    subagent: record.subagent,
    updatedAt: record.lastActiveAt,
    blank: record.blank
  };
}
function byLastActive(rows, now) {
  return rows.slice().sort((left, right) => right.lastActiveAt - left.lastActiveAt).slice(0, RECENT_LIMIT).map((record) => toSessionRow(record, now));
}
function findProfileHome() {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (; ; ) {
    if (existsSync(join(dir, "profiles"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
function resolveStorageRoot(home) {
  const base = home || process.env.DSH_HOME || findProfileHome() || join(homedir(), ".dsh");
  const root = join(base, "storages");
  const layout = existsSync(join(root, "session_projcache", "sessions")) ? "per-record" : existsSync(join(root, "session_projcache.json")) ? "single" : "missing";
  return { home: base, root, layout };
}
var HarnessIndex = class {
  storageRoot;
  layout;
  intervalMs;
  warn;
  records = /* @__PURE__ */ new Map();
  /** 待解析队列：首轮装全部文件，之后只装 mtime/size 变了的。 */
  queue = [];
  pumping = false;
  disposed = false;
  found = false;
  rounds = 0;
  scannedAt = 0;
  error = null;
  /** 本轮里解析失败的文件（单个坏文件不该抹掉整轮的成果，但也不能当作没发生）。 */
  fileError = null;
  timer = null;
  /** single 布局只有一个文件，用它的 stat 判断要不要重解析。 */
  singleStamp = null;
  constructor(options = {}) {
    const resolved = resolveStorageRoot(options.home);
    this.storageRoot = resolved.root;
    this.layout = resolved.layout;
    this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.warn = options.warn ?? (() => {
    });
  }
  start() {
    if (this.timer !== null || this.disposed) return;
    if (this.layout === "missing") {
      this.error = `\u627E\u4E0D\u5230\u4F1A\u8BDD\u6295\u5F71\u7F13\u5B58\uFF1A${this.storageRoot}`;
      this.warn(`[dsh-os] ${this.error}`);
      this.found = true;
      this.scannedAt = Date.now();
      return;
    }
    this.refresh();
    this.timer = setInterval(() => this.refresh(), this.intervalMs);
  }
  stop() {
    this.disposed = true;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  /** 纯内存聚合，同步返回；workspace 是绝对路径 cwd，给了就只算它的空间。 */
  snapshot(workspace) {
    const now = Date.now();
    const rows = [...this.records.values()];
    const path = workspace ?? "";
    const spaceRows = path ? rows.filter((record) => record.cwd === path) : rows;
    const modelsAll = buildModels(rows, now);
    const all = aggregate(rows, now, modelsAll);
    const modelsSpace = path ? buildModels(spaceRows, now) : modelsAll;
    const space = path ? aggregate(spaceRows, now, modelsSpace) : all;
    const sessionsAll = byLastActive(rows.filter(listable), now);
    return {
      t: now,
      store: {
        ok: this.layout !== "missing" && this.rounds > 0,
        root: this.storageRoot,
        sessions: rows.length,
        scannedAt: this.scannedAt,
        partial: !this.found,
        error: this.error
      },
      scope: { path, name: path ? basename(path) : "" },
      space,
      all,
      models: { space: modelsSpace, all: modelsAll },
      sessions: path ? byLastActive(spaceRows.filter(listable), now) : sessionsAll,
      sessionsAll,
      running: byLastActive(rows.filter((record) => !record.blank && isRunning(record, now)), now)
    };
  }
  root() {
    return this.storageRoot;
  }
  refresh() {
    if (this.disposed) return;
    try {
      if (this.layout === "single") {
        this.refreshSingle();
        return;
      }
      const dir = join(this.storageRoot, "session_projcache", "sessions");
      const keys = readdirSync(dir).filter((name2) => name2.endsWith(".json")).map((name2) => name2.slice(0, -".json".length));
      const present = new Set(keys);
      for (const key of this.records.keys()) {
        if (!present.has(key)) this.records.delete(key);
      }
      if (!this.found) {
        if (this.pumping) return;
        this.fileError = null;
        this.queue = keys;
        this.pump();
        return;
      }
      this.fileError = null;
      for (const key of keys) {
        const record = this.records.get(key);
        const stat = statSync(join(dir, `${key}.json`));
        if (!record || record.mtimeMs !== stat.mtimeMs || record.size !== stat.size) this.queue.push(key);
      }
      if (this.queue.length > 0) this.pump();
      else this.finish();
    } catch (error) {
      this.fail(error);
    }
  }
  refreshSingle() {
    const file = join(this.storageRoot, "session_projcache.json");
    let stamp;
    try {
      const stat = statSync(file);
      stamp = { mtimeMs: stat.mtimeMs, size: stat.size };
    } catch (error) {
      this.records.clear();
      this.singleStamp = null;
      this.fail(error);
      return;
    }
    if (this.found && this.singleStamp && this.singleStamp.mtimeMs === stamp.mtimeMs && this.singleStamp.size === stamp.size) {
      this.finish();
      return;
    }
    try {
      const tables = dict(dict(JSON.parse(readFileSync(file, "utf8")))?.tables);
      const sessions = dict(tables?.sessions) ?? {};
      this.records.clear();
      for (const [id, value] of Object.entries(sessions)) this.records.set(id, parseSession(id, value, stamp.mtimeMs, stamp.size));
      this.singleStamp = stamp;
      this.finish();
    } catch (error) {
      this.fail(error);
    }
  }
  /** 分批解析：每 tick 最多 BATCH_SIZE 个文件，其余交给下一轮事件循环。 */
  pump() {
    if (this.pumping) return;
    this.pumping = true;
    const step = () => {
      try {
        for (const key of this.queue.splice(0, BATCH_SIZE)) this.index(key);
        if (this.disposed) {
          this.pumping = false;
          return;
        }
        if (this.queue.length > 0) {
          setImmediate(step);
          return;
        }
        this.pumping = false;
        this.found = true;
        this.finish();
      } catch (error) {
        this.pumping = false;
        this.fail(error);
      }
    };
    step();
  }
  index(key) {
    const file = join(this.storageRoot, "session_projcache", "sessions", `${key}.json`);
    try {
      const stat = statSync(file);
      const record = parseSession(key, JSON.parse(readFileSync(file, "utf8")), stat.mtimeMs, stat.size);
      this.records.set(key, record);
    } catch (error) {
      this.records.delete(key);
      this.fileError = `${key}: ${shortError(error)}`;
      this.warn(`[dsh-os] \u4F1A\u8BDD\u6295\u5F71\u89E3\u6790\u5931\u8D25 ${this.fileError}`);
    }
  }
  finish() {
    this.scannedAt = Date.now();
    this.found = true;
    this.rounds += 1;
    this.error = this.fileError;
  }
  fail(error) {
    this.error = shortError(error);
    this.warn(`[dsh-os] \u4F1A\u8BDD\u6295\u5F71\u7D22\u5F15\u5237\u65B0\u5931\u8D25\uFF1A${this.error}`);
  }
};

// src/metrics.ts
import { performance } from "node:perf_hooks";

// src/procfs.ts
import { readdirSync as readdirSync2, readFileSync as readFileSync2, statfsSync } from "node:fs";
import { cpus, freemem, hostname, loadavg, networkInterfaces, platform, release, totalmem, uptime } from "node:os";
function readText(path) {
  try {
    return readFileSync2(path, "utf8");
  } catch {
    return null;
  }
}
function readNumber(path) {
  const text2 = readText(path);
  if (text2 === null) return null;
  const value = Number.parseFloat(text2);
  return Number.isFinite(value) ? value : null;
}
function platformCaps() {
  const linux = platform() === "linux";
  return {
    perCore: cpus().length > 0,
    freq: linux,
    swap: linux,
    net: linux,
    disk: true,
    power: linux,
    proc: linux,
    load: platform() !== "win32"
  };
}
function diskRoot() {
  if (platform() !== "win32") return "/";
  const drive = process.env.SystemDrive ?? "C:";
  return `${drive}\\`;
}
function readCpuTimesFromOs() {
  const list = cpus();
  if (list.length === 0) return null;
  const toTimes = (times) => ({
    user: times.user,
    nice: times.nice ?? 0,
    system: times.sys,
    idle: times.idle,
    iowait: 0,
    irq: times.irq ?? 0,
    softirq: 0,
    steal: 0
  });
  const cores = list.map((core) => toTimes(core.times));
  const total = cores.reduce(
    (sum, core) => ({
      user: sum.user + core.user,
      nice: sum.nice + core.nice,
      system: sum.system + core.system,
      idle: sum.idle + core.idle,
      iowait: 0,
      irq: sum.irq + core.irq,
      softirq: 0,
      steal: 0
    }),
    { user: 0, nice: 0, system: 0, idle: 0, iowait: 0, irq: 0, softirq: 0, steal: 0 }
  );
  return { cores, total };
}
function readCpuTimes() {
  const text2 = readText("/proc/stat");
  if (!text2) return readCpuTimesFromOs();
  const cores = [];
  let total = null;
  for (const line of text2.split("\n")) {
    if (!line.startsWith("cpu")) break;
    const parts = line.trim().split(/\s+/);
    const name2 = parts[0];
    if (name2 !== "cpu" && !/^cpu\d+$/.test(name2)) continue;
    const values = parts.slice(1, 9).map((value) => Number.parseInt(value, 10) || 0);
    const times = {
      user: values[0] ?? 0,
      nice: values[1] ?? 0,
      system: values[2] ?? 0,
      idle: values[3] ?? 0,
      iowait: values[4] ?? 0,
      irq: values[5] ?? 0,
      softirq: values[6] ?? 0,
      steal: values[7] ?? 0
    };
    if (name2 === "cpu") total = times;
    else cores.push(times);
  }
  if (!total) return null;
  return { cores, total };
}
function readCpuFreqs(coreCount) {
  if (platform() !== "linux") return new Array(coreCount).fill(null);
  const freqs = [];
  for (let index = 0; index < coreCount; index += 1) {
    const khz = readNumber(`/sys/devices/system/cpu/cpu${index}/cpufreq/scaling_cur_freq`);
    freqs.push(khz === null ? null : Math.round(khz / 1e3));
  }
  return freqs;
}
function readMem() {
  const text2 = readText("/proc/meminfo");
  if (!text2) {
    const total = Math.round(totalmem() / 1024);
    const free = Math.round(freemem() / 1024);
    if (total <= 0) return null;
    return { total, available: free, free, buffers: 0, cached: 0, dirty: 0, swapTotal: 0, swapFree: 0, slab: 0 };
  }
  const fields = /* @__PURE__ */ new Map();
  for (const line of text2.split("\n")) {
    const match = /^(\w+):\s+(\d+)/.exec(line);
    if (match) fields.set(match[1], Number.parseInt(match[2], 10));
  }
  const pick = (key) => fields.get(key) ?? 0;
  const cached = pick("Cached") + pick("SReclaimable") - pick("Shmem");
  return {
    total: pick("MemTotal"),
    available: pick("MemAvailable"),
    free: pick("MemFree"),
    buffers: pick("Buffers"),
    cached: Math.max(cached, 0),
    dirty: pick("Dirty"),
    swapTotal: pick("SwapTotal"),
    swapFree: pick("SwapFree"),
    slab: pick("Slab")
  };
}
function pickIface() {
  const text2 = readText("/proc/net/dev");
  if (!text2) {
    for (const [name2, addresses] of Object.entries(networkInterfaces())) {
      if (addresses?.some((address) => !address.internal)) return name2;
    }
    return "\u2014";
  }
  let fallback = "lo";
  for (const line of text2.split("\n").slice(2)) {
    const match = /^\s*([^:]+):/.exec(line);
    if (!match) continue;
    const name2 = match[1].trim();
    if (name2 === "lo") continue;
    if (name2 === "wlan0") return name2;
    if (fallback === "lo") fallback = name2;
  }
  return fallback;
}
function readNet(iface) {
  const text2 = readText("/proc/net/dev");
  if (!text2) return null;
  for (const line of text2.split("\n").slice(2)) {
    const match = /^\s*([^:]+):\s*(.*)$/.exec(line);
    if (!match || match[1].trim() !== iface) continue;
    const values = match[2].trim().split(/\s+/).map((value) => Number.parseInt(value, 10) || 0);
    return {
      iface,
      rxBytes: values[0] ?? 0,
      rxPackets: values[1] ?? 0,
      txBytes: values[8] ?? 0,
      txPackets: values[9] ?? 0
    };
  }
  return null;
}
function readDisk(path = diskRoot()) {
  try {
    const stats = statfsSync(path);
    const total = stats.blocks * stats.bsize;
    const free = stats.bfree * stats.bsize;
    return { total, free, used: total - free };
  } catch {
    return null;
  }
}
var CPU_TEMP_HINTS = ["cpu", "soc", "apc", "tsens", "gpu", "ddr", "board"];
function readPower() {
  if (platform() !== "linux") return { cpuTempC: null, batteryPercent: null, batteryTempC: null, batteryStatus: null };
  let cpuTempC = null;
  try {
    for (const zone of readdirSync2("/sys/class/thermal")) {
      if (!zone.startsWith("thermal_zone")) continue;
      const type = (readText(`/sys/class/thermal/${zone}/type`) ?? "").trim().toLowerCase();
      const milli = readNumber(`/sys/class/thermal/${zone}/temp`);
      if (milli === null || milli <= 0) continue;
      if (!CPU_TEMP_HINTS.some((hint) => type.includes(hint))) continue;
      const celsius = milli / 1e3;
      if (celsius > 0 && celsius < 130 && (cpuTempC === null || celsius < cpuTempC)) cpuTempC = celsius;
    }
  } catch {
  }
  const batteryPercent = readNumber("/sys/class/power_supply/battery/capacity");
  const batteryTempRaw = readNumber("/sys/class/power_supply/battery/temp");
  const batteryStatus = (readText("/sys/class/power_supply/battery/status") ?? "").trim() || null;
  return {
    cpuTempC: cpuTempC === null ? null : Math.round(cpuTempC * 10) / 10,
    batteryPercent: batteryPercent === null ? null : Math.round(batteryPercent),
    batteryTempC: batteryTempRaw === null ? null : Math.round(batteryTempRaw / 10 * 10) / 10,
    batteryStatus
  };
}
function readProcBasics(pid) {
  const stat = readText(`/proc/${pid}/stat`);
  if (!stat) return null;
  const open = stat.indexOf("(");
  const close = stat.lastIndexOf(")");
  if (open < 0 || close < 0) return null;
  const comm = stat.slice(open + 1, close);
  const rest = stat.slice(close + 2).split(/\s+/);
  const utime = Number.parseInt(rest[11] ?? "0", 10) || 0;
  const stime = Number.parseInt(rest[12] ?? "0", 10) || 0;
  const rssPages = Number.parseInt(rest[21] ?? "0", 10) || 0;
  return { comm, rssKb: rssPages * 4096 / 1024, ticks: utime + stime };
}
var ProcessSampler = class {
  previous = /* @__PURE__ */ new Map();
  previousAt = 0;
  /** 采样一次进程表，返回按 CPU 降序的前 limit 行。 */
  sample(limit = 6) {
    const now = Date.now();
    const elapsedSec = this.previousAt === 0 ? 0 : (now - this.previousAt) / 1e3;
    const clk = 100;
    let pids;
    try {
      pids = readdirSync2("/proc").filter((name2) => /^\d+$/.test(name2));
    } catch {
      return { rows: [], count: 0, threads: 0 };
    }
    const next = /* @__PURE__ */ new Map();
    const rows = [];
    let threads = 0;
    for (const name2 of pids) {
      const pid = Number.parseInt(name2, 10);
      const basics = readProcBasics(pid);
      if (!basics) continue;
      next.set(pid, basics.ticks);
      threads += 1;
      const before = this.previous.get(pid);
      const cpuPercent = before === void 0 || elapsedSec <= 0 ? 0 : Math.max(0, (basics.ticks - before) / clk / elapsedSec * 100);
      rows.push({ pid, comm: basics.comm, cpuPercent, rssKb: Math.round(basics.rssKb) });
    }
    this.previous = next;
    this.previousAt = now;
    rows.sort((left, right) => right.cpuPercent - left.cpuPercent || right.rssKb - left.rssKb);
    return { rows: rows.slice(0, limit), count: rows.length, threads };
  }
};
function readCpuModel() {
  const text2 = readText("/proc/cpuinfo") ?? "";
  for (const key of ["Hardware", "model name", "Processor", "cpu model"]) {
    const match = new RegExp(`^${key}\\s*:\\s*(.+)$`, "m").exec(text2);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  const osModel = cpus()[0]?.model;
  return osModel && osModel !== "unknown" ? osModel : `ARM64 ${cpus().length}-core`;
}
var facts = null;
function hostFacts() {
  if (facts) return facts;
  const model = readCpuModel();
  facts = {
    hostname: hostname(),
    kernel: release(),
    platform: platform(),
    arch: process.arch,
    model: model.replace(/\s+/g, " ").trim(),
    cores: cpus().length,
    memTotalKb: Math.round(totalmem() / 1024),
    uptimeSec: Math.round(uptime())
  };
  return facts;
}
function readProcessCount() {
  try {
    return readdirSync2("/proc").filter((name2) => /^\d+$/.test(name2)).length;
  } catch {
    return 0;
  }
}
function readRunQueue() {
  const text2 = readText("/proc/loadavg");
  if (!text2) return { running: 0, total: 0 };
  const match = /(\d+)\/(\d+)/.exec(text2);
  return { running: match ? Number.parseInt(match[1], 10) : 0, total: match ? Number.parseInt(match[2], 10) : 0 };
}
function readLoad() {
  const [one = 0, five = 0, fifteen = 0] = loadavg();
  const text2 = readText("/proc/uptime");
  const uptimeSec = text2 ? Number.parseFloat(text2.split(/\s+/)[0] ?? "0") : uptime();
  return { load: [one, five, fifteen], uptimeSec: Math.round(uptimeSec) };
}

// src/metrics.ts
var TICK_MS = 2e3;
var HISTORY = 90;
function busyOf(times) {
  return times.user + times.nice + times.system + times.irq + times.softirq + times.steal;
}
function totalOf(times) {
  return busyOf(times) + times.idle + times.iowait;
}
function percentOf(previous, current) {
  const totalDelta = totalOf(current) - totalOf(previous);
  if (totalDelta <= 0) return 0;
  const busyDelta = busyOf(current) - busyOf(previous);
  return Math.min(100, Math.max(0, busyDelta / totalDelta * 100));
}
function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
var Ring = class {
  constructor(size) {
    this.size = size;
  }
  values = [];
  push(value) {
    this.values.push(value);
    if (this.values.length > this.size) this.values.shift();
  }
  list() {
    return this.values.slice();
  }
};
var MetricsSampler = class {
  timer = null;
  processes = new ProcessSampler();
  previousCpu = null;
  previousNet = null;
  previousNetAt = 0;
  iface = pickIface();
  cpuPercent = 0;
  corePercents = [];
  cpuBreakdown = { user: 0, system: 0, iowait: 0, steal: 0 };
  netRates = { rxBps: 0, txBps: 0 };
  procInfo = {
    total: 0,
    running: 0,
    tasks: 0,
    top: []
  };
  lagMs = 0;
  tickCount = 0;
  history = {
    at: new Ring(HISTORY),
    cpu: new Ring(HISTORY),
    mem: new Ring(HISTORY),
    rx: new Ring(HISTORY),
    tx: new Ring(HISTORY)
  };
  start() {
    if (this.timer) return;
    this.prime();
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.timer.unref?.();
  }
  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }
  /** 先建立基线，让第一份快照就有历史点。 */
  prime() {
    this.previousCpu = readCpuTimes();
    this.previousNet = readNet(this.iface);
    this.previousNetAt = performance.now();
    this.processes.sample();
    this.tick();
  }
  tick() {
    const now = performance.now();
    const cpu = readCpuTimes();
    if (cpu && this.previousCpu) {
      this.cpuPercent = round(percentOf(this.previousCpu.total, cpu.total));
      this.corePercents = cpu.cores.map((core, index) => {
        const before = this.previousCpu?.cores[index];
        return before ? round(percentOf(before, core)) : 0;
      });
      const totalDelta = Math.max(1, totalOf(cpu.total) - totalOf(this.previousCpu.total));
      const share = (keys) => {
        const before = this.previousCpu?.total;
        if (!before) return 0;
        const delta = keys.reduce((sum, key) => sum + (cpu.total[key] - before[key]), 0);
        return round(delta / totalDelta * 100);
      };
      this.cpuBreakdown = {
        user: share(["user", "nice"]),
        system: share(["system", "irq", "softirq"]),
        iowait: share(["iowait"]),
        steal: share(["steal"])
      };
    }
    if (cpu) {
      this.previousCpu = cpu;
    }
    const net = readNet(this.iface);
    if (net && this.previousNet) {
      const seconds = Math.max(0.2, (now - this.previousNetAt) / 1e3);
      this.netRates = {
        rxBps: Math.max(0, Math.round((net.rxBytes - this.previousNet.rxBytes) / seconds)),
        txBps: Math.max(0, Math.round((net.txBytes - this.previousNet.txBytes) / seconds))
      };
    }
    if (net) {
      this.previousNet = net;
      this.previousNetAt = now;
    }
    if (this.tickCount % 3 === 0) {
      const sampled = this.processes.sample(6);
      const queue = readRunQueue();
      this.procInfo = { total: sampled.count, running: queue.running, tasks: sampled.threads, top: sampled.rows };
    }
    this.tickCount += 1;
    const scheduled = performance.now();
    setTimeout(() => {
      this.lagMs = round(Math.max(0, performance.now() - scheduled - 10), 1);
    }, 10).unref?.();
    const mem = readMem();
    this.history.at.push(Math.round(Date.now()));
    this.history.cpu.push(this.cpuPercent);
    this.history.mem.push(mem ? round((mem.total - mem.available) / mem.total * 100) : 0);
    this.history.rx.push(this.netRates.rxBps);
    this.history.tx.push(this.netRates.txBps);
  }
  /** 最近一次采样的完整快照。 */
  snapshot() {
    const facts2 = hostFacts();
    const mem = readMem() ?? {
      total: facts2.memTotalKb,
      available: facts2.memTotalKb,
      free: 0,
      buffers: 0,
      cached: 0,
      dirty: 0,
      swapTotal: 0,
      swapFree: 0,
      slab: 0
    };
    const load = readLoad();
    const disk = readDisk() ?? { total: 0, used: 0, free: 0 };
    const net = readNet(this.iface);
    const memory = {
      ...mem,
      used: mem.total - mem.available,
      percent: mem.total > 0 ? round((mem.total - mem.available) / mem.total * 100) : 0
    };
    const usage = process.memoryUsage();
    const elu = performance.eventLoopUtilization();
    return {
      t: Date.now(),
      host: { ...facts2, uptimeSec: load.uptimeSec },
      cap: platformCaps(),
      cpu: {
        total: this.cpuPercent,
        cores: this.corePercents,
        freqs: readCpuFreqs(facts2.cores),
        ...this.cpuBreakdown
      },
      mem: memory,
      load: load.load,
      net: {
        iface: this.iface,
        rxBps: this.netRates.rxBps,
        txBps: this.netRates.txBps,
        rxTotal: net?.rxBytes ?? 0,
        txTotal: net?.txBytes ?? 0
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
        version: process.version
      },
      history: {
        at: this.history.at.list(),
        cpu: this.history.cpu.list(),
        mem: this.history.mem.list(),
        rx: this.history.rx.list(),
        tx: this.history.tx.list()
      }
    };
  }
};

// src/index.ts
var name = "dsh-os";
var inject = ["webServer"];
var JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
function reply(res, payload, status = 200) {
  const response = res;
  response.writeHead(status, JSON_HEADERS);
  response.end(JSON.stringify(payload));
}
function workspaceOf(req) {
  const url = req?.url;
  if (!url) return "";
  try {
    return new URL(url, "http://localhost").searchParams.get("ws") ?? "";
  } catch {
    return "";
  }
}
function serveMetrics(sampler) {
  return (_req, res) => {
    try {
      reply(res, sampler.snapshot());
    } catch (error) {
      reply(res, { error: String(error?.message ?? error) }, 500);
    }
  };
}
function serveHarness(index) {
  return (req, res) => {
    let payload;
    try {
      payload = index.snapshot(workspaceOf(req));
    } catch (error) {
      reply(res, { error: String(error?.message ?? error) }, 500);
      return;
    }
    reply(res, payload);
  };
}
function apply(ctx) {
  const sampler = new MetricsSampler();
  ctx.effect(() => {
    sampler.start();
    return () => sampler.stop();
  }, "dsh-os: metrics sampler");
  ctx.effect(
    () => ctx.webServer.register({
      kind: "exact",
      path: "/plugins/dsh-os/metrics",
      handler: serveMetrics(sampler)
    }),
    "dsh-os: metrics route"
  );
  const harness = new HarnessIndex();
  ctx.effect(() => {
    harness.start();
    return () => harness.stop();
  }, "dsh-os: session index");
  ctx.effect(
    () => ctx.webServer.register({
      kind: "exact",
      path: "/plugins/dsh-os/harness",
      handler: serveHarness(harness)
    }),
    "dsh-os: harness route"
  );
}
export {
  apply,
  inject,
  name
};
