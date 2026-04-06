import {
  BrowserWindow,
  BrowserView,
  Updater,
  Utils,
  type RPCSchema,
} from "electrobun/bun";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type {
  AnalysisStagePayload,
  AnalyzeResponse,
  BytesPayload,
  ExportSplitResponse,
  FilePickResult,
  FolderPathsResponse,
  FolderTarget,
  OpenFolderResponse,
  SaveResultJsonResponse,
  SetFileFromBytesResult,
} from "../shared/rpcTypes";
import type { AnalysisSegment } from "../shared/schema/analysisOutput";
import { parseCaptionFile, isCaptionExtension, isMp3Extension } from "./parsers/caption";
import { createConfigStore, resolveApiKey } from "./services/configStore";
import { exportSplitFromTimeline } from "./services/audioSplitter";
import { analyzeCaptionAndAudio } from "./services/geminiClient";
import { createHistoryStore } from "./services/historyStore";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      console.log(`HMR: using Vite at ${DEV_SERVER_URL}`);
      return DEV_SERVER_URL;
    } catch {
      console.log("Vite not running; use `bun run dev:hmr` for HMR.");
    }
  }
  return "views://mainview/index.html";
}

function safeTempName(original: string): string {
  const base = basename(original).replace(/[^a-zA-Z0-9._-]+/g, "_");
  const id = randomBytes(8).toString("hex");
  return `${id}-${base}`;
}

const configStore = createConfigStore(Utils.paths);
const historyStore = createHistoryStore(Utils.paths.userData);

type AppRPC = {
  bun: RPCSchema<{
    requests: {
      pickCaption: { params: Record<string, never>; response: FilePickResult | null };
      pickMp3: { params: Record<string, never>; response: FilePickResult | null };
      setCaptionFromBytes: {
        params: BytesPayload;
        response: SetFileFromBytesResult;
      };
      setMp3FromBytes: {
        params: BytesPayload;
        response: SetFileFromBytesResult;
      };
      getApiKey: {
        params: Record<string, never>;
        response: { key: string | null; fromEnv: boolean };
      };
      setApiKey: {
        params: { key: string | null };
        response: { ok: boolean };
      };
      analyze: {
        params: {
          captionPath: string;
          mp3Path: string;
          apiKeyOverride?: string | null;
        };
        response: AnalyzeResponse;
      };
      saveResultJson: {
        params: { json: string; suggestedName: string };
        response: SaveResultJsonResponse;
      };
      exportSplitSegments: {
        params: { mp3Path: string; segments: AnalysisSegment[] };
        response: ExportSplitResponse;
      };
      getFolderPaths: {
        params: Record<string, never>;
        response: FolderPathsResponse;
      };
      openFolder: {
        params: { target: FolderTarget };
        response: OpenFolderResponse;
      };
    };
    messages: Record<string, never>;
  }>;
  webview: RPCSchema<{
    requests: Record<string, never>;
    messages: {
      analysisStage: AnalysisStagePayload;
    };
  }>;
};

let mainWindow: BrowserWindow;

function sendStage(payload: AnalysisStagePayload) {
  try {
    const w = mainWindow?.webview as { rpc?: { send: { analysisStage: (p: AnalysisStagePayload) => void } } } | undefined;
    w?.rpc?.send?.analysisStage(payload);
  } catch {
    /* ignore if webview not ready */
  }
}

async function pickOneFile(filters: string): Promise<FilePickResult | null> {
  const paths = await Utils.openFileDialog({
    startingFolder: Utils.paths.documents,
    allowedFileTypes: filters,
    canChooseFiles: true,
    canChooseDirectory: false,
    allowsMultipleSelection: false,
  });
  const p = paths[0];
  if (!p) return null;
  const st = await stat(p);
  return { path: p, name: basename(p), size: st.size };
}

async function writeBytesFile(
  payload: BytesPayload,
  validExt: (n: string) => boolean,
): Promise<SetFileFromBytesResult> {
  if (!validExt(payload.name))
    return { error: `Invalid file type for "${payload.name}".` };
  const tmpDir = join(Utils.paths.temp, "mp3-spliter-ai");
  if (!existsSync(tmpDir)) await mkdir(tmpDir, { recursive: true });
  const dest = join(tmpDir, safeTempName(payload.name));
  const buf = Buffer.from(payload.base64, "base64");
  if (buf.length === 0)
    return { error: "Empty file." };
  if (payload.size > 0 && Math.abs(buf.length - payload.size) > 3)
    return { error: "Decoded size does not match reported file size." };
  await writeFile(dest, buf);
  return { path: dest, name: payload.name, size: buf.length };
}

const appRpc = BrowserView.defineRPC<AppRPC>({
  maxRequestTime: 300_000,
  handlers: {
    requests: {
      pickCaption: async () => {
        const r = await pickOneFile("txt,srt,vtt,json");
        if (!r) return null;
        if (!isCaptionExtension(r.name))
          return null;
        return r;
      },
      pickMp3: async () => {
        const r = await pickOneFile("mp3");
        if (!r) return null;
        if (!isMp3Extension(r.name)) return null;
        return r;
      },
      setCaptionFromBytes: async (params) => writeBytesFile(params, isCaptionExtension),
      setMp3FromBytes: async (params) => writeBytesFile(params, isMp3Extension),
      getApiKey: async () => {
        const cfg = await configStore.load();
        const fromEnv = Boolean(
          process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim(),
        );
        const key = resolveApiKey(cfg, process.env);
        return { key, fromEnv };
      },
      setApiKey: async ({ key }) => {
        await configStore.save({
          geminiApiKey: key === null || key === "" ? null : key,
        });
        return { ok: true };
      },
      analyze: async ({ captionPath, mp3Path, apiKeyOverride }) => {
        sendStage({ stage: "parsing", detail: "Reading caption…" });
        const cfg = await configStore.load();
        const apiKey =
          apiKeyOverride?.trim() ||
          resolveApiKey(cfg, process.env);
        if (!apiKey)
          return {
            ok: false,
            error:
              "No API key. Set GEMINI_API_KEY in the environment or save a key in Settings.",
            code: "NO_API_KEY",
          };

        if (!isCaptionExtension(captionPath) && !isCaptionExtension(basename(captionPath)))
          return {
            ok: false,
            error: "Caption path must be a .txt, .srt, .vtt, or .json file.",
            code: "BAD_CAPTION",
          };
        if (!mp3Path.toLowerCase().endsWith(".mp3"))
          return {
            ok: false,
            error: "Audio path must be an .mp3 file.",
            code: "BAD_AUDIO",
          };

        const capFile = Bun.file(captionPath);
        if (!(await capFile.exists()))
          return { ok: false, error: "Caption file not found.", code: "MISSING" };
        const audioFile = Bun.file(mp3Path);
        if (!(await audioFile.exists()))
          return { ok: false, error: "MP3 file not found.", code: "MISSING" };

        const captionBytes = new Uint8Array(await capFile.arrayBuffer());
        const parsed = parseCaptionFile(captionPath, captionBytes);
        if (!parsed.ok)
          return { ok: false, error: parsed.error, code: "CAPTION_PARSE" };

        const result = await analyzeCaptionAndAudio({
          apiKey,
          captionPlainText: parsed.text,
          captionFormatLabel: parsed.sourceFormat,
          mp3Path,
          mp3DisplayName: basename(mp3Path),
          signalStage: (stage, detail) => {
            sendStage({ stage, detail });
          },
        });

        if (result.ok) {
          sendStage({ stage: "done", detail: "Complete." });
          void historyStore.append({
            at: new Date().toISOString(),
            captionName: basename(captionPath),
            mp3Name: basename(mp3Path),
            segmentCount: result.data.length,
          });
        } else {
          sendStage({ stage: "idle", detail: result.error });
        }

        return result;
      },
      saveResultJson: async ({ json, suggestedName }) => {
        const name = suggestedName.replace(/[^\w.-]+/g, "_") || "analysis.json";
        const dest = join(Utils.paths.downloads, name);
        try {
          if (!existsSync(Utils.paths.downloads))
            await mkdir(Utils.paths.downloads, { recursive: true });
          await writeFile(dest, json, "utf-8");
          Utils.showItemInFolder(dest);
          return { ok: true, path: dest };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return { ok: false, error: msg };
        }
      },
      exportSplitSegments: async ({ mp3Path, segments }) => {
        if (!mp3Path.toLowerCase().endsWith(".mp3"))
          return {
            ok: false,
            error: "Source file must be an .mp3.",
            code: "BAD_AUDIO",
          };
        const out = await exportSplitFromTimeline({
          documentsRoot: Utils.paths.documents,
          mp3SourcePath: mp3Path,
          segments,
        });
        if (!out.ok) return out;
        Utils.showItemInFolder(out.rootFolder);
        return {
          ok: true,
          rootFolder: out.rootFolder,
          csvPath: out.csvPath,
          segmentCount: out.segmentCount,
        };
      },
      getFolderPaths: async () => {
        const documents = Utils.paths.documents;
        const mp3SplitterOutput = join(documents, "Mp3SplitterOutput");
        const downloads = Utils.paths.downloads;
        if (!existsSync(mp3SplitterOutput))
          await mkdir(mp3SplitterOutput, { recursive: true });
        return { documents, mp3SplitterOutput, downloads };
      },
      openFolder: async ({ target }) => {
        let path: string;
        if (target === "documents") path = Utils.paths.documents;
        else if (target === "exports")
          path = join(Utils.paths.documents, "Mp3SplitterOutput");
        else if (target === "downloads") path = Utils.paths.downloads;
        else return { ok: false, error: "Unknown folder target." };
        try {
          if (!existsSync(path)) await mkdir(path, { recursive: true });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return { ok: false, error: msg };
        }
        const opened = Utils.openPath(path);
        if (!opened)
          return {
            ok: false,
            error: "Could not open folder in the system file manager.",
          };
        return { ok: true, path };
      },
    },
    messages: {},
  },
});

const url = await getMainViewUrl();

mainWindow = new BrowserWindow({
  title: "MP3 + Caption Analyzer",
  url,
  rpc: appRpc,
  frame: {
    width: 960,
    height: 780,
    x: 120,
    y: 120,
  },
});

console.log("MP3 + Caption Analyzer started.");
