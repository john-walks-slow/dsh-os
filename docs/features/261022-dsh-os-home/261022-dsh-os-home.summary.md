# dsh-os 特性实施总结

日期：2026-10-22
状态：已完成验收（worktree 隔离实例端到端验证）

## 交付清单

1. **宿主指标探针与轻量服务**
   - [`src/procfs.ts`](src/procfs.ts)：无外部依赖解析 Linux `/proc/stat`（分核与全核时间片差值计算）、`/proc/meminfo`、`/proc/net/dev`、`statfs`、`/sys/class/thermal` 与 `/proc` 进程统计。
   - [`src/metrics.ts`](src/metrics.ts)：2秒定时间隔差值采样器，维护 90 点历史环形缓冲区，生成即时快照。
   - [`src/index.ts`](src/index.ts)：宿主服务，暴露 `GET /plugins/dsh-os/metrics` 端点。无 `@deepseek-ai/*` 运行时依赖，防范 ESM 解析崩溃。

2. **双字符动效引擎**
   - [`src/client/field/engine.ts`](src/client/field/engine.ts)：
     - **rain（字符雨，默认推荐）**：Lain 极简风格，长尾渐隐、点阵底纸，解决原拓扑场过度迷幻问题。
     - **field（等高线拓扑场）**：多层 3D Perlin 标量场等值线切割与 Bayer 有序抖动着色。
     - **hero 径向椭圆避让**：以输入框中心向外做径向衰减，确保文字对比度。

3. **DSH 娘 3D 全息投影背景**
   - [`tools/chan-art.py`](tools/chan-art.py) 把立绘（泛洪抠掉外部白底）采样成 42×75 的 ASCII 位图，输出 [`src/client/field/chan-art.ts`](src/client/field/chan-art.ts)：每格带字形、亮度与材质。
   - 渲染时按材质给每格一个 z 高度，绕 Y 轴缓慢自转 + 轻微俯仰，透视投影后做逐格深度缓冲，因此旋转时前后层有真实视差；配合投影台、倒影、上升数据尘与侧身扫描光带。
   - 该模式自动隐藏顶部 Token 账本，给人物让出空间。

4. **桌面与终端 HUD**
   - [`src/client/os/Desktop.tsx`](src/client/os/Desktop.tsx)：顶栏系统标记与时钟、左侧系统窗格（SYS）、右侧核心监控（HARNESS）、顶部中央 Token 账本（LEDGER）、底部控制台（CONSOLE）与任务栏。支持宽屏与移动端高密度自适应。
   - [`src/client/os/Boot.tsx`](src/client/os/Boot.tsx)：真实宿主参数驱动的 POST 开机自检序列。
   - [`src/client/os/panels.tsx`](src/client/os/panels.tsx)：分核 CPU/内存/SWAP/磁盘/网络速率折线图、上下文压力、Token 账本（输入/输出/缓存/TPS统计）。

5. **原生界面美化与设置系统**
   - [`src/client/styles.ts`](src/client/styles.ts)：统一深色接管、主视图打透（`dos-paint-through`）、侧边栏美化（`dsh-os-skin-sidebar`）、输入框美化（`dsh-os-skin-composer`）。
   - [`src/client/settings.ts`](src/client/settings.ts)：偏好存储（localStorage）、5套主题预设（DSH蓝默认、青色、洋红、琥珀、单色）与自定义色、色相变量派生。
   - [`src/client/os/settings-panel.tsx`](src/client/os/settings-panel.tsx)：注册在 `settings.section` 的标准原生设置面板。

6. **侧边栏终端化**
   - 统一深蓝渐变底 + CRT 扫描线 + 左侧刻度导轨 + 等宽字体 + `> WORKSPACES` 分组标签 + 描边 NEW SESSION 按钮；同时覆盖宿主主题的 `--dsw-specific-sidebar-fill` 变量，消除原来的灰色块。

7. **验证产物与截图**
   - 完整冒烟用例：[`e2e/smoke.mjs`](e2e/smoke.mjs)
   - 官方多尺寸截图：
     - [`screenshots/home-rain.png`](screenshots/home-rain.png)
     - [`screenshots/home-dshchan.png`](screenshots/home-dshchan.png)
     - [`screenshots/home-field.png`](screenshots/home-field.png)
     - [`screenshots/home-mobile.png`](screenshots/home-mobile.png)
     - [`screenshots/boot.png`](screenshots/boot.png)
     - [`screenshots/settings.png`](screenshots/settings.png)
