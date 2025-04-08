// Core exports
export { AbstractTTSClient } from "./core/abstract-tts";
export * as SSMLUtils from "./core/ssml-utils";
export * as VoiceUtils from "./core/voice-utils";
export { AudioPlayback } from "./core/playback";

// SSML exports
export { SSMLBuilder } from "./ssml/builder";

// Markdown exports
export * as SpeechMarkdown from "./markdown/converter";

// Engine exports
export { AzureTTSClient } from "./engines/azure";
export { ElevenLabsTTSClient } from "./engines/elevenlabs";
export { GoogleTTSClient } from "./engines/google";
export { OpenAITTSClient } from "./engines/openai";
export { PlayHTTTSClient } from "./engines/playht";
export { PollyTTSClient } from "./engines/polly";
export { SherpaOnnxTTSClient } from "./engines/sherpaonnx";

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
