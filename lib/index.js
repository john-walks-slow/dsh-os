// src/metrics.ts
import { performance } from "node:perf_hooks";

// src/procfs.ts
import { readdirSync, readFileSync, statfsSync } from "node:fs";
import { cpus, freemem, hostname, loadavg, networkInterfaces, platform, release, totalmem, uptime } from "node:os";
function readText(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}
function readNumber(path) {
  const text = readText(path);
  if (text === null) return null;
  const value = Number.parseFloat(text);
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
  const text = readText("/proc/stat");
  if (!text) return readCpuTimesFromOs();
  const cores = [];
  let total = null;
  for (const line of text.split("\n")) {
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
  const text = readText("/proc/meminfo");
  if (!text) {
    const total = Math.round(totalmem() / 1024);
    const free = Math.round(freemem() / 1024);
    if (total <= 0) return null;
    return { total, available: free, free, buffers: 0, cached: 0, dirty: 0, swapTotal: 0, swapFree: 0, slab: 0 };
  }
  const fields = /* @__PURE__ */ new Map();
  for (const line of text.split("\n")) {
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
  const text = readText("/proc/net/dev");
  if (!text) {
    for (const [name2, addresses] of Object.entries(networkInterfaces())) {
      if (addresses?.some((address) => !address.internal)) return name2;
    }
    return "\u2014";
  }
  let fallback = "lo";
  for (const line of text.split("\n").slice(2)) {
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
  const text = readText("/proc/net/dev");
  if (!text) return null;
  for (const line of text.split("\n").slice(2)) {
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
    const free = stats.bavail * stats.bsize;
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
    for (const zone of readdirSync("/sys/class/thermal")) {
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
      pids = readdirSync("/proc").filter((name2) => /^\d+$/.test(name2));
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
  const text = readText("/proc/cpuinfo") ?? "";
  for (const key of ["Hardware", "model name", "Processor", "cpu model"]) {
    const match = new RegExp(`^${key}\\s*:\\s*(.+)$`, "m").exec(text);
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
    return readdirSync("/proc").filter((name2) => /^\d+$/.test(name2)).length;
  } catch {
    return 0;
  }
}
function readRunQueue() {
  const text = readText("/proc/loadavg");
  if (!text) return { running: 0, total: 0 };
  const match = /(\d+)\/(\d+)/.exec(text);
  return { running: match ? Number.parseInt(match[1], 10) : 0, total: match ? Number.parseInt(match[2], 10) : 0 };
}
function readLoad() {
  const [one = 0, five = 0, fifteen = 0] = loadavg();
  const text = readText("/proc/uptime");
  const uptimeSec = text ? Number.parseFloat(text.split(/\s+/)[0] ?? "0") : uptime();
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
function serveMetrics(sampler) {
  return (_req, res) => {
    const response = res;
    let body;
    try {
      body = JSON.stringify(sampler.snapshot());
    } catch (error) {
      response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: String(error?.message ?? error) }));
      return;
    }
    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    });
    response.end(body);
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
}
export {
  apply,
  inject,
  name
};
