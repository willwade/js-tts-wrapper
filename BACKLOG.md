# js-tts-wrapper Engine & Feature Backlog

Reference: [speech-sdk](https://github.com/Jellypod-Inc/speech-sdk) (`@speech-sdk/core`)

## Completed

- [x] Cartesia engine (`sonic-3`, `sonic-2`) with audio tag / emotion-to-SSML support
- [x] Deepgram engine (`aura-2`) with static voice list
- [x] ElevenLabs v3 audio tag passthrough (`[laugh]`, `[sigh]`, etc.)
- [x] Generic property pass-through via `properties` / `propertiesJson`
- [x] Hume engine (`octave-2`, `octave-1`) with streaming via separate `/tts/stream/file` endpoint
- [x] xAI engine (`grok-tts`) with native audio tag passthrough, language config
- [x] Fish Audio engine (`s2-pro`) with audio tag passthrough, model-as-header pattern
- [x] Mistral engine (`voxtral-mini-tts-2603`) with SSE streaming, base64 chunk parsing
- [x] Murf engine (`GEN2`, `FALCON`) with dual model/endpoints, base64 GEN2 / binary FALCON
- [x] Unreal Speech engine with two-step URI non-streaming, direct streaming
- [x] Resemble engine with base64 JSON non-streaming, direct streaming

## New Engines to Add

### Lower Priority (Open-Source / Niche)

| Engine | Models | Key Features | Notes |
|--------|--------|-------------|-------|
| **fal** | `f5-tts`, `kokoro`, `dia-tts`, `orpheus-tts`, `index-tts-2` | Voice cloning, open-source | No streaming, many sub-models |
| **Google Gemini TTS** | `gemini-2.5-flash-preview-tts`, `gemini-2.5-pro-preview-tts` | Pseudo-streaming, 23 languages | Different from existing Google Cloud TTS |

## Cross-Cutting Features

### Audio Tags (Cross-Provider Abstraction)

Unified `[tag]` syntax mapped to provider-specific representations:
- **ElevenLabs v3** — native passthrough (done)
- **Cartesia sonic-3** — emotions to `<emotion value="..."/>` SSML (done)
- **OpenAI gpt-4o-mini-tts** — tags to natural language `instructions`
- **xAI grok-tts** — native passthrough
- **Fish Audio s2-pro** — native passthrough
- **All others** — strip tags with warnings

### Model-Level Feature Declarations

Add per-model capability metadata (from speech-sdk pattern):
- `streaming` — supports real-time audio streaming
- `audio-tags` — supports `[tag]` syntax
- `inline-voice-cloning` — accepts reference audio inline
- `open-source` — model is open source

Enables runtime capability checks via `hasFeature()`.

### Unified Voice Type

Current: engine-specific voice IDs
Proposed: `string | { url: string } | { audio: string | Uint8Array }`
- `string` — standard voice ID
- `{ url }` — voice cloning from URL
- `{ audio }` — voice cloning from inline audio

### Voice Cloning Support

Providers that support inline voice cloning:
- Cartesia sonic-3
- Hume octave-2
- Fish Audio s2-pro
- Resemble
- Mistral voxtral-mini-tts-2603
- fal (f5-tts, dia-tts, index-tts-2)

### Streaming Improvements

- [x] Cartesia: true streaming (already pipes response.body)
- [x] Deepgram: true streaming (already pipes response.body)
- [x] ElevenLabs: true streaming (fixed — pipes response.body when not using timestamps)
- [x] Polly: true streaming for MP3/OGG (already pipes AudioStream; WAV requires buffering for header)
- [x] Standardize `synthToBytestream` to return actual streaming responses where supported
- Google Cloud TTS: SDK returns all audio at once — would need StreamingSynthesize beta API
- Google Gemini TTS: pseudo-streaming via SSE base64 chunks (new engine, not yet implemented)

### Tree-Shakeable Subpath Exports

From speech-sdk pattern — add per-provider subpath exports in package.json:
```json
{
  "exports": {
    ".": "./dist/esm/index.js",
    "./cartesia": "./dist/esm/engines/cartesia.js",
    "./deepgram": "./dist/esm/engines/deepgram.js"
  }
}
```

### Unified Error Hierarchy

Standardize errors across engines with rich context (statusCode, model, responseBody).

## Existing Engine Updates Needed

| Engine | Update Needed |
|--------|--------------|
| **OpenAI** | Add `gpt-4o-mini-tts` model with instructions/audio tag support |
| **Google** | Add Gemini-based TTS alongside existing Cloud TTS |
| **ElevenLabs** | Close issue #24 (already fixed) |
