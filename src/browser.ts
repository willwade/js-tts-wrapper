/**
 * Browser-compatible entry point for js-tts-wrapper
 *
 * This file exports only the components that work in browser environments.
 */

// Core components
export { AbstractTTSClient } from "./core/abstract-tts";
export { SSMLBuilder } from "./ssml/builder";
export { SpeechMarkdownConverter } from "./markdown/converter-browser";

// Browser-compatible engines
export { AzureTTSClient } from "./engines/azure";
export { ElevenLabsTTSClient } from "./engines/elevenlabs";
export { GoogleTTSClient } from "./engines/google";
export { OpenAITTSClient } from "./engines/openai";
export { PlayHTTTSClient } from "./engines/playht";
export { PollyTTSClient } from "./engines/polly";
export { WatsonTTSClient } from "./engines/watson";
export { WitAITTSClient } from "./engines/witai";
export { SherpaOnnxWasmTTSClient } from "./engines/sherpaonnx-wasm";
export { EspeakBrowserTTSClient } from "./engines/espeak-wasm";
export { UpliftAITTSClient } from "./engines/upliftai";

// Browser-compatible factory (excludes server-only engines)
export { createBrowserTTSClient } from "./factory-browser";

// Mock client for testing (if available)
// Note: This is conditionally exported in factory.ts instead

// Utilities
export { estimateWordBoundaries } from "./utils/word-timing-estimator";
export { isBrowser, isNode } from "./utils/environment";

// Types
export * from "./types";
