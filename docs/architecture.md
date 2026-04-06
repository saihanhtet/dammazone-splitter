# Architecture

## Overview

The app is a **desktop shell** built with [Electrobun](https://electrobun.dev): a **Bun** main process hosts a **native webview** that loads the UI. The UI is **React** with **Tailwind**, bundled by **Vite** into static assets copied into the Electrobun `views/` tree at build time.

Responsibilities split as follows:

| Layer | Role |
|-------|------|
| **Renderer (React)** | File selection UX, drag-and-drop, settings, theme, display of analysis JSON, calls into main via RPC |
| **Main (Bun)** | File dialogs, temp files, Gemini calls (`@google/genai`), ffmpeg for export, config/history on disk |
| **Shared (`src/shared`)** | RPC result types, Zod schema for analysis output — imported by both sides for type safety |

## Process and webview

- **Main**: `src/bun/index.ts` creates a `BrowserWindow`, registers RPC, resolves the mainview URL.
- **Mainview URL**: In **dev** channel, if `http://localhost:5173` responds (Vite HMR), that URL is used; otherwise `views://mainview/index.html` (production bundle).
- **RPC**: `BrowserView.defineRPC` connects **bun → webview** requests and **webview → bun** messages (e.g. analysis stage updates).

## Frontend routing

Routing uses **React Router** with a **`HashRouter`** (`#/`, `#/saved`) so navigation works inside the Electrobun webview without server-side routes.

- `/` — main analysis UI (`HomePage`)
- `/saved` — exports / paths / shortcuts (`ExportsPage`)

## UI state

- **Theme**: `ThemeProvider` — light/dark, persisted (e.g. `localStorage`).
- **Settings**: `AppSettingsProvider` — Gemini API key and related UI state; key may mirror env or persisted config from main.

## Analysis pipeline (conceptual)

1. User selects caption file + MP3 (native picker or DnD → base64 → temp file on main).
2. Main reads caption bytes, **parses** to plain text (`parseCaptionFile`).
3. Main **auto-formats Myanmar captions** into labeled blocks (`Paragraph 1`, `Paragraph 2`, ...) using `src/shared/formatMyanmarParagraphs.ts` with shorter defaults for readability (`ideal=110`, `max=150`, `min=55` chars).
4. Main **uploads** MP3 via Gemini Files API, waits until file is **ACTIVE**.
5. Main calls **generateContent** with system instruction, user text (caption + metadata), and audio part; response must be **JSON** matching the model JSON schema.
6. Main **parses** and **Zod-validates** the array; on success, optional **history** append; UI shows segments.
7. Optional **export**: main runs **ffmpeg** per segment, writes `mp3/` + `output.csv` under Documents.

## Dependencies (runtime)

- **Electrobun** — window, webview, RPC, OS paths, dialogs, `openPath`, `showItemInFolder`.
- **@google/genai** — Gemini client, file upload, structured JSON output.
- **ffmpeg** — external binary on `PATH`; used only for export, not bundled.
