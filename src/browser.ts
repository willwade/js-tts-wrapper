/**
 * Browser-compatible entry point for js-tts-wrapper
 *
 * This file exports only the components that work in browser environments.
 */

// Core components
export { AbstractTTSClient } from "./core/abstract-tts";
// Browser-compatible engines
export { AzureTTSClient } from "./engines/azure";
export { CartesiaTTSClient } from "./engines/cartesia";
export { DeepgramTTSClient } from "./engines/deepgram";
export { ElevenLabsTTSClient } from "./engines/elevenlabs";
export { EspeakBrowserTTSClient } from "./engines/espeak-wasm";
export { FishAudioTTSClient } from "./engines/fishaudio";
export { GoogleTTSClient } from "./engines/google";
export { HumeTTSClient } from "./engines/hume";
export { MistralTTSClient } from "./engines/mistral";
export { ModelsLabTTSClient } from "./engines/modelslab";
export { MurfTTSClient } from "./engines/murf";
export { OpenAITTSClient } from "./engines/openai";
export { PlayHTTTSClient } from "./engines/playht";
export { PollyTTSClient } from "./engines/polly";
export { ResembleTTSClient } from "./engines/resemble";
export { SherpaOnnxWasmTTSClient } from "./engines/sherpaonnx-wasm";
export { UnrealSpeechTTSClient } from "./engines/unrealspeech";
export { UpliftAITTSClient } from "./engines/upliftai";
export { WatsonTTSClient } from "./engines/watson";
export { WitAITTSClient } from "./engines/witai";
export { XaiTTSClient } from "./engines/xai";
// Browser-compatible factory (excludes server-only engines)
export { createBrowserTTSClient } from "./factory-browser";
export * as SpeechMarkdown from "./markdown/converter-browser";
export { configureSpeechMarkdown, SpeechMarkdownConverter } from "./markdown/converter-browser";
export { SSMLBuilder } from "./ssml/builder";

// Mock client for testing (if available)
// Note: This is conditionally exported in factory.ts instead

// Types
export * from "./types";
export { isBrowser, isNode } from "./utils/environment";
// Utilities
export { estimateWordBoundaries } from "./utils/word-timing-estimator";
export * as VoiceUtils from "./core/voice-utils";
