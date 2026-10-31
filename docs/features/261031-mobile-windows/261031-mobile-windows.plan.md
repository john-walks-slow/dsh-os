# 移动端完整 HUD 与 Windows 宿主校验 · 计划

## 背景

dsh-os 的实际使用环境是用户自己的 Windows 宿主 DSH 与手机浏览器。此前首页在窄屏（< 780px）只保留两条压缩状态，四块窗格、模型账本、口径/明暗/自检入口全部消失；Windows 半边虽然已有 `node:os` 兜底，但路径比较、CPU 型号与磁盘能力位仍有真机风险。

## 目标

1. **Windows 真的可用**：宿主端点在无 `/proc`、`/sys` 的平台上仍给出真实 CPU / 内存 / 磁盘读数，能力位与界面隐藏逻辑一致；同一工作区的 `C:\a\b`、`C:/A/B` 与尾斜杠形式必须命中同一份账本。
2. **移动端功能完整**：窄屏也能访问 SYS / WS / SESS / LEDGER 四块窗格、账本时间窗、WS/ALL 口径、明暗切换、开机自检与设置入口；触控目标与明细卡不得溢出。

## 方案

### 宿主半边

- `harness.ts` 引入 `workspaceKey`（统一分隔符、去尾斜杠、Windows 折叠大小写）与 `workspaceName`（显示名），快照按归一化键过滤。
- `procfs.ts` 的 CPU 型号在 `os.cpus()` 给不出型号时使用 `PROCESSOR_IDENTIFIER`，最后才退到 `${arch} ${cores}-core`，不再硬编码 ARM64。
- `readDisk` 对非法容量返回 null；`metrics.ts` 用实际可读性填写 `cap.disk`，界面不再显示 `0/0` 的假磁盘行。
- `Boot` 的挂载点、网络行与 FPS 改为真实读数。

### 浏览器半边

- `Desktop.tsx` 在 `dense` 布局下增加底部抽屉：四个页签复用桌面窗格组件（inline 样式），底部固定 WS/ALL、SYS/DARK/LIGHT、BOOT 与 SETTINGS；顶部压缩条与任务栏 HUD chip 都能打开抽屉。
- 窄屏顶栏改用更小的左右边距，极窄屏隐藏时钟与会话计数，避免文字互相压住。
- 账本在窄屏收起 TPS / share 两列，保留 model / sess / input / output / cache。
- 遥测条在窄屏收起 workspace 与明细字段，保留模型、压力计、百分比、年龄；明细卡改为两列网格、底部操作可换行，条子加高到 24px 并放大展开按钮。
- `openHostSettings` 改为优先点击 `_settingsArea` 内的按钮，兼容折叠成图标的侧边栏。

### 验证

- 新增 `e2e/host.mjs`：直接加载 `lib/index.js`，用临时 DSH_HOME 播种 Windows 风格路径夹具，断言两个端点。
- 新增 `.github/workflows/host.yml`：Ubuntu + `windows-latest` 矩阵跑 `npm ci && npm run build && node e2e/host.mjs`，Windows runner 就是真机平台证据。
- 扩展现有 Playwright e2e：412×915 下断言顶栏不压字、HUD 四页签/账本/口径/明暗/设置入口、遥测条与明细卡无横向溢出。
