# DSH Web GUI 换肤面清单（Theme Surface Map）

> 调研对象：`/usr/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/` 下的客户端 UI 包（版本随 DSH 主包走）。
> 用途：dsh-os 从「首页美化」升级为「全 GUI 主题」的实现依据。
> 所有类名均为 CSS Module 哈希类名，格式 `<Prefix>_<name>`；`<Prefix>` 是构建期生成的稳定短哈希，**不是**语义名。文中给出的 `前缀` 可当作稳定锚点使用，但升级 DSH 后需要复核。

---

## 0. 结论先行

1. **DSH 官方 token 体系覆盖了绝大部分视觉面。** 全仓 `dsh-client-ui-*` 里通过 `var(--dsw-*)` 取色的声明占绝对多数；真正「绕过 token 的硬编码颜色」集中在四类地方：① 品牌色渐变（darwin 侧边栏）、② 会话流里的 mask 渐变、③ 侧边栏/日程悬浮卡片的浮层文字色（`#fff`/`#cfd3d6`/`#adb2b8`）、④ 文件类型图标与 Excel/PDF 预览的内嵌资源。详见第 3 章。
2. **深浅两套的差异 100% 由 alias 层承担。** 77 个 `--dsw-static-*` 原始色阶在 `body` 与 `body[data-ds-dark-theme]` 下几乎完全一致（只有 `--dsw-static-neutral-bluish-60` 一处不同）；`body[data-ds-dark-theme]` 覆盖了全部 101 个 `--dsw-alias-*`。**这意味着只要覆盖 alias，深浅两套自然各走一套。**
3. **`ctx.theme.overrideTokens(source, tokens)` 强约束：每个 token 必须同时给 `light` 和 `dark` 两个值**（`ThemeTokenModes`），给裸字符串会抛错。所以主题的颜色表应该天然是「一个 token → 一对值」的结构。
4. **消息流的背景全是 token，但有几处需要打组件选择器**：`ChangedFiles`（`.hz8-rW_card`）、`PlanPreview`（`.k74WwW_card`）、`Deliverables`（`.nyYjTG_root/.nyYjTG_fileIcon`）、`Schedule`（`.Ww4dvW_card`）这四处用 `body[data-ds-dark-theme] .xxx` 直接分支到 `--dsw-static-neutral-850/800`（不是 alias）。覆盖 alias 对它们无效，必须覆盖 static 或打组件选择器。
5. **侧边栏的高危区不是颜色，是布局变量**：`--dsh-sidebar-inline-padding`、`--dsh-session-list-edge-inset`、`--dsh-sidebar-width`、`--dsh-frame-leading-clearance` 与 `[data-windows-titlebar]` 分支共同决定折叠/展开、rail 模式、负 margin 出血。**只改颜色与 border-radius，不要动 padding / margin / width / height。**

---

## 1. 客户端 UI 包职责表

`dsh-client-ui-*` 共 **53** 个，`dsh-experimental-client-ui-*` **2** 个。

### 1.1 骨架与基础设施

| 包 | 职责 |
| --- | --- |
| `dsh-client-ui-theme` | Token 体系本体：`--dsw-*` 全套样式表、深浅状态机 `ThemeRuntime`、Appearance 设置行、`ctx.theme` 服务（含 `overrideTokens`/`register`）。**换肤的唯一官方入口。** |
| `dsh-client-ui-layout` | 三栏 AppFrame、拖拽把手、`ctx.layout` 视图状态服务；`data-ds-dark-theme` 的实际写入者（theme-presenter）。 |
| `dsh-client-ui-renderer` | 浏览器 UI 渲染器：React slot 绑定、`ctx.uiRenderer`、应用根组装。 |
| `dsh-client-ui-slots` | Slot 注册纯核心（无 DOM）：typed Slot / Component Factory / Store seat。 |
| `dsh-client-ui-primitives` | 纯 React 原子件（零 cordis）：按钮、输入、菜单、弹窗、Toast、Tooltip、markdown、代码块、diff、JSON 树。**唯一带 `.module.css` 原文件的包。** |
| `dsh-client-ui-session` | 会话控制器适配层、session 作用域 slot。 |
| `dsh-client-ui-slots` / `dsh-client-ui-settings` | 设置域基座：共享配置表单 + settings slot 契约。 |
| `dsh-client-ui-brand-official` | 侧边栏品牌位（`FishLogo` + `BrandWordmark`，来自 primitives）。 |

### 1.2 会话流

| 包 | 职责 |
| --- | --- |
| `dsh-client-ui-conversation` | 目标无关的会话装配：壳、**composer / 输入条**、队列、视图导航、hero 态。 |
| `dsh-client-ui-chat` | Chat 会话目标本体：**消息流、turn 结构、思考行、turn 触发/过程/收尾、token 用量面板**。 |
| `dsh-client-ui-tool` | 客户端工具调用树渲染器 + 每个工具的呈现 slot（工具卡）。 |
| `dsh-client-ui-trajectory` | Trajectory 事件账本 + 交互式时间总览视图。 |
| `dsh-client-ui-deliverables` | 变更文件卡、逐文件对比 tab、交付卡、最终回复里的可点击文件引用；**file-diff 色的唯一使用者**。 |
| `dsh-client-ui-attachment` | 附件呈现：composer 附件条、消息内图片、拖放遮罩。 |
| `dsh-client-ui-message-feedback` | 助手消息动作条里的赞/踩 + 反馈弹窗。 |
| `dsh-client-ui-agent-preset` | Agent 预设面：后续会话默认值、本会话席位、组合编辑器。 |
| `dsh-client-ui-permission-presets` | 权限面：General 里的新会话默认值 + `/permission` 弹窗。 |
| `dsh-client-ui-model-selection` | 模型选择（共享模型目录 + 会话投影）。 |
| `dsh-client-ui-approval` | 审批 composer takeover。 |
| `dsh-client-ui-user-questions` | `ask_user_question` 的 composer takeover 与计划评审呈现。 |
| `dsh-client-ui-goal` | 会话目标面：composer 上方的 GoalBar。 |
| `dsh-client-ui-plan` | Plan 模式控件、常驻 transcript 计划卡、侧边栏 Markdown 预览。 |
| `dsh-client-ui-jobs` | 会话头的后台任务列表 + 按需流式记录面板。 |
| `dsh-client-ui-workflow-run` | 持久 workflow-run 会话节点 + 嵌套成员展开。 |
| `dsh-client-ui-subagent` | 子代理会话目录、续跑路由 UI、`@` 引用源。 |
| `dsh-client-ui-skill` | Web 技能引用 + 专用 skill 工具行。 |
| `dsh-client-ui-cordis` | Cordis 动态插件定义卡（`cordis_define` 工具行 + 启停开关）。 |
| `dsh-client-ui-commands` | 客户端命令面：全局目录缓存、`/` 源、三种命令 UI。 |
| `dsh-client-ui-input-trigger` | 输入触发管线：`/` 与 `@` 检测、候选菜单、pick 路由。 |
| `dsh-client-ui-reference` | 统一 `@file` / `@session` 引用源。 |
| `dsh-client-ui-open-in-app` | 「用…打开」控件（会话头拆按钮 + 文档预览默认程序）。 |
| `dsh-experimental-client-ui-agent-team` | Agent Teams 名册、任务板、队友导航。 |
| `dsh-experimental-client-ui-voice-input` | 语音录制并插入草稿。 |

### 1.3 侧边栏与右侧栏

| 包 | 职责 |
| --- | --- |
| `dsh-client-ui-sidebar` | 左侧栏壳：品牌区、New Session、面板列表、区域槽、底部设置入口、折叠/rail 态。 |
| `dsh-client-ui-workspace` | 工作区选择器 + **工作区分组 / 会话行 / 搜索结果行**（侧边栏列表的实际渲染者）。 |
| `dsh-client-ui-sidebar-right` | 右侧栏停靠面：会话绑定状态、展开控件、导航服务。 |
| `dsh-client-ui-sidebar-files` | 右侧栏工作区文件树 tab。 |
| `dsh-client-ui-sidebar-terminal` | 右侧栏交互式 shell tab（内嵌 xterm.css）。 |
| `dsh-client-ui-sidebar-browser` | 右侧栏沙箱 Web 浏览器 tab。 |
| `dsh-client-ui-sidebar-documentpreview` | 右侧栏文档预览：Office / 表格 / Markdown / 代码 / 图片 / PDF / HTML / 纯文本。 |
| `dsh-client-ui-plugin-manager` | 侧边栏 Plugins 面板：安装/启停/重试/组合插件包。 |

### 1.4 设置页

| 包 | 职责 |
| --- | --- |
| `dsh-client-ui-settings-general` | General 分区、**Settings 根壳（面板 + 导航 + 遮罩）**、壳 trigger/header chrome、版本欢迎通知。 |
| `dsh-client-ui-settings-models` | 模型设置 + 共享产品引导弹窗。 |
| `dsh-client-ui-settings-plugins` | 内置插件设置分区、Settings 导航入口、tab chrome。 |
| `dsh-client-ui-settings-plugin-inventory` | 只读 Cordis Loader 清单 tab。 |
| `dsh-client-ui-settings-account` | DeepSeek 登录管理 + Platform 计费页跳转（含明暗两套插画）。 |
| `dsh-client-ui-settings-agent-loop` | agent-loop 命名空间的并行工具调用上限。 |
| `dsh-client-ui-settings-shell` | shell 执行器超时与单流输出上限。 |
| `dsh-client-ui-settings-subagent` | 子代理递归深度、并行容量、可选模型。 |
| `dsh-client-ui-settings-web-search` | DeepSeek 搜索 provider 的 key / endpoint / 预算。 |
| `dsh-client-ui-settings-session-log` | 会话日志上传开关。 |
| `dsh-client-ui-shortcuts` | 快捷键查阅、录制、本地偏好编辑。 |
| `dsh-client-ui-schedule` | Host 任务管理页 + 会话提醒目录。 |
| `dsh-client-ui-directory-picker-browse` | 应用内目录浏览（工作区目录流）。 |
| `dsh-client-ui-directory-picker-native` | 原生目录选择器（无渲染）。 |

---

## 2. Token 体系

### 2.1 来源与结构

全部样式表来自 `dsh-client-ui-theme/lib/client.js`，共 7 个内嵌 CSS 块：

| 变量名 | 内容 |
| --- | --- |
| `base_css_default` | `:root` 字体族、圆角（`--dsw-radius-xs/sm/md/lg/xl/panel` = 4/8/12/16/20/28px）、缓动与时长；`body` 上的 `--dsw-alias-settings-card-fill/stroke`；`[data-dsh-automatic-focus]` 去 outline。 |
| `design_platform_css_default` | **核心**：77 个 `--dsw-static-*`（body + dark）、101 个 `--dsw-alias-*` + 11 个 `--dsw-specific-*`（body + dark）、darwin 菜单特殊值。 |
| `gradient_shadow_text_css_default` | 4 个渐变、4 个阴影、3 个 elevation、`--dsw-elevation-stroke-color`、`--dsw-mask-blur`、`--dsw-menu-backdrop-filter`，以及 `--dsw-font-*` 字体阶梯。 |
| `scrollbar_css_default` | `--dsh-scrollbar-*` 与 `::-webkit-scrollbar*` 规则。 |
| `focus_css_default` | `--dsw-focus-ring-width:2px` 与 `:focus-visible` 全局规则。 |
| `corner_shape_css_default` | `--dsw-corner-shape: superellipse(1.5)`（`@supports` 内）。 |
| `onboarding_css_default` | `--dsw-alias-onboarding-*`（4 个）+ 3 组 onboarding 渐变 stops。 |
| `shiki_css_default` | `--shiki-*` 代码高亮 token（`--shiki-background:var(--dsw-alias-markdown-code-block)`）。 |

层级：`--dsw-static-*`（原始色阶，77）→ `--dsw-alias-*`（语义层，107，其中 base 块 101）→ `--dsw-specific-*`（产品特定，11）。另有 `--dsw-specific-menu` / `--dsw-menu-surface-fill` / `--dsw-alias-menu-group-header-fill` 三个浮层填充。

### 2.2 深浅切换机制

**结论：不是覆盖 static，而是覆盖 alias。**

```css
/* 1) 静态层两套几乎相同（仅 bluish-60 一处不同） */
body                  { --dsw-static-neutral-bluish-60:#f5f6f7; ... }
body[data-ds-dark-theme] { --dsw-static-neutral-bluish-60:#f9fafb; ... }

/* 2) 语义层由 static 派生，两套差异全在这里 */
body                  { --dsw-alias-bg-base:var(--dsw-static-neutral-bluish-00); ... }  /* 101 个 */
body[data-ds-dark-theme] { --dsw-alias-bg-base:var(--dsw-static-neutral-bluish-950); ... } /* 覆盖同样 101 个 */
```

- dark 分支 **覆盖了全部 101 个 `--dsw-alias-*`**，没有任何 alias 在深色下沿用浅色定义。
- 另有 `body[data-ds-dark-theme] [data-menu-material]{--dsw-elevation-stroke-color:var(--dsw-alias-border-l3)}`（仅菜单材质）。
- darwin 平台额外两条：`html[data-platform=darwin] body{--dsw-specific-menu:#f8f9faf0}` / `...[data-ds-dark-theme]{--dsw-specific-menu:#303136f0}`。

**谁写这个属性：**
- 首屏（插件加载前）：`dsh-client-ui-theme/lib/index.js` 的 boot 脚本，`document.body.toggleAttribute('data-ds-dark-theme', dark)`，同时写 `--dsh-content-font-size`；head 里还有 `:root{color-scheme:...}` 与 `body{background-color:#fff|#151517}`。
- 运行期：`dsh-client-ui-layout/lib/client.js` 的 `ThemePresenter`，`DARK_ATTRIBUTE = "data-ds-dark-theme"`，依据 `active.colorScheme`（**不是 theme id**）切换；同时写 `html[data-ds-theme-source]` 与 `<meta name="theme-color">`，并把 `active.tokens` 作为 inline CSS 变量写到 body 上（每次 apply 先移除上次写的 token）。

> 对换肤的意义：`data-ds-theme-source` 会被 Electron preload 转发给 `nativeTheme.themeSource`，所以**注册主题时 `colorScheme` 必须诚实**，否则原生窗口外观会与页面不一致。

### 2.3 插件可用的官方接口

`ctx.theme`（`ThemeRuntime`）：

```ts
register(definition: ThemeDefinition): () => void
// ThemeDefinition = { id, colorScheme: 'light'|'dark', tokens: Record<string,string> }

overrideTokens(source: string, tokens: ThemeTokenOverrides): () => void
// ThemeTokenOverrides = Record<string, { light: string; dark: string }>
//  —— light / dark 均必填；给裸字符串会抛「teaching error」

setTheme(id): void          // 唯一偏好写入口
setFontSize(px): void       // 内容字号轴（--dsh-content-font-size）
getTheme(): ThemeSnapshot
exportInspectTokens(): ThemeTokenInspection[]
```

- 覆盖层以 `source` 为身份栈式叠加，**同一个 source 再次调用会整体替换它的层并重新置顶**，并返回一个 disposer。
- **`validateOverrides` 只校验「值的形状」（必须是 `{light:string, dark:string}`），不校验 token 名。** 因此任何 CSS 自定义属性名都被接受。

#### 关键机制：override 是写在 `body` 上的 inline style

`ThemePresenter.apply()` 的实际动作（`dsh-client-ui-layout/lib/client.js`）：

```js
for (const name of this.appliedTokens) body.style.removeProperty(name);   // 先撤上一轮
this.appliedTokens = [];
for (const [name, value] of Object.entries(snapshot.active.tokens)) {
  body.style.setProperty(name, value);                                    // 再写这一轮
  this.appliedTokens.push(name);
}
```

`composeActive` 已按当前 `colorScheme` 从 `{light, dark}` 里挑好值，所以**写进 body 的永远是一个已解析的具体值**。由此推出三条重要能力：

1. **它能压过 `body{...}` 与 `body[data-ds-dark-theme]{...}`**（同元素，inline 胜出）—— 这正是覆盖 alias 的机制。
2. **它也能压过 `:root{...}`**：自定义属性沿 DOM 继承，`body` 上的值对 body 子树优先于 html 上的值。**所以 `--dsw-radius-*`、`--dsw-font-*`、`--dsh-*` 这些定义在 `:root` 的 token 同样可以被 `overrideTokens` 改掉。**
3. **`--dsw-static-*` 与 `--shiki-*` 也能被覆盖**（虽然不建议大面积改 static，但针对性的几处 —— 例如 deliverables/plan/schedule 的 `--dsw-static-neutral-850/800` —— 是可行且干净的做法）。

> 副作用提醒：`--dsh-*` 是布局契约（见第 7.3 节），**用 overrideTokens 改它们等于把皮肤绑死在当前 DSH 版本的布局实现上**，务必克制。

- `exportInspectTokens()` 返回的官方「推荐覆盖清单」只有 14 项（说明官方认可的稳定面就是这些，其余 token 属内部协议）：

  ```
  --dsw-alias-bg-base                     应用基底背景
  --dsw-alias-bg-layer-1                  一级抬升面
  --dsw-alias-bg-layer-2                  二级嵌套面
  --dsw-alias-bg-overlay                  浮层/弹出层背景
  --dsw-alias-border-l1                   一级微妙边框
  --dsw-alias-border-l2                   二级较强边框
  --dsw-alias-brand-primary               主品牌强调色
  --dsw-alias-label-primary               主文字
  --dsw-alias-label-secondary             次文字
  --dsw-alias-state-error-primary         错误态
  --dsw-alias-state-idle-primary          静止态
  --dsw-alias-state-success-primary       成功态
  --dsw-alias-state-warn-primary          警告态
  --dsw-specific-sidebar-fill             侧边栏列与标题行背景
  ```
  全部 `requiresLightAndDark: true`。

### 2.4 被引用但从未定义的 alias（可自由定义，属于「漏网 token」）

这些名字被组件引用，但 theme 包从未定义；其中 9 个连 fallback 都没有 → 该声明在浏览器里直接失效（`var()` 无 fallback 且未定义 ⇒ 属性 invalid at computed-value time）：

| token | 使用方 | 现状 |
| --- | --- | --- |
| `--dsw-alias-bg-l1` | sidebar-terminal | 无 fallback，失效 |
| `--dsw-alias-bg-l2` | sidebar-terminal | 无 fallback，失效 |
| `--dsw-alias-bg-layer-4` | primitives（模型列表 hover）、settings-subagent | 无 fallback，失效 |
| `--dsw-alias-fill-l1` | jobs | 无 fallback，失效 |
| `--dsw-alias-fill-l2` | jobs | 无 fallback，失效 |
| `--dsw-alias-fill-tsp-secondary` | agent-preset | 无 fallback，失效 |
| `--dsw-alias-label-error` | primitives（SettingsForm 错误文案） | 无 fallback，失效 |
| `--dsw-alias-label-quaternary` | agent-preset、sidebar-browser | 无 fallback，失效 |
| `--dsw-alias-separator-primary` | chat（分隔点） | 无 fallback，失效 |
| `--dsw-alias-fill-tertiary` | attachment | 有 fallback `#00000014` |

> 换肤可以在 `overrideTokens` 里顺手把这 10 个补上（浅深各一），代价为零、收益是几处 hover/错误文案恢复可见。

### 2.5 `--dsw-alias-*` / `--dsw-specific-*` 完整映射表

见 **附录 A**（一行一个 token，含浅/深解析值与来源链）。

---

## 3. 硬编码颜色清单（按包）

扫描范围：全部 `dsh-client-ui-*` / `dsh-experimental-client-ui-*` 的 `lib/*.js` 内嵌 CSS + `lib/**/*.module.css` + JSX 内联样式。以下只保留视觉上重要的项。

### 3.1 真·硬编码（完全无 token，必须写针对性 CSS）

#### `dsh-client-ui-layout` — AppFrame（darwin 侧边栏品牌渐变，唯一的大面积硬编码背景）

```
[data-platform=darwin] .pI_x6G_sidebarCol   background: linear-gradient(to bottom, #7a9bf01a, #7a9bf000 35%, #8f89b800 68%, #8f89b817),
                                            color-mix(in srgb, color-mix(in srgb, var(--dsw-specific-sidebar-fill) 97%, #7a9bf0) 40%, transparent)
[data-platform=darwin] [data-ds-dark-theme] .pI_x6G_sidebarCol
                                            background: linear-gradient(to bottom, #7a9bf014, #7a9bf000 35%, #8f89b800 68%, #8f89b812),
                                            color-mix(in srgb, var(--dsw-specific-sidebar-fill) 50%, transparent)
@media (prefers-reduced-transparency:reduce)  →  color-mix(... sidebar-fill 90%, transparent)
```
语义：**侧边栏大面积背景 + 品牌色氛围渐变**（`#7a9bf0` 蓝紫 / `#8f89b8` 紫）。它混入了 `--dsw-specific-sidebar-fill`，但基色被 `#7a9bf0` 污染。**换肤时这是第一个必须打掉的地方**（打 `[data-platform=darwin]` 选择器，或覆盖 `--dsw-specific-sidebar-fill` 后仍需另写 linear-gradient）。

#### `dsh-client-ui-sidebar` — SidebarRoot（darwin 玻璃 New Session 按钮）

```
[data-platform=darwin] .hHd-Xa_newSession              background:#ffffff8c
[data-platform=darwin] .hHd-Xa_newSession:hover        background:#ffffff4d
[data-platform=darwin] [data-ds-dark-theme] .hHd-Xa_newSession        background:#ffffff26
[data-platform=darwin] [data-ds-dark-theme] .hHd-Xa_newSession:hover  background:#fff3
```
语义：**按钮半透明填充（白色蒙版）**。基色（非 darwin）走 `--dsw-alias-button-elevated-fill`，所以只影响 macOS 外壳。

#### `dsh-client-ui-workspace` — Rows（会话悬浮卡片文字）

```
.YDXeBa_hoverTitle   color:#fff       （悬浮卡主标题）
.YDXeBa_hoverPath    color:#cfd3d6    （路径）
.YDXeBa_hoverTime    color:#cfd3d6    （时间）
.YDXeBa_hoverStatus  color:#adb2b8    （状态行）
```
语义：**浮层文字**。这四处写死为「深色浮层上的浅字」，**不随主题翻转**。若主题把悬浮卡做成浅色，这四行会看不见。

#### `dsh-client-ui-schedule` — TaskManagerPage / 任务卡

```
.mBt53q_taskName      color:#fff
.mBt53q_taskIcon      color:#cfd3d6
.mBt53q_taskRelative  color:#adb2b8
```
语义同上：**悬浮/浮层内的浅色文字**，问题同 workspace。

#### `dsh-client-ui-trajectory` — 时间总览

```
.Y0dWHa_requestBoundaryControl  box-shadow:0 2px 6px #0000001f
.Y0dWHa_overview...(右侧渐隐)   box-shadow:-12px 0 32px #00000024
```
语义：**阴影**。未走 `--dsw-shadow-*`，深色下会偏黑脏。

#### `dsh-client-ui-shortcuts` — Reference 面板

```
box-shadow:0 0 1px #0003, 0 0 4px #00000005, 0 12px 32px #00000014
```
语义：**弹层阴影**（等于 `--dsw-shadow-lv3` 的字面复制，但没走 token）。

#### `dsh-client-ui-conversation` — InputBar

```
.uV2eYG_primary  color:#fff            （发送键图标色，背景走 --dsw-alias-button-info-fill）
.uV2eYG_select   background-image:url("data:image/svg+xml,...stroke='%2381858C'...")
```
语义：**发送键前景** + **下拉箭头箭头图标**（内嵌 SVG，箭头色写死 `#81858C` = `neutral-bluish-600`）。深色下这个箭头偏暗。

#### `dsh-client-ui-sidebar-terminal` — 内嵌 xterm.css

```
.xterm .composition-view { color:#fff; background:#000 }
fill:"#17191d", stroke:"#fff"   （JS 内联的图标）
```
语义：**终端背景/前景**。xterm 实例的 `theme` 传的是空对象 `{}`，所以终端配色完全由内嵌 CSS 决定；终端区域的换肤需要 `!important` 覆盖 `.xterm` 系列。

#### `dsh-client-ui-deliverables` — ChangedFiles / Deliverables / PlanPreview

组件级 dark 分支，**绕过 alias 直接用 static**：

```
.hz8-rW_card  { --changes-fill: var(--dsw-static-neutral-50);  --changes-hover: var(--dsw-static-neutral-100); }
body[data-ds-dark-theme] .hz8-rW_card { --changes-fill: var(--dsw-static-neutral-850); --changes-hover: var(--dsw-static-neutral-800); }
.hz8-rW_tile  { background: color-mix(in srgb, var(--dsw-static-neutral-00) 50%, transparent) }
body[data-ds-dark-theme] .hz8-rW_tile { background: color-mix(in srgb, var(--dsw-static-neutral-00) 5%, transparent) }
body[data-ds-dark-theme] .nyYjTG_fileIcon { background:color-mix(in srgb, var(--dsw-static-neutral-00) 5%, transparent) }
body[data-ds-dark-theme] .nyYjTG_root { --deliverable-fill:var(--dsw-static-neutral-850); --deliverable-hover:var(--dsw-static-neutral-800) }
```
`dsh-client-ui-plan`：`body[data-ds-dark-theme] .k74WwW_card{--plan-card-fill:var(--dsw-static-neutral-850);--plan-card-hover:var(--dsw-static-neutral-800)}`
`dsh-client-ui-schedule`：`body[data-ds-dark-theme] .Ww4dvW_card{--card-fill:var(--dsw-static-neutral-850);--card-hover:var(--dsw-static-neutral-800)}`
`dsh-client-ui-sidebar-right`：`body[data-ds-dark-theme] .geFEbW_hero{color:var(--dsw-static-neutral-700)}`

语义：**卡片填充与其 hover**。这些走的是 `--dsw-static-neutral-*` 灰阶（不是 bluish 色系），**与主导航色系不一致**；若主题想统一，需要同时覆盖 static 或打组件选择器。

#### `dsh-client-ui-settings-account` — WelcomeNotice / 插画

```
.ywGceq_lightIllustration  display:block; body[data-ds-dark-theme] → display:none
.ywGceq_darkIllustration   display:none;  body[data-ds-dark-theme] → display:block
backdrop-filter: blur(32.609px)   （欢迎卡片毛玻璃）
background: ...(color-mix ...ent) 4%, transparent)
```
语义：**明暗两套插画资产切换 + 毛玻璃卡片**。插画是位图资源，不可调色。

### 3.2 `var(--token, 硬编码 fallback)` —— 惰性 fallback

DSH 里大量写成 `var(--dsw-alias-border-l2,#0000001f)`（attachment / chat / tool / skill / commands / user-questions / directory-picker-browse / model-selection 等）。

**换肤影响：零。** token 一旦在 `body` 上有定义，fallback 永远不生效（包括被 overrideTokens 改写后的值）。**不要把这些当成硬编码去追**。代表性样本：

```
dsh-client-ui-attachment : var(--dsw-alias-border-l2,#0000001f) / var(--dsw-alias-label-tertiary,#00000073)
                           var(--dsw-alias-state-error-primary,#d54941) / var(--dsw-alias-brand-primary,#4d6bfe)
dsh-client-ui-chat       : var(--dsw-alias-border-l2,#0000001f) / var(--dsw-alias-label-tertiary,#00000073)
```
例外一个：`var(--dsw-alias-fill-tertiary,#00000014)`（attachment）—— token 未定义，fallback **会**生效。

### 3.3 纯装饰 / 结构性「透明黑」

以下出现频率极高但视觉上无关，换肤时忽略：

- `border: 2px solid #0000` / `border: 1px solid #0000`（占位边框，hover 时改色）— chat、tool、skill、commands、model-selection、user-questions、directory-picker-browse、workspace
- `background: 0 0`（等价 transparent）
- `border-color: #0000`
- `mask-image:linear-gradient(...#0000 0,#000 24px...)` 里的 `#000`/`#0000` —— **mask 用的 alpha 通道，不是颜色**，不要动（见 4.4）

### 3.4 不可换肤的品牌资产（明确放弃）

- `dsh-client-ui-primitives` 的 **FileTypeIcon**：`lib/index.js` 里内嵌 100+ 个 data-URI SVG 精灵（每个文件扩展名一个），品牌色直接写死在 SVG 里（`fill="#DD0031"` Angular、`fill="#1572B6"` CSS、`fill="#3776AB"` Python…），外壳圆角底 `fill="#F8ECEF" stroke="#DDE2E8"`。外层只有一个 `color: var(--dsh-file-type-icon-color, var(--dsh-file-type-default-color))`，只影响**单色类型**图标；彩色精灵不受控。
- `dsh-client-ui-primitives` 的 **SiteGlyph**：引用站点图标（GitHub / npm / Wikipedia…），同为内嵌品牌 SVG。
- `FishLogo` / `BrandWordmark`：`fill="currentColor"`，**跟随 `color`**，可换色。
- `dsh-client-ui-sidebar-documentpreview/lib/client.excel.js`（7 MB，1027 处 hex）与 `client.pdf.js`（710 KB，52 处 hex）：第三方 x-spreadsheet / pdf.js 打包产物，自成一套浅色排版。**Excel、PDF 预览面基本无法 token 化**，只能整体套一层 `filter`/容器色或接受。

---

## 4. 影响换肤的「结构手法」清单

### 4.1 `backdrop-filter`

| 出处 | 值 |
| --- | --- |
| theme（菜单） | `--dsw-menu-backdrop-filter: blur(40px) saturate(150%)` |
| theme（遮罩） | `--dsw-mask-blur: none`（默认关，Modal 与 Settings 面板都用它） |
| primitives `MenuSurface.material` | `var(--dsw-menu-backdrop-filter)` |
| primitives `Modal.mask` | `backdrop-filter: var(--dsw-mask-blur)` |
| settings-general `.VOzbGW_mask` | `backdrop-filter: var(--dsw-mask-blur)` |
| attachment `DropOverlay.mask` | `backdrop-filter: blur(10px)`（写死） |
| settings-account 欢迎卡 | `backdrop-filter: blur(32.609px)`（写死） |

另有至少 8 个包把 `backdrop-filter: var(--dsw-menu-backdrop-filter)` 写进各自的弹层（attachment / chat / conversation / cordis / goal / jobs / schedule / subagent / agent-team）。**换肤时统一改这两个变量即可**；写死的那两处需单独打。

> 注意：`MenuSurface` 用 `isolation: isolate` + 独立 `.material` 绝对定位层承载毛玻璃，**不要给菜单根元素加 backdrop-filter**，会破坏固定定位与嵌套菜单。

### 4.2 渐变

| 位置 | 值 | 用途 |
| --- | --- | --- |
| theme body | `--dsw-linear-gradient-think: linear-gradient(180deg,#fff 20.19%,#fff0 100%)` / dark `#151517` | 思考块渐隐 |
| theme body | `--dsw-linear-think-select: linear-gradient(180deg,#f5f6f7 …)` / dark `#232325` | 思考选中态 |
| onboarding | violet / blue / cyan 三组 stops | 引导页 |
| layout sidebarCol | `#7a9bf0` / `#8f89b8` 品牌渐变 | 见 3.1 |
| conversation composerSeat | `linear-gradient(180deg, color-mix(... bg-base 0%, transparent) 0px, var(--dsw-alias-bg-base) 36px)` | composer 底部渐隐（**纯 token**，安全） |
| workspace `WorkspaceBrowser.fade` | `linear-gradient(to bottom, transparent, var(--dsw-specific-sidebar-fill))` | 列表底部渐隐（安全） |
| workspace Rows / WorkspaceBrowser 拖放指示 | 三段 `linear-gradient` 拼出的「插入线 + 三角箭头」，用 `--dsw-alias-state-business-primary` | 拖放 UI（安全） |
| conversation `widthHandle:after` | `linear-gradient(to bottom, transparent … var(--dsw-alias-scrollbar-bg-l1) … transparent)` | 拖拽宽度提示 |
| 若干 | `linear-gradient(90deg,#0000,#000 12px)` 系列 | **全是 mask-image**，见 4.4 |

### 4.3 `box-shadow` / elevation

token 化的三套 elevation（全部定义在 `body, body *` 上，可继承）：

```css
--dsw-elevation-stroke:    0 0 0 .5px var(--dsw-elevation-stroke-color);
--dsw-elevation-panel:     var(--dsw-elevation-stroke), 0 3px 8px 0 #00000008, 0 0 16px 0 #00000005;
--dsw-elevation-prominent: var(--dsw-elevation-stroke), 0 3px 8px 0 #0000000a, 0 0 20px 0 #0000000d;
--dsw-elevation-soft:      var(--dsw-elevation-stroke), 0 4px 16px 0 #00000008, 0 0 24px 0 #00000008;
```
+ `--dsw-shadow-lv1 / lv1-blur / lv2 / lv3`。

**用法约定（换肤必须遵守）**：组件在**自己的规则里**重绑 `--dsw-elevation-stroke-color`，再 `box-shadow: var(--dsw-elevation-panel)`。例：
- `chat .EvIC1a_toBottom` → `--dsw-elevation-stroke-color: var(--dsw-alias-border-l3)`
- `conversation .uV2eYG_card` → `--dsw-alias-border-l2`（`cardWorkspaceTrigger` 改 `transparent`）
- `primitives Menu.list` → `var(--dsw-alias-border-l1)`
- `deliverables` / `trajectory` / `chat` 等亦同

硬编码阴影只有三处（3.1 已列）：trajectory 两处 + shortcuts 一处。

### 4.4 `mask-image`（**不是颜色，是 alpha**）

以下 `#000` / `#0000` 都是 mask 的 alpha 通道，**换肤千万别改**：

```
chat:        mask-image:linear-gradient(90deg,#000 calc(100% - 48px),#0000)     思考流式渐隐
chat:        mask-image:linear-gradient(#0000 0,#000 24px 100%)                 fadeTop
workspace:   mask-image:linear-gradient(90deg,#0000,#000 12px)                  会话标题滚动渐隐
sidebar:     mask-image:linear-gradient(90deg,#000 calc(100% - 16px),#0000)     New Session 快捷键渐隐
trajectory:  mask-image:linear-gradient(#000 calc(100% - 12px),#0000)
primitives TextShimmer .sweep: mask-image:linear-gradient(105deg,transparent 0%,black 40% 60%,transparent 100%)   shimmer 扫光
```

唯一的例外是 `chat` 的**运行中鲸鱼动画**：`mask: url(data:image/png;base64,...) 50%/100% 100% no-repeat alpha`，`background: currentColor` —— 即「用位图 mask + currentColor 上色」，颜色由 `color`（`--dsw-alias-label-deep-diving`）决定，**可换色，但形状是固定的鲸鱼位图**。

### 4.5 `mix-blend-mode` / `filter`

- `mix-blend-mode`：**全仓 0 处。**
- `filter: drop-shadow`：**全仓 0 处。**
- 纯 `filter` 只有两处，且都在第三方/边缘位置：
  - `dsh-client-ui-sidebar-documentpreview`（自有代码）：`.dhJKeW_emptyIcon{opacity:.6; filter:grayscale()}` —— 空态图标去色。**若主题想让空态图标带品牌色，打掉这条即可。**
  - `client.excel.js` / `client.pdf.js` 里的 `filter:alpha(opacity=50)`（IE 时代遗留），无实际影响。
- 其余所有 `filter:` 命中都是 `backdrop-filter` 的误匹配。

结论：不需要担心混合模式与滤镜，只有那一处 grayscale 值得注意。

### 4.6 内联 SVG 与 icon 着色

- 全部 UI 图标（primitives 的 89 处）用 `fill: "currentColor"` 或 `stroke: currentColor`；`fill: "none"` 185 处为轮廓图标。**换肤靠容器 `color`，不用碰 SVG。**
- `fill: "var(--dsw-alias-label-primary-inverted)"` 7 处、`fill: "var(--dsw-static-neutral-400)"` / `00` 各 1 处 —— 也用 token。
- 品牌/类型图标例外：`fill: "white"` 7 处、`fill: "#525C6F"/"#535A68"/"#394259"/"#979DA6"/"#A8ABB0"/"#A797FC"/"#9CE5ED"` 等彩色值全部来自 `client.excel.js`（x-spreadsheet）。
- 内嵌 SVG data-URI 仅一处含颜色：conversation 的 `.uV2eYG_select` 下拉箭头 `stroke='%2381858C'`。

### 4.7 图片 / 纹理 / 字体资产

| 资产 | 位置 | 可否换肤 |
| --- | --- | --- |
| Montserrat woff2 ×3 + OFL | `dsh-client-ui-theme/lib/styles/` | 品牌字体，`--dsw-font-family-brand:"Montserrat", var(--dsw-font-family)`；改字体族即可绕过 |
| 鲸鱼 PNG（base64，28×28 多帧） | `dsh-client-ui-chat` ChatView CSS | 形状不可换；颜色可（currentColor） |
| 明/暗插画（img） | `dsh-client-ui-settings-account` | 不可换，只能 `display:none` 或 `filter` |
| 文件类型 SVG 精灵（100+） | `dsh-client-ui-primitives/lib/index.js` | 不可换 |
| 站点图标 SVG | `dsh-client-ui-primitives` SiteGlyph | 不可换 |
| 头像 / 用户头像 | 无内置资产（走 attachment 远程图） | — |

### 4.8 `corner-shape`（DSH 的「方圆形」标志）

```css
@supports (corner-shape:superellipse(1.5)) {
  :root { --dsw-corner-shape: superellipse(1.5); }
  *,:before,:after { corner-shape: var(--dsw-corner-shape); }
}
```
局部还有多处 `corner-shape: round`（发送键、状态点、滚动条拇指、Spinner）。**换肤若要改「方圆感」，改 `--dsw-corner-shape` 一处即可全局生效；局部 `round` 的四处需单独打。**

### 4.9 层级（z-index）地图

| z | 用途 |
| --- | --- |
| 1–5 | 会话流内部（sticky banner、渐隐层、卡片内容） |
| 6 | 代码块 sticky banner、trajectory |
| 7 | composer seat、compaction sticky 头 |
| 8 | 回到底部按钮、chunked list |
| 9 | 带 trigger menu 的 composer |
| 10 / 11 | 右侧栏 dock 层 / 拖拽把手、分栏把手 |
| 15 | `pI_x6G_leadingSeat`（AppFrame 悬浮工具位） |
| 20 | `AppFrame.overlayLayer`（插件 overlay 的宿主，`pointer-events:none` + 子元素 auto） |
| 30 | Windows 标题栏按钮 |
| 40 / 60 | 右侧栏全屏层 / 浮动层（`--dsh-dockkit-float-layer`） |
| 100 | 各类下拉/弹出菜单 |
| 900 | （个别弹层） |
| 1000 | Modal 遮罩、Settings 面板、附件拖放遮罩 |
| 1002 / 1003 / 1004 | 图片灯箱及其上层 |
| 1100 | **Menu portal、Toast** |

> `shell.overlay`（dsh-os 现有桌面层挂载点）位于 `pI_x6G_overlayLayer`（z=20）。**要盖住 Toast(1100) 与 Menu(1100) 是不可能的，也不应该。**

---

## 5. 消息流的具体构成

### 5.1 骨架（`dsh-client-ui-chat`，前缀 `EvIC1a` = ChatView）

```
[data-conversation-scroll]                    滚动容器（可选，供宽度把手/滚动模式用）
└ .EvIC1a_frame / .EvIC1a_root                 overflow: visible clip
  ├ .EvIC1a_scroll                            padding: 16px calc(--dsh-composer-side-clearance + 16px)
  │ └ .EvIC1a_column                          max-width: --dsh-chat-content-width；居中
  │   └ .EvIC1a_flowItem …                    每个节点一个；节点间距 --dsh-chat-flow-gap
  │        ├ [data-chat-flow-kind=user]             用户消息
  │        ├ [data-chat-flow-kind=steering]         插话
  │        ├ [data-chat-flow-kind=turn-trigger]     轮次触发卡
  │        ├ [data-chat-flow-kind=turn-process]     过程折叠行（gap 变 16px）
  │        └ [data-chat-group-part=response]        回答（gap 变 12px）
  │   └ .EvIC1a_running                       运行中状态条（whale + 文案）
  │        ├ .EvIC1a_runningDivider           background: color-mix(--dsw-alias-border-l1 75%, --dsw-alias-border-l2)
  │        ├ .EvIC1a_runningIcon              14px 槽，whaleStill / whaleAnimated
  │        └ .EvIC1a_runningText              color: --dsw-alias-label-deep-diving；shimmer 覆写 --dsw-alias-label-shimmer
  └ .EvIC1a_toBottomSlot / .EvIC1a_toBottom   回到底部圆钮
                                              background: --dsw-alias-button-floating-fill
                                              shadow: --dsw-elevation-panel
                                              color: --dsw-alias-label-primary
```

稳定钩子：`data-slot="conversation.chat.node"`、`data-chat-flow-kind`、`data-chat-group-part`、`data-chat-group-key`、`data-conversation-scroll`、`data-turn-process-answer`。

### 5.2 各块的类名与关键 token

#### (a) 用户消息（`MessageItem`，前缀 `Sixlwa`）

| 元素 | 关键样式 |
| --- | --- |
| `.Sixlwa_userRow` | 右对齐列，gap 6px |
| `.Sixlwa_userStack` | `max-width: min(--dsh-chat-content-width * .702, 82%)` |
| `.Sixlwa_bubble` | **`background: var(--dsw-specific-bubble)`**、`border-radius: var(--dsw-radius-xl)`、`color: var(--dsw-alias-label-primary)`、padding 10/16。**气泡背景唯一的锚点。** |
| `.Sixlwa_referenceSummary` | `--dsw-alias-label-tertiary` |
| `.Sixlwa_attachmentRow` / `.Sixlwa_fileCard` | 卡片：`border .5px --dsw-alias-border-l2`、`border-radius --dsw-radius-xl`、`background: var(--dsw-specific-input-major, transparent)` |
| `.Sixlwa_fileName` / `.Sixlwa_fileMeta` | `--dsw-alias-label-primary` / `--dsw-alias-label-tertiary` |

> `--dsw-specific-bubble-highlight`（浅 `#d3e2ff` / 深 `#43454a`）在仓内没有被引用，但显然是留给气泡高亮（引用/选中）的。

#### (b) 助手 markdown（`AssistantMarkdown` 前缀 `hWmORq`；内容来自 primitives `markdown/MarkdownText.module.css`）

- 容器：`color: var(--dsw-alias-label-primary)`，`font-size: --dsh-content-font-size`
- 标题 h1–h4：`--dsw-font-markdown-h1..h4`；列表 marker `--dsw-alias-label-secondary`
- 链接 / 文件提及：`color: var(--dsw-alias-link)`，hover 才加 `underline dotted`
- 行内代码：`background-color: var(--dsw-alias-markdown-inline-code)` + `border .5px var(--dsw-alias-border-l1)` + `--dsw-radius-sm`
- `hr`：`background: var(--dsw-alias-border-l2)`，高 0.5px
- `blockquote`：`border-left: 2px solid var(--dsw-alias-label-caption)`
- 表格：`th` 底线 `--dsw-alias-border-l3`，`td` 底线 `--dsw-alias-border-l2`；宽表用 `.md-table-wide` 出血到内容列之外（`--dsh-table-lead/spare`）
- 图片：`border-radius: var(--dsw-radius-md)` + `background: var(--dsw-alias-bg-base)`
- 停止标记 `.hWmORq_stopped`：`background: --dsw-alias-interactive-bg-hover`，`color: --dsw-alias-label-tertiary`
- 行动作条 `.hWmORq_actions`：`margin-top:16px; margin-left:-6px`

#### (c) 代码块（primitives `markdown/CodeBlock.module.css`）

```
.block   background: var(--dsw-alias-markdown-code-block); border-radius: var(--dsw-radius-lg)
         color: var(--dsw-alias-label-primary)
.banner  background: var(--dsw-alias-markdown-code-block-banner)   ← 顶部语言条
.bannerWrap  background-color: var(--dsw-alias-bg-base); position: sticky; top:0; z-index:6
.pre        同 .block 背景；底部两个圆角挂在 <pre> 上（不用 overflow:hidden，否则 sticky banner 失效）
.numbered .line::before  color: var(--dsw-alias-label-tertiary)   ← 行号
```
语法高亮走 shiki：`--shiki-background: var(--dsw-alias-markdown-code-block)`，其余 `--shiki-token-*` 是写死的 12 个色（见附录 D）。

#### (d) Diff（两套）

**工具行内 diff**（primitives `DiffBlock.module.css`，`.js` 命名，无哈希前缀）：
```
.del  color: --dsw-alias-state-error-primary;   background: --dsw-alias-code-diff-deleted; box-shadow: inset 3px 0 0 --dsw-alias-state-error-primary
.add  color: --dsw-alias-state-success-primary; background: --dsw-alias-code-diff-added;   box-shadow: inset 3px 0 0 --dsw-alias-state-success-primary
.path --dsw-alias-label-secondary   .gap/.expand --dsw-alias-label-tertiary
```

**交付页文件 diff**（deliverables `FileDiff.module.css`，前缀 `IP6KhG`）：
```
.IP6KhG_add  background: var(--dsw-alias-file-diff-added-bg);   --diff-gutter-fill: --dsw-alias-file-diff-added-gutter;   --diff-marker: --dsw-alias-file-diff-added-marker
.IP6KhG_del  background: var(--dsw-alias-file-diff-deleted-bg); --diff-gutter-fill: --dsw-alias-file-diff-deleted-gutter; --diff-marker: --dsw-alias-file-diff-deleted-marker
.IP6KhG_add .IP6KhG_number:first-child  box-shadow: inset 3px 0 0 var(--diff-marker)
.IP6KhG_header  border-bottom .5px --dsw-alias-border-l3
.IP6KhG_empty   background: color-mix(--dsw-alias-interactive-bg-hover 50%, transparent)   ← 本地变量 --diff-empty-fill
```
> 六个 `--dsw-alias-file-diff-*` 是**唯一一组不走 static 色阶、直接写字面量的 alias**（浅 `#e6f4e7/#01a241`、深 `#1f3124/#41c977`），换肤必须显式覆盖。

#### (e) 工具调用卡（`dsh-client-ui-tool`）

| 模块 | 前缀 | 关键 |
| --- | --- | --- |
| `ToolRow` | `o3BgMG` | `.o3BgMG_sep` 分隔点 `--dsw-alias-label-caption`；`.o3BgMG_summary` 13px；`[data-tool^=cordis_] .title` 加粗 500；`.diffStat` 等宽；hover/展开时 `.diffAdded → --dsw-alias-state-success-primary`、`.diffRemoved → --dsw-alias-state-error-primary` |
| | | `.o3BgMG_ioCard`：`border .5px --dsw-alias-border-l1`、`--dsw-radius-lg`、`background: --dsw-alias-markdown-code-block`、font `--dsw-font-markdown-code-block-small` |
| | | `.o3BgMG_ioSection`：两列 grid、max-height 150px；`.ioLabel` `--dsw-alias-label-caption` sticky；`.ioDivider` `--dsw-alias-border-l2`；`.ioText` `--dsw-alias-label-secondary`，`[data-error]` → 错误色 |
| | | `.o3BgMG_inspectButton`：胶囊、`border .5px --dsw-alias-border-l3`、`background: --dsw-alias-bg-base`、hover 透明度从 0→1 |
| | | `.o3BgMG_errorSummary → --dsw-alias-state-error-primary`；`.stoppedSummary → --dsw-alias-state-warn-label` |
| `ToolDetails` | `DXqwVW` | 同 `ioCard` 配方：`--dsw-alias-markdown-code-block` 底 + `border-l1` + `--dsw-radius-lg`；`.item + .item` 用 `--dsw-alias-border-l2` 分隔 |
| `ToolCallTree` | — | 仅 200 B，纯布局 |
| `bash-sample` | — | 终端示例块 |
| `AskQuestionCard` / `QuestionToolRow` | — | 提问卡 |
| `TerminalBlock`（primitives） | `.js` | 终端渲染 |

**工具结果的统一视觉语言**：`--dsw-alias-markdown-code-block` 作底 + `--dsw-alias-border-l1` 描边 + `--dsw-radius-lg`。换肤若想「工具卡变质感」，改这三个即可覆盖全部工具。

#### (f) Thinking / Reasoning（`ReasoningRow`，前缀 `lcKema`）

```
.lcKema_root                      折叠时 height: calc(24px + font-delta)，contain: size layout
.lcKema_root[data-expanded] [data-open] [data-disclosure-row]  sticky 头，background: --dsw-alias-bg-base
.lcKema_separator                 2×2 圆点，--dsw-alias-label-caption
.lcKema_summaryText               13px，流式时 mask 渐隐
.lcKema_thinkBody                 padding-left: calc(22px + font-delta)，`--dsw-alias-label-*` 继承
```
`--dsw-linear-gradient-think` / `--dsw-linear-think-select` 是思考块的渐隐/选中渐变。

#### (g) 轮次触发 / 过程 / 用量

- `TurnTriggerNodeView`（前缀 `oz9t_a`）：`border .5px --dsw-alias-border-l1`、`--dsw-radius-xl`、**`background: var(--dsw-alias-turn-trigger-bg, var(--dsw-alias-markdown-code-block))`**，hover → `turn-trigger-bg-hover`；header `--dsw-alias-label-tertiary`，时间戳 `--dsw-font-xxs-12`
- `TurnProcessNodeView`（前缀 `l_-RG`）：`border-bottom .5px --dsw-alias-border-l2`，`--dsw-alias-label-tertiary`，时长数字用 `tabular-nums`
- `TurnUsagePanel`（前缀 `Q51KRG`）：trigger `--dsw-alias-label-tertiary`，hover `--dsw-alias-interactive-bg-hover`
- `TurnTailNodeView` / `StatsPills` / `stat-dialog` / `TurnNavigator`

#### (h) 上下文 / 压缩 / 系统提示 / 错误

- `ContextInjectionRow`（`bOPqQW`）：`.bOPqQW_sep{color:var(--dsw-alias-separator-primary)}`（**未定义 token，失效**）
- `ContextBody`：catalog / recall / relay 三类分区
- `MessageItem` 里的压缩行：`.Sixlwa_compactionButton` sticky + `background: --dsw-alias-bg-base`；`.compactionSep` 用 `--dsw-alias-label-caption`
- 错误块：`.Sixlwa_turnErrorTitle → --dsw-alias-state-error-primary`（600 粗）；`.turnErrorMessage → --dsw-alias-label-secondary`；`.turnErrorCode → --dsw-font-markdown-code-block-small`；`.maxTokensTitle → --dsw-alias-state-warn-primary`
- 重试：`.Sixlwa_retryRow/retrySummary` 用 `--dsw-alias-label-tertiary`，`focus-visible` 环 `var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary))`

#### (i) 引用 / citation

- markdown 里的引用：`--dsw-alias-markdown-citation`（浅 `#ebeef2` / 深 `#353638`）
- 行内 tag：`--dsw-alias-markdown-tag`
- 占位：`--dsw-alias-markdown-placeholder`
- `SiteGlyph` 站点图标（引用的 URL 域名 → 品牌图标，不可调色）

#### (j) 其他会话流节点

`dsh-client-ui-attachment`（`MessageImage` / `FileCard`）、`dsh-client-ui-plan`（计划卡）、`dsh-client-ui-goal`（GoalBar）、`dsh-client-ui-jobs`（任务列表）、`dsh-client-ui-deliverables`（变更文件卡）、`dsh-client-ui-workflow-run`、`dsh-client-ui-subagent`、`dsh-client-ui-cordis`、`dsh-client-ui-skill`、`dsh-client-ui-user-questions`、`dsh-client-ui-approval`、`dsh-client-ui-trajectory`。

---

## 6. Composer（输入框）区域

### 6.1 结构（`dsh-client-ui-conversation`）

```
wSkVaW_composerSeat                    吸底 z=7
  └ [data-conversation-composer-overlay]?   当 takeover（审批/提问/权限）出现时改为 absolute
wSkVaW_composerStack  gap: --dsh-composer-stack-gap(6px)
  └ uV2eYG_root        padding: 0 var(--dsh-composer-side-clearance) 4px
     ├ uV2eYG_notice      提示条：background --dsw-alias-interactive-bg-hover / color --dsw-alias-label-secondary
     ├ uV2eYG_card        ★ 主卡片
     │   ├ uV2eYG_cardWorkspaceTrigger :after  虚线描边（1px dashed, --dsw-alias-border-l4），hover → --dsw-alias-state-business-primary
     │   ├ uV2eYG_accessory   顶部附件/上下文条
     │   ├ uV2eYG_scroll → uV2eYG_grow → uV2eYG_input   （contenteditable）
     │   ├ uV2eYG_placeholder  color: --dsw-alias-label-caption
     │   └ uV2eYG_row          底部工具行
     │       ├ uV2eYG_tools      [＋ 附件按钮] + 选择器
     │       ├ uV2eYG_modes      模式/权限
     │       └ uV2eYG_trailing   发送键 / 停止键
     └ uV2eYG_dock         dock 槽（附件条、queued 消息等）
```

### 6.2 关键 token

| 元素 | 样式 |
| --- | --- |
| **`.uV2eYG_card`** | `background: var(--dsw-specific-input-major)`；`border-radius: var(--dsw-radius-panel)`(28px)；`box-shadow: var(--dsw-elevation-soft)`；本地重绑 `--dsw-elevation-stroke-color: var(--dsw-alias-border-l2)`；`gap:12px; padding-top:8px`；本地重绑 `--dsh-scrollbar-thumb(-hover)` 到 `--dsw-alias-scrollbar-bg-l2` |
| `.uV2eYG_input` | `color: --dsw-alias-label-primary`；**`caret-color: var(--dsw-alias-state-business-primary)`**；`min-height:36px`（hero 态 52px） |
| `.uV2eYG_input p:last-child:after` | `content: var(--dsh-composer-hint)`，`color: var(--dsw-alias-label-caption)` |
| `.uV2eYG_add`（＋号） | 28×28 圆形，`background: var(--dsw-specific-selector)`，`color: --dsw-alias-label-primary`，hover `--dsw-alias-interactive-bg-hover-solid` |
| `.uV2eYG_select`（模型/模式/权限） | `color: --dsw-alias-label-secondary`，13px/500，`max-width:220px`，`height:28px`，**背景箭头是内嵌 SVG `stroke='%2381858C'`**，hover `--dsw-alias-interactive-bg-hover` |
| **`.uV2eYG_primary`（发送键）** | `background: var(--dsw-alias-button-info-fill)`（浅 `#4176e6` / 深 `#7aaaff`）；`color:#fff`（硬编码）；34×34；`border-radius:999px`；`transform:translateY(-2px)`；hover `--dsw-alias-button-info-hover` |
| `.uV2eYG_pending` | 8px 呼吸圆点，`background: --dsw-alias-state-business-primary` |
| `.uV2eYG_retry` | `border:1px solid`（currentColor） |
| `.uV2eYG_inputDisabled` | `color: --dsw-alias-label-tertiary` |
| 容器宽度 | `--dsh-composer-card-max-width` = `--dsh-chat-content-width + 32px`；`--dsh-composer-side-clearance:16px`；`--dsh-composer-text-max-height:336px` |
| hero 态 | `[data-phase=hero] .wSkVaW_scrollBody{justify-content:center}`；`wSkVaW_composerHero` 底部 padding 32px |

### 6.3 相关独立部件

- `ContextMeter`（`--dsw-alias-*` 环形用量）
- `QueueDock`（排队消息）
- `TodoPanel`
- `GoalBar`（goal 包，docked 在 composer 上方）
- `PlanModeControl` / `permission-presets` / `approval` / `user-questions` 的 takeover 面板
- `attachment` 的 `ComposerAttachments` / `AttachmentRail` / `DropOverlay`（`--dsw-alias-bg-mask-drop` + `blur(10px)`，z=1000）
- `model-selection` / `commands` / `input-trigger` 的弹出菜单（`--dsw-specific-menu` + `--dsw-menu-backdrop-filter`，z=1100）

---

## 7. 侧边栏

### 7.1 结构

```
pI_x6G_sidebarCol                             background: var(--dsw-specific-sidebar-fill); border-right .5px --dsw-alias-border-l3
└ hHd-Xa_root                                padding: 6px var(--dsh-sidebar-inline-padding); background: --dsw-specific-sidebar-fill; color: --dsw-alias-label-primary
  ├ hHd-Xa_topStrip                          （仅 Windows 标题栏）52px
  ├ hHd-Xa_logoRow                           height:60px；[data-windows-titlebar] → 40px；collapsed → 36px
  │   └ hHd-Xa_brand → brandIdentity → brandMark(FishLogo) + brandName(18px/600) + localBuildBrand
  ├ hHd-Xa_newSession                        ★ New Session 按钮
  ├ hHd-Xa_panelList                         Plugins / Files / … 面板行
  │   └ hHd-Xa_panelRow(.panelActive)
  ├ hHd-Xa_regionArea                        区域槽（实际的会话列表）
  │   └ bhn1Oq_root (workspace/WorkspaceBrowser)
  │       ├ bhn1Oq_sectionHeader  → sectionLabel + searchSlot(→ search/searchInput/clearButton) + headerActions
  │       ├ bhn1Oq_treeBody → groupSection* → YDXeBa_projectRow / YDXeBa_sessionRow
  │       ├ bhn1Oq_fade                        底部渐隐 linear-gradient(to bottom, transparent, --dsw-specific-sidebar-fill)
  │       └ bhn1Oq_sessionOverflowButton       「显示更多」
  └ hHd-Xa_footArea → settingsArea + footerActions   （设置入口）
```

### 7.2 关键 token

| 元素 | 样式 |
| --- | --- |
| 侧边栏底 | `--dsw-specific-sidebar-fill`（浅 `#f9fafb` / 深 `#1b1b1c`）+ 右描边 `--dsw-alias-border-l3` |
| 文字 | `--dsw-alias-label-primary`，14px |
| **New Session** | `border .5px --dsw-alias-border-l3`；`border-radius: --dsw-radius-md`；`background: --dsw-alias-button-elevated-fill`；`height:38px`；`color: --dsw-alias-label-primary`；hover `--dsw-alias-button-floating-hover`；`margin: 0 2px 12px` |
| 面板行 | `border-radius: --dsw-radius-md`；`min-height:36px`；hover/active 均 `--dsw-alias-interactive-bg-hover`；`focus-visible` 用 `--dsw-focus-ring-*` + `outline-offset:-2px` |
| 图标按钮 | 28×28（collapsed 36×36）；`color: --dsw-alias-label-secondary`；hover `--dsw-alias-interactive-bg-hover`；collapsed 态 `color: --dsw-alias-label-primary` |
| 版本徽标 | `color: --dsw-alias-label-primary-inverted` + `background: --dsw-alias-label-primary` |
| 工作区行 | `border-radius: --dsw-radius-md`；`height:34px`；hover/selected `--dsw-alias-interactive-bg-hover`；`padding-inline-start: calc(8px + --dsh-workspace-indent)` |
| 会话行 | `height:32px`；标题 14px；`.meta`/`.time` → `--dsw-alias-label-tertiary`（time 仅 10px）；`.pinIndicator` → `--dsw-alias-label-caption`；归档态 → 全部 `--dsw-alias-label-caption` |
| 状态点 | `StateDot`：done/success、warning、error、idle 四态走 `--dsw-alias-state-*` |
| 搜索 | 收起时 28×28 无框；展开 `.searchExpanded`：`border .5px --dsw-alias-border-l4` + `border-radius: --dsw-radius-md` + `height:30px`；input `color: --dsw-alias-label-primary`，placeholder `--dsw-alias-label-tertiary`；展开动画改 `width/padding/border-color/background-color` |
| 骨架屏 | `--dsw-alias-bg-skeleton` 呼吸 |
| 空态 | `--dsw-alias-label-tertiary`；空态图标 `--dsw-alias-label-caption`；动作链接 `--dsw-alias-link` |
| 重命名输入 | `border .5px --dsw-alias-border-l4`（Rows）/ `--dsw-alias-border-l4` + `--dsw-radius-lg`（Browser） |
| 删除/归档 | `--dsw-alias-state-error-primary` |

### 7.3 ⚠️ 高危区：一改就把布局搞坏的地方

> 历史教训：侧边栏被改坏过。以下每一条都请当作**只读契约**。

1. **`--dsh-sidebar-inline-padding:12px`**（定义在 `.hHd-Xa_root`）。
   `regionArea` 用 `margin-left:-4px; margin-right: calc(-1 * var(--dsh-sidebar-inline-padding))` + `padding-left:4px` 做「负 margin 出血、内容左对齐 4px、滚动条贴右缘」。改这个值会同时挪动列表左右缘与滚动条位置。
2. **`WorkspaceBrowser` 的三个局部变量**：`--dsh-session-list-edge-inset: var(--dsh-sidebar-inline-padding)`、`--dsh-session-list-scrollbar-width:5px`、`--dsh-session-list-scrollbar-offset:2px`。
   `.bhn1Oq_list` 的 `padding-right` 由三者做减法算出，`scrollbar-gutter: stable`；改任一值会让会话标题与滚动条错位或被裁。
3. **`bhn1Oq_listArea / list` 的成对负 margin**：`margin-left:-4px` 必须配 `padding-left:4px`，只改一个会整体右移 4px。
4. **折叠（`.hHd-Xa_collapsed` / `rail`）是一整套重置**：`padding:18px 10px 6px`、`logoRow height:36px`、`iconButton` 36×36、`panelRow` 36×36、`newSession` 36×36 且 `border-color:#0000`、`regionArea` 取消负 margin、`footArea` 居中。**这些尺寸是配套的，单独调一个会错位。**
5. **`bhn1Oq_search` / `sectionLabel` / `headerActions` / `searchSlot` 的展开动画全部围绕 `max-width` 而非 `width`/`display`**：`sectionLabel max-width:45%`、`searchSlot max-width:28px→100%`、`headerActions max-width:60px→0`。改成 `display:none` 或改 `width` 会导致动画跳变或布局抖动。
6. **`newSession` 用 `container-type: inline-size` + `width:100cqw`**：宽度由容器查询给出，不要给它设固定宽度。
7. **`logoRow` 的 `overflow:hidden`** 与 `brandName` 的 `letter-spacing:.04em` 共同保证品牌字不溢出；放大字号会直接裁掉。
8. **`[data-windows-titlebar]` 分支**：`toggle` 与 `newSession` 改为 `position:fixed` + `left:12px/48px` + `z-index:30`，`logoRow height:40px`，`collapsed .logoRow{height:0}`，并联动 `--dsh-windows-menu-start:84px`。**任何给这两个按钮加 `position`/`margin`/`padding` 的皮肤规则都会在 Windows 下破版。**
9. **darwin 特有**：`[data-platform=darwin] .hHd-Xa_root{background:0 0}`（透明，让 `pI_x6G_sidebarCol` 的渐变透出来）；给 root 设不透明背景会让 macOS 的侧边栏质感消失。
10. **`pI_x6G_sidebarCol` 的宽度来自 grid 模板列**（`AppFrame` 的 `grid-template-columns` 与 `[data-animating]` 过渡），**不要在皮肤里给它设 `width`**，否则拖拽/动画会失效。
11. **`.bhn1Oq_fade` 的 `left/right` 用 `--dsh-session-list-edge-inset` 对齐**，`[data-platform=darwin]` 下直接 `display:none`。
12. **`YDXeBa_sessionRow` 的 hover 行为是「时间/图钉隐藏、动作按钮出现、标题 `text-overflow:clip`」**，且仅在 `@media (hover:hover)` 下切换 —— 加 `overflow` 或改 `flex` 会破坏这个三态。

**安全区**：颜色（`--dsw-specific-sidebar-fill`、`--dsw-alias-label-*`、`--dsw-alias-interactive-bg-hover`）、`border-radius`、`box-shadow`、字体族、图标 `color`。**危险区**：`padding` / `margin` / `width` / `height` / `max-width` / `position` / `display` / `overflow` / `flex` / `container-type` / `grid-template-*`。

---

## 8. 其他表面

### 8.1 设置页

`dsh-client-ui-settings-general` 的 `SettingsRoot`（前缀 `VOzbGW`）：

```
.VOzbGW_trigger / .VOzbGW_rail         侧边栏底部设置入口（42px / rail 36×36）
.VOzbGW_overlay                        z=1000 fixed 全屏
.VOzbGW_mask                           inset: var(--dsh-frame-chrome-top,0px) 0 0;
                                       background: var(--dsw-alias-bg-mask-1); backdrop-filter: var(--dsw-mask-blur)
.VOzbGW_panel                          width:800px; height:min(800px, 100vh - 2*max(24px, --dsh-frame-overlay-top))
                                       border-radius: var(--dsw-radius-panel); background: var(--dsw-alias-bg-layer-2)
                                       box-shadow: var(--dsw-elevation-prominent)
                                       本地重绑 scrollbar thumb → --dsw-alias-scrollbar-bg-l2
.VOzbGW_nav                            width:188px; padding:22px 12px 0
.VOzbGW_navCell                        height:40px; hover → --dsw-specific-sidebar-nav-item-hover
                                                    active → --dsw-specific-sidebar-nav-item-active
```

`primitives/settings-form/SettingsForm.module.css` 的错误文案用 `--dsw-alias-label-error`（**未定义，失效**）。

### 8.2 弹窗 / 菜单 / Toast / Tooltip

| 组件 | 配方 |
| --- | --- |
| `Modal` | `.root` z=1000 + padding `max(24px, --dsh-frame-overlay-top)`；`.mask::after` `background: var(--dsw-alias-bg-mask-1)` + 入场动画；`.dialog` `background: var(--dsw-alias-bg-layer-2)` + `box-shadow: var(--dsw-elevation-prominent)` + `border-radius: var(--dsw-radius-panel)`；`.close` hover `--dsw-alias-interactive-bg-hover` |
| `MenuSurface` | `.material`（`z-index:-1` 绝对定位层）`background: var(--dsw-menu-surface-fill)` + `backdrop-filter: var(--dsw-menu-backdrop-filter)`；`border-radius: var(--dsw-radius-lg)`（compact 为 md）；根元素 `isolation:isolate`；darwin 额外一个 `.backing` 固定定位层用于原生 vibrancy |
| `Menu` | `.list` `box-shadow: var(--dsw-elevation-prominent)`；本地重绑 `--dsw-elevation-stroke-color: var(--dsw-alias-border-l1)`；**菜单内滚动条自动切到 l2**（`--dsh-scrollbar-thumb: --dsw-alias-scrollbar-bg-l2`）；`.item` 13px、`min-height:34px`、hover/focus 都是 `--dsw-alias-interactive-bg-hover`（**键盘焦点用填充而非 outline**）；`.footer` 上边 `0.5px --dsw-alias-border-l2`；z=100，portal 模式 z=1100 |
| `Tooltip` | `background: var(--dsw-alias-tooltip-bg)`；`color: var(--dsw-static-neutral-bluish-00)`（**写死白，不随主题翻转**，因为 tooltip 底两套都深）；`--dsw-radius-sm`；z=100；`pointer-events:none` |
| `Toast` | `background: var(--dsw-alias-toast-bg)`；`color: var(--dsw-alias-toast-label)`；`box-shadow: var(--dsw-shadow-lv3)`；**z=1100**；`pointer-events:none`（仅 `.action` 可点）；图标 `--dsw-alias-state-warn-label` / success 变 `--dsw-alias-state-success-primary`；动作文字 `--dsw-static-deepseek-400`；**两套主题下都是深底** |
| `HoverCard` | 唯一硬编码文字色 `#FFFFFF` |

### 8.3 滚动条

```css
body {
  --dsh-scrollbar-thumb:        var(--dsw-alias-scrollbar-bg-l1);
  --dsh-scrollbar-thumb-hover:  var(--dsw-alias-scrollbar-hover-l1);
  --dsh-scrollbar-thumb-border: 0px;
  --dsh-scrollbar-track-margin: 0px;
  --dsh-scrollbar-width:        5px;
}
::-webkit-scrollbar        { width/height: var(--dsh-scrollbar-width); }
::-webkit-scrollbar-track  { background: 0 0; margin-block: var(--dsh-scrollbar-track-margin); }
::-webkit-scrollbar-thumb  { border: var(--dsh-scrollbar-thumb-border) solid transparent;
                             corner-shape: round; background: var(--dsh-scrollbar-thumb);
                             background-clip: content-box; border-radius: 999px; }
::-webkit-scrollbar-thumb:hover { background-color: var(--dsh-scrollbar-thumb-hover); }
@supports not selector(::-webkit-scrollbar) { body, body * { scrollbar-width:thin; scrollbar-color: var(--dsh-scrollbar-thumb) transparent } }
```
**换肤路径**：改 `--dsw-alias-scrollbar-bg-l1/l2` 与 `*-hover-l1/l2` 即全局生效。局部覆盖者：`.hHd-Xa_quietBars`（把 thumb 设为 `transparent`）、菜单/设置面板/composer（重绑到 l2）、`chat`/`tool`/`conversation`/`attachment`/`skill`/`trajectory`/`sidebar-files`（改 track margin 或 thumb border）。

### 8.4 焦点环

```css
:root { --dsw-focus-ring-width: 2px; }
:focus-visible { outline-color: var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
                 outline-width: var(--dsw-focus-ring-width); }
html[data-input-modality=pointer] body :focus-visible:not(:read-write) {
  --dsw-focus-ring-color: transparent; outline-color: #0000;   /* 鼠标操作不显示焦点环 */
}
[data-dsh-automatic-focus]:focus, [data-dsh-automatic-focus]:focus:focus-visible { outline: none; }
```
**换肤只需覆盖 `--dsw-alias-state-business-primary`**（焦点环默认取它），或显式定义 `--dsw-focus-ring-color`。

### 8.5 选区

全仓**没有 `::selection` 的全局规则**。唯一定义：

```
dsh-client-ui-sidebar-documentpreview  : .E0GbtG_text ::selection { background: var(--dsw-alias-bg-document-selection); color: #0000 }
dsh-client-ui-sidebar-terminal         : xterm 内部
```
> 换肤若要自定义文本选区，需要**自己写 `::selection` 全局规则**（这是 token 完全覆盖不到的空白点）。`--dsw-alias-bg-document-selection` 是唯一现成的选区色（`color-mix(blue-500 40%, transparent)`）。

### 8.6 终端（右侧栏）

- xterm.css 完整内嵌在 `lib/client.terminal.js`，`.xterm .composition-view{color:#fff;background:#000}`。
- JS 侧 `theme: {}` 为空对象，**没有走 DSH token**。
- 相关 token 化的部分：`TerminalGuide` 用 `--dsw-alias-bg-layer-1` + `--dsw-alias-border-l3` + `--dsw-radius`；`--dsl-terminal-font` / `--dsl-terminal-line-height:18px` / `--dsl-terminal-output-max-height:224px`。
- **终端区域换肤是「大部分要 !important 硬打」的例外区。**

### 8.7 文档预览（右侧栏）

- `client.js`（自有部分）只有 4 处 hex，基本 token 化。
- `client.excel.js` / `client.pdf.js` 是第三方打包产物（浅色排版 + 大量品牌色），**放弃 token 化**。

---

## 9. 换肤策略与风险清单

### 9.1 推荐分层

1. **第一层（收益最大，风险最低）**：`ctx.theme.overrideTokens('dsh-os', {...})` 覆盖 alias。
   - 必覆盖：`bg-base`、`bg-layer-1/2/3`、`bg-overlay`、`border-l1..l4`、`label-primary/secondary/tertiary/caption/dimmed/*-inverted`、`interactive-bg-hover(-solid/-active/-accent)`、`button-*`、`brand-primary/-invert/-text`、`link`、`menu-icon`、`scrollbar-*`、`state-*`、`markdown-*`、`toast-*`、`tooltip-*`、`turn-trigger-*`、`bg-mask-1..3`、`bg-skeleton`、`file-diff-*`（6 个）、`code-diff-*`、`switch-thumb`、`label-deep-diving(-shimmer)`、`label-shimmer`、`bg-module-platform`、`bg-multi-select`、`bg-document-*`、`label-document-preview`、`border-l2-darkmode-thin`、`border-inverted/-inverted2`、`bg-mask-photo/-drop`。
   - 顺带补上 2.4 里那 10 个未定义 token。
2. **第二层（`--dsw-specific-*`，决定产品个性）**：`sidebar-fill`、`bubble`、`bubble-highlight`、`input-major`、`selector`、`menu`、`tip`、`login-input`、`sidebar-nav-item-*`。**`--dsw-specific-sidebar-fill` 是官方 inspect 清单里唯一上榜的 specific token，改它一处就定了整个侧边栏基调。**
3. **第三层（非颜色 token）**：`--dsw-radius-*`、`--dsw-elevation-stroke-color`、`--dsw-mask-blur`、`--dsw-menu-backdrop-filter`、`--dsw-corner-shape`、`--dsw-font-family`、`--dsw-linear-gradient-think`。
   - `--dsw-radius-*` 与 `--dsw-font-*` 定义在 `:root`，但 **overrideTokens 同样能改**（它写的是 body 上的 inline style，按继承优先于 html 上的值，见 2.3）。代价是这些名字不在官方 inspect 目录里，属于「用内部协议」—— 用之前先确认升级 DSH 后它们还在。
4. **第四层（针对性 CSS）**：只打第 3 章列出的硬编码点 + 组件级 dark 分支 + `::selection` + `.xterm`。

### 9.2 风险清单

| 风险 | 说明 |
| --- | --- |
| **组件级 dark 分支不吃 alias** | deliverables / plan / schedule / sidebar-right 用 `body[data-ds-dark-theme] .xxx{--x: var(--dsw-static-neutral-850)}`。覆盖 alias 无效，须覆盖 static 灰阶或打组件选择器。 |
| **`overrideTokens` 要求 light+dark 成对** | 忘记给 dark 会抛错；两模式给同一个值也是合法但有意的选择（`scheme-invariant`）。 |
| **覆盖 static 会误伤** | `--dsw-static-*` 被大量组件直接引用（FileTypeIcon 的单色类型、shiki、各处 `color-mix`）。如果整体覆盖整套 static，会连带改掉代码高亮与文件图标底色。**做法应是「只点杀需要的那几个」**（如 `--dsw-static-neutral-850/800` 用于 deliverables/plan/schedule 卡片），而不是整表替换。 |
| **硬编码浮层文字** | workspace / schedule 的 `#fff`/`#cfd3d6`/`#adb2b8` 假定浮层是深色。若主题做浅色浮层，必须同时打这两个组件。 |
| **mask 渐变里的 `#000` 不是颜色** | 改了会让渐隐/滚动提示失效。 |
| **`isolation` / `backdrop-filter` 的层叠陷阱** | `MenuSurface` 依赖独立 `.material` 层；给菜单根加 `backdrop-filter` 会创建新的合成层并破坏 fixed 定位与嵌套菜单。 |
| **`shell.overlay` 在 z=20** | 盖不住菜单/模态/Toast（100/1000/1100）。全 GUI 主题若想「压住一切」，正确做法是覆盖 token 与组件选择器，而不是抬 z-index。 |
| **`data-platform=darwin` / `[data-windows-titlebar]` 分支** | 侧边栏、AppFrame、菜单、右侧栏都有平台特化。皮肤规则若不限定平台，会在 macOS/Windows 上破版。 |
| **`corner-shape` 局部 `round`** | 全局改 `--dsw-corner-shape` 后，发送键、状态点、滚动条拇指、Spinner 仍是正圆——这是有意的，别去"修正"。 |
| **`prefers-reduced-motion` / `prefers-reduced-transparency`** | 每个带动画/毛玻璃的模块都有 reduce media query。新增阴影/毛玻璃时请同样尊重它们。 |
| **DSH 升级后哈希前缀会变** | 所有针对性 CSS 都应尽量用 `data-*` 属性（`data-slot`、`data-chat-flow-kind`、`data-phase`、`data-platform`、`data-ds-dark-theme`、`data-menu-material`、`data-sidebar-collapsed`、`data-dockkit-*`）作锚点，哈希类名只作兜底。 |

---

## 附录 A：alias / specific token 全表

> `<=` 后为该值指向的上一层变量（去掉 `--dsw-static-` / `--dsw-alias-` 前缀，`A:` 表示指向另一个 alias）；无 `<=` 者为字面量。所有 101 个 `--dsw-alias-*` 在 `body[data-ds-dark-theme]` 下均被重新定义。

### A. `--dsw-alias-*`（101 个，语义层，主题覆盖的主战场）

```css
# token                                     LIGHT                              DARK
--dsw-alias-bg-base                        #fff <= neutral-bluish-00          #151517 <= neutral-bluish-950
--dsw-alias-bg-document-preview            #ebeef2 <= neutral-bluish-100      #151517 <= neutral-bluish-950
--dsw-alias-bg-document-selection          color-mix(in srgb, var(--dsw-static-blue-500) 40%, transparent) color-mix(in srgb, var(--dsw-static-blue-500) 40%, transparent)
--dsw-alias-label-document-preview         #61666b <= neutral-bluish-700      #cfd3d6 <= neutral-bluish-300
--dsw-alias-bg-layer-1                     #fff <= neutral-bluish-00          #232324 <= neutral-bluish-875
--dsw-alias-bg-layer-2                     #fff <= neutral-bluish-00          #2c2c2e <= neutral-bluish-850
--dsw-alias-bg-layer-3                     #fff <= neutral-bluish-00          #353638 <= neutral-bluish-800
--dsw-alias-bg-mask-1                      #0000003d                          #00000080
--dsw-alias-bg-mask-2                      #0000001f                          #0003
--dsw-alias-bg-mask-3                      #0000007a                          #0000007a
--dsw-alias-bg-mask-photo                  #000000e0                          #000000e0
--dsw-alias-bg-mask-drop                   #ffffffb3                          #272730b3
--dsw-alias-bg-module-platform             #f5f6f7 <= neutral-bluish-60       #353638 <= neutral-bluish-800
--dsw-alias-bg-multi-select                #f5f6f7 <= neutral-bluish-60       #212123 <= neutral-850
--dsw-alias-bg-overlay                     #e9ecf2 <= neutral-bluish-150      #61666b <= neutral-bluish-700
--dsw-alias-bg-skeleton                    #0000000a                          #ffffff14
--dsw-alias-border-inverted2               #0000                              #ffffff14
--dsw-alias-border-inverted                #0000                              #ffffff0f
--dsw-alias-border-l1                      #0000000a                          #ffffff0f
--dsw-alias-border-l2-darkmode-thin        #0000001a                          #ffffff0f
--dsw-alias-border-l2                      #0000001a                          #ffffff1f
--dsw-alias-border-l3                      #0000001f                          #ffffff29
--dsw-alias-border-l4                      #00000029                          #fff3
--dsw-alias-brand-primary-invert           #0f1115 <= neutral-bluish-1000     #f9fafb <= neutral-bluish-50
--dsw-alias-brand-primary-new-colorprimary-new-color #4176e6                            #5686fe <= deepseek-450
--dsw-alias-brand-primary                  #0f1115 <= neutral-bluish-1000     #f9fafb <= neutral-bluish-50
--dsw-alias-brand-text                     #0f1115 <= neutral-bluish-1000     #f9fafb <= neutral-bluish-50
--dsw-alias-button-contrast-fill           #61666b <= neutral-bluish-700      #f9fafb <= neutral-bluish-50
--dsw-alias-button-elevated-fill           #fff <= neutral-bluish-00          #43454a <= neutral-bluish-750
--dsw-alias-button-floating-fill           #fff <= neutral-bluish-00          #2c2c2e <= neutral-bluish-850
--dsw-alias-button-floating-hover          #f1f3f5 <= neutral-bluish-75       #353638 <= neutral-bluish-800
--dsw-alias-button-ghost-active-border     #979da6 <= neutral-bluish-500      #81858c <= neutral-bluish-600
--dsw-alias-button-ghost-active-fill       #ebeef2 <= neutral-bluish-100      #43454a <= neutral-bluish-750
--dsw-alias-button-ghost-active-hover      #e9ecf2 <= neutral-bluish-150      #61666b <= neutral-bluish-700
--dsw-alias-button-info-fill               #4176e6 <= deepseek-500            #7aaaff <= deepseek-400
--dsw-alias-button-info-hover              #7aaaff <= deepseek-400            #4176e6 <= deepseek-500
--dsw-alias-button-primary-dimmed          #ebeef2 <= neutral-bluish-100      #43454a <= neutral-bluish-750
--dsw-alias-button-primary-fill            #0f1115 <= A:brand-primary         #f9fafb <= A:brand-primary
--dsw-alias-button-primary-hover           #43454a <= neutral-bluish-750      #ebeef2 <= neutral-bluish-100
--dsw-alias-button-tool-bar-fill-invisible #1f1f1f5c                          #1f1f1f5c
--dsw-alias-button-tool-bar-fill           #54555780                          #54555780
--dsw-alias-button-tool-bar-hover          #54555799                          #54555799
--dsw-alias-interactive-bg-active          #2631481a                          #ffffff24
--dsw-alias-interactive-bg-hover-accent    #26314824                          #ffffff3d
--dsw-alias-interactive-bg-hover-danger    #ec13130d                          #f25a5a26
--dsw-alias-interactive-bg-hover-solid     #f1f3f5 <= neutral-bluish-75       #353638 <= neutral-bluish-800
--dsw-alias-interactive-bg-hover           #2631480f                          #ffffff14
--dsw-alias-label-caption                  #adb2b8 <= neutral-bluish-400      #81858c <= neutral-bluish-600
--dsw-alias-label-deep-diving              color-mix(in srgb, var(--dsw-static-deepseek-500) 70%, var(--dsw-static-blue-950)) color-mix(in srgb, var(--dsw-static-deepseek-450) 55%, var(--dsw-static-neutral-bluish-400))
--dsw-alias-label-deep-diving-shimmer      color-mix(in srgb, var(--dsw-static-deepseek-500) 30%, var(--dsw-static-blue-950)) color-mix(in srgb, var(--dsw-static-blue-300) 65%, var(--dsw-static-deepseek-400))
--dsw-alias-label-dimmed                   #e1e5ee <= neutral-bluish-200      #43454a <= neutral-bluish-750
--dsw-alias-label-primary-bluish           #0e3074 <= blue-900                #f9fafb <= neutral-bluish-50
--dsw-alias-label-primary-dimmed           #151517 <= neutral-bluish-950      #ebeef2 <= neutral-bluish-100
--dsw-alias-label-primary-foreground       #fff <= neutral-bluish-00          #0f1115 <= neutral-bluish-1000
--dsw-alias-label-primary-inverted         #fff <= neutral-bluish-00          #353638 <= neutral-bluish-800
--dsw-alias-label-primary                  #0f1115 <= neutral-bluish-1000     #f9fafb <= neutral-bluish-50
--dsw-alias-label-secondary                #61666b <= neutral-bluish-700      #cfd3d6 <= neutral-bluish-300
--dsw-alias-label-shimmer                  color-mix(in srgb, var(--dsw-static-neutral-1000) 30%, transparent) color-mix(in srgb, var(--dsw-static-neutral-00) 45%, transparent)
--dsw-alias-label-tertiary                 #81858c <= neutral-bluish-600      #adb2b8 <= neutral-bluish-400
--dsw-alias-menu-icon                      #353638 <= neutral-bluish-800      #ebeef2 <= A:label-primary-dimmed
--dsw-alias-link                           #4176e6 <= deepseek-500            #7aaaff <= deepseek-400
--dsw-alias-markdown-citation              #ebeef2 <= neutral-bluish-100      #353638 <= neutral-bluish-800
--dsw-alias-markdown-code-block-banner     #f9fafb <= neutral-bluish-50       #2c2c2e <= neutral-bluish-850
--dsw-alias-markdown-code-block            #f9fafb <= neutral-bluish-50       #1b1b1c <= neutral-bluish-900
--dsw-alias-markdown-code-segment-selected #fff <= neutral-bluish-00          #353638 <= neutral-bluish-800
--dsw-alias-markdown-code-segment-unselected #f1f3f5 <= neutral-bluish-75       #1b1b1c <= neutral-bluish-900
--dsw-alias-markdown-inline-code           #fafafa <= neutral-50              #292929 <= neutral-800
--dsw-alias-markdown-placeholder           #f5f6f7 <= neutral-bluish-60       #2c2c2e <= neutral-bluish-850
--dsw-alias-markdown-tag                   #f1f3f5 <= neutral-bluish-75       #2c2c2e <= neutral-bluish-850
--dsw-alias-scrollbar-bg-l1                #e5e5e5 <= neutral-200             #3c3c3d <= neutral-700
--dsw-alias-scrollbar-bg-l2                #e5e5e5 <= neutral-200             #545557 <= neutral-600
--dsw-alias-scrollbar-hover-l1             #d4d4d4 <= neutral-300             #545557 <= neutral-600
--dsw-alias-scrollbar-hover-l2             #d4d4d4 <= neutral-300             #65676b <= neutral-550
--dsw-alias-state-business-primary         #4176e6 <= deepseek-500            #7aaaff <= deepseek-400
--dsw-alias-state-business-tertiary        #e4edfd <= deepseek-100            #34415b <= deepseek-800
--dsw-alias-code-diff-added                #22c55e14 <= green-500-a08         #22c55e1f <= green-500-a12
--dsw-alias-code-diff-deleted              #ec131314 <= red-600-a08           #f25a5a1f <= red-400-a12
--dsw-alias-file-diff-added-bg             #e6f4e7                            #1f3124
--dsw-alias-file-diff-added-gutter         #edf7ed                            #132016
--dsw-alias-file-diff-added-marker         #01a241                            #41c977
--dsw-alias-file-diff-deleted-bg           #fce6e2                            #3c1f1b
--dsw-alias-file-diff-deleted-gutter       #fdece9                            #28130e
--dsw-alias-file-diff-deleted-marker       #ba2723                            #fa423e
--dsw-alias-state-error-primary            #ec1313 <= red-600                 #f25a5a <= red-400
--dsw-alias-state-error-secondary          #f25a5a <= red-400                 #f25a5a <= red-400
--dsw-alias-state-idle-primary             #d4d4d4 <= neutral-300             #545557 <= neutral-600
--dsw-alias-state-success-primary          #22c55e <= green-500               #22c55e <= green-500
--dsw-alias-state-success-secondary        #4ed17e <= green-400               #4ed17e <= green-400
--dsw-alias-state-success-tertiary         #e6faed <= green-100               #233c2c <= green-900
--dsw-alias-state-warn-label               #dd8629 <= amber-600               #dd8629 <= amber-600
--dsw-alias-state-warn-primary             #f59e0b <= amber-500               #f59e0b <= amber-500
--dsw-alias-state-warn-secondary           #f7ad31 <= amber-400               #f7ad31 <= amber-400
--dsw-alias-state-warn-tertiary            #fef5e7 <= amber-100               #27241f <= amber-900
--dsw-alias-switch-thumb                   #fff <= neutral-bluish-00          #adb2b8 <= neutral-bluish-400
--dsw-alias-toast-bg                       #353638 <= neutral-bluish-800      #43454a <= neutral-bluish-750
--dsw-alias-toast-label                    #fff <= neutral-bluish-00          #fff <= neutral-bluish-00
--dsw-alias-tooltip-bg                     #2c2c2e <= neutral-bluish-850      #43454a <= neutral-bluish-750
--dsw-alias-tooltip-key-bg                 color-mix(in srgb, var(--dsw-alias-tooltip-bg), white 18%) color-mix(in srgb, var(--dsw-alias-tooltip-bg), white 18%)
--dsw-alias-turn-trigger-bg                #f9fafb <= A:markdown-code-block   #ffffff14 <= A:interactive-bg-hover
--dsw-alias-turn-trigger-bg-hover          #2631480f <= A:interactive-bg-hover #ffffff24 <= A:interactive-bg-active
--dsw-alias-menu-group-header-fill         #f8f9faf0                          #303136f0
```

### B. `--dsw-specific-*` 与菜单表面（12 个）

```css
# token                                     LIGHT                              DARK
--dsw-specific-bubble-highlight            #d3e2ff <= deepseek-200            #43454a <= neutral-bluish-750
--dsw-specific-bubble                      #edf3fe <= deepseek-50             #2c2c2e <= neutral-bluish-850
--dsw-specific-input-major                 #fff <= neutral-bluish-00          #2c2c2e <= neutral-bluish-850
--dsw-specific-login-input                 #f9fafb <= neutral-bluish-50       #1b1b1c <= neutral-bluish-900
--dsw-menu-surface-fill                    #f8f9fa94                          #43454a73
--dsw-specific-menu                        #f8f9fa94 <= surface-fill          #43454a73 <= surface-fill
--dsw-specific-selector                    #f5f6f7 <= neutral-bluish-60       #353638 <= neutral-bluish-800
--dsw-specific-sidebar-fill                #f9fafb <= neutral-bluish-50       #1b1b1c <= neutral-bluish-900
--dsw-specific-sidebar-nav-item-active-accent #e4edfd <= deepseek-100            #353638 <= neutral-bluish-800
--dsw-specific-sidebar-nav-item-active     #ebeef2 <= neutral-bluish-100      #43454a <= neutral-bluish-750
--dsw-specific-sidebar-nav-item-hover      #f1f3f5 <= neutral-bluish-75       #2c2c2e <= neutral-bluish-850
--dsw-specific-tip                         #f5f6f7 <= neutral-bluish-60       #353638 <= neutral-bluish-800
```

> 说明：`<=` 后是它指向的上一层变量；`A:` 前缀表示指向另一个 alias（构成 alias 内部链）。深浅两套的 static 原始色阶几乎完全相同（77 个里只有 `--dsw-static-neutral-bluish-60` 一处差异：浅 `#f5f6f7`／深 `#f9fafb`），**深浅差异 100% 由 alias 层承担**。

---

## 附录 B：`--dsw-static-*` 原始色阶（77 个）

```css
# --dsw-static-*（77 个原始色阶；深浅两套仅 neutral-bluish-60 不同：浅 #f5f6f7 / 深 #f9fafb）
--dsw-static-amber-100:#fef5e7
--dsw-static-amber-400:#f7ad31
--dsw-static-amber-500:#f59e0b
--dsw-static-amber-600:#dd8629
--dsw-static-amber-900:#27241f
--dsw-static-blue-100:#dbeafe
--dsw-static-blue-300:#93c5fd
--dsw-static-blue-400:#60a5fa
--dsw-static-blue-450:#4d93f8
--dsw-static-blue-500:#3b82f6
--dsw-static-blue-50:#eff6ff
--dsw-static-blue-50p:#eaf3ff
--dsw-static-blue-600:#2563eb
--dsw-static-blue-75:#e5f0ff
--dsw-static-blue-800:#1e40af
--dsw-static-blue-900:#0e3074
--dsw-static-blue-950:#172554
--dsw-static-deepseek-100:#e4edfd
--dsw-static-deepseek-200:#d3e2ff
--dsw-static-deepseek-300:#b7c8fe
--dsw-static-deepseek-400:#7aaaff
--dsw-static-deepseek-450:#5686fe
--dsw-static-deepseek-500:#4176e6
--dsw-static-deepseek-50:#edf3fe
--dsw-static-deepseek-600:#4868b2
--dsw-static-deepseek-700-delete:#2f4c8f
--dsw-static-deepseek-800:#34415b
--dsw-static-deepseek-900:#283142
--dsw-static-green-100:#e6faed
--dsw-static-green-400:#4ed17e
--dsw-static-green-500-a08:#22c55e14
--dsw-static-green-500-a12:#22c55e1f
--dsw-static-green-500:#22c55e
--dsw-static-green-900:#233c2c
--dsw-static-neutral-00:#fff
--dsw-static-neutral-1000:#000
--dsw-static-neutral-100:#f5f5f5
--dsw-static-neutral-150:#ededed
--dsw-static-neutral-200:#e5e5e5
--dsw-static-neutral-250:#dcdcdc
--dsw-static-neutral-300:#d4d4d4
--dsw-static-neutral-400:#a2a4a6
--dsw-static-neutral-500:#7f8287
--dsw-static-neutral-50:#fafafa
--dsw-static-neutral-550:#65676b
--dsw-static-neutral-600:#545557
--dsw-static-neutral-700:#3c3c3d
--dsw-static-neutral-800:#292929
--dsw-static-neutral-850:#212123
--dsw-static-neutral-900:#0f0f0f
--dsw-static-neutral-bluish-00:#fff
--dsw-static-neutral-bluish-1000:#0f1115
--dsw-static-neutral-bluish-100:#ebeef2
--dsw-static-neutral-bluish-150:#e9ecf2
--dsw-static-neutral-bluish-200:#e1e5ee
--dsw-static-neutral-bluish-300:#cfd3d6
--dsw-static-neutral-bluish-400:#adb2b8
--dsw-static-neutral-bluish-500:#979da6
--dsw-static-neutral-bluish-50:#f9fafb
--dsw-static-neutral-bluish-600:#81858c
--dsw-static-neutral-bluish-60:#f5f6f7
--dsw-static-neutral-bluish-700:#61666b
--dsw-static-neutral-bluish-750:#43454a
--dsw-static-neutral-bluish-75:#f1f3f5
--dsw-static-neutral-bluish-800:#353638
--dsw-static-neutral-bluish-850:#2c2c2e
--dsw-static-neutral-bluish-875:#232324
--dsw-static-neutral-bluish-900:#1b1b1c
--dsw-static-neutral-bluish-950:#151517
--dsw-static-red-100:#fee2e2
--dsw-static-red-400-a12:#f25a5a1f
--dsw-static-red-400:#f25a5a
--dsw-static-red-500:#ef4444
--dsw-static-red-50:#fef2f2
--dsw-static-red-600-a08:#ec131314
--dsw-static-red-600:#ec1313
--dsw-static-red-900:#570c0c
```

---

## 附录 C：非颜色 token

### C.1 形状与动效（`:root`）

```css
--dsw-radius-xs: 4px;  --dsw-radius-sm: 8px;   --dsw-radius-md: 12px;
--dsw-radius-lg: 16px; --dsw-radius-xl: 20px;  --dsw-radius-panel: 28px;
--dsw-corner-shape: superellipse(1.5);          /* @supports (corner-shape:superellipse(1.5)) */
--ds-ease-in-out: cubic-bezier(.4, 0, .2, 1);
--ds-transition-duration: .2s;  --ds-transition-duration-fast: .1s;  --ds-transition-duration-slow: .3s;
--dsw-focus-ring-width: 2px;
```

### C.2 阴影与高度（`body` / `body, body *`，浅色）

```css
--dsw-shadow-lv1:      0 2px 4px 0 #0000000d;
--dsw-shadow-lv1-blur: 0 4px 12px 0 #00000005;
--dsw-shadow-lv2:      0 4px 12px 0 #00000005, 0 2px 8px 0 #0000000a;
--dsw-shadow-lv3:      0 0 1px 0 #0003, 0 0 4px 0 #00000005, 0 12px 32px 0 #00000014;
--dsw-elevation-stroke-color: var(--dsw-alias-border-l4);          /* dark [data-menu-material] → border-l3 */
--dsw-elevation-stroke:    0 0 0 .5px var(--dsw-elevation-stroke-color);
--dsw-elevation-panel:     var(--dsw-elevation-stroke), 0 3px 8px 0 #00000008, 0 0 16px 0 #00000005;
--dsw-elevation-prominent: var(--dsw-elevation-stroke), 0 3px 8px 0 #0000000a, 0 0 20px 0 #0000000d;
--dsw-elevation-soft:      var(--dsw-elevation-stroke), 0 4px 16px 0 #00000008, 0 0 24px 0 #00000008;
--dsw-mask-blur: none;
--dsw-menu-backdrop-filter: blur(40px) saturate(150%);
```

> **深浅两套的 elevation 数值完全相同**（阴影是写死的黑色 alpha，深色下不会自动加重）。若主题要「深色下更沉的阴影」，必须显式覆盖 `--dsw-elevation-*`。

### C.3 渐变

```css
/* body（浅） */
--dsw-linear-gradient-think: linear-gradient(180deg, #fff 20.19%, #fff0 100%);
--dsw-linear-think-select:   linear-gradient(180deg, #f5f6f7 20.19%, #f5f6f700 100%);
/* body[data-ds-dark-theme] */
--dsw-linear-gradient-think: linear-gradient(180deg, #151517 20.19%, #15151700 100%);
--dsw-linear-think-select:   linear-gradient(180deg, #232325 20.19%, #23232500 100%);
/* onboarding（仅 body） */
--dsw-gradient-onboarding-violet-stops: #2a2fb6 33.102%, #8b76f6 50.954%, #c5c0ff 85.326%, #2a2fb6;
--dsw-gradient-onboarding-blue-stops:   #3964fe 18.75%, #398efe 51.78%, #6dccff 86.252%, #3964fe;
--dsw-gradient-onboarding-cyan-stops:   #0293b4 21.154%, #2dc8eb 50.954%, #aff0ff 85.326%, #0293b4;
```

### C.4 字体族与字号阶梯

```css
--dsw-font-family:       -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB",
                         "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif;
--dsw-font-family-brand: "Montserrat", var(--dsw-font-family);
--ds-font-family-code:   "SF Mono", "JetBrains Mono", "Fira Code", Consolas, "Liberation Mono", Menlo,
                         Courier, "PingFang SC", "Microsoft YaHei";
--dsh-content-font-size: <用户设置，默认 14px>   /* 由 ThemePresenter 写在 body 上 */
--dsh-content-font-delta: calc(var(--dsh-content-font-size,14px) - 14px);
--dsh-content-font-size-secondary: min(calc(--dsh-content-font-size - 1px), max(13px, ...));
```
固定字号阶梯（每个都带 `-font-family / -font-weight / -line-height / -font-size / -font-style` 派生变量）：
`--dsw-font-xl-24`、`--dsw-font-l-20`、`--dsw-font-m-18`、`--dsw-font-base-16`、`--dsw-font-base-strong-16`、`--dsw-font-s-14`、`--dsw-font-s-strong-14`、`--dsw-font-xs-13`、`--dsw-font-xs-strong-13`、`--dsw-font-xxs-12`、`--dsw-font-xxs-strong-12`、`--dsw-font-xxxs-11`、`--dsw-font-xxxs-strong-11`。
markdown 专用阶梯：`--dsw-font-markdown-h1/h2/h3/h4`、`-base(-strong/-italic/-strong-italic)`、`-table(-head)`、`-small(...)`、`-code`、`-code-block(-small)`。

---

## 附录 D：shiki 代码高亮色（token 之外的例外）

```css
:root {
  --shiki-foreground: var(--dsw-alias-label-primary);
  --shiki-background: var(--dsw-alias-markdown-code-block);
  --shiki-token-constant: #1c7ed6;   --shiki-token-string: #2f9e44;
  --shiki-token-comment: #868e96;    --shiki-token-keyword: #d6336c;
  --shiki-token-parameter: #e8590c;  --shiki-token-function: #6741d9;
  --shiki-token-string-expression: #2b8a3e;  --shiki-token-punctuation: #495057;
  --shiki-token-link: #1971c2;
}
body[data-ds-dark-theme] {
  --shiki-token-constant: #4dabf7;   --shiki-token-string: #69db7c;
  --shiki-token-comment: #adb5bd;    --shiki-token-keyword: #faa2c1;
  --shiki-token-parameter: #ffa94d;  --shiki-token-function: #b197fc;
  --shiki-token-string-expression: #8ce99a;  --shiki-token-punctuation: #ced4da;
  --shiki-token-link: #74c0fc;
}
```
**这 11 个色是字面量，深浅两套各一份。** 代码块的「换肤质感」很大程度取决于它们 —— 是 token 体系之外最值得覆盖的一组。
