# dsh-os

DeepSeek Harness OS：一套覆盖**整个** DSH Web GUI 的主题 —— 会话流、侧边栏、代码块、工具卡、弹窗、菜单、输入框与设置页一起换墨，深浅两套；首页（blank-session hero）则进一步变身为一台带真实监控的赛博终端桌面。干活时它安静地用一条会话遥测条告诉你上下文压力、用量与解码速度；停手时它把字符雨、开机自检、整机 HUD 与 **按模型聚合的 Token 账本**摆出来。

换肤走 DSH 官方的主题 token 覆盖层（`ctx.theme.overrideTokens`），不是往别人的 DOM 上糊 CSS —— 所以跟随宿主明暗、跟着版本升级都不打架。

[English](README.en.md) · **中文**

---

## 视觉与特性概览

| 会话（深色）：主题 + 会话遥测条 | 会话（浅色）：明细卡与上下文构成 |
| :---: | :---: |
| ![Session Dark](<screenshots/session-dark.png>) | ![Session Light](<screenshots/session-light.png>) |

| 宿主原生设置窗口（深色） | 宿主原生设置窗口（浅色） |
| :---: | :---: |
| ![Native Settings Dark](<screenshots/settings-native-dark.png>) | ![Native Settings Light](<screenshots/settings-native-light.png>) |

| 首页 · 稀疏字符雨（深色） | 首页 · 纸面蓝图（浅色） |
| :---: | :---: |
| ![Rain Pattern](<screenshots/home-rain.png>) | ![Light Tone](<screenshots/home-light.png>) |

| 3D 旋转 DSH 娘全息投影 | 等高线拓扑场（迷幻模式） |
| :---: | :---: |
| ![DSH Chan](<screenshots/home-dshchan.png>) | ![Field Pattern](<screenshots/home-field.png>) |

| 开机自检序列（Boot POST） | 移动端自适应 |
| :---: | :---: |
| ![Boot Sequence](<screenshots/boot.png>) | ![Mobile View](<screenshots/home-mobile.png>) |

| 内置设置页（Settings） |
| :---: |
| ![Settings Panel](<screenshots/settings.png>) |

---

## 核心特性

1. **全应用主题（Whole-GUI Theme）**
   - 通过官方 token 覆盖层改写 `--dsw-alias-*` / `--dsw-specific-*` / 圆角 / 高度 / shiki 语法高亮共 150+ 个词条：会话流、侧边栏、代码块、工具卡、diff、弹窗、菜单、滚动条、输入框、设置页**一起换墨**。
   - 深浅两套由宿主主题决定（跟随系统 / 跟随宿主），不抢偏好：深色是夜航终端玻璃，浅色是蓝图纸面。
   - 主题色一处改全应用生效（任务栏芯片、设置页或会话遥测条里的 `SYS / DARK / LIGHT`）；宿主原生的设置窗口、菜单、Toast、Tooltip 同样在这套 token 之下。
   - 只改颜色、字体、字距与圆角，**不碰布局**：侧边栏、会话流的尺寸与交互契约原样保留，官方升级不易破版。

2. **会话遥测条（Session Telemetry Strip）**
   - 会话视图顶端一条 21px 状态带：模型、上下文压力计（百分比 + 已用/窗口）、本会话输入/输出/缓存命中、解码速度、距今时间。
   - 点箭头展开明细：上下文构成（system / tools / messages 各占多少）、缓存读写、解码时长、会话 id；展开时会话流**从顶部让出这段高度**（下缘不动），正文不会被压住；点别处或滚动自动收起，`Esc` 也可。
   - 数据是**当下**的：宿主打开会话时投影的真实读数（`tokenUsage` / `contextPressure` / `contextBreakdown` / `sessionStats`），不是估算。

3. **整机监控（SYS · MONITOR）**
   - **CPU**：总利用率、分核柱状图（C0~C7）、主频与温度。
   - **内存与存储**：物理内存、Swap、根分区占用。
   - **网络**：自动识别主网卡（如 `wlan0`），瞬时收发速率 + 迷你折线，**鼠标悬停可读出任意一刻的瞬时值**。
   - **负载与运行时长**：1/5/15m Loadavg、开机时长、电池电量与温度。
   - 窗格按可用高度决定画哪几行：宁可少画一行，也不会让内容被静默裁掉。

4. **当前工作区总览（WORKSPACE · OVERVIEW）**
   - 工作区名、会话总数与 7 天活跃数、**此刻正在跑的会话与在飞的子代理数**。
   - 今日新增 Token 与缓存重读量分开统计，另有缓存命中率、最近活动时间与主力模型。
   - 底部一行 Node 运行时读数（RSS / Event Loop Lag / 进程数）。

5. **最近会话（SESSIONS · RECENT）**
   - 按最近活动排序，带模型、Token 与相对时间；**点一行直接回到那个会话**。
   - 空白会话与子代理会话不计入，不会出现"没有内容的假会话"。

6. **模型账本（MODEL · LEDGER）**
   - 按**模型**聚合 Token：会话数、输入、输出、缓存命中率、解码速度（TPS）与占比。
   - 数据来自 DSH 自己的会话投影缓存（`storages/session_projcache`），覆盖**全部历史会话**——不是只算当前打开的那几个，所以在首页（没有任何活跃会话时）也有真实数字；Linux / Windows / macOS 一视同仁。
   - 支持 `24H / 7D / ALL` 时间窗与 `WS / ALL` 口径切换；**点一行回到该模型最近用过的会话**。

7. **三种字符动效背景（Glyph Engine）**
   - **稀疏字符雨（`rain`，默认推荐）**：Lain 极简风格，垂直列式下落、长尾渐隐、点阵底纹。
   - **3D 旋转 DSH 娘（`dsh-chan`）**：把鲸鱼娘立绘采样成 42×75 的 ASCII 位图，按材质分前后层，绕 Y 轴缓慢自转——有视差、有透视、有投影台与倒影。
   - **等高线拓扑场（`field`）**：3D Perlin 标量场切出多层等高线，距离场自适应字形排列与 Bayer 抖动着色。
   - 中间输入区域自动计算椭圆径向暗角，确保输入框文字清晰无阻碍。

8. **深浅色双墨色**
   - **跟随宿主**（默认）：宿主切深浅色，桌面一起换——桌面层不会像早期版本那样强行改写宿主的主题。
   - 深色是霓虹终端，浅色是纸面/蓝图：同一套窗格与等宽字语汇，两套墨色。
   - 任务栏 `SYS / DARK / LIGHT` 芯片或设置页里切换；点芯片同时会把宿主主题偏好一起改掉。

9. **原生界面美化**
   - **移除原生 hero 标题**：首页的 "Into the Unknown" 标题、鲸鱼图标与预览徽标全部隐去，只留工作区选择与输入框。
   - **输入框皮肤**：与桌面同底的渐变、主色描边、聚焦光晕。

10. **交互与操作**
   - 键盘 `` ` ``（反引号 / 波浪号）：一键快速切换/隐藏整个 OS 桌面层。
   - 会话里通过遥测条卡片切换 `SYS / DARK / LIGHT`：干活时也能换墨，不必回首页。
   - 键盘 `Esc` / 点击屏幕：立即跳过开机自检序列。
   - 底部任务栏：`FIELD` 背景动效开关、`BOOT` 重播、`WS/ALL` 统计口径、`SYS/DARK/LIGHT` 明暗、`SETTINGS` 入口；右侧滚动条显示真实事件（CPU 打满、内存压力、网络突发、会话起停）。

---

## 安装

一行装完，不需要克隆仓库：

```bash
dsh plugin --profile web add github:john-walks-slow/dsh-os
```

`web` 换成你自己的 profile 名。这条命令会把包加进依赖、写进 `dsh.profile.bundles`，并解析 `cordis.patch.yml`；重启 DSH 后生效。

卸载：

```bash
dsh plugin --profile web remove dsh-os
```

装指定版本/tag：`add github:john-walks-slow/dsh-os#v0.3.0`。

### 从源码改

```bash
git clone https://github.com/john-walks-slow/dsh-os.git
cd dsh-os && npm install && npm run build
```

然后把 profile 的 `package.json` 依赖写成 `"dsh-os": "link:/绝对路径/dsh-os"` 并加进 `bundles`，重启生效。

### 平台支持

| 指标 | Linux | Windows / macOS |
| --- | --- | --- |
| CPU 总占用 · 分核 | `/proc/stat`（含 iowait / steal） | `node:os`（无 iowait / steal） |
| CPU 频率 · 温度 · 电池 | `/sys` | — |
| 内存 · Swap | `/proc/meminfo` | 内存可读；Swap 无 |
| 磁盘占用 | ✅ | ✅ 系统盘 |
| 网卡速率 | `/proc/net/dev` | — |
| 进程表 · 负载 | ✅ | — |
| 模型账本（会话投影缓存） | ✅ | ✅ |

拿不到的行界面会直接隐藏，并在 SYS 面板的 ARCH 行标注 `node:os`，不会挂一排 `--`。
Windows 上 `link:` 路径用正斜杠即可，例如 `"dsh-os": "link:C:/Users/you/dsh-os"`。

### 数据与权限

- **只读**本机 `/proc`、`/sys`、`statfs` 拿系统指标，并**只读** DSH 自己的会话投影缓存（`<DSH_HOME>/storages/session_projcache`）做账本聚合；全部在本机内循环，不联网。
- 账本的时间窗按"会话最近活动时间"归窗（投影本身是按会话聚合的，不是逐轮次），所以是近似而非精确到每一轮。
- 偏好存在浏览器 `localStorage`（键 `dsh-os:settings`）。
- 不写会话数据，不改 DSH 配置；退出首页后桌面层与皮肤全部自动卸掉。

## 架构与技术实现

- **无依赖宿主插件**：宿主半边（`src/index.ts` + `src/procfs.ts` + `src/metrics.ts` + `src/harness.ts`）仅依赖 Node.js 核心库，不静态引入 `@deepseek-ai/*` 运行时，彻底规避 link 依赖导致的 ESM 循环解析崩溃问题。
- **两个只读端点**：
  - `GET /plugins/dsh-os/metrics`：整机读数快照（90 点历史环形缓冲）。
  - `GET /plugins/dsh-os/harness?ws=<cwd>`：会话与 Token 账本。宿主侧把 3400+ 条投影检查点索引进内存（首轮分批 200 文件/帧、之后每 15 秒按 mtime/size 增量刷新），请求只做内存聚合。
- **两半皮肤，一个色源**（`src/client/skin/`）：
  - `palette.ts` 摊出深浅两套墨色，并同时喂给官方 token 覆盖层（全应用）与自己的 `--dos-*` 变量（HUD / 字符场 / 遥测条）；改主题色只改这一处。
  - 覆盖层走 `ctx.theme.overrideTokens('dsh-os', { token: { light, dark } })`：宿主按当前配色方案取值，所以"跟随明暗"是免费的，卸载时自动还原。
  - `styles.ts` 只补 token 到不了的地方：选区、滚动条、chrome 排版、官方写死的浮层浅字、以及我们自己的元件。
- **纯客户端无侵入挂载**：
  - HUD 挂载于 `shell.overlay`（Frame 级 click-through 插槽），几何由中央列与 hero 的实测矩形推出来。
  - `isHome(snapshot)` 判定空白会话首页；进入会话后桌面层退场，只留遥测条。
  - 明暗读宿主 `ctx.theme`（缺失时回退到 `body[data-ds-dark-theme]` + `prefers-color-scheme`），只在 `html` 上打自己的 `data-dos-tone`。
  - 设置模块挂载于标准 `settings.section` 插槽。

### 开发

```bash
npm run build          # 构建 lib/index.js 与 lib/client.js
npm run typecheck      # tsc --noEmit
npm run e2e            # dsh-e2e 隔离实例 + 无头冒烟测试（首页桌面层，含夹具播种）
npm run e2e:session    # 会话视图检查：遥测条真实读数、明细卡不压正文、卡片内换墨
npm run e2e:shots      # 重新生成 screenshots/ 里的官方截图
```

会话视图那两张截图需要一个"有内容的会话"。DSH 只在启动时枚举工作区会话，所以顺序是：

```bash
node e2e/seed-conversation.mjs    # 把本机真实会话日志搬进隔离 home（没有历史会自动跳过）
dsh-e2e stop && dsh-e2e start --wait-ready
dsh-e2e run e2e/shots.mjs
```

设计迭代可以在不启动 DSH 的情况下进行：`npx esbuild tools/preview.tsx --bundle --format=iife --jsx=automatic --define:process.env.NODE_ENV='"production"' --outfile=tools/preview.js`，然后打开 `tools/preview.html?pattern=rain&tone=light`（`?settings=1` 渲染设置页，`?win=1` 模拟无 `/proc` 的平台）。

---

## 许可证

[MIT](LICENSE)
