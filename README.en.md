# dsh-os

DeepSeek Harness OS: a theme that covers the **entire** DSH Web GUI — session stream, sidebar, code blocks, tool cards, dialogs, menus, composer and settings page all change ink together, in both light and dark; the home screen (the blank-session hero) goes further and becomes a cyberpunk terminal desktop with real telemetry. While you work it stays quiet and reports context pressure, usage and decode speed through a single session telemetry strip; when you stop it brings out the character rain, the boot self-test, the full host HUD and a **per-model token ledger**.

Reskinning goes through DSH's official theme token overlay (`ctx.theme.overrideTokens`) rather than CSS smeared over someone else's DOM — so it follows the host's light/dark mode, and upgrades don't turn into fights.

**English** · [中文](README.md)

---

## Visual Showcase

| Session (dark): theme + telemetry strip | Session (light): detail card and context breakdown |
| :---: | :---: |
| ![Session Dark](<screenshots/session-dark.png>) | ![Session Light](<screenshots/session-light.png>) |

| Host Native Settings (dark) | Host Native Settings (light) |
| :---: | :---: |
| ![Native Settings Dark](<screenshots/settings-native-dark.png>) | ![Native Settings Light](<screenshots/settings-native-light.png>) |

| Home · Sparse Rain (dark) | Home · Paper Blueprint (light) |
| :---: | :---: |
| ![Rain Pattern](<screenshots/home-rain.png>) | ![Light Tone](<screenshots/home-light.png>) |

| 3D Rotating DSH-chan Hologram | Contour Field Topology (psychedelic mode) |
| :---: | :---: |
| ![DSH Chan](<screenshots/home-dshchan.png>) | ![Field Pattern](<screenshots/home-field.png>) |

| Boot POST Sequence | Mobile Responsive Layout |
| :---: | :---: |
| ![Boot Sequence](<screenshots/boot.png>) | ![Mobile View](<screenshots/home-mobile.png>) |

| Integrated Settings Panel |
| :---: |
| ![Settings Panel](<screenshots/settings.png>) |

---

## Key Features

1. **Whole-GUI Theme**
   - Rewrites 150+ tokens through the official token overlay — `--dsw-alias-*` / `--dsw-specific-*` / radii / heights / shiki syntax highlighting: the session stream, sidebar, code blocks, tool cards, diffs, dialogs, menus, scrollbars, composer and settings page all **change ink together**.
   - Light and dark are decided by the host theme (follow the system / follow the host) and never hijack your preference: dark is night-flight terminal glass, light is blueprint paper.
   - Accent colour is a single source that applies app-wide (taskbar chips, the settings page, or `SYS / DARK / LIGHT` in the session telemetry strip); the host's native settings window, menus, toasts and tooltips sit under the same tokens.
   - Only colours, fonts, letter spacing and radii change — **layout is untouched**: the sidebar's and session stream's sizing and interaction contracts stay exactly as they are, so official upgrades rarely break the look.

2. **Session Telemetry Strip**
   - A 21px status band at the top of the session view: model, context pressure gauge (percentage plus used/window), this session's input / output / cache hits, decode speed and age.
   - Click the arrow to expand details: context breakdown (how much goes to system / tools / messages), cache reads and writes, decode time and the session id; expanding **yields that height from the top** of the session stream (the bottom edge stays put), so the body text is never squeezed. Click anywhere else or scroll to collapse; `Esc` works too.
   - The numbers are **right now**: real readings projected by the host when the session opens (`tokenUsage` / `contextPressure` / `contextBreakdown` / `sessionStats`), not estimates.

3. **Host Monitor (SYS · MONITOR)**
   - **CPU**: total usage, per-core meters (C0~C7), frequency and temperature.
   - **Memory & Storage**: RAM, Swap, root filesystem usage.
   - **Network**: auto-detected primary interface (e.g. `wlan0`), live RX/TX rates plus a sparkline you can **hover to read any sample**.
   - **Load & uptime**: 1/5/15m loadavg, uptime, battery level and temperature.
   - Panels decide which rows to draw from the height they actually got — a row is never silently clipped.

4. **Workspace Overview (WORKSPACE · OVERVIEW)**
   - Workspace name, session count, 7-day activity, **sessions running right now and subagents in flight**.
   - Today's fresh tokens split from cache re-reads, plus cache hit ratio, last activity and top model.
   - One compact Node runtime line (RSS / event-loop lag / process count).

5. **Recent Sessions (SESSIONS · RECENT)**
   - Sorted by recency with model, tokens and age; **click a row to jump back into that session**.
   - Blank and subagent sessions are excluded — no ghost rows.

6. **Model Ledger (MODEL · LEDGER)**
   - Token usage aggregated **per model**: sessions, input, output, cache hit ratio, decode TPS and share.
   - Data comes from DSH's own session projection cache (`storages/session_projcache`), so it covers **every session ever recorded** — not just the ones currently open. It therefore shows real numbers on the home screen (where nothing is running), and it works the same on Linux, Windows and macOS.
   - `24H / 7D / ALL` time windows and a `WS / ALL` scope switch; **click a row to reopen the last session that used that model**.

7. **Three ASCII Background Engines**
   - **Sparse Rain (`rain`, default)**: Lain-style vertical rain with long fading tails and a dot-matrix base.
   - **3D Rotating DSH-chan (`dsh-chan`)**: the whale-girl artwork sampled into a 42×75 ASCII bitmap, split into depth layers and spun around the Y axis — parallax, perspective, pedestal and floor reflection.
   - **Contour Field Topology (`field`)**: multi-level contours cut from 3D Perlin noise, distance-adaptive glyphs and Bayer dithering.
   - The composer area gets a computed elliptical dimming mask so input text always stays legible.

8. **Light & Dark Ink**
   - **Follow the host** (default): switch the host theme and the desktop follows — the overlay never forces a palette onto the host UI the way early versions did.
   - Dark is a neon terminal; light is paper/blueprint. Same panels and monospace vocabulary, two sets of ink.
   - Switch from the `SYS / DARK / LIGHT` taskbar chips or the settings page; clicking a chip also updates the host theme preference.

9. **Native UI Beautification**
   - **Hero headline removed**: the "Into the Unknown" headline, fish mark and preview badge are hidden on the home screen; workspace picker and composer stay.
   - **Composer skin**: same base as the desktop, accent border, focus glow.

10. **Controls**
    - Press `` ` `` (backquote / tilde) to toggle the whole OS desktop layer.
    - Switch `SYS / DARK / LIGHT` from the telemetry card while inside a session — you don't have to go back home to change ink.
    - Press `Esc` or click anywhere to skip the boot self-test.
    - Taskbar: `FIELD` background toggle, `BOOT` replay, `WS/ALL` scope, `SYS/DARK/LIGHT` ink, `SETTINGS`; the ticker on the right streams real events (CPU saturation, memory pressure, network bursts, sessions starting and stopping).

---

## Install

One command, no clone needed:

```bash
dsh plugin --profile web add github:john-walks-slow/dsh-os
```

Replace `web` with your own profile name. This adds the package, writes it into `dsh.profile.bundles` and resolves `cordis.patch.yml`; restart DSH to take effect.

Uninstall:

```bash
dsh plugin --profile web remove dsh-os
```

Pin a version/tag: `add github:john-walks-slow/dsh-os#v0.3.0`.

### From source

```bash
git clone https://github.com/john-walks-slow/dsh-os.git
cd dsh-os && npm install && npm run build
```

Then point your profile's `package.json` at `"dsh-os": "link:/absolute/path/dsh-os"`, add it to `bundles`, and restart.

### Platform support

| Metric | Linux | Windows / macOS |
| --- | --- | --- |
| CPU total · per-core | `/proc/stat` (incl. iowait / steal) | `node:os` (no iowait / steal) |
| CPU frequency · temperature · battery | `/sys` | — |
| Memory · Swap | `/proc/meminfo` | memory only; no swap |
| Disk usage | ✅ | ✅ system drive |
| Network rates | `/proc/net/dev` | — |
| Process table · load | ✅ | — |
| Model ledger (projection cache) | ✅ | ✅ |

Rows that a platform cannot provide are hidden entirely (the SYS panel tags the ARCH row with `node:os`) instead of showing a column of `--`. On Windows, `link:` paths accept forward slashes, e.g. `"dsh-os": "link:C:/Users/you/dsh-os"`.

### Data & permissions

- **Read-only** access to `/proc`, `/sys` and `statfs` for host metrics, plus **read-only** access to DSH's own session projection cache (`<DSH_HOME>/storages/session_projcache`) for the ledger. Everything stays on the machine; nothing is sent anywhere.
- Ledger time windows bucket sessions by their last activity (projections are aggregated per session, not per turn), so they are an approximation.
- Preferences live in browser `localStorage` (key `dsh-os:settings`).
- No session data is written and no DSH configuration is modified; leaving the home screen tears the desktop layer and the skin down.

## Architecture

- **Dependency-free host plugin**: the host half (`src/index.ts` + `src/procfs.ts` + `src/metrics.ts` + `src/harness.ts`) imports Node built-ins only — never `@deepseek-ai/*` at runtime — which avoids the ESM resolution crash that `link:` installs can trigger.
- **Two read-only endpoints**:
  - `GET /plugins/dsh-os/metrics` — host telemetry snapshot (90-point ring buffer).
  - `GET /plugins/dsh-os/harness?ws=<cwd>` — sessions and token ledger. The host indexes 3400+ projection checkpoints into memory (first pass batched at 200 files per frame, then incremental by mtime/size every 15s); requests only aggregate in memory.
- **Two skin halves, one colour source** (`src/client/skin/`):
  - `palette.ts` spreads out the light and dark inks and feeds both the official token overlay (whole app) and dsh-os's own `--dos-*` variables (HUD / glyph field / telemetry strip); changing the accent colour happens in this one place.
  - The overlay goes through `ctx.theme.overrideTokens('dsh-os', { token: { light, dark } })`: the host picks values for the current colour scheme, so "following light/dark" is free and uninstalling restores everything automatically.
  - `styles.ts` only fills what tokens can't reach: selection, scrollbars, chrome typography, official hard-coded light text in popovers, and dsh-os's own components.
- **Non-invasive client mount**:
  - HUD registers into `shell.overlay` (frame-level click-through slot); geometry is derived from measured center-column and hero rectangles.
  - `isHome(snapshot)` detects the blank-session home screen; once a session starts the desktop layer leaves and only the telemetry strip remains.
  - Ink reads the host `ctx.theme` (falling back to `body[data-ds-dark-theme]` + `prefers-color-scheme`) and only publishes its own `data-dos-tone` on `html`.
  - Settings register into the standard `settings.section` slot.

### Development

```bash
npm run build          # build lib/index.js and lib/client.js
npm run typecheck      # tsc --noEmit
npm run e2e            # isolated dsh-e2e instance + headless smoke test (seeds fixtures)
npm run e2e:session    # session view checks: real telemetry readings, detail card not squeezing the body, in-card ink change
npm run e2e:shots      # regenerate the official screenshots in screenshots/
```

The two session screenshots need a session with actual content. DSH only enumerates workspace sessions at startup, so the order is:

```bash
node e2e/seed-conversation.mjs    # copy real local session logs into the isolated home (skipped if there is no history)
dsh-e2e stop && dsh-e2e start --wait-ready
dsh-e2e run e2e/shots.mjs
```

Design iteration without booting DSH:

```bash
npx esbuild tools/preview.tsx --bundle --format=iife --jsx=automatic \
  --define:process.env.NODE_ENV='"production"' --outfile=tools/preview.js
```

then open `tools/preview.html?pattern=rain&tone=light` (`?settings=1` renders the settings page, `?win=1` simulates a platform without `/proc`).

---

## License

[MIT](LICENSE)
