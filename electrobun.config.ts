import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "MP3 Caption Analyzer",
    identifier: "dev.mp3spliterai.analyzer",
    version: "1.0.0",
  },
  build: {
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets": "views/mainview/assets",
    },
    watchIgnore: ["dist/**"],
    mac: { bundleCEF: false },
    linux: { bundleCEF: false },
    win: { bundleCEF: false },
  },
  release: {
    // Skip delta patches for local canary/stable builds (no release.baseUrl).
    generatePatch: false,
  },
} satisfies ElectrobunConfig;
