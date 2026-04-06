import type { AnalysisSegment } from "./schema/analysisOutput";

export type FilePickResult = {
  path: string;
  name: string;
  size: number;
};

export type AnalyzeSuccess = {
  ok: true;
  data: AnalysisSegment[];
};

export type AnalyzeFailure = {
  ok: false;
  error: string;
  code?: string;
};

export type AnalyzeResponse = AnalyzeSuccess | AnalyzeFailure;

export type BytesPayload = {
  name: string;
  size: number;
  base64: string;
};

export type SetFileFromBytesResult =
  | FilePickResult
  | { error: string };

export type SaveResultJsonResponse =
  | { ok: true; path: string }
  | { ok: false; error: string };

export type ExportSplitResponse =
  | {
      ok: true;
      rootFolder: string;
      csvPath: string;
      segmentCount: number;
    }
  | { ok: false; error: string; code?: string };

export type FolderPathsResponse = {
  documents: string;
  mp3SplitterOutput: string;
  downloads: string;
};

export type FolderTarget = "documents" | "exports" | "downloads";

export type OpenFolderResponse =
  | { ok: true; path: string }
  | { ok: false; error: string };

export type AnalysisStagePayload = {
  stage: "idle" | "parsing" | "uploading" | "generating" | "validating" | "done";
  detail?: string;
};
