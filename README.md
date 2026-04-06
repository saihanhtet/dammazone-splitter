# MP3 + Caption Analyzer (Electrobun)

Desktop app built with **Electrobun**, **React**, **Tailwind**, and **Vite**, based on the upstream [`react-tailwind-vite`](https://github.com/blackboardsh/electrobun/tree/main/templates/react-tailwind-vite) template (using the **npm** `electrobun` package, not the monorepo `file:` dependency).

The app takes **one caption file** (`.txt`, `.srt`, `.vtt`, or `.json`) and **one MP3**, sends them to **Gemini** via `@google/genai` (audio uploaded with the Files API; caption text extracted locally), and returns **strict JSON** validated with **Zod** to match this shape:

```json
[
  {
    "start": "mm:ss",
    "end": "mm:ss",
    "section": "string",
    "text": "string with line breaks",
    "pause": "0.0s"
  }
]
```

## Prerequisites

- [Bun](https://bun.sh) (used to install dependencies and run the Bun main process)
- A [Gemini API key](https://aistudio.google.com/apikey)
- **[ffmpeg](https://ffmpeg.org)** installed and available on your `PATH` (required for **Export split MP3 + CSV**)
- OS support per [Electrobun](https://electrobun.dev) (macOS / Windows / Linux as documented there)

## Setup

```bash
bun install
```

Copy environment variables (optional):

```bash
cp .env.example .env
# Edit .env and set GEMINI_API_KEY=...
```

API key resolution order:

1. `GEMINI_API_KEY` or `GOOGLE_API_KEY` in the environment when the app starts  
2. Key saved in **Settings** (written to the app user data directory — **not** encrypted; suitable for local dev only)

## Run (development)

Build the webview once, then start Electrobun:

```bash
bun run start
```

Or watch mode (rebuilds native side on changes; still run Vite when you change UI):

```bash
bun run dev
```

**Hot module reload** (Vite on port 5173 + app):

```bash
bun run dev:hmr
```

## Build (production)

```bash
bun run build
```

This runs `vite build` then `electrobun build --env=canary`. Electrobun only creates a **`.dmg`** for **canary** or **stable** builds; the default `electrobun build` (no `--env`) is **dev** and produces an `.app` under `build/` but **no** DMG.

After a successful build, look under **`artifacts/`** for a name like **`canary-macos-arm64-<AppName>.dmg`** (exact prefix depends on CPU and `buildEnvironment`).

For a faster dev-style bundle without a DMG:

```bash
bun run build:dev
```

## Export split audio + CSV

After a successful **Analyze**, use **Export split MP3 + CSV**. The app:

1. Sorts JSON segments by `start` time.
2. Cuts the source MP3 with **ffmpeg** (`stream copy`, then **libmp3lame** fallback if needed).
3. Writes under your **Documents** folder:

   `Documents/Mp3SplitterOutput/<folder>/mp3/001.mp3`, `002.mp3`, …  

   Each export gets a **unique folder name**: local **date**, **time** (hours, minutes, seconds), **milliseconds**, and a short **random hex** suffix (e.g. `2026-04-06_143052_847_a3f4e2b1`). If that path already exists, a numeric suffix is added (`_2`, …).

4. Writes **`output.csv`** in the same dated folder with two columns, **`caption`** and **`mp3`**, one row per segment. The `caption` column is the segment `text` from JSON; `mp3` is the relative path (e.g. `mp3/001.mp3`). The file is UTF-8 with a BOM for Excel.

The dated folder is opened in the system file manager when export finishes.

## Project layout

| Area | Path |
|------|------|
| Bun main process + RPC | [`src/bun/index.ts`](src/bun/index.ts) |
| MP3 split + CSV export | [`src/bun/services/audioSplitter.ts`](src/bun/services/audioSplitter.ts) |
| Gemini client | [`src/bun/services/geminiClient.ts`](src/bun/services/geminiClient.ts) |
| Caption parsers | [`src/bun/parsers/caption.ts`](src/bun/parsers/caption.ts) |
| API key persistence | [`src/bun/services/configStore.ts`](src/bun/services/configStore.ts) |
| Optional history (JSONL) | [`src/bun/services/historyStore.ts`](src/bun/services/historyStore.ts) + `analysis-history.jsonl` under user data |
| Zod schema | [`src/shared/schema/analysisOutput.ts`](src/shared/schema/analysisOutput.ts) |
| React UI | [`src/mainview/`](src/mainview/) (routes + light/dark theme) |

Navigation uses **React Router** with a **hash router** (`#/`, `#/saved`) so routing works reliably in the Electrobun webview. **Settings** includes **Light** / **Dark** (stored in `localStorage`) and the Gemini API key. The **Saved / exports** page lists paths and opens **Documents**, **Mp3SplitterOutput** (split MP3 + CSV), and **Downloads** in the system file manager.

Default Gemini model: **`gemini-2.5-flash`**. The SDK uses the **default AI Studio API version (`v1beta`)** unless you set `GEMINI_API_VERSION`. Override the model with **`GEMINI_MODEL`** if needed.

## Documentation

Technical documentation (architecture, RPC, Gemini, export, build, configuration) lives in **[`docs/`](docs/README.md)**.

### Troubleshooting: `404 Not Found` / `GEMINI_ERROR`

Usually means the **HTTP URL for the model or method does not exist** for the API version in use. This app previously forced **`v1`**, which often returns **404** for the same model names that work on **`v1beta`**. The client now uses the SDK default (**`v1beta`**) for AI Studio keys.

If you still see 404: confirm the key is from [Google AI Studio](https://aistudio.google.com/apikey), try **`GEMINI_MODEL=gemini-2.0-flash`**, and avoid setting `GEMINI_API_VERSION=v1` unless Google’s docs say your feature requires it.

## Notes

- **Drag-and-drop** encodes files as base64 in the renderer; very large MP3s may be slow or hit RPC limits. Prefer **Choose MP3** (native file dialog) for big files so the main process reads paths directly.
- **Save JSON** writes into your **Downloads** folder and reveals the file in the system file manager (Electrobun does not expose a native “save as” dialog in the current API).
- Analysis summaries are appended to `analysis-history.jsonl` in app user data after each successful run.
- **Open folder** uses Electrobun `Utils.openPath` on macOS / Windows / Linux; if nothing happens, check OS permissions.

## Typecheck

```bash
bun run typecheck
```
