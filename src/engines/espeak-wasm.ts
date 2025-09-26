import { AbstractTTSClient } from "../core/abstract-tts";
import type { SpeakOptions, TTSCredentials, UnifiedVoice } from "../types";

// Function to detect if we're in a browser environment
function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

// Removed meSpeak interface - no longer used

/**
 * eSpeak TTS client for browser environments using meSpeak.js
 * This provides eSpeak functionality in browsers and Node.js via WebAssembly
 * For Node.js-only environments with better performance, use EspeakNodeTTSClient instead.
 */
export class EspeakBrowserTTSClient extends AbstractTTSClient {
  private nodeClient?: any;
  private meSpeak: any | null = null;
  private meSpeakReady = false;

  constructor(credentials: TTSCredentials = {}) {
    super(credentials);

    // Set a default voice for eSpeak TTS
    this.voiceId = "en"; // Default English voice

    // In Node.js environments, we'll lazily load the Node client when needed to avoid bundling it in browsers.
  }

  async synthToBytes(text: string, options?: SpeakOptions): Promise<Uint8Array> {
    // Node.js: delegate to Node client
    if (!isBrowser()) {
      if (!this.nodeClient) {
        const dynamicImport: any = new Function("m", "return import(m)");
        const mod = await dynamicImport("./espeak");
        const EspeakNodeTTSClient = (mod as any).EspeakNodeTTSClient || (mod as any).default;
        this.nodeClient = new EspeakNodeTTSClient(this.credentials);
      }
      return await this.nodeClient.synthToBytes(text, options);
    }

    // Browser: use meSpeak (UMD) with embedded config/voice JSONs
    await this.ensureMeSpeakLoaded();

    const meSpeak = this.meSpeak;
    if (!meSpeak) throw new Error("eSpeak-WASM: meSpeak failed to load");

    const voiceId = (this.voiceId || "en").toLowerCase();
    // pick meSpeak voice payload (limited set to keep bundle small)
    const voicePayload = await this.getVoicePayload(voiceId);
    if (!meSpeak.isConfigLoaded()) {
      const { default: configJson } = await import("mespeak/src/mespeak_config.json");
      meSpeak.loadConfig(configJson);
    }
    if (voicePayload && !meSpeak.isVoiceLoaded(voicePayload.voice_id)) {
      meSpeak.loadVoice(voicePayload);
      meSpeak.setDefaultVoice(voicePayload.voice_id);
    }

    // Map SpeakOptions rate/pitch to meSpeak numeric speed/pitch
    const rateToSpeed: Record<string, number> = {
      "x-slow": 80,
      slow: 120,
      medium: 175,
      fast: 220,
      "x-fast": 300,
    };
    const pitchMap: Record<string, number> = {
      "x-low": 10,
      low: 25,
      medium: 50,
      high: 70,
      "x-high": 90,
    };
    const speed = rateToSpeed[(options?.rate || "medium") as string] ?? 175;
    const pitch = pitchMap[(options?.pitch || "medium") as string] ?? 50;

    // get raw WAV buffer from meSpeak
    const arr: number[] | null = meSpeak.speak(text, {
      rawdata: "array",
      voice: voicePayload?.voice_id || voiceId,
      speed,
      pitch,
    });
    if (!arr || !arr.length) throw new Error("eSpeak-WASM: synthesis failed");
    return new Uint8Array(arr);
  }

  private async ensureMeSpeakLoaded(): Promise<void> {
    if (this.meSpeakReady) return;
    // mespeak is CommonJS; vite will shim a default export
    const mod: any = await import("mespeak");
    this.meSpeak = (mod && (mod.default || mod)) as any;
    this.meSpeakReady = true;
  }

  // Load a small curated set of English voices inline to avoid URL/CORS
  private async getVoicePayload(voiceId: string): Promise<any | null> {
    try {
      switch (voiceId) {
        case "en": {
          const { default: v } = await import("mespeak/voices/en/en.json");
          return v;
        }
        case "en-us": {
          const { default: v } = await import("mespeak/voices/en/en-us.json");
          return v;
        }
        case "en-rp": {
          const { default: v } = await import("mespeak/voices/en/en-rp.json");
          return v;
        }
        case "en-sc": {
          const { default: v } = await import("mespeak/voices/en/en-sc.json");
          return v;
        }
        case "en-wm": {
          const { default: v } = await import("mespeak/voices/en/en-wm.json");
          return v;
        }
        default: {
          // Fallback to plain English if requested voice not bundled
          const { default: v } = await import("mespeak/voices/en/en.json");
          return v;
        }
      }
    } catch {
      return null;
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

    // Generate word boundaries if requested
    let wordBoundaries: Array<{ text: string; offset: number; duration: number }> = [];

    if (options?.useWordBoundary) {
      // Create estimated word timings and store them
      this._createEstimatedWordTimings(text);

      // Convert internal timings to word boundary format
      wordBoundaries = this.timings.map(([start, end, word]) => ({
        text: word,
        offset: Math.round(start * 10000), // Convert to 100-nanosecond units
        duration: Math.round((end - start) * 10000),
      }));
    }

    // "Fake" streaming by wrapping full audio in a ReadableStream
    const audioStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(audioBytes);
        controller.close();
      },
    });

    return { audioStream, wordBoundaries };
  }

  /**
   * Return available voices for eSpeak WASM
   */
  async _getVoices(): Promise<UnifiedVoice[]> {
    // For Node.js environments, delegate to the regular eSpeak client (lazy loaded)
    if (!isBrowser()) {
      if (!this.nodeClient) {
        const dynamicImport: any = new Function("m", "return import(m)");
        const mod = await dynamicImport("./espeak");
        const EspeakNodeTTSClient = (mod as any).EspeakNodeTTSClient || (mod as any).default;
        this.nodeClient = new EspeakNodeTTSClient(this.credentials);
      }
      const nodeVoices = await this.nodeClient._getVoices();
      // Rename them to indicate they're from eSpeak WASM (but actually using Node.js fallback)
      return nodeVoices.map((voice: UnifiedVoice) => ({
        ...voice,
        name: voice.name.replace("(eSpeak)", "(eSpeak WASM)"),
      }));
    }
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
   * Get the list of required credential types for this engine
   * @returns Array of required credential field names
   */
  protected getRequiredCredentials(): string[] {
    return []; // eSpeak doesn't require any credentials
  }

  /**
   * Check if credentials are valid (eSpeak doesn't need credentials)
   */
  async checkCredentials(): Promise<boolean> {
    // eSpeak doesn't need credentials and we have fallbacks for both environments
    return true;
  }

  /**
   * Get detailed credential validation info
   */
  async checkCredentialsAdvanced(): Promise<{
    valid: boolean;
    message: string;
    details?: Record<string, any>;
  }> {
    return {
      valid: true,
      message: "eSpeak WASM is available with environment-specific fallbacks",
      details: {
        environment: isBrowser() ? "browser" : "node",
        engine: isBrowser() ? "meSpeak" : "text2wav",
        note: "Credentials not required for eSpeak",
      },
    };
  }
}

// Backward compatibility export
export { EspeakBrowserTTSClient as EspeakWasmTTSClient };
