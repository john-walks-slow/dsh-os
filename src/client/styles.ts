/**
 * dsh-os 的全部样式：一层注入的 <style>，命名空间 `.dos-`（桌面）与 `.dso-`
 * （设置页）。
 *
 * 三个职责：
 *   1. 桌面背景：把首页的 frame 底色打透，让字符场成为壁纸；
 *   2. HUD 语汇：终端窗格、ASCII 仪表、扫描线与暗角；
 *   3. 响应式：窄屏收起窗格，只留状态条。
 *
 * 颜色分两处：主题色由 settings.ts 摊成 `--dos-*` 变量（深/浅各一套），
 * 这里只写结构与排版，不再出现深色死值——否则浅色模式下必然花屏。
 *
 * @module dsh-os/styles
 */

export const STYLE_ID = 'dsh-os-style'

export const CSS = `
/* ── 桌面背景：只作用于首页（html.dsh-os-live） ─────────────────────── */
html.dsh-os-live body { background: var(--dos-bg, #04070b) !important; }
html.dsh-os-live [data-slot="root"] > div { background-color: transparent !important; background-image: none !important; }
html.dsh-os-live #dsh-os-field { opacity: 1; }
html.dsh-os-live #root { position: relative; z-index: 1; }
.dos-paint-through { background-color: transparent !important; background-image: none !important; }

/* hero 背后压一层让位光晕：标题与输入框在字符场上仍然读得清 */
html.dsh-os-live [class*="_composerHero"] { position: relative; }
html.dsh-os-live [class*="_composerHero"]::before {
  content: ""; position: absolute; inset: -10% -7%; z-index: -1; pointer-events: none;
  background: var(--dos-field-veil);
}

#dsh-os-field {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  opacity: 0; transition: opacity .8s ease;
  contain: strict;
}
#dsh-os-field canvas { display: block; width: 100%; height: 100%; opacity: var(--dos-field-opacity, .94); }
#dsh-os-field::after {
  content: ""; position: absolute; inset: 0;
  background: var(--dos-field-scan), var(--dos-vignette);
  mix-blend-mode: multiply;
}
#dsh-os-field::before {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(180deg, var(--dos-sheen), transparent 26%, transparent 74%, var(--dos-sheen));
}

.dos-root, .dos-root *, .dos-root *::before, .dos-root *::after { box-sizing: border-box; }
:root {
  --dos-cy: #5b8cff;
  --dos-mag: #ff6ea9;
  --dos-amber: #ffc061;
  --dos-bg: #04070b;
  --dos-ink: #e8efff;
  --dos-ink-dim: rgba(190,206,240,.58);
  --dos-ink-faint: rgba(164,182,220,.34);
  --dos-edge: rgba(91,140,255,.28);
  --dos-rgb: 91,140,255;
}

.dos-root {
  position: fixed; inset: 0; z-index: 40;
  pointer-events: none;
  color: var(--dos-ink);
  font-family: ui-monospace, "JetBrains Mono", "SFMono-Regular", Menlo, Consolas, "Noto Sans Mono CJK SC", monospace;
  font-size: 11.5px; line-height: 1.4;
  font-variant-ligatures: none;
  -webkit-font-smoothing: antialiased;
  text-shadow: var(--dos-text-shadow);
  opacity: 1; transition: opacity .45s ease;
  user-select: none;
}
.dos-root[data-phase="off"] { opacity: 0; }
.dos-root[data-phase="off"] * { pointer-events: none !important; }

/* 全局扫描线 + 一条缓慢下行的亮带 */
.dos-root::before {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background-image: repeating-linear-gradient(180deg, var(--dos-scan) 0 1px, transparent 1px 3px);
  opacity: .75;
}
.dos-root::after {
  content: ""; position: absolute; left: 0; right: 0; height: 18vh; pointer-events: none; z-index: 1;
  background: var(--dos-band);
  animation: dos-roll 13s linear infinite;
  mix-blend-mode: var(--dos-band-blend);
}
@keyframes dos-roll { from { transform: translateY(-20vh); } to { transform: translateY(115vh); } }
@keyframes dos-blink { 0%, 55% { opacity: 1; } 56%, 100% { opacity: 0; } }
@keyframes dos-flicker { 0%, 100% { opacity: 1; } 47% { opacity: .82; } 48% { opacity: 1; } 71% { opacity: .93; } }
@keyframes dos-scan-x { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }

.dos-cursor { display: inline-block; width: .62em; height: 1.02em; margin-left: 2px; vertical-align: -2px; background: var(--dos-cy); animation: dos-blink 1.1s steps(1) infinite; box-shadow: var(--dos-led-shadow); }
.dos-led { display: inline-block; width: 6px; height: 6px; border-radius: 1px; background: var(--dos-cy); box-shadow: var(--dos-led-shadow); }
.dos-led[data-tone="hot"] { background: var(--dos-mag); box-shadow: var(--dos-led-shadow); }
.dos-led[data-tone="warn"] { background: var(--dos-amber); box-shadow: var(--dos-led-shadow); }
.dos-led[data-tone="idle"] { background: var(--dos-ink-faint); box-shadow: none; }
.dos-led[data-pulse="1"] { animation: dos-blink 1.4s steps(1) infinite; }

/* ── 顶栏 ──────────────────────────────────────────────────────────── */
.dos-rail { position: absolute; display: flex; align-items: center; gap: 14px; height: 22px; padding: 0 6px; pointer-events: none; background: linear-gradient(90deg, var(--dos-scrim-a), var(--dos-scrim-b) 55%, var(--dos-scrim-c)); }
.dos-rail-left { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
.dos-mark { color: var(--dos-cy); letter-spacing: .16em; font-size: 12px; text-shadow: var(--dos-text-shadow); white-space: nowrap; }
.dos-mark b { font-weight: 600; }
.dos-mark-sub { color: var(--dos-ink-faint); font-size: 9px; letter-spacing: .32em; text-transform: uppercase; white-space: nowrap; }
.dos-rail-mid { flex: 1; height: 1px; background: linear-gradient(90deg, rgba(var(--dos-rgb),.4), rgba(var(--dos-rgb),.08) 55%, transparent); position: relative; overflow: hidden; }
.dos-rail-mid::after { content: ""; position: absolute; inset: 0; width: 22%; background: linear-gradient(90deg, transparent, var(--dos-cy), transparent); animation: dos-scan-x 7s linear infinite; opacity: .8; }
.dos-rail-right { display: flex; align-items: center; gap: 12px; color: var(--dos-ink-dim); font-size: 10px; letter-spacing: .1em; white-space: nowrap; }
.dos-rail-right [data-tone="hot"] { color: var(--dos-mag); }
.dos-rail-stat b { color: var(--dos-ink); font-weight: 500; }
.dos-clock { color: var(--dos-ink); font-size: 12px; letter-spacing: .14em; font-variant-numeric: tabular-nums; }

/* ── 窗格 ──────────────────────────────────────────────────────────── */
.dos-panel {
  position: absolute; display: flex; flex-direction: column; gap: 2px;
  padding: 6px 8px 8px;
  background: var(--dos-panel-bg);
  border: 1px solid var(--dos-edge);
  clip-path: polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 9px 100%, 0 calc(100% - 9px));
  box-shadow: var(--dos-panel-shadow);
  backdrop-filter: blur(6px) saturate(1.05);
  overflow: hidden;
  pointer-events: auto;
}
.dos-panel::before, .dos-panel::after {
  content: ""; position: absolute; width: 7px; height: 7px; pointer-events: none;
  border: 1px solid var(--dos-cy); opacity: .75;
}
.dos-panel::before { top: 3px; left: 3px; border-right: 0; border-bottom: 0; }
.dos-panel::after { right: 3px; bottom: 3px; border-left: 0; border-top: 0; }
.dos-panel[data-tone="mag"] { border-color: rgba(255,110,169,.34); }
.dos-panel[data-tone="mag"]::before, .dos-panel[data-tone="mag"]::after { border-color: var(--dos-mag); }

.dos-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--dos-cy); font-size: 9.5px; letter-spacing: .22em; text-transform: uppercase; white-space: nowrap; }
.dos-head b { font-weight: 600; color: var(--dos-cy); }
.dos-head .dos-head-meta { color: var(--dos-ink-faint); letter-spacing: .12em; }
.dos-rule { height: 1px; margin: 1px 0; background: linear-gradient(90deg, rgba(var(--dos-rgb),.5), rgba(var(--dos-rgb),.12) 40%, transparent); }
.dos-sub { color: var(--dos-ink-faint); font-size: 8.5px; letter-spacing: .16em; text-transform: uppercase; margin-top: 1px; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.dos-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; min-width: 0; line-height: 1.25; }
.dos-k { color: var(--dos-ink-dim); font-size: 9px; letter-spacing: .18em; text-transform: uppercase; white-space: nowrap; }
.dos-v { color: var(--dos-ink); font-size: 11.5px; letter-spacing: .02em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.dos-v small { color: var(--dos-ink-faint); font-size: 8.5px; letter-spacing: .08em; }
.dos-v[data-tone="hot"] { color: var(--dos-mag); }
.dos-v[data-tone="warn"] { color: var(--dos-amber); }
.dos-v[data-tone="ok"] { color: var(--dos-cy); }

/* ASCII 计量条：字符即像素 */
.dos-meter { font-size: 10px; line-height: 1; letter-spacing: .04em; white-space: pre; font-variant-numeric: tabular-nums; }
.dos-meter .on { color: var(--dos-cy); text-shadow: var(--dos-text-shadow); }
.dos-meter .off { color: rgba(var(--dos-rgb),.18); }
.dos-meter[data-tone="warn"] .on { color: var(--dos-amber); }
.dos-meter[data-tone="hot"] .on { color: var(--dos-mag); }
.dos-meter[data-tone="ghost"] .on { color: var(--dos-ink-dim); text-shadow: none; }

/* 火花线：悬停可读出任一点的瞬时值 */
.dos-spark-wrap { position: relative; display: block; }
.dos-spark { display: block; width: 100%; height: 22px; overflow: visible; cursor: crosshair; }
.dos-spark polyline { fill: none; stroke: var(--dos-cy); stroke-width: 1.1; vector-effect: non-scaling-stroke; filter: var(--dos-spark-glow); }
.dos-spark polygon { fill: rgba(var(--dos-rgb),.1); stroke: none; }
.dos-spark[data-tone="mag"] polyline { stroke: var(--dos-mag); }
.dos-spark[data-tone="mag"] polygon { fill: rgba(255,110,169,.1); }
.dos-spark-cursor { stroke: var(--dos-ink-faint); stroke-width: 1; vector-effect: non-scaling-stroke; stroke-dasharray: 2 2; }
.dos-spark-dot { fill: var(--dos-cy); }
.dos-spark-tip {
  position: absolute; right: 0; top: -3px; padding: 1px 5px; pointer-events: none;
  font-size: 9px; letter-spacing: .06em; color: var(--dos-ink);
  background: var(--dos-bar-bg); border: 1px solid var(--dos-edge);
}

.dos-cores { display: grid; grid-template-columns: 1fr 1fr; gap: 1px 8px; }
.dos-core { display: flex; align-items: center; gap: 4px; color: var(--dos-ink-faint); font-size: 9px; letter-spacing: .04em; line-height: 1.15; }
.dos-core i { font-style: normal; width: 14px; color: var(--dos-ink-dim); }
.dos-core .dos-meter { font-size: 8px; letter-spacing: 0; }

.dos-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 10px; }
.dos-stack { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dos-spacer { flex: 1; }

/* 分段选择器 */
.dos-seg { display: inline-flex; border: 1px solid var(--dos-edge); }
.dos-seg-item {
  padding: 0 6px; height: 15px; display: inline-flex; align-items: center;
  font: inherit; font-size: 8.5px; letter-spacing: .16em; text-transform: uppercase;
  color: var(--dos-ink-dim); background: transparent; border: none; border-left: 1px solid var(--dos-edge);
  cursor: pointer;
}
.dos-seg-item:first-child { border-left: none; }
.dos-seg-item:hover { color: var(--dos-ink); background: rgba(var(--dos-rgb),.12); }
.dos-seg-item[data-on="1"] { color: var(--dos-chip-on-ink); background: var(--dos-cy); }
.dos-meta-row { display: inline-flex; align-items: center; gap: 8px; }
.dos-scope { color: var(--dos-cy); border: 1px solid var(--dos-edge); padding: 0 4px; font-size: 8px; letter-spacing: .16em; }

/* 会话列表 */
.dos-session { display: flex; align-items: center; gap: 6px; padding: 1px 2px; min-width: 0; cursor: pointer; border-left: 1px solid transparent; }
.dos-session:hover { background: rgba(var(--dos-rgb),.1); border-left-color: var(--dos-cy); }
.dos-session .t { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dos-ink-dim); font-size: 10px; }
.dos-session:hover .t { color: var(--dos-ink); }
.dos-session .m { color: var(--dos-cy-dim); font-size: 8.5px; letter-spacing: .04em; max-width: 62px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dos-session .tok, .dos-session .age { color: var(--dos-ink-faint); font-size: 8.5px; letter-spacing: .06em; font-variant-numeric: tabular-nums; }
.dos-session .tok { min-width: 34px; text-align: right; }
.dos-session .age { min-width: 24px; text-align: right; }

/* ── 任务栏 ────────────────────────────────────────────────────────── */
.dos-taskbar { position: absolute; height: 26px; display: flex; align-items: center; gap: 8px; padding: 0 12px; overflow: hidden; background: linear-gradient(180deg, var(--dos-scrim-b), var(--dos-scrim-a)); border-top: 1px solid rgba(var(--dos-rgb),.2); backdrop-filter: blur(4px); pointer-events: auto; font-size: 9px; letter-spacing: .16em; color: var(--dos-ink-faint); text-transform: uppercase; }
.dos-chip { display: inline-flex; align-items: center; gap: 5px; padding: 2px 7px; border: 1px solid rgba(var(--dos-rgb),.2); background: transparent; color: var(--dos-ink-dim); font: inherit; font-size: 8.5px; letter-spacing: .18em; cursor: pointer; text-transform: uppercase; }
.dos-chip:hover { color: var(--dos-ink); border-color: var(--dos-cy); }
.dos-chip[data-on="1"] { color: var(--dos-chip-on-ink); background: var(--dos-cy); border-color: var(--dos-cy); box-shadow: var(--dos-led-shadow); }
.dos-chip[data-dim="1"] { opacity: .55; }
.dos-ticker { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--dos-ink-faint); letter-spacing: .1em; text-transform: none; font-size: 9.5px; }
.dos-keys { display: flex; gap: 8px; color: var(--dos-ink-faint); font-size: 8.5px; }
.dos-keys kbd { font: inherit; color: var(--dos-ink-dim); border: 1px solid rgba(var(--dos-rgb),.22); padding: 0 3px; }

/* ── 开机自检 ──────────────────────────────────────────────────────── */
.dos-boot { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 5vh 5vw; background: var(--dos-boot-bg); color: var(--dos-ink); pointer-events: auto; cursor: pointer; font-family: ui-monospace, "JetBrains Mono", "SFMono-Regular", Menlo, Consolas, "Noto Sans Mono CJK SC", monospace; text-shadow: var(--dos-text-shadow); }
.dos-boot::before { content: ""; position: absolute; inset: 0; background-image: repeating-linear-gradient(180deg, var(--dos-scan) 0 1px, transparent 1px 3px); pointer-events: none; }
.dos-boot-inner { position: relative; width: min(920px, 100%); display: flex; flex-direction: column; gap: 13px; }
.dos-boot[data-leaving="1"] { animation: dos-boot-out .7s ease forwards; }
@keyframes dos-boot-out { 0% { opacity: 1; clip-path: inset(0 0 0 0); } 55% { opacity: 1; clip-path: inset(48% 0 48% 0); } 100% { opacity: 0; clip-path: inset(50% 0 50% 0); } }
.dos-boot-banner { margin: 0; color: var(--dos-cy); font-size: clamp(7px, 1.9vw, 26px); line-height: 1.08; letter-spacing: .01em; white-space: pre; animation: dos-flicker 7s linear infinite; }
.dos-boot-meta { display: flex; flex-wrap: wrap; gap: 6px 18px; color: var(--dos-ink-dim); font-size: 10px; letter-spacing: .16em; text-transform: uppercase; }
.dos-boot-meta b { color: var(--dos-cy); font-weight: 500; }
.dos-boot-log { display: flex; flex-direction: column; gap: 1px; font-size: 11px; line-height: 1.7; }
.dos-boot-log .ok { color: var(--dos-cy); }
.dos-boot-log .k { color: var(--dos-ink-faint); }
.dos-boot-log .dots { color: rgba(var(--dos-rgb),.22); flex: 1; overflow: hidden; white-space: nowrap; }
.dos-boot-log .v { color: var(--dos-ink); }
.dos-boot-row { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.dos-boot-bar { display: flex; align-items: center; gap: 10px; color: var(--dos-ink-dim); font-size: 9.5px; letter-spacing: .2em; text-transform: uppercase; }
.dos-boot-foot { color: var(--dos-ink-faint); font-size: 9px; letter-spacing: .22em; text-transform: uppercase; }

/* ── 隐藏 Into the unknown 原生标头 ─────────────────────────────── */
html.dsh-os-live [class*="_composerHero"] [class*="_headline"],
html.dsh-os-live [class*="_composerHero"] [class*="_titleGroup"],
html.dsh-os-live [class*="_composerHero"] [class*="_fishHitbox"],
html.dsh-os-live [class*="_composerHero"] [class*="_previewBadge"] {
  display: none !important;
}
html.dsh-os-live [class*="_composerHero"] [class*="_stack"] {
  gap: 0 !important;
}

/* ── 原生皮肤：输入框 ──────────────────────────────────────────────── */
html.dsh-os-live.dsh-os-skin-composer [class*="_composerHero"] [class*="_card"],
html.dsh-os-live.dsh-os-skin-composer [class*="_composerStack"] [class*="_card"] {
  background: var(--dos-panel-bg) !important;
  border: 1px solid var(--dos-edge) !important;
  border-radius: 2px !important;
  box-shadow: var(--dos-panel-shadow) !important;
}
html.dsh-os-live.dsh-os-skin-composer [class*="_composerHero"] [class*="_placeholder"],
html.dsh-os-live.dsh-os-skin-composer [class*="_composerStack"] [class*="_placeholder"] {
  color: var(--dos-ink-faint) !important;
  letter-spacing: .03em;
  font-family: var(--ds-font-family-code, monospace) !important;
}
html.dsh-os-live.dsh-os-skin-composer [class*="_composerHero"] [class*="_tools"],
html.dsh-os-live.dsh-os-skin-composer [class*="_composerStack"] [class*="_tools"] {
  border-top: 1px solid var(--dos-panel-line) !important;
}
html.dsh-os-live.dsh-os-skin-composer [class*="_composerHero"] [class*="_primary"],
html.dsh-os-live.dsh-os-skin-composer [class*="_composerStack"] [class*="_primary"] {
  background: var(--dos-cy) !important;
  color: var(--dos-chip-on-ink) !important;
}
html.dsh-os-live.dsh-os-skin-composer [class*="_composerHero"] [class*="_add"],
html.dsh-os-live.dsh-os-skin-composer [class*="_composerStack"] [class*="_add"] {
  border-color: var(--dos-edge) !important;
  color: var(--dos-cy) !important;
}

/* ── 模型账本 ─────────────────────────────────────────────────────── */
.dos-ledger { display: flex; flex-direction: column; gap: 1px; }
.dos-ledger-head, .dos-ledger-row, .dos-ledger-total {
  display: grid; grid-template-columns: minmax(0,1fr) 42px 72px 72px 46px 40px 66px; gap: 8px;
  align-items: baseline; font-size: 10px; line-height: 1.55;
}
.dos-ledger-head { color: rgba(var(--dos-rgb),.6); font-size: 8.5px; letter-spacing: .16em; text-transform: uppercase; }
.dos-ledger-row { color: var(--dos-ink-dim); border-left: 1px solid transparent; padding-left: 4px; }
.dos-ledger-row[data-clickable] { cursor: pointer; }
.dos-ledger-row:hover { color: var(--dos-ink); background: rgba(var(--dos-rgb),.1); border-left-color: var(--dos-cy); }
.dos-ledger-row .t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dos-ledger-row .n, .dos-ledger-total .n { text-align: right; font-variant-numeric: tabular-nums; }
.dos-ledger-row .n .dos-meter { font-size: 9px; letter-spacing: 0; }
.dos-ledger-total { border-top: 1px solid rgba(var(--dos-rgb),.18); padding-top: 2px; color: var(--dos-cy); }
.dos-ledger-empty { color: var(--dos-ink-faint); font-size: 10px; padding: 6px 0; }

/* ── 窄屏 ──────────────────────────────────────────────────────────── */
.dos-compact { position: absolute; display: flex; align-items: center; gap: 10px; padding: 4px 8px; background: var(--dos-bar-bg); border: 1px solid rgba(var(--dos-rgb),.2); clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px)); font-size: 9px; letter-spacing: .12em; color: var(--dos-ink-dim); overflow: hidden; white-space: nowrap; }
.dos-compact b { color: var(--dos-cy); font-weight: 500; }
.dos-compact .sep { color: var(--dos-cy-faint); }

@media (max-width: 720px) {
  .dos-mark-sub { display: none; }
  .dos-rail { gap: 8px; }
  .dos-rail-right { gap: 8px; }
}

@media (prefers-reduced-motion: reduce) {
  .dos-root::after, .dos-boot-banner { animation: none !important; }
  .dos-rail-mid::after { animation: none; }
}

/* ── 设置页（跟随宿主主题） ─────────────────────────────────────────── */
.dso-settings {
  display: flex; flex-direction: column; gap: 16px; padding: 8px 0 24px; max-width: 760px;
  color: var(--dsw-alias-label-primary, #1a1a1a);
  font-family: -apple-system, "PingFang SC", "Noto Sans CJK SC", sans-serif;
}
.dso-header h2 { margin: 0 0 6px; font-size: 16px; font-weight: 600; letter-spacing: .01em; }
.dso-header p { margin: 0; font-size: 13px; line-height: 1.65; color: var(--dsw-alias-label-tertiary, #8a8f98); }
.dso-section { margin: 6px 0 -4px; font-size: 12px; font-weight: 600; letter-spacing: .08em; color: var(--dsw-alias-label-secondary, #666); text-transform: uppercase; }
.dso-group { border: .5px solid var(--dsw-alias-border-l2, #e6e6e6); border-radius: 10px; overflow: hidden; }
.dso-field { display: flex; align-items: center; gap: 16px; padding: 11px 14px; border-top: .5px solid var(--dsw-alias-border-l2, #e6e6e6); }
.dso-field:first-child { border-top: 0; }
.dso-field-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.dso-field-text b { font-size: 13px; font-weight: 500; }
.dso-field-text span { font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-tertiary, #8a8f98); }
.dso-switch {
  position: relative; flex: none; width: 40px; height: 22px; padding: 0; border-radius: 999px; cursor: pointer;
  background: var(--dsw-alias-bg-layer-3, #d9d9d9); border: .5px solid var(--dsw-alias-border-l3, #ccc);
  transition: background .18s ease;
}
.dso-switch[data-on="true"] { background: var(--dos-cy, #4d6bfe); border-color: transparent; box-shadow: 0 0 12px -2px var(--dos-cy, #4d6bfe); }
.dso-knob {
  position: absolute; top: 1px; left: 1px; width: 18px; height: 18px; border-radius: 50%;
  background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25); transition: transform .18s ease;
}
.dso-switch[data-on="true"] .dso-knob { transform: translateX(18px); background: #fff; }
.dso-seg { display: inline-flex; flex: none; border: .5px solid var(--dsw-alias-border-l3, #ccc); border-radius: 8px; overflow: hidden; }
.dso-seg-item {
  padding: 5px 11px; font: inherit; font-size: 12px; cursor: pointer; border: none; border-left: .5px solid var(--dsw-alias-border-l3, #ccc);
  background: transparent; color: var(--dsw-alias-label-secondary, #666);
}
.dso-seg-item:first-child { border-left: none; }
.dso-seg-item:hover { color: var(--dsw-alias-label-primary, #111); }
.dso-seg-item[data-on="true"] { background: var(--dos-cy, #4d6bfe); color: #fff; }
.dso-patterns { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.dso-pattern {
  display: flex; flex-direction: column; gap: 4px; padding: 10px; cursor: pointer; text-align: left;
  font: inherit; color: inherit; border-radius: 10px; background: transparent;
  border: .5px solid var(--dsw-alias-border-l2, #e6e6e6);
}
.dso-pattern[data-on="true"] { border-color: var(--dos-cy, #4d6bfe); background: color-mix(in srgb, var(--dos-cy, #4d6bfe) 10%, transparent); }
.dso-pattern b { font-size: 11px; letter-spacing: .16em; text-transform: uppercase; font-weight: 600; }
.dso-pattern > span:last-child { font-size: 11px; color: var(--dsw-alias-label-tertiary, #8a8f98); }
.dso-pattern-art {
  display: flex; align-items: flex-end; justify-content: center; gap: 7px;
  height: 52px; margin-bottom: 4px; padding: 8px; overflow: hidden;
  border-radius: 6px; background: #04080d; border: .5px solid #12222c;
}
.dso-pattern-art i { display: block; width: 2px; background: linear-gradient(180deg, rgba(91,140,255,0), #5b8cff); }
.dso-pattern-art-rain i:nth-child(1) { height: 40%; }
.dso-pattern-art-rain i:nth-child(2) { height: 72%; }
.dso-pattern-art-rain i:nth-child(3) { height: 55%; }
.dso-pattern-art-rain i:nth-child(4) { height: 88%; }
.dso-pattern-art-rain i:nth-child(5) { height: 48%; }
.dso-pattern-art-dshchan { align-items: center; justify-content: center; gap: 3px; }
.dso-pattern-art-dshchan i {
  width: 4px; border-radius: 2px; background: #5b8cff; box-shadow: 0 0 6px #5b8cff;
}
.dso-pattern-art-dshchan i:nth-child(1) { height: 35%; background: #ff6ea9; }
.dso-pattern-art-dshchan i:nth-child(2) { height: 65%; }
.dso-pattern-art-dshchan i:nth-child(3) { height: 80%; width: 6px; }
.dso-pattern-art-dshchan i:nth-child(4) { height: 60%; }
.dso-pattern-art-dshchan i:nth-child(5) { height: 30%; background: #ffc061; }
.dso-pattern-art-field { align-items: center; gap: 0; }
.dso-pattern-art-field i {
  width: 34px; height: 70%; margin: 0 -8px; background: none;
  border: 1px solid rgba(91,140,255,.65); border-radius: 50%;
}
.dso-pattern-art-field i:nth-child(2) { height: 52%; }
.dso-pattern-art-field i:nth-child(3) { height: 34%; }
.dso-pattern-art-field i:nth-child(4) { height: 52%; }
.dso-pattern-art-field i:nth-child(5) { height: 70%; }
.dso-pattern-art-off { align-items: center; }
.dso-pattern-art-off i { height: 1px; width: 70%; background: #1b3340; }
.dso-swatches { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.dso-swatch {
  width: 26px; height: 26px; padding: 0; border-radius: 6px; cursor: pointer;
  border: 2px solid transparent; box-shadow: inset 0 0 0 .5px rgba(0,0,0,.35);
}
.dso-swatch[data-on="true"] { border-color: var(--dsw-alias-label-primary, #111); box-shadow: 0 0 0 2px var(--dsw-alias-bg-base, #fff), 0 0 12px -3px var(--dos-cy, #4d6bfe); }
.dso-custom { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--dsw-alias-label-secondary, #666); cursor: pointer; }
.dso-custom input { width: 26px; height: 26px; padding: 0; border: none; background: none; cursor: pointer; }
.dso-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 12px; color: var(--dsw-alias-label-tertiary, #8a8f98); }
.dso-reset {
  font: inherit; font-size: 12px; cursor: pointer; padding: 6px 12px; border-radius: 8px;
  color: var(--dsw-alias-label-secondary, #666); background: transparent;
  border: .5px solid var(--dsw-alias-border-l3, #ccc);
}
.dso-reset:hover { color: var(--dsw-alias-label-primary, #111); border-color: var(--dsw-alias-border-l4, #aaa); }
@media (max-width: 620px) {
  .dso-patterns { grid-template-columns: 1fr 1fr; }
}
/* ══ 全应用主题：结构性皮肤 ═════════════════════════════════════════════
 *
 * 颜色与圆角绝大多数由 settings → skin/palette 的官方 token 覆盖层解决
 * （body 上的 inline CSS 变量）。这里只处理 token 覆盖不到、或需要"加一层
 * 我们自己的话术"的地方：
 *   1. 选区、滚动条、焦点环这类全局空白；
 *   2. chrome 排版（分组标签、New Session 用等宽大写字距）；
 *   3. 几处官方硬编码颜色（浮层浅字）在浅色纸面上的兜底；
 *   4. 会话内遥测条（我们自己的元件）。
 *
 * 铁律：只碰 color / background / border-color / font / letter-spacing /
 * text-transform / border-radius；不碰 padding / margin / width / height /
 * position / display / flex / grid（侧边栏的布局契约见
 * docs/references/261022-dsh-theme-surface-map.md 第 7.3 节）。
 */
html.dsh-os-theme ::selection { background: color-mix(in srgb, var(--dos-cy) 32%, transparent); color: var(--dos-ink); }
html.dsh-os-theme * { scrollbar-color: var(--dos-cy-dim) transparent; }
html.dsh-os-theme ::-webkit-scrollbar { width: 8px; height: 8px; }
html.dsh-os-theme ::-webkit-scrollbar-track { background: transparent; }
html.dsh-os-theme ::-webkit-scrollbar-thumb { background: var(--dos-cy-dim); border-radius: 0; }
html.dsh-os-theme ::-webkit-scrollbar-thumb:hover { background: var(--dos-cy); }
html.dsh-os-theme :focus-visible { outline-color: var(--dos-cy); }

/* chrome 排版：全大写的等宽标签，是"仪表盘"语汇的来源 */
html.dsh-os-theme [class*="_sectionLabel"],
html.dsh-os-theme [class*="_panelTitle"],
html.dsh-os-theme [class*="_newSessionContent"] {
  font-family: ui-monospace, "JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace;
  text-transform: uppercase;
  letter-spacing: .14em;
}

/* 悬浮卡在浅色纸面上要改成深字（官方这四处写死了浅字，假定浮层是深色） */
html.dsh-os-theme[data-dos-tone="light"] [class*="_hoverTitle"] { color: var(--dos-ink); }
html.dsh-os-theme[data-dos-tone="light"] [class*="_hoverPath"],
html.dsh-os-theme[data-dos-tone="light"] [class*="_hoverTime"],
html.dsh-os-theme[data-dos-tone="light"] [class*="_hoverStatus"] { color: var(--dos-ink-dim); }

/* 会话内遥测条：条子本身浮在留白上，会话流顶部留出条子高度 */
html.dsh-os-theme[data-dos-strip] [data-conversation-scroll] { padding-top: 26px; }
/* 明细卡展开时改成"从顶部让出高度"：下缘不动，最新消息不被挤走，正文也不被压住 */
html.dsh-os-theme[data-dos-strip-card] [data-conversation-scroll] {
  padding-top: 0;
  margin-top: var(--dos-strip-room, 0px);
  transition: margin-top .18s ease;
}
@media (prefers-reduced-motion: reduce) {
  html.dsh-os-theme[data-dos-strip-card] [data-conversation-scroll] { transition: none; }
}

.dos-strip { position: absolute; inset: 0 0 auto 0; pointer-events: none; z-index: 6; }
.dos-strip-bar {
  display: flex; align-items: center; gap: 6px; height: 21px; padding: 0 8px;
  pointer-events: auto;
  font-family: ui-monospace, "JetBrains Mono", "SFMono-Regular", Menlo, Consolas, "Noto Sans Mono CJK SC", monospace;
  font-size: 10px; line-height: 1; letter-spacing: .06em;
  color: var(--dos-ink-dim);
  background: var(--dos-strip-bg);
  border: 1px solid var(--dos-panel-line); border-top: none;
  backdrop-filter: blur(7px) saturate(1.1);
  cursor: default;
}
.dos-strip-bar .dos-strip-model { color: var(--dos-cy); letter-spacing: .12em; text-transform: uppercase; }
.dos-strip-dim { color: color-mix(in srgb, var(--dos-ink) 58%, transparent); }
.dos-strip-num { color: var(--dos-ink); font-variant-numeric: tabular-nums; }
.dos-strip-num[data-tone="warn"] { color: var(--dos-amber); }
.dos-strip-num[data-tone="hot"] { color: var(--dos-mag); }
.dos-strip-sep { color: var(--dos-panel-line); }
.dos-strip-spacer { flex: 1; }
.dos-strip-gauge { font-size: 9px; letter-spacing: 0; }
.dos-strip-gauge .on { color: var(--dos-cy); }
.dos-strip-gauge .off { color: color-mix(in srgb, var(--dos-cy) 24%, transparent); }
.dos-strip-gauge[data-tone="warn"] .on { color: var(--dos-amber); }
.dos-strip-gauge[data-tone="hot"] .on { color: var(--dos-mag); }
.dos-strip-toggle {
  pointer-events: auto; width: 16px; height: 15px; padding: 0; cursor: pointer;
  font: inherit; font-size: 9px; color: var(--dos-ink-dim);
  background: transparent; border: 1px solid var(--dos-panel-line);
}
.dos-strip-toggle:hover { color: var(--dos-cy); border-color: var(--dos-cy); }

.dos-strip-card {
  pointer-events: auto; width: 460px; max-width: 92vw; margin-top: 4px; padding: 8px 10px 9px;
  background: var(--dos-panel-bg); border: 1px solid var(--dos-edge);
  box-shadow: var(--dos-panel-shadow); backdrop-filter: blur(9px) saturate(1.1);
  font-family: ui-monospace, "JetBrains Mono", "SFMono-Regular", Menlo, Consolas, "Noto Sans Mono CJK SC", monospace;
  font-size: 10.5px; color: var(--dos-ink);
  clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
}
.dos-strip-card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.dos-strip-card-head b { font-weight: 600; color: var(--dos-ink); }
.dos-strip-card-head span { color: var(--dos-ink-faint); font-size: 9.5px; letter-spacing: .1em; text-transform: uppercase; }
.dos-strip-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px 12px; margin-top: 7px; }
.dos-strip-grid > div { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.dos-strip-grid .k { color: var(--dos-ink-faint); font-size: 8.5px; letter-spacing: .18em; text-transform: uppercase; }
.dos-strip-grid b { font-weight: 500; font-size: 12px; }
.dos-strip-grid small { color: var(--dos-ink-faint); font-size: 9px; }
.dos-strip-rule { height: 1px; margin: 8px 0 6px; background: linear-gradient(90deg, var(--dos-edge), transparent 62%); }
.dos-strip-breakdown { display: flex; flex-direction: column; gap: 3px; }
.dos-strip-seg { display: grid; grid-template-columns: 74px 1fr 46px; align-items: center; gap: 8px; }
.dos-strip-seg-label { color: var(--dos-ink-dim); font-size: 9.5px; letter-spacing: .1em; }
.dos-strip-seg-bar { height: 5px; background: linear-gradient(90deg, var(--dos-cy), var(--dos-cy-dim)); }
.dos-strip-seg-num { color: var(--dos-ink-faint); text-align: right; font-variant-numeric: tabular-nums; }
.dos-strip-card-foot { display: flex; align-items: center; gap: 8px; }
.dos-strip-action {
  pointer-events: auto; padding: 2px 7px; cursor: pointer; font: inherit; font-size: 9.5px;
  letter-spacing: .12em; text-transform: uppercase; color: var(--dos-ink-dim);
  background: transparent; border: 1px solid var(--dos-panel-line);
}
.dos-strip-action:hover { color: var(--dos-cy); border-color: var(--dos-cy); }
.dos-strip-action[data-on="1"] { color: var(--dos-chip-on-ink); background: var(--dos-cy); border-color: var(--dos-cy); }
.dos-strip-seg-switch { display: inline-flex; gap: 3px; }
.dos-strip-card-foot .dos-strip-dim { margin-left: auto; font-size: 9px; }
`
