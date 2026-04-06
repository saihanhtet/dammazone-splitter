import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AnalysisSegment } from "../../shared/schema/analysisOutput";

/**
 * Unique, filesystem-safe export folder name (local time + ms + random id).
 * Example: `2026-04-06_143052_847_a3f4e2b1`
 */
export function formatOutputFolderName(d: Date = new Date()): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  const suffix = randomBytes(4).toString("hex");
  return `${y}-${mo}-${day}_${h}${min}${s}_${ms}_${suffix}`;
}

export function parseTimeToSeconds(ts: string): number {
  const t = ts.trim();
  const parts = t.split(":").map((p) => p.trim());
  if (parts.length === 1) {
    const n = parseFloat(parts[0]!);
    if (Number.isNaN(n)) throw new Error(`Invalid timestamp: "${ts}"`);
    return n;
  }
  if (parts.length === 2) {
    const m = parseInt(parts[0]!, 10);
    const s = parseFloat(parts[1]!);
    if (Number.isNaN(m) || Number.isNaN(s)) throw new Error(`Invalid timestamp: "${ts}"`);
    return m * 60 + s;
  }
  if (parts.length === 3) {
    const h = parseInt(parts[0]!, 10);
    const m = parseInt(parts[1]!, 10);
    const s = parseFloat(parts[2]!);
    if (Number.isNaN(h) || Number.isNaN(m) || Number.isNaN(s))
      throw new Error(`Invalid timestamp: "${ts}"`);
    return h * 3600 + m * 60 + s;
  }
  throw new Error(`Invalid timestamp: "${ts}"`);
}

function csvEscape(field: string): string {
  if (/[",\n\r]/.test(field)) return `"${field.replace(/"/g, '""')}"`;
  return field;
}

function resolveUniqueChildDir(parent: string, baseName: string): string {
  let candidate = join(parent, baseName);
  if (!existsSync(candidate)) return candidate;
  for (let i = 2; i < 10_000; i++) {
    candidate = join(parent, `${baseName}_${i}`);
    if (!existsSync(candidate)) return candidate;
  }
  return join(parent, `${baseName}_${Date.now()}`);
}

async function runFfmpeg(
  ffmpegBin: string,
  args: string[],
): Promise<{ ok: true } | { ok: false; stderr: string }> {
  const proc = Bun.spawn([ffmpegBin, ...args], {
    stderr: "pipe",
    stdout: "pipe",
  });
  const stderr = await new Response(proc.stderr).text();
  const code = await proc.exited;
  if (code !== 0) return { ok: false, stderr: stderr.slice(-4000) };
  return { ok: true };
}

/** Cut [startSec, endSec) from input into output. Tries stream copy, then re-encode if needed. */
async function cutSegment(
  ffmpegBin: string,
  inputPath: string,
  startSec: number,
  endSec: number,
  outputPath: string,
): Promise<void> {
  const duration = endSec - startSec;
  if (duration <= 0)
    throw new Error(
      `Invalid segment duration (${startSec}s → ${endSec}s). Check start/end in JSON.`,
    );

  const copyArgs = [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    inputPath,
    "-ss",
    String(startSec),
    "-t",
    String(duration),
    "-map",
    "0:a:0",
    "-c",
    "copy",
    outputPath,
  ];

  let r = await runFfmpeg(ffmpegBin, copyArgs);
  if (r.ok) return;

  const lameArgs = [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    inputPath,
    "-ss",
    String(startSec),
    "-t",
    String(duration),
    "-map",
    "0:a:0",
    "-c:a",
    "libmp3lame",
    "-b:a",
    "192k",
    outputPath,
  ];
  r = await runFfmpeg(ffmpegBin, lameArgs);
  if (!r.ok)
    throw new Error(
      `ffmpeg failed for segment (${startSec}s–${endSec}s): ${r.stderr}`,
    );
}

export type ExportSplitResult =
  | {
      ok: true;
      rootFolder: string;
      csvPath: string;
      mp3RelativeDir: string;
      segmentCount: number;
    }
  | { ok: false; error: string; code?: string };

/**
 * Writes under `documentsRoot/Mp3SplitterOutput/{uniqueFolder}/mp3/001.mp3…` and `output.csv`.
 */
export async function exportSplitFromTimeline(options: {
  documentsRoot: string;
  mp3SourcePath: string;
  segments: AnalysisSegment[];
  at?: Date;
}): Promise<ExportSplitResult> {
  const { documentsRoot, mp3SourcePath, segments } = options;
  const at = options.at ?? new Date();

  const ffmpegBin = Bun.which("ffmpeg");
  if (!ffmpegBin)
    return {
      ok: false,
      error:
        "ffmpeg was not found in PATH. Install ffmpeg (e.g. `brew install ffmpeg`) and restart the app.",
      code: "NO_FFMPEG",
    };

  if (!existsSync(mp3SourcePath))
    return { ok: false, error: "Source MP3 file not found.", code: "MISSING_MP3" };

  if (!segments.length)
    return { ok: false, error: "No segments in JSON to export.", code: "EMPTY" };

  let ordered: { seg: AnalysisSegment; start: number; end: number }[];
  try {
    ordered = [...segments]
      .map((seg) => ({
        seg,
        start: parseTimeToSeconds(seg.start),
        end: parseTimeToSeconds(seg.end),
      }))
      .sort((a, b) => a.start - b.start);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, code: "BAD_TIMESTAMP" };
  }

  for (let i = 0; i < ordered.length; i++) {
    const { start, end } = ordered[i]!;
    if (end <= start)
      return {
        ok: false,
        error: `Segment ${i + 1}: end must be after start (${segRange(ordered[i]!.seg)}).`,
        code: "BAD_RANGE",
      };
  }

  const outBase = join(documentsRoot, "Mp3SplitterOutput");
  if (!existsSync(outBase)) await mkdir(outBase, { recursive: true });

  const folderName = formatOutputFolderName(at);
  const rootFolder = resolveUniqueChildDir(outBase, folderName);
  await mkdir(rootFolder, { recursive: true });

  const mp3Dir = join(rootFolder, "mp3");
  await mkdir(mp3Dir, { recursive: true });

  const csvLines: string[] = ["caption,mp3"];

  for (let i = 0; i < ordered.length; i++) {
    const { seg, start, end } = ordered[i]!;
    const fileName = `${String(i + 1).padStart(3, "0")}.mp3`;
    const outPath = join(mp3Dir, fileName);
    const relMp3 = `mp3/${fileName}`;

    try {
      await cutSegment(ffmpegBin, mp3SourcePath, start, end, outPath);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg, code: "FFMPEG" };
    }

    csvLines.push(`${csvEscape(seg.text)},${csvEscape(relMp3)}`);
  }

  const csvPath = join(rootFolder, "output.csv");
  const bom = "\uFEFF";
  await writeFile(csvPath, bom + csvLines.join("\n") + "\n", "utf-8");

  return {
    ok: true,
    rootFolder,
    csvPath,
    mp3RelativeDir: "mp3",
    segmentCount: ordered.length,
  };
}

function segRange(seg: AnalysisSegment): string {
  return `"${seg.start}"–"${seg.end}"`;
}
