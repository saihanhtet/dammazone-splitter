# RPC and main process

RPC is defined in `src/bun/index.ts` with `BrowserView.defineRPC<AppRPC>()` and mirrored on the client (e.g. `bunRequestApi.ts`).

## Timeouts

`maxRequestTime` is set to **300_000 ms** (5 minutes) to accommodate Gemini upload + generation.

## Bun → webview (requests)

All **requests** are initiated from the renderer and handled in the main process.

| Request | Params | Response |
|---------|--------|----------|
| `pickCaption` | — | `FilePickResult \| null` |
| `pickMp3` | — | `FilePickResult \| null` |
| `setCaptionFromBytes` | `BytesPayload` | `SetFileFromBytesResult` |
| `setMp3FromBytes` | `BytesPayload` | `SetFileFromBytesResult` |
| `getApiKey` | — | `{ key: string \| null; fromEnv: boolean }` |
| `setApiKey` | `{ key: string \| null }` | `{ ok: boolean }` |
| `analyze` | `{ captionPath, mp3Path, apiKeyOverride? }` | `AnalyzeResponse` |
| `saveResultJson` | `{ json, suggestedName }` | `SaveResultJsonResponse` |
| `exportSplitSegments` | `{ mp3Path, segments: AnalysisSegment[] }` | `ExportSplitResponse` |
| `getFolderPaths` | — | `FolderPathsResponse` |
| `openFolder` | `{ target: FolderTarget }` | `OpenFolderResponse` |

### Types (summary)

- **`FilePickResult`**: `{ path, name, size }`
- **`BytesPayload`**: `{ name, size, base64 }` — written under `Utils.paths.temp/mp3-spliter-ai/` with a random prefix; extension validated.
- **`AnalyzeResponse`**: `{ ok: true, data }` or `{ ok: false, error, code? }`
- **`ExportSplitResponse`**: success includes `rootFolder`, `csvPath`, `segmentCount`
- **`FolderTarget`**: `"documents" \| "exports" \| "downloads"` — `exports` maps to `Documents/Mp3SplitterOutput`

## Webview → bun (messages)

| Message | Payload |
|---------|---------|
| `analysisStage` | `AnalysisStagePayload` |

### `AnalysisStagePayload`

```ts
{
  stage: "idle" | "parsing" | "uploading" | "generating" | "validating" | "done";
  detail?: string;
}
```

Emitted during `analyze` so the UI can show progress. Stages align with: caption read/parse → file upload/wait → Gemini call → JSON + Zod → done/idle on error.

## Error codes (analyze / export)

Common `code` values returned on failure:

- `NO_API_KEY` — no key in env or settings
- `BAD_CAPTION` / `BAD_AUDIO` — wrong extension or path
- `MISSING` — file not found
- `CAPTION_PARSE` — parser error
- `EMPTY_RESPONSE` / `JSON_PARSE` / `ZOD_VALIDATION` — model output issues
- `GEMINI_ERROR` — API or client error (message from `mapApiError`)

Export may return ffmpeg-related messages via `exportSplitFromTimeline` (invalid timestamps, missing ffmpeg, etc.).
