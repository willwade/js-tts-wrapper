/**
 * Browser-compatible entry point for js-tts-wrapper
 *
 * This file exports only the components that work in browser environments.
 */

// Core components
export { AbstractTTSClient } from "./core/abstract-tts";
export { SSMLBuilder } from "./ssml/builder";
export { SpeechMarkdownConverter } from "./markdown/converter";

// Browser-compatible engines
export { SherpaOnnxWasmTTSClient } from "./engines/sherpaonnx-wasm";

// Utilities
export { estimateWordBoundaries } from "./utils/word-timing-estimator";
export { isBrowser, isNode } from "./utils/environment";

// Types
export * from "./types";
