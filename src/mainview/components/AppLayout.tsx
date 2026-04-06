import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useRpc } from "../lib/electrobunContext";
import { useAppSettings } from "../settingsContext";
import { useTheme } from "../themeContext";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? "bg-indigo-100 text-indigo-900 dark:bg-indigo-900/50 dark:text-indigo-100"
      : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
  }`;

export default function AppLayout() {
  const rpc = useRpc();
  const { theme, setTheme } = useTheme();
  const {
    apiKeyInput,
    setApiKeyInput,
    keyFromEnv,
    refreshKey,
    saveApiKey,
  } = useAppSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (settingsOpen) void refreshKey();
  }, [settingsOpen, refreshKey]);

  const onSaveSettings = async () => {
    await saveApiKey();
    setSettingsOpen(false);
  };

  if (!rpc) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
        Connecting to app…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
              MP3 + Caption Analyzer
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Gemini structured JSON from one caption file and one MP3.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <nav className="flex flex-wrap gap-1">
              <NavLink to="/" end className={navClass}>
                Home
              </NavLink>
              <NavLink to="/saved" className={navClass}>
                Saved / exports
              </NavLink>
            </nav>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Settings
            </button>
          </div>
        </div>
      </header>

      <Outlet />

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 dark:bg-black/70">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Settings</h2>

            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">
                Appearance
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                    theme === "light"
                      ? "border-indigo-500 bg-indigo-50 text-indigo-900 dark:border-indigo-400 dark:bg-indigo-950/50 dark:text-indigo-100"
                      : "border-slate-300 text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                >
                  Light
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                    theme === "dark"
                      ? "border-indigo-500 bg-indigo-50 text-indigo-900 dark:border-indigo-400 dark:bg-indigo-950/50 dark:text-indigo-100"
                      : "border-slate-300 text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                >
                  Dark
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
                Preference is saved in this browser session (localStorage).
              </p>
            </div>

            <div className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Gemini API key</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Keys are stored under your app user data folder (not encrypted). You
                can also set{" "}
                <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GEMINI_API_KEY</code> in
                the environment.
              </p>
              {keyFromEnv && (
                <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
                  Using API key from environment. Saved key is ignored until env is
                  cleared.
                </p>
              )}
              <label className="mt-4 block text-xs font-medium uppercase text-slate-500 dark:text-slate-500">
                API key
                <input
                  type="password"
                  autoComplete="off"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  disabled={keyFromEnv}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                  placeholder="AIza…"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-lg px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Close
              </button>
              <button
                type="button"
                disabled={keyFromEnv}
                onClick={() => void onSaveSettings()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
              >
                Save key
              </button>
            </div>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block text-sm text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Get a key in Google AI Studio
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
