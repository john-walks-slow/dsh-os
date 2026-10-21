# dsh-os 模块指令

## 模块定位

`dsh-os` 是面向 DeepSeek Harness Web GUI 的首页终端风格美化与参数监控插件。
在主视图没有选中活跃会话（即处于 blank-session hero 状态）时，将原本单调的白底界面替换为一台功能完整、充满 Lain / Cyberpunk 风格的终端操作系统桌面；当用户开始会话或选中已有会话时，桌面层自动安全淡出并恢复 DSH 默认界面。

## 目录结构

- `src/index.ts`：宿主服务入口，通过 `ctx.webServer` 注册指标端点。
- `src/procfs.ts`：读取 Linux `/proc` 与 `/sys` 虚拟文件系统底层的无依赖读取器。
- `src/metrics.ts`：CPU 时间片差值计算与 90 点历史环形缓冲区。
- `src/client/index.tsx`：浏览器插件入口，挂载 `shell.overlay` 与 `settings.section`。
- `src/client/field/`：Canvas 字符动效引擎（`rain` 稀疏字符雨、`dshchan` 3D 全息投影、`field` 等高线拓扑）；`chan-art.ts` 由 `tools/chan-art.py` 从立绘生成，勿手改。
- `src/client/os/`：HUD 桌面、顶栏、窗格（系统、核心、Token 账本、最近会话、控制台）、开机自检与设置面板。
- `src/client/settings.ts`：主题色派生与偏好状态存储。
- `src/client/styles.ts`：单文件注入样式表，包含全局扫描线、原生界面美化皮肤与设置面板排版。
- `e2e/smoke.mjs`：基于 `dsh-e2e` 的无头端到端冒烟验证脚本。

## 开发与构建规则

1. **宿主包依赖铁律**：宿主半边（`src/index.ts`、`src/procfs.ts`、`src/metrics.ts`）禁止直接引入任何 `@deepseek-ai/*` 运行时模块，仅依赖 Node.js 内置模块（`node:fs`、`node:os`、`node:perf_hooks` 等），以防通过 `link:` 接入用户 profile 时因缺少独立 `node_modules` 导致 ESM 解析失败并拖垮整个 DSH。
2. **构建一致性校验**：所有改动完成后必须执行 `npm run build`，构建脚本会通过 `node --check` 逐项验证 `lib/index.js` 和 `lib/client.js` 的语法闭合性。
3. **测试规范**：日常验证采用 `npm run e2e`（底层由 `dsh-e2e` 托管，动态分配独立端口与隔离 home），测试完成必须及时执行 `dsh-e2e stop` 释放槽位与内存。
4. **线上服务守护**：严禁未经用户明确书面同意重启线上 DSH 服务。
