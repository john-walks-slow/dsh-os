# 全应用主题（whole-GUI theme）· 实施总结

## 这一轮做了什么

dsh-os 从"首页美化插件"变成"覆盖整个 DSH Web GUI 的主题"，并顺带补上一件干活时真正有用的元件。

### 1. 全应用换肤（官方 token 覆盖层）

- 新增 `src/client/skin/palette.ts` 作为**唯一色源**：深浅两套墨色 + 150+ 条官方 token 覆盖表 + 自己的 `--dos-*` 变量 + 字符场图集。
- 通过 `ctx.theme.overrideTokens('dsh-os', { token: { light, dark } })` 挂载（`src/client/theme.ts` 的 `applySkin/clearSkin`）。官方层写在 body 内联样式上，压过 `:root` 与 `body[data-ds-dark-theme]`，同一个 token 给两份取值，因此**跟随宿主明暗无需额外代码**，卸载时自动还原 DSH 原生配色。
- 覆盖面：会话流与消息气泡（`--dsw-specific-bubble`）、代码块与 markdown、工具卡与 diff、侧边栏与工作区列表、弹窗/菜单/Toast/Tooltip、输入框、设置页、滚动条、圆角阶梯（4/8/12/16/20/28 → 2/3/4/6/8/10）、高度与玻璃（毛玻璃遮罩 + 极浅投影）、以及 **12 个 shiki 语法高亮色**（代码块不再是"跟主题无关的一块彩虹"）。
- 顺手补上 10 个上游组件引用了但主题从未定义的 alias（`--dsw-alias-label-error`、`bg-layer-4`、`separator-primary` 等），几处 hover 与错误文案从"声明失效"变成可见。
- 只在 token 到不了的地方写 CSS（`styles.ts`）：`::selection`（官方全仓没有这条规则）、滚动条、chrome 排版（等宽大写 + 字距）、浅色下官方写死的浮层浅字兜底。

### 2. 会话遥测条（新增元件）

- 会话视图顶端 21px 状态带：`● MEDIUM dsh-os │▮▮▮▮▮▮▯▯ 67% 341.9K/512.0K │ in 6.59M out 395.5K cache 94% │ 24tps 13h ▸`。
- 明细卡（点箭头展开，点外面/滚动/`Esc` 收起）：上下文构成条（message/tools/system 各占多少）、缓存读写、解码时长与 TPS、会话 id，以及 `SYS / DARK / LIGHT` 明暗切换（任务栏只在首页，干活时要能换墨）。
- 数据是真的：取打开中会话的 `tokenUsage` / `contextPressure` / `contextBreakdown` / `sessionStats`，并用 `ctx.sessions.refreshProjections` 催一次昂贵投影；`tokenUsage` 的扁平与 `{totals}` 两种形状都兼容。

### 3. 修掉的真实缺陷

- **白底白字**：`--dsw-alias-label-primary-inverted` 写成了与底色同向，深色下 contrast 药丸完全看不见。新增的 e2e「对比度哨兵」（扫描全页面"背景亮度与文字亮度差 < 40"的可见文本）当场抓出，修正为随墨色反向。
- **三种蓝并存**：DSH 自家品牌蓝阶（`--dsw-static-deepseek-*`、`--dsw-static-blue-500`）没跟着主题色走，标签页下划线与发送键留着旧蓝；现已并入主题色阶。
- **正文偏灰、代码块与底几乎同色**：次要文字提亮一档，代码块底比页面底亮一档。
- **遥测条读数全 0**：客户端投影里 `tokenUsage` 是扁平对象（不是磁盘检查点里的 `{ totals, last }`），已兼容。

## 验证

| 项 | 结果 |
| --- | --- |
| `npm run typecheck` / `npm run build` | 通过 |
| `npm run e2e` | 全绿（41 条断言，含 6 条新增主题断言 + 对比度哨兵） |
| `npm run e2e:shots` | 产出 `session-dark.png` / `session-light.png`（真实会话日志 + 真实读数） |
| 视觉走查 | 深色会话正文完整可见；浅色无深色残留块；代码块/内联码/工具卡/错误块配色统一 |

## 已知折衷

- 明细卡展开时会盖住约 250px 正文（会话流是贴底滚动，加 padding 推不开内容）。策略是"临时浮层"，交互上即时收起；彻底解决需要滚动容器之外的挂载位，官方骨架目前没有。
- deliverables / plan / schedule 三处官方卡片走 static 灰阶，只能用 static 覆盖统一，属于折衷而非干净解。
- darwin（macOS）专属硬编码未处理：侧边栏品牌渐变与玻璃按钮在 macOS 上仍是原生观感。
- 会话视图截图依赖本机真实会话日志（`e2e/seed-conversation.mjs` 会自动跳过无历史的环境）。

## 相关文件

- 实现：`src/client/skin/palette.ts`、`src/client/skin/strip.tsx`、`src/client/theme.ts`、`src/client/styles.ts`、`src/client/index.tsx`、`src/client/settings.ts`
- 换肤面清单（调研产物）：`docs/references/261022-dsh-theme-surface-map.md`
- 测试与截图：`e2e/smoke.mjs`、`e2e/shots.mjs`、`e2e/seed-conversation.mjs`、`e2e/lib/fixtures.mjs`
