import { AbstractTTSClient } from "../core/abstract-tts";
import type { SpeakOptions, TTSCredentials, UnifiedVoice } from "../types";

// Dynamic require/import for meSpeak
let meSpeak: any = null;

// Function to load meSpeak module
async function loadMeSpeak() {
  if (meSpeak) return meSpeak;

  try {
    if (typeof window !== "undefined") {
      // Browser environment - meSpeak should be loaded globally
      if ((window as any).meSpeak) {
        meSpeak = (window as any).meSpeak;
        return meSpeak;
      }
      throw new Error(
        "meSpeak is not loaded. Please include meSpeak.js in your HTML or install the mespeak package."
      );
    }
    // Node.js environment - use dynamic import for ESM compatibility
    meSpeak = await import("mespeak" as any);

    // Handle both default and named exports
    if (meSpeak.default) {
      meSpeak = meSpeak.default;
    }
    return meSpeak;
  } catch (err) {
    console.error("Error loading meSpeak:", err);
    throw new Error("meSpeak package not found. Please install it with: npm install mespeak");
  }
}

// meSpeak options interface
interface MeSpeakOptions {
  voice?: string;
  amplitude?: number;
  wordgap?: number;
  pitch?: number;
  speed?: number;
  variant?: string;
  volume?: number;
  rawdata?: boolean | string;
}

/**
 * eSpeak TTS client for browser environments using meSpeak.js
 * This provides eSpeak functionality in browsers and Node.js via WebAssembly
 * For Node.js-only environments with better performance, use EspeakNodeTTSClient instead.
 */
export class EspeakBrowserTTSClient extends AbstractTTSClient {
  constructor(credentials: TTSCredentials = {}) {
    super(credentials);

    // Set a default voice for eSpeak TTS
    this.voiceId = "en"; // Default English voice
  }

  async synthToBytes(text: string, options?: SpeakOptions): Promise<Uint8Array> {
    try {
      // Load the meSpeak module
      const meSpeakModule = await loadMeSpeak();

      // Prepare options for meSpeak
      const meSpeakOptions: MeSpeakOptions = {
        rawdata: true, // Get raw audio data instead of playing
      };

      // Use voice from options or the default voice
      const voiceId = options?.voice || this.voiceId || "en";
      meSpeakOptions.voice = voiceId;

      // Map other options to meSpeak format
      if (options?.rate) {
        // meSpeak uses speed in words per minute, default is 175
        // Convert from rate (0.1-10) to WPM (50-400)
        const rateNum =
          typeof options.rate === "string" ? Number.parseFloat(options.rate) : options.rate;
        const rate = Math.max(0.1, Math.min(10, rateNum));
        meSpeakOptions.speed = Math.round(50 + ((rate - 0.1) * (400 - 50)) / (10 - 0.1));
      }

      if (options?.pitch) {
        // meSpeak uses pitch 0-99, default is 50
        // Convert from pitch (0.1-2) to 0-99
        const pitchNum =
          typeof options.pitch === "string" ? Number.parseFloat(options.pitch) : options.pitch;
        const pitch = Math.max(0.1, Math.min(2, pitchNum));
        meSpeakOptions.pitch = Math.round(((pitch - 0.1) * 99) / (2 - 0.1));
      }

      // Call meSpeak to generate audio with a callback
      return new Promise((resolve, reject) => {
        meSpeakModule.speak(
          text,
          meSpeakOptions,
          (success: boolean, _id: number, stream: ArrayBuffer) => {
            if (success && stream) {
              resolve(new Uint8Array(stream));
            } else {
              reject(new Error("Failed to synthesize speech with meSpeak"));
            }
          }
        );
      });
    } catch (err) {
      console.error("eSpeak WASM TTS synthesis error:", err);
      throw new Error(
        `Failed to synthesize speech with eSpeak WASM: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Synthesize text to a byte stream (ReadableStream)
   * @param text Text to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to an object containing the audio stream and an empty word boundaries array.
   */
  async synthToBytestream(
    text: string,
    options?: SpeakOptions
  ): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
  }> {
    const audioBytes = await this.synthToBytes(text, options);

    // "Fake" streaming by wrapping full audio in a ReadableStream
    const audioStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(audioBytes);
        controller.close();
      },
    });

    return { audioStream, wordBoundaries: [] };
  }

  /**
   * Return available voices for eSpeak WASM
   */
  async _getVoices(): Promise<UnifiedVoice[]> {
    // meSpeak supports many languages, here's a subset of common ones
    const commonVoices = [
      { id: "en", name: "English", language: "English" },
      { id: "en-us", name: "English (US)", language: "English" },
      { id: "en-rp", name: "English (RP)", language: "English" },
      { id: "en-sc", name: "English (Scottish)", language: "English" },
      { id: "es", name: "Spanish", language: "Spanish" },
      { id: "es-la", name: "Spanish (Latin America)", language: "Spanish" },
      { id: "fr", name: "French", language: "French" },
      { id: "de", name: "German", language: "German" },
      { id: "it", name: "Italian", language: "Italian" },
      { id: "pt", name: "Portuguese (Brazil)", language: "Portuguese" },
      { id: "pt-pt", name: "Portuguese (European)", language: "Portuguese" },
      { id: "ru", name: "Russian", language: "Russian" },
      { id: "zh", name: "Chinese (Mandarin)", language: "Chinese" },
      { id: "zh-yue", name: "Chinese (Cantonese)", language: "Chinese" },
      { id: "ja", name: "Japanese", language: "Japanese" },
      { id: "ko", name: "Korean", language: "Korean" },
      { id: "ar", name: "Arabic", language: "Arabic" },
      { id: "hi", name: "Hindi", language: "Hindi" },
      { id: "nl", name: "Dutch", language: "Dutch" },
      { id: "sv", name: "Swedish", language: "Swedish" },
      { id: "da", name: "Danish", language: "Danish" },
      { id: "no", name: "Norwegian", language: "Norwegian" },
      { id: "fi", name: "Finnish", language: "Finnish" },
      { id: "pl", name: "Polish", language: "Polish" },
      { id: "cs", name: "Czech", language: "Czech" },
      { id: "hu", name: "Hungarian", language: "Hungarian" },
      { id: "tr", name: "Turkish", language: "Turkish" },
      { id: "he", name: "Hebrew", language: "Hebrew" },
      { id: "th", name: "Thai", language: "Thai" },
      { id: "vi", name: "Vietnamese", language: "Vietnamese" },
    ];

    const voices: UnifiedVoice[] = commonVoices.map((voice) => ({
      id: voice.id,
      name: `${voice.name} (eSpeak WASM)`,
      gender: "Unknown", // meSpeak doesn't typically provide gender info
      provider: "espeak-ng",
      languageCodes: [
        {
          bcp47: voice.id.split("-")[0], // Use the base language code
          iso639_3: "", // Would need mapping
          display: voice.language,
        },
      ],
    }));

    return voices;
  }

  /**
   * Check if credentials are valid (eSpeak doesn't need credentials)
   */
  async checkCredentials(): Promise<boolean> {
    try {
      await loadMeSpeak();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get detailed credential validation info
   */
  async checkCredentialsAdvanced(): Promise<{
    valid: boolean;
    message: string;
    details?: Record<string, any>;
  }> {
    try {
      const meSpeakModule = await loadMeSpeak();
      return {
        valid: true,
        message: "eSpeak WASM is available and ready to use",
        details: {
          version: meSpeakModule.version || "unknown",
          environment: typeof window !== "undefined" ? "browser" : "node",
        },
      };
    } catch (err) {
      return {
        valid: false,
        message: `eSpeak WASM not available: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}

// Backward compatibility export
export { EspeakBrowserTTSClient as EspeakWasmTTSClient };
