// Core exports
export { AbstractTTSClient } from "./core/abstract-tts";
export * as SSMLUtils from "./core/ssml-utils";
export * as VoiceUtils from "./core/voice-utils";
export { AudioPlayback } from "./core/playback";

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
export { SherpaOnnxWasmTTSClient } from "./engines/sherpaonnx-wasm";
export { EspeakTTSClient } from "./engines/espeak";
export { WatsonTTSClient } from "./engines/watson";

// Type exports
export type {
  SpeakOptions,
  UnifiedVoice,
  TTSCredentials,
  TTSEventType,
  WordBoundaryCallback,
  SimpleCallback,
  PropertyType,
} from "./types";
