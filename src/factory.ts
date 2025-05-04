// Factory for TTS clients (browser/server compatible)
import { AzureTTSClient } from "./engines/azure.js";
import { ElevenLabsTTSClient } from "./engines/elevenlabs.js";
import { GoogleTTSClient } from "./engines/google.js";
import { OpenAITTSClient } from "./engines/openai.js";
import { PlayHTTTSClient } from "./engines/playht.js";
import { PollyTTSClient } from "./engines/polly.js";
import { WatsonTTSClient } from "./engines/watson.js";
import { WitAITTSClient } from "./engines/witai.js";
import type { TTSCredentials } from "./types";

export type SupportedTTS = "azure" | "google" | "polly" | "elevenlabs" | "openai" | "playht" | "watson" | "witai";

export function createTTSClient(engine: SupportedTTS, credentials: TTSCredentials) {
  switch (engine) {
    case "azure":
      return new AzureTTSClient(credentials as { subscriptionKey: string; region: string });
    case "google":
      return new GoogleTTSClient(credentials as import("./engines/google").GoogleTTSCredentials);
    case "polly":
      return new PollyTTSClient(credentials as import("./engines/polly").PollyTTSCredentials);
    case "elevenlabs":
      return new ElevenLabsTTSClient(credentials as import("./engines/elevenlabs").ElevenLabsCredentials);
    case "openai":
      return new OpenAITTSClient(credentials as import("./engines/openai").OpenAITTSCredentials);
    case "playht":
      return new PlayHTTTSClient(credentials as import("./engines/playht").PlayHTTTSCredentials);
    case "watson":
      return new WatsonTTSClient(credentials as import("./engines/watson").WatsonTTSCredentials);
    case "witai":
      return new WitAITTSClient(credentials as import("./engines/witai").WitAITTSCredentials);
    default:
      throw new Error(`Engine '${engine}' is not supported in the factory.`);
  }
}
