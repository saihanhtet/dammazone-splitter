# Configuration

## Environment variables

| Variable | Purpose |
|----------|---------|
| **`GEMINI_API_KEY`** | Primary API key for Gemini (read at process start) |
| **`GOOGLE_API_KEY`** | Alternate name; same resolution as `GEMINI_API_KEY` |
| **`GEMINI_MODEL`** | Override model (default `gemini-2.5-flash`) |
| **`GEMINI_API_VERSION`** | Optional; if unset, SDK default (**`v1beta`**) is used for AI Studio |

Copy **`.env.example`** to **`.env`** for local development. Electrobun/Bun loads env according to your runtime setup.

## API key resolution order

1. **`GEMINI_API_KEY`** or **`GOOGLE_API_KEY`** in the environment when the app starts  
2. Key stored in **Settings** → written to **`config.json`** under app user data (**not** encrypted; suitable for local/dev only)

Implementation: `resolveApiKey` in `src/bun/services/configStore.ts`.

## `config.json`

- **Path**: `join(Utils.paths.userData, "config.json")`
- **Shape**: `{ geminiApiKey?: string | null }`
- **Written** when the user saves a key from Settings (`setApiKey` RPC).

## User data paths (Electrobun)

The main process uses **`Utils.paths`** for:

- `userData` — config + `analysis-history.jsonl`
- `temp` — DnD/base64 staging (`mp3-spliter-ai/` subfolder)
- `documents`, `downloads` — export targets and folder shortcuts

Exact OS paths follow Electrobun’s conventions for each platform.

## Security notes

- **API keys in Settings** are stored in plain JSON on disk.
- **Drag-and-drop** sends base64 through RPC; very large files can be slow or hit practical limits — prefer **native file pick** for large MP3s so the main process reads paths directly.

## UI preferences

- **Theme** (light/dark): stored in the renderer (e.g. `localStorage`), not in `config.json`.
- **Router**: hash-based (`#/`), no server routing.
