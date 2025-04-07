// Core exports
export { AbstractTTSClient } from "./core/abstract-tts";
export { SSMLUtils } from "./core/ssml-utils";
export { VoiceUtils } from "./core/voice-utils";
export { AudioPlayback } from "./core/playback";

// SSML exports
export { SSMLBuilder } from "./ssml/builder";

// Markdown exports
export { SpeechMarkdownConverter } from "./markdown/converter";

// Engine exports
export { AzureTTSClient } from "./engines/azure";

// Type exports
export type {
  SpeakOptions,
  UnifiedVoice,
  TTSCredentials,
  TTSEventType,
  WordBoundaryCallback,
  SimpleCallback,
} from "./types";
