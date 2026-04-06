import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

const HISTORY_FILE = "analysis-history.jsonl";

export type HistoryEntry = {
  at: string;
  captionName: string;
  mp3Name: string;
  segmentCount: number;
};

export function createHistoryStore(userDataPath: string) {
  const historyPath = () => join(userDataPath, HISTORY_FILE);

  return {
    async append(entry: HistoryEntry): Promise<void> {
      if (!existsSync(userDataPath))
        await mkdir(userDataPath, { recursive: true });
      const line = JSON.stringify(entry) + "\n";
      await appendFile(historyPath(), line, "utf-8");
    },
  };
}
