# Export, captions, and files

## Caption parsing

Module: `src/bun/parsers/caption.ts`

Supported extensions: **`.txt`**, **`.srt`**, **`.vtt`**, **`.json`**.

- **SRT / VTT**: Cue numbers and timestamp lines are stripped; cue bodies are extracted and joined (tags like `<...>` removed).
- **JSON**: Heuristic extraction from common keys (`text`, `caption`, `segments[].text`, etc.).

Parse failures surface as `analyze` errors with code **`CAPTION_PARSE`**.

## MP3 split + CSV export

Module: `src/bun/services/audioSplitter.ts`  
RPC: **`exportSplitSegments`**

### Output location

Under the user’s **Documents** folder:

`Documents/Mp3SplitterOutput/<unique-folder>/`

- **Folder name**: `formatOutputFolderName()` — `YYYY-MM-DD_HHmmss_mmm_<8 hex>` (local time + random suffix). If the directory exists, a numeric suffix `_2`, `_3`, … is tried.

### Contents

- **`mp3/001.mp3`**, `002.mp3`, … — segments ordered by parsed **`start`** time.
- **`output.csv`** — UTF-8 with BOM; columns **`caption`** (segment `text`) and **`mp3`** (relative path, e.g. `mp3/001.mp3`).

### Timestamps

`start` / `end` from JSON are parsed with **`parseTimeToSeconds`**:

- `mm:ss` or `m:ss`
- `h:mm:ss` optional
- Single number → seconds

Invalid or non-positive durations throw before ffmpeg runs.

### ffmpeg

- Resolved via **`ffmpeg`** on **`PATH`** (`Bun.spawn`).
- Each segment: try **stream copy** (`-c copy`), on failure **re-encode** with **libmp3lame**.
- stderr is captured on failure (truncated in error messages).

After success, the main process opens the export folder with **`Utils.showItemInFolder`**.

## Other file operations

| Action | Behavior |
|--------|----------|
| **Save JSON** | Writes to **Downloads** with a sanitized filename; **`showItemInFolder`** |
| **DnD / base64** | Files decoded to temp under `Utils.paths.temp/mp3-spliter-ai/` |
| **History** | Append-only **`analysis-history.jsonl`** in app **user data** (`HistoryEntry`: ISO time, caption/mp3 names, segment count) |

## Config on disk

**`config.json`** in app user data — see [Configuration](configuration.md).
