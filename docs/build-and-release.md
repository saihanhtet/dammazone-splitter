# Build and release

## Scripts (`package.json`)

| Script | Command | Purpose |
|--------|---------|---------|
| `start` | `vite build && electrobun dev` | One Vite build, then Electrobun dev |
| `dev` | `electrobun dev --watch` | Native/main process watch |
| `dev:hmr` | Concurrent Vite (5173) + `start` | HMR for UI |
| `build` | `vite build && electrobun build --env=canary` | Production UI + **canary** Electrobun bundle (DMG on macOS) |
| `build:dev` | `vite build && electrobun build` | **Dev** Electrobun env — `.app` under `build/`, **no DMG** |
| `typecheck` | `tsc --noEmit` | Typecheck only |

## Vite

- **Root**: `src/mainview`
- **Output**: `dist/` (see `vite.config.ts`)
- **Alias**: `@shared` → `src/shared`

## Electrobun

- **Config**: `electrobun.config.ts`
- **Copy**: `dist/index.html` → `views/mainview/index.html`, `dist/assets` → `views/mainview/assets`
- **`bundleCEF: false`** on macOS/Linux/Windows (template default)
- **`release.generatePatch: false`** — skips delta patch generation for local builds (no `release.baseUrl`)

## DMG and artifacts

Electrobun produces a **`.dmg`** only when **`--env=canary`** or **`--env=stable`**. The default **`electrobun build`** (no `--env`) uses **`dev`** and does **not** create a DMG.

After **`bun run build`**, check **`artifacts/`** for files such as:

- `canary-macos-arm64-<AppName>-canary.dmg`
- Matching `.tar.zst` and `update.json`

Exact names depend on CPU architecture and app naming from `electrobun.config.ts` (`app.name`, version, channel).

## Codesign / notarization

Local builds typically log **skipping codesign** / **skipping notarization**. Production signing is configured outside this repo (Apple Developer, CI secrets).
