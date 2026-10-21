/**
 * dsh-os 的全部样式：一层注入的 <style>，命名空间 `.dos-`。
 *
 * 三个职责：
 *   1. 桌面背景：把首页的 frame 底色打透，让字符场成为壁纸；
 *   2. HUD 语汇：终端窗格、ASCII 仪表、扫描线与暗角；
 *   3. 响应式：窄屏收起两侧窗格，只留状态条。
 *
 * @module dsh-os/styles
 */

export const STYLE_ID = 'dsh-os-style'

export const CSS = `
/* ── 桌面背景：只作用于首页（html.dsh-os-live） ─────────────────────── */
html.dsh-os-live body { background: #04070b !important; }
html.dsh-os-live [data-slot="root"] > div { background-color: transparent !important; background-image: none !important; }
html.dsh-os-live #dsh-os-field { opacity: 1; }
html.dsh-os-live #root { position: relative; z-index: 1; }
.dos-paint-through { background-color: transparent !important; background-image: none !important; }

/* hero 背后压一层柔光暗角：标题与输入框在字符场上仍然读得清 */
html.dsh-os-live [class*="_composerHero"] { position: relative; }
html.dsh-os-live [class*="_composerHero"]::before {
  content: ""; position: absolute; inset: -10% -7%; z-index: -1; pointer-events: none;
  background: radial-gradient(58% 62% at 50% 46%, rgba(3,7,10,.86) 0%, rgba(3,7,10,.62) 52%, rgba(3,7,10,0) 78%);
}
#dsh-os-field canvas { opacity: .94; }

#dsh-os-field {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  opacity: 0; transition: opacity .8s ease;
  contain: strict;
}
#dsh-os-field canvas { display: block; width: 100%; height: 100%; }
#dsh-os-field::after {
  content: ""; position: absolute; inset: 0;
  background:
    repeating-linear-gradient(180deg, rgba(0,0,0,.22) 0 1px, transparent 1px 3px),
    radial-gradient(120% 90% at 50% 42%, transparent 34%, rgba(0,0,0,.52) 100%);
  mix-blend-mode: multiply;
}
#dsh-os-field::before {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(var(--dos-rgb),.05), transparent 26%, transparent 74%, rgba(255,110,169,.04));
}

.dos-root, .dos-root *, .dos-root *::before, .dos-root *::after { box-sizing: border-box; }
:root {
  --dos-cy: #5b8cff;
  --dos-cy-dim: rgba(91,140,255,.42);
  --dos-cy-faint: rgba(91,140,255,.14);
  --dos-mag: #ff6ea9;
  --dos-amber: #ffc061;
  --dos-red: #ff5a6a;
  --dos-ink: #e8efff;
  --dos-ink-dim: rgba(190,206,240,.58);
  --dos-ink-faint: rgba(164,182,220,.34);
  --dos-edge: rgba(91,140,255,.28);
  --dos-panel: rgba(4,11,14,.62);
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
  text-shadow: 0 1px 2px rgba(0,0,0,.75);
  opacity: 1; transition: opacity .45s ease;
  user-select: none;
}
.dos-root[data-phase="off"] { opacity: 0; }
.dos-root[data-phase="off"] * { pointer-events: none !important; }

/* 全局扫描线 + 一条缓慢下行的亮带 */
.dos-root::before {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background-image:
    repeating-linear-gradient(180deg, rgba(255,255,255,.022) 0 1px, transparent 1px 3px);
  opacity: .75;
}
.dos-root::after {
  content: ""; position: absolute; left: 0; right: 0; height: 18vh; pointer-events: none; z-index: 1;
  background: linear-gradient(180deg, transparent, rgba(var(--dos-rgb),.02) 45%, rgba(var(--dos-rgb),.045) 50%, rgba(var(--dos-rgb),.02) 55%, transparent);
  animation: dos-roll 13s linear infinite;
  mix-blend-mode: screen;
}
@keyframes dos-roll { from { transform: translateY(-20vh); } to { transform: translateY(115vh); } }
@keyframes dos-blink { 0%, 55% { opacity: 1; } 56%, 100% { opacity: 0; } }
@keyframes dos-flicker { 0%, 100% { opacity: 1; } 47% { opacity: .82; } 48% { opacity: 1; } 71% { opacity: .93; } }
@keyframes dos-scan-x { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }

.dos-cursor { display: inline-block; width: .62em; height: 1.02em; margin-left: 2px; vertical-align: -2px; background: var(--dos-cy); animation: dos-blink 1.1s steps(1) infinite; box-shadow: 0 0 8px var(--dos-cy); }
.dos-led { display: inline-block; width: 6px; height: 6px; border-radius: 1px; background: var(--dos-cy); box-shadow: 0 0 7px var(--dos-cy); }
.dos-led[data-tone="hot"] { background: var(--dos-mag); box-shadow: 0 0 7px var(--dos-mag); }
.dos-led[data-tone="warn"] { background: var(--dos-amber); box-shadow: 0 0 7px var(--dos-amber); }
.dos-led[data-tone="idle"] { background: var(--dos-ink-faint); box-shadow: none; }
.dos-led[data-pulse="1"] { animation: dos-blink 1.4s steps(1) infinite; }

/* ── 顶栏 ──────────────────────────────────────────────────────────── */
.dos-rail { position: absolute; display: flex; align-items: center; gap: 14px; height: 22px; padding: 0 6px; pointer-events: none; background: linear-gradient(90deg, rgba(3,8,11,.86), rgba(3,8,11,.55) 55%, rgba(3,8,11,.25)); }
.dos-rail-left { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
.dos-mark { color: var(--dos-cy); letter-spacing: .16em; font-size: 12px; text-shadow: 0 0 12px rgba(var(--dos-rgb),.55); white-space: nowrap; }
.dos-mark b { font-weight: 600; }
.dos-mark-sub { color: var(--dos-ink-faint); font-size: 9px; letter-spacing: .32em; text-transform: uppercase; white-space: nowrap; }
.dos-rail-mid { flex: 1; height: 1px; background: linear-gradient(90deg, rgba(var(--dos-rgb),.4), rgba(var(--dos-rgb),.08) 55%, transparent); position: relative; overflow: hidden; }
.dos-rail-mid::after { content: ""; position: absolute; inset: 0; width: 22%; background: linear-gradient(90deg, transparent, var(--dos-cy), transparent); animation: dos-scan-x 7s linear infinite; opacity: .8; }
.dos-rail-right { display: flex; align-items: center; gap: 12px; color: var(--dos-ink-dim); font-size: 10px; letter-spacing: .1em; white-space: nowrap; }
.dos-clock { color: var(--dos-ink); font-size: 12px; letter-spacing: .14em; font-variant-numeric: tabular-nums; }

/* ── 窗格 ──────────────────────────────────────────────────────────── */
.dos-panel {
  position: absolute; display: flex; flex-direction: column; gap: 2px;
  padding: 6px 8px 8px;
  background:
    linear-gradient(180deg, rgba(var(--dos-rgb),.05), transparent 22%),
    linear-gradient(180deg, rgba(5,13,17,.93), rgba(3,8,11,.95));
  border: 1px solid var(--dos-edge);
  clip-path: polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 9px 100%, 0 calc(100% - 9px));
  box-shadow: inset 0 0 26px rgba(0,0,0,.55), 0 0 22px rgba(0,0,0,.35);
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
.dos-sub { color: var(--dos-ink-faint); font-size: 8.5px; letter-spacing: .2em; text-transform: uppercase; margin-top: 1px; line-height: 1.2; }

.dos-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; min-width: 0; line-height: 1.25; }
.dos-k { color: var(--dos-ink-dim); font-size: 9px; letter-spacing: .18em; text-transform: uppercase; white-space: nowrap; }
.dos-v { color: var(--dos-ink); font-size: 11.5px; letter-spacing: .02em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.dos-v small { color: var(--dos-ink-faint); font-size: 8.5px; letter-spacing: .08em; }
.dos-v[data-tone="hot"] { color: var(--dos-mag); }
.dos-v[data-tone="warn"] { color: var(--dos-amber); }
.dos-v[data-tone="ok"] { color: var(--dos-cy); }

/* ASCII 计量条：字符即像素 */
.dos-meter { font-size: 10px; line-height: 1; letter-spacing: .04em; white-space: pre; font-variant-numeric: tabular-nums; }
.dos-meter .on { color: var(--dos-cy); text-shadow: 0 0 6px rgba(var(--dos-rgb),.5); }
.dos-meter .off { color: rgba(var(--dos-rgb),.14); }
.dos-meter[data-tone="warn"] .on { color: var(--dos-amber); text-shadow: 0 0 6px rgba(255,180,84,.45); }
.dos-meter[data-tone="hot"] .on { color: var(--dos-mag); text-shadow: 0 0 6px rgba(255,110,169,.45); }
.dos-meter[data-tone="ghost"] .on { color: var(--dos-ink-dim); text-shadow: none; }

.dos-spark { display: block; width: 100%; height: 22px; overflow: visible; }
.dos-spark polyline { fill: none; stroke: var(--dos-cy); stroke-width: 1.1; vector-effect: non-scaling-stroke; filter: drop-shadow(0 0 3px rgba(var(--dos-rgb),.55)); }
.dos-spark polygon { fill: rgba(var(--dos-rgb),.1); stroke: none; }
.dos-spark[data-tone="mag"] polyline { stroke: var(--dos-mag); filter: drop-shadow(0 0 3px rgba(255,110,169,.5)); }
.dos-spark[data-tone="mag"] polygon { fill: rgba(255,110,169,.1); }

.dos-cores { display: grid; grid-template-columns: 1fr 1fr; gap: 1px 8px; }
.dos-core { display: flex; align-items: center; gap: 4px; color: var(--dos-ink-faint); font-size: 9px; letter-spacing: .04em; line-height: 1.15; }
.dos-core i { font-style: normal; width: 14px; color: var(--dos-ink-dim); }
.dos-core .dos-meter { font-size: 8px; letter-spacing: 0; }

.dos-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 10px; }
.dos-stack { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dos-spacer { flex: 1; }

/* 会话列表 */
.dos-session { display: flex; align-items: center; gap: 6px; padding: 1px 2px; min-width: 0; cursor: pointer; border-left: 1px solid transparent; }
.dos-session:hover { background: rgba(var(--dos-rgb),.07); border-left-color: var(--dos-cy); }
.dos-session .t { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dos-ink-dim); font-size: 10px; }
.dos-session:hover .t { color: var(--dos-ink); }
.dos-session .age { color: var(--dos-ink-faint); font-size: 8.5px; letter-spacing: .06em; }
.dos-session .idx { color: var(--dos-cy-faint); font-size: 8.5px; }

/* ── 控制台 ────────────────────────────────────────────────────────── */
.dos-console { position: absolute; display: flex; flex-direction: column; gap: 2px; padding: 7px 10px 8px; background: linear-gradient(180deg, rgba(4,12,16,.86), rgba(3,8,11,.94)); border: 1px solid rgba(var(--dos-rgb),.18); backdrop-filter: blur(3px); pointer-events: auto; overflow: hidden; }
.dos-console-line { display: flex; gap: 8px; font-size: 10px; line-height: 1.55; white-space: nowrap; color: rgba(190,233,225,.72); }
.dos-console-line[data-fresh="1"] { color: var(--dos-ink); }
.dos-console-line .ts { color: rgba(var(--dos-rgb),.4); flex: none; }
.dos-console-line .tag { flex: none; width: 52px; color: var(--dos-cy-dim); letter-spacing: .08em; text-transform: uppercase; font-size: 9px; }
.dos-console-line[data-tone="mag"] .tag { color: var(--dos-mag); }
.dos-console-line[data-tone="warn"] .tag { color: var(--dos-amber); }
.dos-console-line .msg { overflow: hidden; text-overflow: ellipsis; }
.dos-prompt { display: flex; gap: 6px; align-items: center; color: var(--dos-cy); font-size: 10px; letter-spacing: .04em; margin-top: 1px; }
.dos-prompt .path { color: var(--dos-ink-faint); }

/* ── 任务栏 ────────────────────────────────────────────────────────── */
.dos-taskbar { position: absolute; height: 26px; display: flex; align-items: center; gap: 8px; padding: 0 12px; background: linear-gradient(180deg, rgba(4,11,14,.72), rgba(3,8,11,.94)); border-top: 1px solid rgba(var(--dos-rgb),.2); backdrop-filter: blur(4px); pointer-events: auto; font-size: 9px; letter-spacing: .16em; color: var(--dos-ink-faint); text-transform: uppercase; }
.dos-chip { display: inline-flex; align-items: center; gap: 5px; padding: 2px 7px; border: 1px solid rgba(var(--dos-rgb),.2); background: transparent; color: var(--dos-ink-dim); font: inherit; font-size: 8.5px; letter-spacing: .18em; cursor: pointer; text-transform: uppercase; }
.dos-chip:hover { color: var(--dos-ink); border-color: var(--dos-cy); }
.dos-chip[data-on="1"] { color: #041014; background: var(--dos-cy); border-color: var(--dos-cy); box-shadow: 0 0 12px rgba(var(--dos-rgb),.35); }
.dos-chip[data-dim="1"] { opacity: .55; }
.dos-ticker { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: rgba(160,210,204,.55); letter-spacing: .1em; text-transform: none; font-size: 9.5px; }
.dos-keys { display: flex; gap: 8px; color: var(--dos-ink-faint); font-size: 8.5px; }
.dos-keys kbd { font: inherit; color: var(--dos-ink-dim); border: 1px solid rgba(var(--dos-rgb),.22); padding: 0 3px; }

/* ── 开机自检 ──────────────────────────────────────────────────────── */
.dos-boot { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 5vh 5vw; background: radial-gradient(120% 100% at 50% 45%, #071319 0%, #020508 72%); color: var(--dos-ink); pointer-events: auto; cursor: pointer; font-family: ui-monospace, "JetBrains Mono", "SFMono-Regular", Menlo, Consolas, "Noto Sans Mono CJK SC", monospace; }
.dos-boot::before { content: ""; position: absolute; inset: 0; background-image: repeating-linear-gradient(180deg, rgba(255,255,255,.025) 0 1px, transparent 1px 3px); pointer-events: none; }
.dos-boot-inner { position: relative; width: min(920px, 100%); display: flex; flex-direction: column; gap: 13px; }
.dos-boot[data-leaving="1"] { animation: dos-boot-out .7s ease forwards; }
@keyframes dos-boot-out { 0% { opacity: 1; clip-path: inset(0 0 0 0); } 55% { opacity: 1; clip-path: inset(48% 0 48% 0); } 100% { opacity: 0; clip-path: inset(50% 0 50% 0); } }
.dos-boot-banner { margin: 0; color: #7dffe9; font-size: clamp(7px, 1.9vw, 26px); line-height: 1.08; letter-spacing: .01em; text-shadow: 0 0 18px rgba(var(--dos-rgb),.45), 2px 0 rgba(255,110,169,.35), -2px 0 rgba(var(--dos-rgb),.35); white-space: pre; animation: dos-flicker 7s linear infinite; }
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

/* ── 原生皮肤：侧边栏（全终端机能风） ─────────────────────────────── */
html.dsh-os-live.dsh-os-skin-sidebar,
html.dsh-os-live.dsh-os-skin-sidebar body {
  --dsw-specific-sidebar-fill: #04080f !important;
}
html.dsh-os-live.dsh-os-skin-sidebar [class*="_sidebarCol"],
html.dsh-os-live.dsh-os-skin-sidebar [class*="_sidebarCol"] [class*="_root"] {
  background:
    radial-gradient(120% 45% at 0% 0%, rgba(var(--dos-rgb), .10), transparent 62%),
    linear-gradient(180deg, #050b13 0%, #040810 52%, #03060b 100%) !important;
  border-right: 1px solid rgba(var(--dos-rgb), .22) !important;
  box-shadow: inset -1px 0 0 rgba(var(--dos-rgb), .14), inset -24px 0 46px -46px var(--dos-cy) !important;
  color: var(--dos-ink-dim) !important;
  font-family: var(--ds-font-family-code, ui-monospace, monospace) !important;
}
html.dsh-os-live.dsh-os-skin-sidebar [class*="_sidebarCol"] {
  position: relative;
  isolation: isolate;
}
/* 扫描线 + 左侧刻度导轨 */
html.dsh-os-live.dsh-os-skin-sidebar [class*="_sidebarCol"]::after {
  content: ''; position: absolute; inset: 0; z-index: 4; pointer-events: none;
  background: repeating-linear-gradient(0deg, rgba(0, 0, 0, .24) 0 1px, transparent 1px 3px);
  opacity: .5;
}
html.dsh-os-live.dsh-os-skin-sidebar [class*="_sidebarCol"]::before {
  content: ''; position: absolute; left: 4px; top: 70px; bottom: 10px; width: 1px; z-index: 4; pointer-events: none;
  background: repeating-linear-gradient(180deg, rgba(var(--dos-rgb), .42) 0 1px, transparent 1px 10px);
  opacity: .7;
}
html.dsh-os-live.dsh-os-skin-sidebar [class*="_brandIdentity"] {
  padding-bottom: 8px;
  border-bottom: 1px dashed rgba(var(--dos-rgb), .2);
}
html.dsh-os-live.dsh-os-skin-sidebar [class*="_brandName"] {
  letter-spacing: .2em !important;
  text-transform: uppercase !important;
  color: var(--dos-cy) !important;
  text-shadow: 0 0 10px rgba(var(--dos-rgb), .5);
}
html.dsh-os-live.dsh-os-skin-sidebar [class*="_newSession"] {
  background: rgba(var(--dos-rgb), .07) !important;
  border: 1px solid rgba(var(--dos-rgb), .38) !important;
  border-radius: 1px !important;
  color: var(--dos-cy) !important;
  letter-spacing: .14em !important;
  text-transform: uppercase !important;
  font-size: 11px !important;
  box-shadow: inset 0 0 14px -8px var(--dos-cy);
  transition: all .18s ease;
}
html.dsh-os-live.dsh-os-skin-sidebar [class*="_newSession"]:hover {
  background: var(--dos-cy) !important;
  color: #030810 !important;
  box-shadow: 0 0 22px -4px var(--dos-cy) !important;
}
html.dsh-os-live.dsh-os-skin-sidebar [class*="_sectionHeader"] {
  border-bottom: 1px solid rgba(var(--dos-rgb), .14);
  padding: 8px 4px 4px;
}
html.dsh-os-live.dsh-os-skin-sidebar [class*="_sectionLabel"] {
  font-size: 9px !important;
  letter-spacing: .24em !important;
  text-transform: uppercase !important;
  color: var(--dos-cy) !important;
  opacity: .8;
}
html.dsh-os-live.dsh-os-skin-sidebar [class*="_sectionLabel"]::before {
  content: '> '; color: rgba(var(--dos-rgb), .55);
}
html.dsh-os-live.dsh-os-skin-sidebar [class*="_panelRow"],
html.dsh-os-live.dsh-os-skin-sidebar [class*="_projectRow"] {
  border-radius: 1px;
  border-left: 2px solid transparent;
  color: var(--dos-ink-dim) !important;
  font-size: 12px !important;
  letter-spacing: .02em;
  transition: all .15s ease;
}
html.dsh-os-live.dsh-os-skin-sidebar [class*="_panelRow"]:hover,
html.dsh-os-live.dsh-os-skin-sidebar [class*="_projectRow"]:hover {
  background: rgba(var(--dos-rgb), .1) !important;
  border-left-color: var(--dos-cy) !important;
  color: var(--dos-ink) !important;
}
html.dsh-os-live.dsh-os-skin-sidebar [class*="_searchInput"] {
  background: rgba(2, 6, 10, .85) !important;
  border: 1px solid rgba(var(--dos-rgb), .26) !important;
  border-radius: 1px !important;
  color: var(--dos-ink) !important;
}
html.dsh-os-live.dsh-os-skin-sidebar [class*="_iconButton"]:hover {
  color: var(--dos-cy) !important;
}
html.dsh-os-live.dsh-os-skin-sidebar [class*="_treeBody"] {
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--dos-rgb), .45) transparent;
}

/* ── 原生皮肤：输入框 ──────────────────────────────────────────────── */
html.dsh-os-live.dsh-os-skin-composer [class*="_composerHero"] [class*="_card"],
html.dsh-os-live.dsh-os-skin-composer [class*="_composerStack"] [class*="_card"] {
  background: linear-gradient(180deg, rgba(6, 12, 19, .96), rgba(3, 7, 12, .98)) !important;
  border: 1px solid rgba(var(--dos-rgb), .35) !important;
  border-radius: 2px !important;
  box-shadow:
    0 24px 60px -30px rgba(0, 0, 0, .8),
    0 0 24px -8px var(--dos-cy),
    inset 0 0 24px -16px var(--dos-cy),
    inset 0 1px 0 rgba(var(--dos-rgb), .25) !important;
}
html.dsh-os-live.dsh-os-skin-composer [class*="_composerHero"] [class*="_placeholder"],
html.dsh-os-live.dsh-os-skin-composer [class*="_composerStack"] [class*="_placeholder"] {
  color: rgba(var(--dos-rgb), .48) !important;
  letter-spacing: .03em;
  font-family: var(--ds-font-family-code, monospace) !important;
}
html.dsh-os-live.dsh-os-skin-composer [class*="_composerHero"] [class*="_tools"],
html.dsh-os-live.dsh-os-skin-composer [class*="_composerStack"] [class*="_tools"] {
  border-top: 1px solid rgba(var(--dos-rgb), .15) !important;
}
html.dsh-os-live.dsh-os-skin-composer [class*="_composerHero"] [class*="_primary"],
html.dsh-os-live.dsh-os-skin-composer [class*="_composerStack"] [class*="_primary"] {
  background: var(--dos-cy) !important;
  color: #030810 !important;
  box-shadow: 0 0 16px -2px var(--dos-cy);
}
html.dsh-os-live.dsh-os-skin-composer [class*="_composerHero"] [class*="_add"],
html.dsh-os-live.dsh-os-skin-composer [class*="_composerStack"] [class*="_add"] {
  border-color: rgba(var(--dos-rgb), .32) !important;
  color: rgba(var(--dos-rgb), .85) !important;
}

/* ── Token 账本 ───────────────────────────────────────────────────── */
.dos-ledger { display: flex; flex-direction: column; gap: 1px; }
.dos-ledger-head, .dos-ledger-row, .dos-ledger-total {
  display: grid; grid-template-columns: 1fr 62px 64px 64px 52px 42px; gap: 8px;
  align-items: baseline; font-size: 10px; line-height: 1.5;
}
.dos-ledger-head { color: rgba(var(--dos-rgb), .55); font-size: 8.5px; letter-spacing: .16em; text-transform: uppercase; }
.dos-ledger-row { color: var(--dos-ink-dim); border-left: 1px solid transparent; padding-left: 4px; cursor: pointer; }
.dos-ledger-row:hover { color: var(--dos-ink); background: rgba(var(--dos-rgb), .08); border-left-color: var(--dos-cy); }
.dos-ledger-row .t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dos-ledger-row .n, .dos-ledger-total .n { text-align: right; font-variant-numeric: tabular-nums; }
.dos-ledger-row .p { color: var(--dos-ink-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dos-ledger-total { border-top: 1px solid rgba(var(--dos-rgb), .18); padding-top: 2px; color: var(--dos-cy); }
.dos-ledger-empty { color: var(--dos-ink-faint); font-size: 10px; padding: 6px 0; }

/* ── 窄屏 ──────────────────────────────────────────────────────────── */
.dos-compact { position: absolute; display: flex; align-items: center; gap: 10px; padding: 4px 8px; background: rgba(4,12,16,.9); border: 1px solid rgba(var(--dos-rgb),.2); clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px)); font-size: 9px; letter-spacing: .12em; color: var(--dos-ink-dim); overflow: hidden; white-space: nowrap; }
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
`