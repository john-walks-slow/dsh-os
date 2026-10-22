# dsh-os

DeepSeek Harness OS: turn the DSH Web home page into a cyberpunk terminal desktop — animated ASCII background patterns, boot self-test, live system & Harness telemetry HUD, and native UI skinning.

**English** · [中文](README.md)

---

## Visual Showcase

| Default DSH Blue · Clean Rain | 3D Rotating DSH-chan Hologram |
| :---: | :---: |
| ![Rain Pattern](<screenshots/home-rain.png>) | ![DSH Chan](<screenshots/home-dshchan.png>) |

| Contour Field Topology | Integrated Settings Panel |
| :---: | :---: |
| ![Field Pattern](<screenshots/home-field.png>) | ![Settings Panel](<screenshots/settings.png>) |

| Boot POST Sequence | Mobile Responsive Layout |
| :---: | :---: |
| ![Boot Sequence](<screenshots/boot.png>) | ![Mobile View](<screenshots/home-mobile.png>) |

---

## Key Features

1. **Host & System Telemetry (SYS · MONITOR)**
   - **CPU Core Grid**: Real-time total usage, per-core meter bars (C0~C7), frequency, and temperature.
   - **Memory & Storage**: Physical RAM ratio, Swap usage, and Root (`/`) disk capacity.
   - **Network Throughput**: Automatic network interface detection (e.g. `wlan0`), instantaneous RX/TX rate in KB/s with a miniature sparkline history.
   - **Hardware Status**: 1/5/15m Loadavg, battery percentage, charging state, and temperature.

2. **Harness Telemetry & Token Ledger (HARNESS · CORE & TOKEN · LEDGER)**
   - **Session & Preset Status**: Active session counts, running agents, current workspace path, and selected agent preset.
   - **Context Window Pressure**: Live context usage ratio, prompt tokens, reasoning, and cache metrics.
   - **Multi-session Token Ledger**: Summarized token consumption across sessions, cache hit ratios, and decode tokens-per-second (TPS).
   - **Node.js Runtime Metrics**: DSH PID, RSS footprint, heap allocation, and event loop lag.

3. **Three ASCII Background Engines**
   - **Sparse Character Rain (`rain`, Default)**: Lain-inspired minimalist vertical rain with subtle falling tails and background grid. Clean and calm.
   - **3D Rotating DSH-chan (`dsh-chan`)**: The whale-girl artwork sampled into a 42×75 ASCII bitmap, split into depth layers and spun around the Y axis with perspective, parallax, a projector pedestal and a floor reflection.
   - **Contour Field Topology (`field`)**: Multi-level contour topology using 3D Perlin noise and Bayer dithering. Vibrant and cybernetic.
   - **Dynamic Radial Dimming**: Smoothly attenuates ASCII intensity behind the headline and input bar to guarantee text legibility.

4. **Native UI Beautification (Sidebar & Composer)**
   - Seamlessly activates a customized dark mode on the home screen.
   - **Sidebar Styling**: The sidebar becomes a terminal rail — deep-blue gradient, CRT scanlines, a ticked guide rail, monospace type, `> WORKSPACES` group labels and an outlined NEW SESSION button.
   - **Hero headline removed**: the native "Into the Unknown" headline, fish mark and preview badge are hidden on the home screen.
   - **Composer Styling**: Terminal-window container with subtle ambient glow and focused border highlighting.

5. **Controls & Shortcuts**
   - Press `` ` `` (backquote / tilde) to toggle the OS desktop overlay at any time.
   - Press `Esc` or click anywhere to skip the boot self-test sequence.
   - Quick taskbar chips to toggle the background field, replay boot, or open the settings dialog.

---

## Install

One command, no clone needed:

```bash
dsh plugin --profile web add github:john-walks-slow/dsh-os
```

Replace `web` with your profile name. It adds the dependency, appends the package to `dsh.profile.bundles`, and resolves `cordis.patch.yml`; restart DSH to load it.

Uninstall:

```bash
dsh plugin --profile web remove dsh-os
```

Pin a commit or tag with `add github:john-walks-slow/dsh-os#v0.1.2`.

### From source

```bash
git clone https://github.com/john-walks-slow/dsh-os.git
cd dsh-os && npm install && npm run build
```

Then point the profile dependency at `"dsh-os": "link:/absolute/path/to/dsh-os"`, add it to `bundles`, and restart.

### Platform support

| Metric | Linux | Windows / macOS |
| --- | --- | --- |
| CPU total / per core | `/proc/stat` (incl. iowait, steal) | `node:os` (no iowait/steal) |
| CPU freq, temperature, battery | `/sys` | — |
| Memory / swap | `/proc/meminfo` | memory yes, swap no |
| Disk usage | ✅ | ✅ system drive |
| Network throughput | `/proc/net/dev` | — |
| Process table / load | ✅ | — |

Rows without data are simply hidden, and the SYS panel shows `MODE portable · node:os`. On Windows the `link:` path accepts forward slashes, e.g. `"dsh-os": "link:C:/Users/you/dsh-os"`.

### Data & permissions

- Reads `/proc`, `/sys` and `statfs` locally for telemetry; nothing leaves the machine.
- Preferences live in `localStorage` under `dsh-os:settings`.
- No session data or DSH config is modified; the desktop layer and skins unmount as soon as you leave the home screen.

## License

[MIT](LICENSE)
