# dsh-os 模块指令

## 模块定位

`dsh-os` 是覆盖整个 DeepSeek Harness Web GUI 的主题 + 首页终端桌面：
- **全应用主题**：通过 DSH 官方 token 覆盖层改写 `--dsw-alias-*` / `--dsw-specific-*` / 圆角 / 高度 / shiki 语法高亮，把会话流、侧边栏、代码块、工具卡、弹窗、菜单、输入框、设置页一起换墨（深浅两套由宿主明暗决定）。
- **首页桌面层**：主视图没有活跃会话（blank-session hero）时，把白底首页替换为一台 Lain / Cyberpunk 风格的终端操作系统桌面；进入会话后桌面层自动退场，只留一条会话遥测条。
- **会话遥测条**：会话视图顶端的 21px 状态带与可展开明细卡（上下文压力、用量、缓存、解码速度）。

桌面上的数字必须是真的：整机读数来自 `/proc`·`/sys`（非 Linux 走 `node:os`），会话与 Token 账本来自 DSH 自己的会话投影缓存。**首页没有活跃会话**，所以任何"只有打开会话才有值"的数据都不该出现在这里。

## 目录结构

- `src/index.ts`：宿主服务入口，注册 `/plugins/dsh-os/metrics` 与 `/plugins/dsh-os/harness` 两个只读端点。
- `src/procfs.ts`：读取 Linux `/proc` 与 `/sys` 底层的无依赖读取器（含 `node:os` 兜底与能力位）。
- `src/metrics.ts`：CPU 时间片差值计算与 90 点历史环形缓冲区。
- `src/harness.ts`：会话投影缓存索引器（`<DSH_HOME>/storages/session_projcache`）。首轮分批 200 文件/帧，之后每 15s 按 mtime/size 增量刷新；`snapshot(workspace)` 纯内存聚合成 `HarnessPayload`（工作区/全机两套口径、按模型账本、最近会话、在跑会话）。子代理、空白会话、陈旧 open turn 的处理规则都写在这个文件里。
- `src/client/index.tsx`：浏览器插件入口，挂载 `shell.overlay` 与 `settings.section`，负责首页判定、几何测量、两个端点的轮询与事件滚动条。
- `src/client/harness.ts`：账本端点的前端入口与空载荷占位。
- `src/client/theme.ts`：宿主主题桥 + 官方覆盖层入口（`ctx.theme` → `data-dos-tone`；`applySkin/clearSkin` 装卸 `overrideTokens('dsh-os', …)`；没有主题服务时回退 DOM 与 `prefers-color-scheme`，此时换肤不可用）。
- `src/client/skin/palette.ts`：**色源唯一真相**。摊出深浅两套墨色（`skinFor`）、官方 token 覆盖表（`themeLayer`）、自己的 `--dos-*` 变量（`skinVars`）与字符场图集（`inkPaletteFor`）。改主题色只改这里。
- `src/client/skin/strip.tsx`：会话遥测条与明细卡（读 `projectionValues` / `projectionsBySession`；打开中的会话由 `ctx.sessions.refreshProjections` 催一次昂贵投影）。
- `src/client/styles.ts`：单文件注入样式表（`.dos-` 桌面与遥测条 / `.dso-` 设置页），只补 token 到不了的地方 —— 选区、滚动条、chrome 排版、官方写死的浮层浅字、以及 `.dos-strip-*` 等自有元件。
- `src/client/field/`：Canvas 字符动效引擎（`rain` 稀疏字符雨、`dshchan` 3D 全息投影、`field` 等高线拓扑）；`chan-art.ts` 由 `tools/chan-art.py` 从立绘生成，勿手改。
- `src/client/os/`：HUD 桌面（`Desktop.tsx`）、窗格（`panels.tsx`：SYS·MONITOR / WORKSPACE·OVERVIEW / SESSIONS·RECENT / MODEL·LEDGER）、构件（`chrome.tsx`）、开机自检（`Boot.tsx`）与设置面板（`settings-panel.tsx`）。
- `src/client/settings.ts`：偏好存储（localStorage）与主题色选择。**不再持有颜色**，色源在 `skin/palette.ts`。
- `e2e/smoke.mjs`：基于 `dsh-e2e` 的无头端到端冒烟测试（含主题 token 断言与"背景与文字同亮"的对比度哨兵）；`e2e/lib/fixtures.mjs` 播种会话投影夹具；`e2e/shots.mjs` 重出官方截图；`e2e/seed-conversation.mjs` 把本机真实会话日志搬进隔离 home（会话截图用）。
- `tools/preview.tsx`：离线设计预览页（假数据渲染 Desktop / 设置页），不参与插件产物。

## 开发与构建规则

1. **宿主包依赖铁律**：宿主半边（`src/index.ts`、`src/procfs.ts`、`src/metrics.ts`、`src/harness.ts`）禁止直接引入任何 `@deepseek-ai/*` 运行时模块，仅依赖 Node.js 内置模块，以防通过 `link:` 接入用户 profile 时因缺少独立 `node_modules` 导致 ESM 解析失败并拖垮整个 DSH。
2. **构建一致性校验**：所有改动完成后必须执行 `npm run build`；浏览器半边改完还要 `npm run typecheck`。
3. **皮肤铁律：只碰 color / background / border-color / font / letter-spacing / text-transform / border-radius，绝不碰 padding / margin / width / height / position / display / overflow / flex / grid**。侧边栏与会话流的尺寸是官方契约（`--dsh-sidebar-inline-padding`、`--dsh-session-list-*`、`container-type` 等），历史上改坏过一次；完整"不要动"清单见 `docs/references/261022-dsh-theme-surface-map.md` 第 7.3 节。
4. **窗格不许静默裁切**：`.dos-panel` 是 `overflow: hidden`，行数必须由可用高度算出来（见 `panels.tsx` 的 `systemRows`），并由 e2e 的 "窗格内容不被静默裁掉" 用例守住。
5. **测试规范**：日常验证采用 `npm run e2e`（底层由 `dsh-e2e` 托管，动态分配独立端口与隔离 home），截图用 `npm run e2e:shots`；两者都会播种夹具，测试脚本自己负责清理上一轮夹具（`resetFixtures`）。测试完成必须及时执行 `dsh-e2e stop` 释放槽位与内存。
6. **线上服务守护**：严禁未经用户明确书面同意重启线上 DSH 服务。
