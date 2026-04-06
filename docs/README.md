# Technical documentation

This folder holds **architecture, integration, and operational** details for **MP3 Caption Analyzer** (Electrobun + React + Bun). For a quick start, prerequisites, and user-facing notes, see the [root README](../README.md).

## Contents

| Document | Description |
|----------|-------------|
| [Architecture](architecture.md) | Layers, process model, routing, and high-level data flow |
| [RPC and main process](rpc.md) | Typed RPC surface, handlers, progress stages, timeouts |
| [Gemini integration](gemini.md) | API client, uploads, JSON schema, Zod validation, troubleshooting |
| [Export, captions, and files](export-and-files.md) | Caption parsers, MP3 split + CSV, ffmpeg, paths on disk |
| [Build and release](build-and-release.md) | Vite, Electrobun packaging, DMG vs dev builds, artifacts |
| [Configuration](configuration.md) | Environment variables, `config.json`, API key resolution |
| [Requirements](requirements.md) | Functional and non-functional requirements (spec-style) |

## Repository map (quick reference)

| Area | Path |
|------|------|
| Bun entry + RPC wiring | `src/bun/index.ts` |
| Gemini client | `src/bun/services/geminiClient.ts` |
| System prompt | `src/bun/services/geminiPrompts.ts` |
| MP3 split + CSV | `src/bun/services/audioSplitter.ts` |
| Caption parsers | `src/bun/parsers/caption.ts` |
| Config / history | `src/bun/services/configStore.ts`, `historyStore.ts` |
| Shared types + Zod | `src/shared/rpcTypes.ts`, `src/shared/schema/analysisOutput.ts` |
| React UI | `src/mainview/` |
| Electrobun config | `electrobun.config.ts` |
| Vite config | `vite.config.ts` |
