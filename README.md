# dsh-os

DeepSeek Harness OS: turn the DSH Web home page into a cyberpunk terminal desktop — animated ASCII background patterns, boot self-test, live system & Harness telemetry HUD, and native UI skinning.

dsh-os：把 DSH Web 首页（blank-session hero 界面）改造成一台兼具极客美学与实用监控的赛博终端桌面。包含 ASCII/Lain 风格字符雨与流场拓扑动效、开机自检序列（POST sequence）、真实系统/Harness 参数监控 HUD、原生侧边栏与输入框皮肤，以及完整的偏好设置页。

[English](README.en.md) · **中文**

---

## 视觉与特性概览

| 默认蓝调主题 · 稀疏字符雨（Rain） | 3D 旋转 DSH 娘全息投影（Dsh-Chan） |
| :---: | :---: |
| ![Rain Pattern](<screenshots/home-rain.png>) | ![DSH Chan](<screenshots/home-dshchan.png>) |

| 等高线拓扑场（Field 迷幻模式） | 内置设置面板（Settings） |
| :---: | :---: |
| ![Field Pattern](<screenshots/home-field.png>) | ![Settings Panel](<screenshots/settings.png>) |

| 开机自检序列（Boot POST） | 移动端自适应（Mobile Responsive） |
| :---: | :---: |
| ![Boot Sequence](<screenshots/boot.png>) | ![Mobile View](<screenshots/home-mobile.png>) |

---

## 核心特性

1. **真实宿主与系统监控 (SYS · MONITOR)**
   - **CPU 全核与分核监控**：实时总利用率、各核柱状图（C0~C7）与主频/温度读数。
   - **内存与存储**：物理内存占用比率、Swap 分区用量、根分区 (`/`) 磁盘使用。
   - **网络吞吐**：自动识别主要网络接口（如 `wlan0`），计算瞬时收发速率（KB/s）并附带迷你折线走势图。
   - **系统状态**：负载（1/5/15m Loadavg）、电池电量、充放电状态与电池温度。

2. **Harness 核心与 Token 账本 (HARNESS · CORE & TOKEN · LEDGER)**
   - **会话与预设态**：总会话数、运行中会话、当前工作区基准、当前代理预设（Preset）。
   - **上下文压力监控**：当前会话 Context Window 占比、Prompt Token 消耗量、推理与缓存用量。
   - **多会话 Token 排行账本**：按会话聚合输入/输出 Token、缓存命中率（Cache Hit Ratio）以及解码速率（Tokens Per Second / TPS）。
   - **Node 运行时健康度**：DSH 服务进程 PID、常驻内存 (RSS)、堆内存、事件循环延迟 (Event Loop Lag)。

3. **三种字符动效背景 (Glyph Engine)**
   - **稀疏字符雨 (`rain`) - 默认推荐**：Lain 极简风格，垂直列式下落、长尾渐隐、点阵底纹，安静不抢眼，专注输入。
   - **3D 旋转 DSH 娘 (`dsh-chan`)**：把鲸鱼娘立绘采样成 42×75 的 ASCII 位图，按材质分出前后层，在三维空间里绕 Y 轴缓慢自转——有视差、有透视、有投影台与倒影，转到侧面时会触发一次"重建"抖动。
   - **等高线拓扑场 (`field`)**：3D Perlin 标量场切出多层等高线，距离场自适应字形排列与 Bayer 抖动着色，浓烈迷幻。
   - **智能让位**：中间输入区域自动计算椭圆径向暗角，确保输入框文字清晰无阻碍。

4. **原生界面统一美化 (Native Skinning)**
   - 自动接管首页的深色渲染模式，把主窗口底色打透与背景交融。
   - **移除原生 hero 标题**：首页的 "Into the Unknown" 标题、鲸鱼图标与预览徽标全部隐去，只留工作区选择与输入框。
   - **侧边栏皮肤**：整条侧边栏切成终端形态——深蓝渐变底、CRT 扫描线、左侧刻度导轨、等宽字体、"`> WORKSPACES`" 分组标签与全大写描边的 NEW SESSION 按钮。
   - **输入框皮肤**：微光投影、主色微调、高对比度占位提示与聚焦光晕。

5. **交互与操作**
   - 键盘 `` ` `` (反引号 / 波浪号)：一键快速切换/隐藏整个 OS 桌面层。
   - 键盘 `Esc` / 点击屏幕：立即跳过开机自检序列。
   - 底部任务栏快捷按钮：一键切换背景动效、重播开机、打开设置。

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

装指定版本/tag：`add github:john-walks-slow/dsh-os#v0.1.2`。

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

拿不到的行界面会直接隐藏，并在 SYS 面板标一行 `MODE portable · node:os`，不会挂一排 `--`。
Windows 上 `link:` 路径用正斜杠即可，例如 `"dsh-os": "link:C:/Users/you/dsh-os"`。

### 数据与权限

- 只读本机 `/proc`、`/sys`、`statfs` 拿系统指标，全部在本机内循环，不联网。
- 偏好存在浏览器 `localStorage`（键 `dsh-os:settings`）。
- 不写会话数据，不改 DSH 配置；退出首页后桌面层与皮肤全部自动卸掉。

## 架构与技术实现

- **无依赖宿主插件**：宿主半边 (`src/index.ts` + `src/procfs.ts` + `src/metrics.ts`) 仅依赖 Node.js 核心库，直接读取 Linux `/proc` 与 `/sys` 虚拟文件系统，不静态引入 `@deepseek-ai/*` 运行时，彻底规避 link 依赖导致的 ESM 循环解析崩溃问题。
- **独立指标端点**：宿主暴露 `GET /plugins/dsh-os/metrics` 轻量级 JSON 快照接口，维持 90 点历史环形缓冲区。
- **纯客户端无侵入挂载**：
  - 核心 HUD 挂载于 `shell.overlay`（Frame 级 Click-through 插槽），通过实测动态计算中央列与 Hero 输入框的边界。
  - 通过 `isHome(snapshot)` 智能检测当前是否处于空白会话首页，进入会话后即时撤销背景与样式，恢复干净的对话工作流。
  - 设置模块挂载于标准 `settings.section` 插槽，与 DSH 原生设置中心完美融合。

---

## 许可证

[MIT](LICENSE)
