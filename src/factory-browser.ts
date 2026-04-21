// Browser-compatible factory for TTS clients
import { AzureTTSClient } from "./engines/azure.js";
import { CartesiaTTSClient } from "./engines/cartesia.js";
import { CereVoiceTTSClient } from "./engines/cerevoice.js";
import { DeepgramTTSClient } from "./engines/deepgram.js";
import { ElevenLabsTTSClient } from "./engines/elevenlabs.js";
import { EspeakBrowserTTSClient } from "./engines/espeak-wasm.js";
import { FishAudioTTSClient } from "./engines/fishaudio.js";
import { GeminiTTSClient } from "./engines/gemini.js";
import { GoogleTTSClient } from "./engines/google.js";
import { HumeTTSClient } from "./engines/hume.js";
import { MistralTTSClient } from "./engines/mistral.js";
import { ModelsLabTTSClient } from "./engines/modelslab.js";
import { MurfTTSClient } from "./engines/murf.js";
import { OpenAITTSClient } from "./engines/openai.js";
import { PlayHTTTSClient } from "./engines/playht.js";
import { PollyTTSClient } from "./engines/polly.js";
import { ResembleTTSClient } from "./engines/resemble.js";
import { SherpaOnnxWasmTTSClient } from "./engines/sherpaonnx-wasm.js";
import { UnrealSpeechTTSClient } from "./engines/unrealspeech.js";
import { UpliftAITTSClient } from "./engines/upliftai.js";
import { WatsonTTSClient } from "./engines/watson.js";
import { WitAITTSClient } from "./engines/witai.js";
import { XaiTTSClient } from "./engines/xai.js";
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

export type SupportedBrowserTTS =
  | "azure"
  | "cartesia"
  | "cerevoice"
  | "deepgram"
  | "fishaudio"
  | "gemini"
  | "google"
  | "hume"
  | "mistral"
  | "murf"
  | "polly"
  | "elevenlabs"
  | "openai"
  | "playht"
  | "watson"
  | "witai"
  | "xai"
  | "resemble"
  | "unrealspeech"
  | "upliftai"
  | "modelslab"
  | "sherpaonnx-wasm"
  | "espeak-wasm"
  | "mock";

export function createBrowserTTSClient(engine: SupportedBrowserTTS, credentials?: TTSCredentials) {
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
        console.warn("Failed to parse properties JSON passed to browser factory:", error);
      }
    } else if (rawProps && typeof rawProps === "object") {
      parsedProps = rawProps as Record<string, unknown>;
    }

    if (parsedProps) {
      for (const [key, value] of Object.entries(parsedProps)) {
        try {
          client.setProperty(key, value);
        } catch (error) {
          console.warn(`Failed to apply property '${key}' in browser factory:`, error);
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
    case "cartesia":
      return applyProperties(
        new CartesiaTTSClient(credentials as import("./engines/cartesia").CartesiaTTSCredentials)
      );
    case "cerevoice":
      return applyProperties(
        new CereVoiceTTSClient(credentials as import("./engines/cerevoice").CereVoiceTTSCredentials)
      );
    case "deepgram":
      return applyProperties(
        new DeepgramTTSClient(credentials as import("./engines/deepgram").DeepgramTTSCredentials)
      );
    case "fishaudio":
      return applyProperties(
        new FishAudioTTSClient(credentials as import("./engines/fishaudio").FishAudioTTSCredentials)
      );
    case "gemini":
      return applyProperties(
        new GeminiTTSClient(credentials as import("./engines/gemini").GeminiTTSCredentials)
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
    case "xai":
      return applyProperties(
        new XaiTTSClient(credentials as import("./engines/xai").XaiTTSCredentials)
      );
    case "upliftai":
      return applyProperties(
        new UpliftAITTSClient(credentials as import("./engines/upliftai").UpliftAITTSCredentials)
      );
    case "hume":
      return applyProperties(
        new HumeTTSClient(credentials as import("./engines/hume").HumeTTSCredentials)
      );
    case "mistral":
      return applyProperties(
        new MistralTTSClient(credentials as import("./engines/mistral").MistralTTSCredentials)
      );
    case "murf":
      return applyProperties(
        new MurfTTSClient(credentials as import("./engines/murf").MurfTTSCredentials)
      );
    case "modelslab":
      return applyProperties(
        new ModelsLabTTSClient(credentials as import("./engines/modelslab").ModelsLabTTSCredentials)
      );
    case "resemble":
      return applyProperties(
        new ResembleTTSClient(credentials as import("./engines/resemble").ResembleTTSCredentials)
      );
    case "unrealspeech":
      return applyProperties(
        new UnrealSpeechTTSClient(
          credentials as import("./engines/unrealspeech").UnrealSpeechTTSCredentials
        )
      );
    case "sherpaonnx-wasm":
      return applyProperties(new SherpaOnnxWasmTTSClient(credentials as any));
    case "espeak-wasm":
      return applyProperties(new EspeakBrowserTTSClient(credentials as any));
    case "mock":
      if (MockTTSClient) {
        return applyProperties(new MockTTSClient());
      }
      throw new Error(
        "MockTTSClient is not available. This is only available in development/testing environments."
      );
    default:
      throw new Error(`Engine '${engine}' is not supported in the browser factory.`);
  }
}

// Re-export the main factory function with a different name for compatibility
export { createBrowserTTSClient as createTTSClient };
