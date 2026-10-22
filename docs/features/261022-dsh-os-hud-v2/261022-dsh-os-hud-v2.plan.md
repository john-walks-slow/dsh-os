# dsh-os v2：从"好看的摆件"到"可用的桌面"

日期：2026-10-22　状态：已完成（见 261022-dsh-os-hud-v2.summary.md）

## 背景

第一版（`261022-dsh-os-home`）视觉验收通过，但用户实际使用后提出四类问题：

1. **不可用**：底部模拟终端（CONSOLE）没有任何实际作用；`TOKEN · LEDGER` 从来没显示过数据（用户环境是 Windows 宿主的 DSH）。
2. **不实用**：HARNESS 面板的 `running / total`、Context pressure 只有在"有活跃会话"时才有值，而桌面只在首页（无活跃会话）显示，所以永远是 0。
3. **不适配**：没有深浅色模式适配——桌面层强行给 `body` 打 `data-ds-dark-theme`，浅色用户的原生界面被拖成深色。
4. **副作用**：侧边栏皮肤（`dsh-os-skin-sidebar`）开启后破坏原生侧边栏布局，要求整体撤掉。

## 根因（已实测确认）

- **账本为空的根因**：客户端会话列表快照 `sessions.list.getSnapshot().projectionsBySession[*].values` 只带"列表级"廉价投影键，`tokenUsage` / `sessionStats` 这类昂贵键需要显式 refresh，未打开的会话拿不到 → `deriveHarness` 里 `input+output+cacheRead === 0` 的行全被 `continue` 掉。
- **真实数据的落点**：DSH 把每个会话的投影检查点持久化在 `<DSH_HOME>/storages/session_projcache/sessions/<key>.json`（本机 3400+ 条，含 `tokenUsage` / `modelSelection` / `sessionListMetadata` / `turnBoundary` / `subagent*`）。这是**全量、跨平台**（Windows 上就是 `%USERPROFILE%\.dsh\storages\...`）的数据源。
- **深浅色**：DSH 客户端有正式主题服务 `ctx.theme`（`getTheme()` → `{ preference, active.colorScheme, active.tokens }`，事件 `theme/change`），并在 `html[data-ds-theme-source]` 与 `body[data-ds-dark-theme]` 上发布结果。适配 = 读它 + 跟随它 + 提供切换入口，而不是自己写死。

## 方案

### A. 宿主侧：会话投影索引（`src/harness.ts` + `src/index.ts`）

新增 `HarnessIndex`：分批（每 tick ≤200 文件）首轮索引 `<DSH_HOME>/storages/session_projcache/`，之后每 15s 只 stat 增量刷新；纯内存聚合，同步出快照。新增端点：

```
GET /plugins/dsh-os/harness?ws=<cwd>   →  HarnessPayload
```

载荷含两份口径（`space` = 该工作区 / `all` = 全机）：会话数、7 天活跃、正在跑、子代理、今日会话与 token、24h/7d/全部三个时间窗的用量、按模型聚合的账本（含 TPS、缓存命中率）、最近会话（可点击打开）、正在运行的会话。**时间窗按会话最近活动归窗**（投影是按会话聚合的，不是按轮次），注释与文档里如实说明。

### B. 客户端侧：重排桌面（`src/client/os/*`）

| 位置 | 第一版 | v2 |
| :--- | :--- | :--- |
| 左·上 | SYS · MONITOR | 保留，网络火花线改为可悬停读数 |
| 右·上 | HARNESS · CORE（永远 0） | **WORKSPACE · OVERVIEW**：工作区名、会话数/7d 活跃/正在跑/子代理、今日 token、缓存命中率、最近活动、主力模型 |
| 左·下 | SESSIONS · RECENT | 保留并加模型与 token 列（可点击打开会话） |
| 中·下（宽） | CONSOLE（模拟终端，删除） | **MODEL · LEDGER**：按模型聚合的 token 账本表，带时间窗切换 |
| 顶栏右 | pid / iface / uptime | 工作区会话统计（会话数 · 运行中）+ 时钟 |

交互：任务栏加 `scope`（WS/ALL）与 `theme`（SYSTEM/DARK/LIGHT，直接调 `ctx.theme.setTheme`）chip；账本表带 `24H / 7D / ALL` 时间窗 chip 与排序；行可点击（模型行高亮、会话行打开会话）；火花线悬停读数。

### C. 深浅色适配（`styles.ts` + `settings.ts` + `field/engine.ts`）

- 去掉强行写 `data-ds-dark-theme` 的行为，改为读 `ctx.theme`（缺失时回退到 `body[data-ds-dark-theme]` + `prefers-color-scheme`），在 `html` 上打 `data-dos-tone="dark|light"`。
- 每个主题色派生**两套**调色板：深色（现有霓虹）与浅色（纸面/蓝图风：浅底、深墨、细网格、同样的等宽字与窗格语汇），字符场同步换墨色图集。
- 设置页可显式覆盖（跟随宿主 / 深色 / 浅色）。

### D. 删除侧边栏皮肤

`skinSidebar` 设置项、`dsh-os-skin-sidebar` 全部样式、设置页对应行、README 与截图说明一并移除。输入框皮肤保留。

## 验收

1. `npm run build` + `npm run typecheck` 通过。
2. `npm run e2e`：桌面层出现、三个面板 + 账本表有真实数据（会话数 > 0、模型行 > 0）、控制台面板已消失、浅色/深色两种 `data-dos-tone` 都能渲染、`~` 与 chip 交互正常。
3. 深色与浅色两套截图（1440×900）与窄屏截图。
4. 文档（README / README.en / AGENTS.md）与截图同步更新。
