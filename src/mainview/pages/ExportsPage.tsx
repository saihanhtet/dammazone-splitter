import { useCallback, useEffect, useState } from "react";
import { useRpc } from "../lib/electrobunContext";
import type { FolderPathsResponse, FolderTarget } from "@shared/rpcTypes";

export default function ExportsPage() {
  const rpc = useRpc();
  const [paths, setPaths] = useState<FolderPathsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [opening, setOpening] = useState<FolderTarget | null>(null);

  const loadPaths = useCallback(async () => {
    if (!rpc) return;
    setLoadError(null);
    try {
      const p = await rpc.request.getFolderPaths({});
      setPaths(p);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, [rpc]);

  useEffect(() => {
    void loadPaths();
  }, [loadPaths]);

  const openFolder = async (target: FolderTarget) => {
    if (!rpc) return;
    setActionError(null);
    setOpening(target);
    try {
      const r = await rpc.request.openFolder({ target });
      if (!r.ok) setActionError(r.error);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setOpening(null);
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
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Saved & exported files</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Open your system file manager at the folders below. Split MP3 exports and{" "}
          <code className="rounded bg-slate-200 px-1 text-xs dark:bg-slate-800">output.csv</code>{" "}
          live under <strong className="text-slate-800 dark:text-slate-200">Documents → Mp3SplitterOutput</strong>.
          JSON saves from the app go to <strong className="text-slate-800 dark:text-slate-200">Downloads</strong>.
        </p>
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100">
          {loadError}
        </div>
      )}

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100">
          {actionError}
        </div>
      )}

      <ul className="space-y-4">
        <li className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3 className="font-medium text-slate-900 dark:text-white">Split exports (MP3 + CSV)</h3>
              <p className="mt-1 break-all font-mono text-xs text-slate-600 dark:text-slate-400">
                {paths?.mp3SplitterOutput ?? "…"}
              </p>
            </div>
            <button
              type="button"
              disabled={opening !== null}
              onClick={() => void openFolder("exports")}
              className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {opening === "exports" ? "Opening…" : "Open folder"}
            </button>
          </div>
        </li>

        <li className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3 className="font-medium text-slate-900 dark:text-white">Documents</h3>
              <p className="mt-1 break-all font-mono text-xs text-slate-600 dark:text-slate-400">
                {paths?.documents ?? "…"}
              </p>
            </div>
            <button
              type="button"
              disabled={opening !== null}
              onClick={() => void openFolder("documents")}
              className="shrink-0 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              {opening === "documents" ? "Opening…" : "Open folder"}
            </button>
          </div>
        </li>

        <li className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3 className="font-medium text-slate-900 dark:text-white">Downloads (Save JSON)</h3>
              <p className="mt-1 break-all font-mono text-xs text-slate-600 dark:text-slate-400">
                {paths?.downloads ?? "…"}
              </p>
            </div>
            <button
              type="button"
              disabled={opening !== null}
              onClick={() => void openFolder("downloads")}
              className="shrink-0 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              {opening === "downloads" ? "Opening…" : "Open folder"}
            </button>
          </div>
        </li>
      </ul>
    </main>
  );
}
