# 移动端完整 HUD 与 Windows 宿主校验 · 实施总结

## 完成内容

### 移动端

- 首页窄屏新增底部 HUD 抽屉：`SYS / WS / SESS / LEDGER` 四个页签复用桌面窗格，底部提供 `WS/ALL`、`SYS/DARK/LIGHT`、`BOOT`、`SETTINGS`。压缩状态条与任务栏 `HUD` chip 均可打开，点遮罩、`Esc` 或关闭按钮退出。
- 顶栏在 412px 与 320px 级别不再互相压字；极窄屏隐藏时钟与会话计数、保留 CPU / MEM / TOK。
- 任务栏 chip 最小触控高度 22px，抽屉页签与底部操作 26–30px；账本窄屏收起 TPS / 占比两列。
- 会话遥测条窄屏加高到 24px，收起 workspace 与 in/out/cache/tps 明细，保留模型、压力计与年龄；明细卡改为两列网格，展开按钮 24×20，卡片与底部操作不横向溢出。

### Windows

- 工作区比较统一分隔符、尾斜杠与 Windows 盘符大小写，`C:\a\b` 与 `C:/A/B` 命中同一份账本。
- CPU 型号兜底不再输出 ARM64 占位串；Windows 上 `os.cpus()` 无型号时读 `PROCESSOR_IDENTIFIER`。
- 磁盘读不到时 `cap.disk=false`，SYS 面板整行不画；Boot 的挂载点、网络行与 FPS 改成真实值。
- 设置入口改为按 `_settingsArea` 查找，兼容折叠成图标的侧边栏。

## 验证

| 项 | 结果 |
| --- | --- |
| `npm run typecheck` / `npm run build` | 通过 |
| `npm run test:host`（Linux） | 通过 |
| GitHub Actions [host · windows-latest](https://github.com/john-walks-slow/dsh-os/actions/runs/41205451554) | 通过（15 项断言，win32 x64） |
| `npm run e2e`（1440 / 1280 / 1100 / 412） | 通过，61 条断言 |
| `npm run e2e:session`（1440 + 412） | 通过，20 条断言 |

## 相关文件

- 宿主：`src/harness.ts`、`src/procfs.ts`、`src/metrics.ts`
- 移动端：`src/client/os/Desktop.tsx`、`src/client/os/panels.tsx`、`src/client/skin/strip.tsx`、`src/client/styles.ts`
- 测试：`e2e/host.mjs`、`e2e/smoke.mjs`、`e2e/session.mjs`、`.github/workflows/host.yml`

## 验证备注

当前 DSH 0.2.1-rc.3 不再接受 `DSH_TOKEN=e2etest`，而 `dsh-e2e run` 仍按固定 token 注入，导致实例返回 401。本轮 GUI 验证改为从 `.dsh-e2e-home/instance.log` 读取启动 URL 里的 launch token，手动注入 `DSH_E2E_TOKEN` 后执行脚本；`dsh-e2e` 本身的修复不在本需求范围内。
