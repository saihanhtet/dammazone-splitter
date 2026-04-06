import type { AnalysisSegment } from "@shared/schema/analysisOutput";
import type {
  AnalyzeResponse,
  BytesPayload,
  ExportSplitResponse,
  FilePickResult,
  FolderPathsResponse,
  FolderTarget,
  OpenFolderResponse,
  SaveResultJsonResponse,
  SetFileFromBytesResult,
} from "@shared/rpcTypes";

/** Mirrors Bun-side RPC `requests` for typed `rpc.request` in the webview. */
export type BunRequestApi = {
  pickCaption: (p: Record<string, never>) => Promise<FilePickResult | null>;
  pickMp3: (p: Record<string, never>) => Promise<FilePickResult | null>;
  setCaptionFromBytes: (p: BytesPayload) => Promise<SetFileFromBytesResult>;
  setMp3FromBytes: (p: BytesPayload) => Promise<SetFileFromBytesResult>;
  getApiKey: (
    p: Record<string, never>,
  ) => Promise<{ key: string | null; fromEnv: boolean }>;
  setApiKey: (p: { key: string | null }) => Promise<{ ok: boolean }>;
  analyze: (p: {
    captionPath: string;
    mp3Path: string;
    apiKeyOverride?: string | null;
  }) => Promise<AnalyzeResponse>;
  saveResultJson: (p: {
    json: string;
    suggestedName: string;
  }) => Promise<SaveResultJsonResponse>;
  exportSplitSegments: (p: {
    mp3Path: string;
    segments: AnalysisSegment[];
  }) => Promise<ExportSplitResponse>;
  getFolderPaths: (p: Record<string, never>) => Promise<FolderPathsResponse>;
  openFolder: (p: { target: FolderTarget }) => Promise<OpenFolderResponse>;
};

export type BunSideRpc = {
  request: BunRequestApi;
  setTransport: (t: unknown) => void;
};
