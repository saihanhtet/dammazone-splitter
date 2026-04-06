import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
export type AppConfig = {
  geminiApiKey?: string | null;
};

const CONFIG_FILENAME = "config.json";

function configPath(userData: string): string {
  return join(userData, CONFIG_FILENAME);
}

export async function loadConfig(
  getUserData: () => string,
): Promise<AppConfig> {
  const dir = getUserData();
  const p = configPath(dir);
  if (!existsSync(p)) return {};
  try {
    const raw = await readFile(p, "utf-8");
    const parsed = JSON.parse(raw) as AppConfig;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveConfig(
  getUserData: () => string,
  partial: Partial<AppConfig>,
): Promise<void> {
  const dir = getUserData();
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  const current = await loadConfig(getUserData);
  const next = { ...current, ...partial };
  await writeFile(configPath(dir), JSON.stringify(next, null, 2), "utf-8");
}

export function resolveApiKey(
  config: AppConfig,
  env: typeof process.env,
): string | null {
  const fromEnv =
    env.GEMINI_API_KEY?.trim() || env.GOOGLE_API_KEY?.trim() || "";
  if (fromEnv) return fromEnv;
  const k = config.geminiApiKey?.trim();
  return k || null;
}

/** Pass Utils.paths.userData from main (electrobun). */
export function createConfigStore(utilsPaths: { userData: string }) {
  const getUserData = () => utilsPaths.userData;
  return {
    load: () => loadConfig(getUserData),
    save: (partial: Partial<AppConfig>) => saveConfig(getUserData, partial),
    resolveApiKey: (env: typeof process.env) =>
      loadConfig(getUserData).then((c) => resolveApiKey(c, env)),
  };
}

export type ConfigStore = ReturnType<typeof createConfigStore>;
