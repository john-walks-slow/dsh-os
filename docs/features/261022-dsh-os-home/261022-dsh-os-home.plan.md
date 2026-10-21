# dsh-os：把 DSH 首页做成 DeepSeek Harness OS

日期：2026-10-22　状态：实施中

## 需求

dsh Web GUI 的首页（blank-session hero 页）目前是一张白底、居中一句 "Into the Unknown" 的朴素页面。
目标：把它改造成 cyberpunk / Serial Experiments Lain 风格的终端操作系统界面，并保证"炫技"之外
有真实可用的参数监控。

- 视觉：细致、丰富、酷帅、现代、炫技；ASCII/字符动效背景；CRT/glitch/扫描线语汇。
- 叙事：模拟一个 "DeepSeek Harness OS"（开机自检 → 桌面 → 窗格 → 任务栏）。
- 实用：真实参数监控（CPU / 内存 / 负载 / 网络 / 磁盘 / 温度 / 进程 / DSH 会话与上下文压力）。
- 完成度对标 `appautomaton/delineate` 的 `characters/`（237 行 canvas 字符场：Perlin 场 → 阈值切割 →
  距离变换分环 → 字形图集），做到同等自洽与细节密度，但设计与实现独立。

## 方案

插件 `dsh-os`，两半：

### host 半（`src/index.ts` + `src/metrics.ts`）

- `inject: ['webServer']`，注册 `GET /plugins/dsh-os/metrics`，返回 JSON。
- 数据来源全部是本机真实读数：`/proc/stat`（每核 CPU，按两次采样差值算占用）、`/proc/meminfo`、
  `/proc/loadavg`、`/proc/uptime`、`/proc/net/dev`（wlan0 收发速率）、`statfs('/')`、`/sys/class/thermal`、
  `/proc` 目录计数、`process.memoryUsage()`、event loop lag。
- host 侧维护 60 点环形缓冲（cpu / mem / net），首次请求即可画出历史曲线，客户端无需预热。
- host 半**不 import 任何 `@deepseek-ai/*`**（含 type-only），避免 link 包的 ESM 解析坑。

### client 半（`src/client/`）

- `inject: ['slots', 'sessions', 'uiWorkspace', 'locale']`。
- 判定"首页"用 canonical 信号：`ctx.sessions.list.getSnapshot()` 中没有任何 row 的
  `retainedBy.mainView > 0`（与 dsh-zen 的 `resolveCurrentSessionId` 同源）。有会话时不渲染 OS 层。
- 三层渲染：
  1. **背景层**：`document.body` 里挂 `position: fixed; z-index: -1` 的 canvas；同时给 `<html>` 打
     `dsh-os-live` 类，注入 CSS 把 frame 背景改透明（`[data-slot="root"] > div` 为稳定锚点），
     让字符场成为"桌面壁纸"，侧边栏/输入框像浮在桌面上的窗口。
  2. **HUD 层**：`shell.overlay`（frame 级、click-through、可叠加）注册一个组件，渲染顶栏 / 左侧
     SYS 监控 / 右侧 HARNESS 监控 / 底部任务栏。
  3. **开机层**：首次加载（`sessionStorage`）播放自检序列，可点击/按键跳过，可手动重放。
- 字体：`ui-monospace, "JetBrains Mono", ...` 栈；CJK 回落 Noto Sans Mono CJK。不依赖外部字体下载。
- 偏好（开关背景场 / 重放开机 / 关闭 OS 层）存 `localStorage`；快捷键 `` ` `` 切换、`Esc` 跳过开机。

### 字符场引擎（`src/client/os/field/`）

自研，非抄袭：

- 3D Perlin + 时间演化 → 流场；多重等值线切割得到嵌套环；
- 单元格按到等值线的距离（Felzenszwalb 距离变换）选字形，字形取自密度梯度表
  （` .:-=+*#%@` 与块元素、盲文、片假名混合）；
- 颜色走 neon 渐变（青→洋红→琥珀），按环深与场强插值；Bayer 有序抖动保持复古质感；
- 附加层：字符雨列、网格底纹、扫描线、暗角、随机 glitch 带（RGB 偏移）、偶发"信号丢失"横条；
- 成本：12fps 场、字形图集预烘焙（每套调色一次）、`prefers-reduced-motion` 时静止一帧、
  页面不可见时停帧。

## 验收

1. `npm run build` 通过，`node --check lib/client.js` 通过。
2. 独立端口起 dsh（`dsh-e2e`，隔离 home），首页截图呈现 OS 界面；控制台无报错。
3. `curl /plugins/dsh-os/metrics` 返回真实读数（CPU 随负载变化、内存/网络合理）。
4. 进入会话后 OS 层淡出，会话页面布局不被破坏。
