// Factory for TTS clients (browser/server compatible)
import { AzureTTSClient } from "./engines/azure.js";
import { ElevenLabsTTSClient } from "./engines/elevenlabs.js";
import { EspeakWasmTTSClient } from "./engines/espeak-wasm.js";
import { EspeakTTSClient } from "./engines/espeak.js";
import { GoogleTTSClient } from "./engines/google.js";
import { OpenAITTSClient } from "./engines/openai.js";
import { PlayHTTTSClient } from "./engines/playht.js";
import { PollyTTSClient } from "./engines/polly.js";
import { UpliftAITTSClient } from "./engines/upliftai.js";
import { SherpaOnnxWasmTTSClient } from "./engines/sherpaonnx-wasm.js";
import { SherpaOnnxTTSClient } from "./engines/sherpaonnx.js";
import { WatsonTTSClient } from "./engines/watson.js";
import { WitAITTSClient } from "./engines/witai.js";
import { SAPITTSClient } from "./engines/sapi.js";
import type { TTSCredentials } from "./types";

// Import MockTTSClient for testing
let MockTTSClient: any;
try {
  // Dynamic import to avoid circular dependencies
  import("./__tests__/mock-tts-client.helper.js")
    .then((module) => {
      MockTTSClient = module.MockTTSClient;
    })
    .catch(() => {
      // Ignore errors
    });
} catch (_e) {
  // Ignore errors
}

export type SupportedTTS =
  | "azure"
  | "google"
  | "polly"
  | "elevenlabs"
  | "openai"
  | "playht"
  | "watson"
  | "witai"
  | "upliftai"
  | "sherpaonnx"
  | "sherpaonnx-wasm"
  | "espeak"
  | "espeak-wasm"
  | "sapi"
  | "mock";

export function createTTSClient(engine: SupportedTTS, credentials?: TTSCredentials) {
  switch (engine) {
    case "azure":
      return new AzureTTSClient(credentials as { subscriptionKey: string; region: string });
    case "google":
      return new GoogleTTSClient(credentials as import("./engines/google").GoogleTTSCredentials);
    case "polly":
      return new PollyTTSClient(credentials as import("./engines/polly").PollyTTSCredentials);
    case "elevenlabs":
      return new ElevenLabsTTSClient(
        credentials as import("./engines/elevenlabs").ElevenLabsCredentials
      );
    case "openai":
      return new OpenAITTSClient(credentials as import("./engines/openai").OpenAITTSCredentials);
    case "playht":
      return new PlayHTTTSClient(credentials as import("./engines/playht").PlayHTTTSCredentials);
    case "watson":
      return new WatsonTTSClient(credentials as import("./engines/watson").WatsonTTSCredentials);
    case "witai":
      return new WitAITTSClient(credentials as import("./engines/witai").WitAITTSCredentials);
    case "upliftai":
      return new UpliftAITTSClient(
        credentials as import("./engines/upliftai").UpliftAITTSCredentials
      );
    case "sherpaonnx":
      return new SherpaOnnxTTSClient(credentials as any);
    case "sherpaonnx-wasm":
      return new SherpaOnnxWasmTTSClient(credentials as any);
    case "espeak":
      return new EspeakTTSClient(credentials as any);
    case "espeak-wasm":
      return new EspeakWasmTTSClient(credentials as any);
    case "sapi":
      return new SAPITTSClient(credentials as import("./engines/sapi").SAPITTSCredentials);
    case "mock":
      if (MockTTSClient) {
        return new MockTTSClient();
      }
      throw new Error(
        "MockTTSClient is not available. This is only available in development/testing environments."
      );
    default:
      throw new Error(`Engine '${engine}' is not supported in the factory.`);
  }
}
