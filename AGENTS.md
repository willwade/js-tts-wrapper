# js-tts-wrapper — AI Agent Development Guide

## Project Overview

js-tts-wrapper is a unified TypeScript/JavaScript TTS library that abstracts 14+ cloud and local providers (Azure, Google, Polly, ElevenLabs, OpenAI, PlayHT, Watson, WitAI, UpliftAI, ModelsLab, SherpaONNX, eSpeak, SAPI). It targets both Node.js and browser environments.

**Key Technologies:**
- TypeScript
- Rollup (browser bundle), tsc (CJS/ESM)
- Jest (unit tests)
- Biome (lint/format — `src/utils`, `src/ssml`, `src/markdown` only)

## Project Structure

```
src/
├── core/             # AbstractTTSClient base class, playback, SSML utils
├── engines/          # One file per provider (azure.ts, elevenlabs.ts, etc.)
├── ssml/             # Fluent SSML builder
├── utils/            # Audio conversion, fetch, environment detection
├── factory.ts        # createTTSClient() factory (Node)
├── factory-browser.ts# createBrowserTTSClient() factory (browser)
├── browser.ts        # Browser entry point
├── index.ts          # Main entry point
└── types.ts          # Shared interfaces (SpeakOptions, UnifiedVoice, etc.)

__tests__/            # Jest unit tests
test/                 # Engine integration tests (require credentials)
scripts/              # Build, packaging, and setup scripts
examples/             # Usage examples
dist/                 # Compiled output (do not edit)
```

## Adding a New Engine

1. Create `src/engines/<name>.ts` — extend `AbstractTTSClient`
2. Define credential and options interfaces (extend `TTSCredentials` and `SpeakOptions`)
3. Set `this.capabilities = { browserSupported: true/false, nodeSupported: true/false }`
4. Implement required abstract methods: `synthToBytes()`, `synthToBytestream()`, `_getVoices()`
5. Add the engine to `factory.ts`, `factory-browser.ts`, and `src/browser.ts` exports
6. Add engine type to the `SupportedTTS` union in `src/types.ts`

## Browser Safety

Never use static `import('node:...')` in code that ends up in the browser bundle. Use the `new Function` pattern to hide dynamic Node.js imports from bundlers:

```ts
// Wrong — breaks Turbopack/Vite
const fs = await import(`node:${name}`);

// Correct — opaque to static analysis
const fs = await (new Function('m', 'return import(m)'))('node:fs');
```

Guard Node.js-only code paths with `typeof window !== 'undefined'` checks.

## Development Workflow

### 1. Issue Creation
Every piece of work starts with a GitHub issue.

### 2. Branch Strategy
Create a branch from `main` referencing the issue number:
```bash
git checkout -b feat/42-new-engine-name
```

### 3. Build & Test
```bash
npm run build        # Full build (CJS + ESM + browser bundle)
npm run lint         # Biome lint
npm run test         # Jest unit tests
```

Ensure `npm run build` passes before opening a PR.

### 4. Pull Request
- PR against `main`
- Reference the issue number in the PR description

### 5. Release Process
1. Create a GitHub Release with a version tag (e.g. `gh release create v0.1.73 --title v0.1.73 --generate-notes`)
2. The `Test and Publish` workflow triggers on the release event, runs tests, publishes to npm via OIDC trusted publishing, then commits the version bump back to `main` automatically

## Key Interfaces

```ts
// Core base class — all engines extend this
AbstractTTSClient  // src/core/abstract-tts.ts

// Shared types
SpeakOptions       // rate, pitch, volume, format, rawSSML
UnifiedVoice       // id, name, gender, language, ...
TTSCredentials     // base credentials type
WordBoundaryCallback
```

## Build Outputs

| Format | Location | Use |
|--------|----------|-----|
| CJS | `dist/cjs/` | Node.js `require()` |
| ESM | `dist/esm/` | Node.js `import`, bundlers |
| Browser bundle | `dist/js-tts-wrapper.browser.js` | Browser UMD |
| Types | `dist/*.d.ts` | TypeScript |

Publishing happens from `dist/` (see `scripts/package.cjs`).
