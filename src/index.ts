// Core exports
export { AbstractTTSClient } from "./core/abstract-tts";
export * as SSMLUtils from "./core/ssml-utils";
export * as VoiceUtils from "./core/voice-utils";
export { AudioPlayback } from "./core/playback";

// Factory export
export * from "./factory";

// SSML exports
export { SSMLBuilder } from "./ssml/builder";

// Markdown exports
export * as SpeechMarkdown from "./markdown/converter";

// Utility exports
export { getFetch, isFetchAvailable } from "./utils/fetch-utils";

// Engine exports
export { AzureTTSClient } from "./engines/azure";
export { ElevenLabsTTSClient } from "./engines/elevenlabs";
export { GoogleTTSClient } from "./engines/google";
export { OpenAITTSClient } from "./engines/openai";
export { PlayHTTTSClient } from "./engines/playht";
export { PollyTTSClient } from "./engines/polly";
export { SherpaOnnxTTSClient } from "./engines/sherpaonnx";
// Note: The browser-only SherpaONNX WASM engine is not exported from the Node entry.
// Import it from 'js-tts-wrapper/browser' instead.
// export { SherpaOnnxWasmTTSClient } from "./engines/sherpaonnx-wasm";
export { EspeakNodeTTSClient, EspeakTTSClient } from "./engines/espeak";
export { EspeakBrowserTTSClient, EspeakWasmTTSClient } from "./engines/espeak-wasm";
export { WatsonTTSClient } from "./engines/watson";
export { WitAITTSClient } from "./engines/witai";
export { UpliftAITTSClient } from "./engines/upliftai";
export { SAPITTSClient } from "./engines/sapi";

// Type exports
export type {
  CredentialsCheckResult,
  SpeakOptions,
  UnifiedVoice,
  TTSCredentials,
  TTSEventType,
  WordBoundaryCallback,
  SimpleCallback,
  PropertyType,
} from "./types";
