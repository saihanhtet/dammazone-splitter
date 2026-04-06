# Gemini integration

Implementation: `src/bun/services/geminiClient.ts`  
System prompt: `src/bun/services/geminiPrompts.ts` (`GEMINI_SYSTEM_INSTRUCTION`)

## Client setup

- **`GoogleGenAI`** is constructed with `{ apiKey }` by default so the SDK uses **AI Studio’s default API version (`v1beta`)**.
- Optional **`GEMINI_API_VERSION`** — only set when you explicitly need another version. Forcing `v1` can cause **HTTP 404** for some models or file APIs that are exposed on `v1beta`.

## Model

- Default model: **`gemini-2.5-flash`** (overridable with **`GEMINI_MODEL`**).

## Audio handling

1. MP3 is uploaded with `ai.files.upload` (`mimeType: audio/mpeg`).
2. The code polls `ai.files.get` until state is **ACTIVE** (or **FAILED** / timeout ~10 minutes).
3. After a successful structured response, the uploaded file is **deleted** (best effort in `finally`).

## Generation

- **User message** includes caption format label, display file name, extracted caption text, and instructions to follow the system prompt.
- **Parts**: text (user message) + `createPartFromUri(uri, mimeType)` for the uploaded audio.
- **Config**: `systemInstruction`, `responseMimeType: application/json`, **`responseJsonSchema`** (array of objects with `start`, `end`, `section`, `text`, `pause`), `temperature: 0.2`.

## Validation

1. **`response.text`** must be non-empty JSON.
2. **`JSON.parse`** then **`analysisOutputSchema.safeParse`** (Zod) in `src/shared/schema/analysisOutput.ts`.

Schema fields:

| Field | Meaning |
|-------|---------|
| `start` | `mm:ss` (minutes may be multi-digit) |
| `end` | `mm:ss` |
| `section` | Section label |
| `text` | Caption/transcript (may include `\n`) |
| `pause` | e.g. `0.0s` |

## Troubleshooting

- **404 / empty API error**: Prefer **unset** `GEMINI_API_VERSION`; confirm key from [Google AI Studio](https://aistudio.google.com/apikey); try **`GEMINI_MODEL=gemini-2.0-flash`** if the chosen model name does not exist for your API version.
- **Large MP3s**: Upload + generation time increases; RPC timeout is 5 minutes.
