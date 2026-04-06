import { useCallback, useMemo, useState } from "react";
import type { AnalysisSegment } from "@shared/schema/analysisOutput";
import type { FilePickResult } from "@shared/rpcTypes";
import { useAnalysisStage, useRpc } from "../lib/electrobunContext";
import { useAppSettings } from "../settingsContext";
import { formatBytes } from "../lib/formatBytes";
import { arrayBufferToBase64 } from "../lib/fileToBase64";

const CAPTION_EXT = /\.(txt|srt|vtt|json)$/i;
const MP3_EXT = /\.mp3$/i;

function isCaptionName(name: string) {
  return CAPTION_EXT.test(name);
}
function isMp3Name(name: string) {
  return MP3_EXT.test(name);
}

function validationMessages(
  caption: FilePickResult | null,
  mp3: FilePickResult | null,
  hasKey: boolean,
): string[] {
  const msgs: string[] = [];
  if (!caption) msgs.push("Select exactly one caption file (.txt, .srt, .vtt, .json).");
  if (!mp3) msgs.push("Select exactly one MP3 file.");
  if (!hasKey)
    msgs.push("Add a Gemini API key in Settings or set GEMINI_API_KEY in the environment.");
  return msgs;
}

export default function HomePage() {
  const rpc = useRpc();
  const { apiKeyInput, keyFromEnv } = useAppSettings();
  const stage = useAnalysisStage();
  const [caption, setCaption] = useState<FilePickResult | null>(null);
  const [mp3, setMp3] = useState<FilePickResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisSegment[] | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);

  const hasEffectiveKey = keyFromEnv || apiKeyInput.trim().length > 0;
  const msgs = validationMessages(caption, mp3, hasEffectiveKey);
  const canAnalyze = msgs.length === 0 && !loading && rpc;

  const resultJson = useMemo(
    () => (result ? JSON.stringify(result, null, 2) : ""),
    [result],
  );

  const stageLabel = useMemo(() => {
    if (!loading || !stage) return loading ? "Working…" : "";
    const d = stage.detail ? ` — ${stage.detail}` : "";
    switch (stage.stage) {
      case "parsing":
        return `Parsing caption${d}`;
      case "uploading":
        return `Uploading audio${d}`;
      case "generating":
        return `Analyzing with Gemini${d}`;
      case "validating":
        return `Validating response${d}`;
      case "done":
        return `Done${d}`;
      default:
        return `Working${d}`;
    }
  }, [loading, stage]);

  const applyPickedCaption = useCallback((r: FilePickResult | null) => {
    setCaption(r);
    setError(null);
    setResult(null);
    setExportNote(null);
  }, []);

  const applyPickedMp3 = useCallback((r: FilePickResult | null) => {
    setMp3(r);
    setError(null);
    setResult(null);
    setExportNote(null);
  }, []);

  const pickCaption = async () => {
    if (!rpc) return;
    const r = await rpc.request.pickCaption({});
    applyPickedCaption(r);
  };

  const pickMp3 = async () => {
    if (!rpc) return;
    const r = await rpc.request.pickMp3({});
    applyPickedMp3(r);
  };

  const processFileList = async (files: FileList | File[]) => {
    if (!rpc) return;
    const list = [...files];
    const caps = list.filter((f) => isCaptionName(f.name));
    const audios = list.filter((f) => isMp3Name(f.name));

    if (caps.length > 1) {
      setError("Drop only one caption file at a time.");
      return;
    }
    if (audios.length > 1) {
      setError("Drop only one MP3 at a time.");
      return;
    }

    for (const f of caps) {
      const buf = await f.arrayBuffer();
      const b64 = arrayBufferToBase64(buf);
      const res = await rpc.request.setCaptionFromBytes({
        name: f.name,
        size: f.size,
        base64: b64,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      applyPickedCaption(res);
    }
    for (const f of audios) {
      const buf = await f.arrayBuffer();
      const b64 = arrayBufferToBase64(buf);
      const res = await rpc.request.setMp3FromBytes({
        name: f.name,
        size: f.size,
        base64: b64,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      applyPickedMp3(res);
    }

    if (caps.length === 0 && audios.length === 0 && list.length > 0) {
      setError("Unsupported files. Use .txt, .srt, .vtt, .json, or .mp3.");
    }
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    await processFileList(e.dataTransfer.files);
  };

  const analyze = async () => {
    if (!rpc || !caption || !mp3) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setExportNote(null);
    try {
      const res = await rpc.request.analyze({
        captionPath: caption.path,
        mp3Path: mp3.path,
        apiKeyOverride: keyFromEnv ? null : apiKeyInput.trim() || null,
      });
      if (res.ok) setResult(res.data);
      else setError(res.error + (res.code ? ` (${res.code})` : ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const saveJson = async () => {
    if (!rpc || !resultJson) return;
    const suggested = `analysis-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
    const r = await rpc.request.saveResultJson({
      json: resultJson,
      suggestedName: suggested,
    });
    if (!r.ok) setError(r.error ?? "Save failed.");
  };

  const copyJson = async () => {
    if (!resultJson) return;
    try {
      await navigator.clipboard.writeText(resultJson);
    } catch {
      setError("Could not copy to clipboard.");
    }
  };

  const exportSplitAudio = async () => {
    if (!rpc || !mp3 || !result?.length) return;
    setExporting(true);
    setExportNote(null);
    setError(null);
    try {
      const r = await rpc.request.exportSplitSegments({
        mp3Path: mp3.path,
        segments: result,
      });
      if (r.ok) {
        setExportNote(
          `Exported ${r.segmentCount} clips and output.csv to:\n${r.rootFolder}`,
        );
      } else {
        setError(r.error + (r.code ? ` (${r.code})` : ""));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  if (!rpc) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500 dark:text-slate-400">
        Connecting to app…
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          dragActive
            ? "border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/40"
            : "border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50"
        }`}
      >
        <p className="text-slate-700 dark:text-slate-300">
          Drag and drop caption + MP3 here, or use the buttons below.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={pickCaption}
            className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
          >
            Choose caption
          </button>
          <button
            type="button"
            onClick={pickMp3}
            className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
          >
            Choose MP3
          </button>
        </div>
      </div>

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/40 sm:grid-cols-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">
            Caption
          </h2>
          {caption ? (
            <p className="mt-2 text-sm">
              <span className="font-medium text-slate-900 dark:text-white">{caption.name}</span>
              <span className="text-slate-500"> — {formatBytes(caption.size)}</span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-500">None selected</p>
          )}
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">
            MP3
          </h2>
          {mp3 ? (
            <p className="mt-2 text-sm">
              <span className="font-medium text-slate-900 dark:text-white">{mp3.name}</span>
              <span className="text-slate-500"> — {formatBytes(mp3.size)}</span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-500">None selected</p>
          )}
        </div>
      </section>

      {msgs.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-medium text-amber-900 dark:text-amber-200">Before you analyze</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {msgs.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!canAnalyze}
          onClick={analyze}
          className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/20 hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40 dark:shadow-indigo-900/40"
        >
          Analyze
        </button>
        {loading && (
          <span className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-indigo-600 dark:border-slate-600 dark:border-t-indigo-400" />
            {stageLabel}
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100">
          <p className="font-semibold text-red-800 dark:text-red-300">Error</p>
          <p className="mt-1 whitespace-pre-wrap">{error}</p>
        </div>
      )}

      {result && (
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyJson}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              Copy JSON
            </button>
            <button
              type="button"
              onClick={saveJson}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              Save JSON
            </button>
            <button
              type="button"
              disabled={!mp3 || !result?.length || exporting}
              onClick={exportSplitAudio}
              className="rounded-lg border border-emerald-600 bg-emerald-50 px-4 py-2 text-sm text-emerald-950 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-900/50"
            >
              {exporting ? "Exporting clips…" : "Export split MP3 + CSV"}
            </button>
          </div>
          {exportNote && (
            <p className="whitespace-pre-wrap rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200/90">
              {exportNote}
            </p>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-500">
            Exports to Documents/Mp3SplitterOutput/&lt;date_time_random&gt;/mp3/001.mp3… and
            output.csv (columns: caption, mp3). Requires{" "}
            <code className="rounded bg-slate-200 px-1 dark:bg-slate-800">ffmpeg</code> in PATH.
          </p>
          <pre className="max-h-[480px] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
            {resultJson}
          </pre>
        </section>
      )}
    </main>
  );
}
