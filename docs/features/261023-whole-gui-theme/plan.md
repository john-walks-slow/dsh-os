# 从"首页美化"到"整套 GUI 主题"

## 背景与目标

第一版 dsh-os 只在 blank-session hero（首页）上覆盖一台终端桌面。用户的两条反馈决定了这一轮的方向：

1. 「我们不只是一个首页，我们是一整个主题，会话里面那个也是要改的」——定位改为**全应用主题**。
2. 「绚丽又不打扰，又 interactive 又实用……完成度非常非常非常高」——既不牺牲可读性，也不能只是"换了套颜色"。

于是本轮要同时满足三件事：**覆盖面**（会话流、侧边栏、代码块、弹窗一起换墨）、**不打扰**（正文可读性优先，动效与装饰只留在首页与自己的元件上）、**真有用**（干活时给出此刻该知道的读数）。

## 关键决策

| 决策 | 理由 |
| --- | --- |
| 走 DSH 官方 `ctx.theme.overrideTokens` 覆盖层，而不是往别人的 DOM 上糊 CSS | 官方层是 body 内联变量，天然压过 `:root` / `body[data-ds-dark-theme]`；同一个 token 给 `{light, dark}` 两份，**跟随宿主明暗是免费的**；卸载即还原，不跟版本打架 |
| 覆盖范围从 alias 扩到 `--dsw-specific-*` / 圆角 / 高度 / shiki 语法高亮 | 实测 `validateOverrides` 只校验值的形状、不校验名字（见 `docs/references/261022-dsh-theme-surface-map.md`）。圆角与语法高亮是"整套主题"质感的决定性变量 |
| 色源收拢到 `skin/palette.ts` 一处 | 官方 token 层、首页 HUD、字符场、遥测条共用一套墨色，改主题色只改一个文件；`settings.ts` 不再持有颜色 |
| 只改颜色/字体/字距/圆角，**不碰布局** | 侧边栏曾被改坏（`--dsh-sidebar-inline-padding`、`--dsh-session-list-*`、`container-type`、 `max-width` 动画体系是一整套契约）。这条写成 AGENTS.md 的铁律 |
| 会话里加一条 21px 遥测条，而不是把桌面 HUD 搬进会话 | "不打扰"：桌面层在会话里退场，只在顶端留一条状态带；明细按需展开、点别处即收 |
| DSH 官方硬编码只点杀必要处 | 4 处组件级 dark 分支吃 `--dsw-static-neutral-850/800`（deliverables / plan / schedule / sidebar-right），浅色浮层写死浅字（workspace hover card）——分别用 static 覆盖与一条只改 `color` 的兜底规则解决 |

## 实施

1. **色源**（`src/client/skin/palette.ts`）
   - `skinFor(tone, accent)`：两套墨色（深=夜航终端玻璃，浅=蓝图纸面），四档描边、四档文字、语义色、玻璃面、diff 底。
   - `themeLayer(accent)`：150+ 条覆盖表 —— 面 / 描边 / 字 / 交互底 / 按钮 / markdown 与代码 / diff / 状态 / 浮层 / 滚动条 / specific 层 / 补 10 个上游漏定义的 alias / 圆角阶梯 / 高度与玻璃 / 4 个 static 灰阶 / 12 个 shiki 语法色 / DSH 品牌蓝阶（避免"三种蓝并存"）。
   - `skinVars` / `inkPaletteFor`：喂自己的 HUD、字符场与遥测条。
2. **覆盖层入口**（`src/client/theme.ts`）：`applySkin/clearSkin`；无主题服务时换肤不可用并如实标记。
3. **结构性皮肤**（`src/client/styles.ts`）：`::selection`（官方全仓没有这条规则）、滚动条、chrome 排版（等宽大写 + 字距）、浅色下浮层浅字兜底、`[data-conversation-scroll]` 顶部让位、`.dos-strip-*`。
4. **会话遥测条**（`src/client/skin/strip.tsx`）：模型 · 压力计 · in/out/cache · tps · 距今时间；明细卡给上下文构成、缓存读写、解码时长与会话 id；卡片里带 `SYS/DARK/LIGHT`（任务栏只在首页，干活时要能换墨）。数据取打开中会话的真实投影，并由 `ctx.sessions.refreshProjections` 催一次昂贵投影；`tokenUsage` 的扁平/`{totals}` 两种形状都认。
5. **接线**（`src/client/index.tsx`）：皮肤随设置装卸、`data-dos-tone` / `dsh-os-theme` / `data-dos-strip` 三个钩子属性、`__dshOsStrip()` 调试口。

## 验证

- `npm run typecheck` + `npm run build` 通过。
- `npm run e2e` 全绿，新增：主题层已挂、token 词条 > 100、底色/圆角/气泡/语法色取值、侧边栏底色随明暗、以及**对比度哨兵**（全页面扫描"背景与文字同亮"的可见文本——这条规则当场抓出过 `label-primary-inverted` 写反导致的白底白字）。
- `npm run e2e:shots` 产出会话视图深浅两张（真实会话日志 + 真实投影读数）。
- 视觉走查：`session-dark.png` 正文完整可见、代码块与内联码可读；`session-light.png` 无深色残留块。

## 遗留

- 遥测条明细卡在会话流较满时会盖住约 250px 正文；当前策略是"临时浮层"（点外面/滚动/Esc 即收）。彻底解决需要把条子放在滚动容器之外（官方骨架暂无可挂载的插槽）。
- 会话流里 deliverables / plan / schedule 三处卡片靠 static 灰阶兜住，观感统一但属折衷。
- macOS 的 darwin 专属硬编码（侧边栏品牌渐变、玻璃按钮）未处理——用户环境是 Windows/Linux，留待需要时再补。
