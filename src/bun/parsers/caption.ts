import { extname } from "node:path";

export type CaptionParseResult =
  | { ok: true; text: string; sourceFormat: string }
  | { ok: false; error: string };

const CAPTION_EXT = new Set([".txt", ".srt", ".vtt", ".json"]);

export function isCaptionExtension(filename: string): boolean {
  return CAPTION_EXT.has(extname(filename).toLowerCase());
}

export function isMp3Extension(filename: string): boolean {
  return extname(filename).toLowerCase() === ".mp3";
}

/** Strip SRT/VTT cue lines and tags; join cue bodies. */
export function extractTextFromSrtOrVtt(raw: string): string {
  const lines = raw.split(/\r?\n/);
  const blocks: string[] = [];
  let current: string[] = [];

  const flush = () => {
    const body = current.join("\n").trim();
    if (body) blocks.push(body);
    current = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") {
      flush();
      continue;
    }
    if (/^\d+$/.test(trimmed)) continue;
    if (/^\d{1,2}:\d{2}[:.]\d{2}\s*-->\s*\d{1,2}:\d{2}[:.]\d{2}/.test(trimmed))
      continue;
    const noTags = trimmed
      .replace(/<[^>]+>/g, "")
      .replace(/^\s*NOTE\s+/i, "")
      .trim();
    if (noTags) current.push(noTags);
  }
  flush();
  return blocks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

function extractFromJsonValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const parts = value
      .map((v) => extractFromJsonValue(v))
      .filter((s): s is string => s !== null);
    if (parts.length) return parts.join("\n\n");
  }
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const keys = [
      "text",
      "caption",
      "captions",
      "transcript",
      "content",
      "body",
      "value",
    ];
    for (const k of keys) {
      if (k in o) {
        const t = extractFromJsonValue(o[k]);
        if (t) return t;
      }
    }
    if (Array.isArray(o.segments)) {
      const texts = o.segments
        .map((seg) => {
          if (seg && typeof seg === "object" && "text" in seg)
            return extractFromJsonValue((seg as { text: unknown }).text);
          return null;
        })
        .filter((s): s is string => s !== null);
      if (texts.length) return texts.join("\n\n");
    }
  }
  return null;
}

export function parseCaptionFile(
  absolutePath: string,
  bytes: Uint8Array,
): CaptionParseResult {
  const ext = extname(absolutePath).toLowerCase();
  const decoder = new TextDecoder("utf-8", { fatal: false });

  try {
    if (ext === ".txt") {
      return {
        ok: true,
        text: decoder.decode(bytes).replace(/\r\n/g, "\n").trim(),
        sourceFormat: "plain text (.txt)",
      };
    }

    if (ext === ".srt" || ext === ".vtt") {
      const raw = decoder.decode(bytes);
      const text = extractTextFromSrtOrVtt(raw);
      if (!text)
        return {
          ok: false,
          error: `No caption text could be extracted from ${ext} file.`,
        };
      return {
        ok: true,
        text,
        sourceFormat: ext === ".srt" ? "SubRip (.srt)" : "WebVTT (.vtt)",
      };
    }

    if (ext === ".json") {
      const raw = decoder.decode(bytes);
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return { ok: false, error: "Invalid JSON in caption file." };
      }
      const text = extractFromJsonValue(parsed);
      if (!text)
        return {
          ok: false,
          error:
            "Could not find transcript/caption text in JSON (tried common keys and segments[].text).",
        };
      return { ok: true, text, sourceFormat: "JSON (.json)" };
    }

    return { ok: false, error: `Unsupported caption extension: ${ext}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Failed to read caption: ${msg}` };
  }
}
