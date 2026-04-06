# Project requirements

High-level **functional** and **non-functional** requirements implemented by this codebase. For design detail, see the linked topic docs.

## Functional

| ID | Requirement |
|----|----------------|
| F1 | Accept one **caption file** (`.txt`, `.srt`, `.vtt`, `.json`) and one **MP3**, via native picker or drag-and-drop. |
| F2 | **Parse** caption content to plain text locally (format-specific stripping for SRT/VTT; heuristics for JSON). |
| F3 | Send **caption text + MP3** to **Google Gemini** with a fixed **system instruction** and receive **structured JSON** (timed segments). |
| F4 | **Validate** model output with **Zod** against a single shared schema (`AnalysisSegment[]`). |
| F5 | Surface **progress** during analyze (parsing, upload, generation, validation) to the UI. |
| F6 | Allow **saving** analysis JSON to the user’s **Downloads** folder and revealing the file in the OS file manager. |
| F7 | Optionally **split** the source MP3 by segment timestamps and write **`output.csv`** + numbered MP3s under **`Documents/Mp3SplitterOutput/<unique>/`**. |
| F8 | Persist **Gemini API key** in app settings (user data) or read from **environment**; support override from UI when analyzing. |
| F9 | Append a one-line **history** entry per successful analysis (`analysis-history.jsonl`). |
| F10 | Provide **light/dark** theme and a **hash-based** router (`#/`, `#/saved`) for exports/paths UI. |
| F11 | Expose **folder paths** (Documents, Mp3SplitterOutput, Downloads) and **open** them in the system file manager. |

## Non-functional

| ID | Requirement |
|----|----------------|
| N1 | **Desktop** deployment via Electrobun; main process **Bun**, UI **React + Vite + Tailwind**. |
| N2 | **Type-safe RPC** between renderer and main (shared types in `src/shared`). |
| N3 | **Long-running** analyze RPC tolerates upload + generation (e.g. **5 minute** max request time). |
| N4 | **ffmpeg** invoked as an external **`PATH`** binary (not bundled); graceful errors if missing or encode fails. |
| N5 | **Production build** produces Electrobun **canary** artifacts including **DMG** on macOS when using the documented `bun run build` script. |
| N6 | **No** forced Gemini **`v1`** API version by default — use SDK default (**`v1beta`**) for AI Studio to avoid spurious **404** on models/files. |

## Out of scope / limitations

- **Encryption** of API keys on disk is not implemented; suitable for local/dev use with awareness of risk.
- **Native “save as”** dialog for arbitrary paths is not used; save-to-Downloads is fixed behavior.
- **Very large** MP3s via DnD may be impractical due to base64 + RPC; native pick is preferred.

## Related documentation

- [Architecture](architecture.md)  
- [RPC](rpc.md)  
- [Gemini](gemini.md)  
- [Export and files](export-and-files.md)  
- [Build and release](build-and-release.md)  
- [Configuration](configuration.md)  
