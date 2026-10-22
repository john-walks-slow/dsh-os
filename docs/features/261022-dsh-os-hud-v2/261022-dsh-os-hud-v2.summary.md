# dsh-os v2 实施总结：从"好看的摆件"到"可用的桌面"

日期：2026-10-22　状态：已完成验收（e2e 39 项断言通过 + 截图重出）

## 用户反馈 → 处置

| 反馈 | 处置 |
| :--- | :--- |
| 模拟终端没有任何实际作用 | **删除 CONSOLE 面板**；真实事件继续走任务栏滚动条 |
| 模型账本从来没显示过数据（Windows 宿主） | **换成宿主侧索引**：读 DSH 自己的会话投影缓存，覆盖全部历史会话；账本挪到底部宽位（原来终端的位置） |
| 会话数据永远是 0（只有首屏可见） | 首页改看**工作区总览**：会话数／7d 活跃／此刻在跑／在飞子代理／今日 Token／缓存命中率／最近活动／主力模型，全部来自磁盘上的真实记录 |
| 没有适配深浅色 | 桌面**跟随宿主 `ctx.theme`**，深/浅两套墨色（霓虹终端 / 纸面蓝图）；任务栏与设置页可切换，且不再强行改写宿主主题 |
| sidebar 皮肤把原生界面搞坏 | **整体撤销**（设置项、CSS、文档里的描述全部移除），只保留输入框皮肤 |
| 右上角想要"这个工作区所有会话的情况" | 右上角即 WORKSPACE·OVERVIEW；顶栏右侧也换成 `n run / n sess / tok today` |
| 要又帅又实用又 interactive | 账本行可点（回到该模型最近用过的会话）、时间窗 `24H/7D/ALL`、口径 `WS/ALL`、网络火花线悬停读数、明暗芯片、会话行点击直达；新增 `src/harness.ts` 索引器 + `e2e/lib/fixtures.mjs` 夹具 + `npm run e2e:shots` 截图流水线 |

## 关键实现

1. **宿主侧会话投影索引（`src/harness.ts`，665 行）**
   - 数据源：`<DSH_HOME>/storages/session_projcache/sessions/*.json`（本机 3400+ 条，含 `tokenUsage` / `modelSelection` / `sessionListMetadata` / `turnBoundary` / `subagent*`），兼容旧版 single 布局。
   - 首轮分批 200 文件/帧（实测 1.6-1.8s / 3479 文件），之后每 15s 只 stat 增量刷新（最大事件循环滞后 ~77ms）。
   - 聚合口径：工作区 / 全机两套；按模型账本（含 TPS、缓存命中率、`lastSessionId`）；`sessions` 与 `sessionsAll` 两套最近会话列表；空白会话不计会话数；**open turn 需在 20 分钟内仍有活动才算"在跑"**（历史崩掉的 turn 会被滤掉：全机 running 从 29 收敛到 5）。
   - 端点：`GET /plugins/dsh-os/harness?ws=<cwd>`。
2. **客户端重排**：`WORKSPACE · OVERVIEW`（右上）/ `SESSIONS · RECENT`（左下）/ `MODEL · LEDGER`（底部宽位）替换旧 HARNESS 与 CONSOLE；窗格行数由实测高度算预算（`systemRows`），不再出现被静默裁掉的行。
3. **深浅色**：`src/client/theme.ts` 读宿主 `ctx.theme`（缺失时回退 `body[data-ds-dark-theme]` + `prefers-color-scheme`），只有 `html[data-dos-tone]` 是自己的；`settings.ts` 派生两套 `--dos-*` 变量，样式表里不再有深色死值；字符场按明暗换底纸与墨色。
4. **顺带修掉的旧账**：磁盘 `used` 用 `bfree` 而非 `bavail`（保留块会让 used 超过 total）；`window` 状态变量曾遮蔽全局 `window`；`tools/preview.tsx` 随接口升级修复（`?settings=1` 仍可离线出设置页截图）。

## 验证

- `npm run build` + `npm run typecheck` 通过。
- `npm run e2e`：39 项断言全通过，覆盖夹具播种/索引收敛、账本真实数字、口径与时间窗切换、火花线悬停、深/浅墨色底纸亮度、宿主主题不被改写、`~` 开关、窄屏、三种尺寸下窗格不被裁切、无控制台错误。
- `npm run e2e:shots` 重出 `screenshots/`（深色、浅色、dshchan、field、boot、移动端）；`settings.png` 由 `tools/preview.html?settings=1` 生成。
- 文档同步：`README.md`、`README.en.md`、`AGENTS.md`、`screenshots.json`。

## 已知取舍

- 账本时间窗按"会话最近活动时间"归窗（投影是按会话聚合的，不是逐轮次），是近似口径，README 里已说明。
- 472 条没有 `modelSelection` 的历史记录（几乎都是 one-shot 子代理）汇总在账本里显示为 `unknown`，不与合计对不上。
- e2e 实例里点侧边栏 Settings 打不开宿主设置视图，所以设置页截图改由离线预览页出图。
