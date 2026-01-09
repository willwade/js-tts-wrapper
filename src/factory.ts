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
  const applyProperties = (client: any) => {
    if (!credentials || typeof (client as any)?.setProperty !== "function") {
      return client;
    }

    const rawProps =
      (credentials as any).properties ??
      (credentials as any).propertiesJson ??
      (credentials as any).propertiesJSON;

    let parsedProps: Record<string, unknown> | null = null;
    if (typeof rawProps === "string") {
      try {
        parsedProps = JSON.parse(rawProps);
      } catch (error) {
        console.warn("Failed to parse properties JSON passed to factory:", error);
      }
    } else if (rawProps && typeof rawProps === "object") {
      parsedProps = rawProps as Record<string, unknown>;
    }

    if (parsedProps) {
      for (const [key, value] of Object.entries(parsedProps)) {
        try {
          client.setProperty(key, value);
        } catch (error) {
          console.warn(`Failed to apply property '${key}' in factory:`, error);
        }
      }
    }

    return client;
  };

  switch (engine) {
    case "azure":
      return applyProperties(
        new AzureTTSClient(credentials as { subscriptionKey: string; region: string })
      );
    case "google":
      return applyProperties(
        new GoogleTTSClient(credentials as import("./engines/google").GoogleTTSCredentials)
      );
    case "polly":
      return applyProperties(
        new PollyTTSClient(credentials as import("./engines/polly").PollyTTSCredentials)
      );
    case "elevenlabs":
      return applyProperties(
        new ElevenLabsTTSClient(credentials as import("./engines/elevenlabs").ElevenLabsCredentials)
      );
    case "openai":
      return applyProperties(
        new OpenAITTSClient(credentials as import("./engines/openai").OpenAITTSCredentials)
      );
    case "playht":
      return applyProperties(
        new PlayHTTTSClient(credentials as import("./engines/playht").PlayHTTTSCredentials)
      );
    case "watson":
      return applyProperties(
        new WatsonTTSClient(credentials as import("./engines/watson").WatsonTTSCredentials)
      );
    case "witai":
      return applyProperties(
        new WitAITTSClient(credentials as import("./engines/witai").WitAITTSCredentials)
      );
    case "upliftai":
      return applyProperties(
        new UpliftAITTSClient(credentials as import("./engines/upliftai").UpliftAITTSCredentials)
      );
    case "sherpaonnx":
      return applyProperties(new SherpaOnnxTTSClient(credentials as any));
    case "sherpaonnx-wasm":
      return applyProperties(new SherpaOnnxWasmTTSClient(credentials as any));
    case "espeak":
      return applyProperties(new EspeakTTSClient(credentials as any));
    case "espeak-wasm":
      return applyProperties(new EspeakWasmTTSClient(credentials as any));
    case "sapi":
      return applyProperties(
        new SAPITTSClient(credentials as import("./engines/sapi").SAPITTSCredentials)
      );
    case "mock":
      if (MockTTSClient) {
        return applyProperties(new MockTTSClient());
      }
      throw new Error(
        "MockTTSClient is not available. This is only available in development/testing environments."
      );
    default:
      throw new Error(`Engine '${engine}' is not supported in the factory.`);
  }
}
