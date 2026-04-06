import {
  ApiError,
  GoogleGenAI,
  Type,
  createPartFromText,
  createPartFromUri,
  FileState,
} from "@google/genai";
import { basename } from "node:path";
import type { AnalysisStagePayload } from "../../shared/rpcTypes";
import {
  analysisOutputSchema,
  type AnalysisOutput,
} from "../../shared/schema/analysisOutput";
import { GEMINI_SYSTEM_INSTRUCTION } from "./geminiPrompts";

export const DEFAULT_GEMINI_MODEL =
  process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

/** If unset, @google/genai uses v1beta for AI Studio (recommended). Set only when you know you need another version. */
const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION?.trim();

const ANALYSIS_RESPONSE_JSON_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      start: {
        type: Type.STRING,
        description:
          "Start time as mm:ss (minutes 0–59 or more, seconds 00–59).",
      },
      end: {
        type: Type.STRING,
        description: "End time as mm:ss.",
      },
      section: {
        type: Type.STRING,
        description: "Short section or topic label.",
      },
      text: {
        type: Type.STRING,
        description:
          "Spoken/caption text for this segment; may contain newline characters.",
      },
      pause: {
        type: Type.STRING,
        description: 'Silence after this segment, e.g. "0.0s" or "2.5s".',
      },
    },
    propertyOrdering: ["start", "end", "section", "text", "pause"],
  },
};

async function waitForFileActive(
  ai: GoogleGenAI,
  name: string,
  signalStage?: (detail: string) => void,
): Promise<{ uri: string; mimeType: string }> {
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    const f = await ai.files.get({ name });
    if (f.state === FileState.ACTIVE && f.uri && f.mimeType) {
      return { uri: f.uri, mimeType: f.mimeType };
    }
    if (f.state === FileState.FAILED) {
      throw new Error(
        f.error?.message || "Uploaded audio file failed processing.",
      );
    }
    signalStage?.("Waiting for uploaded file to become ready…");
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("Timed out waiting for audio file to become ACTIVE.");
}

function mapApiError(e: unknown): string {
  if (e instanceof ApiError) {
    const msg = e.message?.trim();
    if (msg) return msg;
    return `Gemini API HTTP ${e.status} (empty error body). If this is 404, check GEMINI_MODEL and API version — the Developer API uses v1beta by default.`;
  }
  if (e instanceof Error) return e.message;
  return String(e);
}

export async function analyzeCaptionAndAudio(options: {
  apiKey: string;
  captionPlainText: string;
  captionFormatLabel: string;
  mp3Path: string;
  mp3DisplayName: string;
  signalStage?: (
    stage: AnalysisStagePayload["stage"],
    detail?: string,
  ) => void;
}): Promise<
  | { ok: true; data: AnalysisOutput }
  | { ok: false; error: string; code?: string }
> {
  const {
    apiKey,
    captionPlainText,
    captionFormatLabel,
    mp3Path,
    mp3DisplayName,
    signalStage,
  } = options;

  let uploadedName: string | undefined;
  // Default: no apiVersion → SDK uses v1beta for AI Studio keys. Forcing `v1`
  // often causes 404 for models/files only exposed on v1beta.
  const ai = new GoogleGenAI(
    GEMINI_API_VERSION
      ? { apiKey, apiVersion: GEMINI_API_VERSION }
      : { apiKey },
  );

  try {
    signalStage?.("uploading", "Uploading MP3…");
    const uploaded = await ai.files.upload({
      file: mp3Path,
      config: {
        mimeType: "audio/mpeg",
        displayName: basename(mp3DisplayName),
      },
    });
    uploadedName = uploaded.name ?? undefined;
    if (!uploadedName) throw new Error("Upload did not return a file name.");

    const { uri, mimeType } = await waitForFileActive(
      ai,
      uploadedName,
      (d) => signalStage?.("uploading", d),
    );

    signalStage?.("generating", "Calling Gemini…");

    const userMessage = `Script source format: ${captionFormatLabel}
Audio file name (reference): ${mp3DisplayName}

--- Script / caption text (extracted; do not alter wording) ---
${captionPlainText}
--- End script ---

Follow the system instructions. Use the attached audio and the script above to produce the JSON array.`;

    const response = await ai.models.generateContent({
      model: DEFAULT_GEMINI_MODEL,
      contents: [
        createPartFromText(userMessage),
        createPartFromUri(uri, mimeType),
      ],
      config: {
        systemInstruction: GEMINI_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseJsonSchema: ANALYSIS_RESPONSE_JSON_SCHEMA,
        temperature: 0.2,
      },
    });

    const text = response.text;
    if (!text?.trim()) {
      return {
        ok: false,
        error: "Gemini returned an empty response.",
        code: "EMPTY_RESPONSE",
      };
    }

    signalStage?.("validating", "Validating JSON…");

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return {
        ok: false,
        error: "Model output was not valid JSON.",
        code: "JSON_PARSE",
      };
    }

    const z = analysisOutputSchema.safeParse(parsed);
    if (!z.success) {
      return {
        ok: false,
        error: `Response failed schema validation: ${z.error.message}`,
        code: "ZOD_VALIDATION",
      };
    }

    return { ok: true, data: z.data };
  } catch (e) {
    return {
      ok: false,
      error: mapApiError(e),
      code: "GEMINI_ERROR",
    };
  } finally {
    if (uploadedName) {
      try {
        await ai.files.delete({ name: uploadedName });
      } catch {
        /* best-effort cleanup */
      }
    }
  }
}
