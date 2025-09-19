import { AbstractTTSClient } from "../core/abstract-tts";
import type { SpeakOptions, TTSCredentials, UnifiedVoice } from "../types";
import { createRequire } from "node:module";
import path from "node:path";

// Dynamic text2wav module - will be loaded when needed
let text2wav: any = null;

// Function to load text2wav module with enhanced ESM compatibility for Next.js and other environments
async function loadText2Wav() {
  if (text2wav) return text2wav;

  try {
    // Check if we're in a Node.js environment
    if (typeof process === "undefined" || !process.versions || !process.versions.node) {
      throw new Error("EspeakNodeTTSClient is only supported in Node.js environments");
    }

    // Detect Next.js environment
    const isNextJS =
      typeof process !== "undefined" &&
      (process.env.NEXT_RUNTIME || process.env.__NEXT_PRIVATE_ORIGIN);

    // Patch fetch to handle local WASM path for text2wav in Node CI where fetch may be called with a file path string
    try {
      const g: any = globalThis as any;
      if (!g.__text2wavFetchPatched && typeof g.fetch === "function") {
        const originalFetch = g.fetch.bind(g);
        g.__text2wavFetchPatched = true;
        g.fetch = (async (input: any, init?: any) => {
          try {
            const req = typeof input === "string" ? input : input?.url;
            // Intercept attempts to fetch the text2wav WASM by plain file path (no scheme)
            if (typeof req === "string" && req.endsWith("espeak-ng.wasm") && !/^https?:|^file:/.test(req)) {
              const { readFileSync } = await import("node:fs");
              const requireFromCwd = createRequire(path.join(process.cwd(), "noop.js"));
              const wasmPath = requireFromCwd.resolve("text2wav/lib/espeak-ng.wasm");
              const buf = readFileSync(wasmPath);
              return new Response(buf);
            }
          } catch (_e) {
            // fall through to original fetch
          }
          return originalFetch(input as any, init);
        }) as any;
      }
    } catch (_patchErr) {
      // Non-fatal: continue without patch
    }

    try {
      // First attempt normal module resolution relative to this file
      text2wav = await import("text2wav" as any);
    } catch (_importError) {
      // Fallback: try resolving from the user's project directory
      try {
        const requireFromCwd = createRequire(path.join(process.cwd(), "noop.js"));
        const resolvedPath = requireFromCwd.resolve("text2wav");
        text2wav = await import(resolvedPath);
      } catch (cwdError) {
        // Specific handling for Next.js environments where bundling may omit the module
        if (isNextJS) {
          throw new Error(
            "text2wav package not found in Next.js environment. " +
              "This may be due to Next.js bundling restrictions. " +
              "Consider using EspeakBrowserTTSClient for browser environments or " +
              "ensure text2wav is properly installed: npm install text2wav"
          );
        }
        throw cwdError;
      }
    }

    // Handle both default and named exports
    if (text2wav?.default) {
      text2wav = text2wav.default;
    }

    return text2wav;
  } catch (err) {
    console.error("Error loading text2wav:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    throw new Error(
      `text2wav package not found. ${errorMessage}. Please install it with: npm install text2wav`
    );
  }
}

// text2wav options interface
interface Text2WavOptions {
  voice?: string;
  amplitude?: number;
  wordGap?: number;
  capital?: number;
  lineLength?: number;
  pitch?: number;
  speed?: number;
  encoding?: 1 | 2 | 4;
  hasTags?: boolean;
  noFinalPause?: boolean;
  punct?: string | boolean;
}

/**
 * eSpeak TTS Client for Node.js environments
 *
 * This client uses the text2wav package for server-side eSpeak TTS synthesis.
 * For browser environments, use EspeakBrowserTTSClient instead.
 */
export class EspeakNodeTTSClient extends AbstractTTSClient {
  constructor(credentials: TTSCredentials = {}) {
    super(credentials);

    // Set a default voice for eSpeak TTS
    this.voiceId = "en"; // Default English voice
  }

  /**
   * Get the list of required credential types for this engine
   * @returns Array of required credential field names
   */
  protected getRequiredCredentials(): string[] {
    return []; // eSpeak doesn't require any credentials
  }

  /**
   * eSpeak does not require credentials in Node.js
   */
  async checkCredentials(): Promise<boolean> {
    return true;
  }

  /**
   * Synthesize text to audio bytes (Uint8Array)
   * @param text Text to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to audio bytes
   */
  async synthToBytes(text: string, options?: SpeakOptions): Promise<Uint8Array> {
    try {
      // Load the text2wav module
      const text2wavModule = await loadText2Wav();

      // Prepare options for text2wav
      const text2wavOptions: Text2WavOptions = {};

      // Use voice from options or the default voice
      const voiceId = options?.voice || this.voiceId || "en";
      text2wavOptions.voice = voiceId;

      // Map other options to text2wav format
      if (options?.rate) {
        // text2wav uses speed in words per minute, default is 175
        // Convert from rate (0.1-10) to WPM (50-400)
        const rateNum =
          typeof options.rate === "string" ? Number.parseFloat(options.rate) : options.rate;
        const rate = Math.max(0.1, Math.min(10, rateNum));
        text2wavOptions.speed = Math.round(50 + ((rate - 0.1) * (400 - 50)) / (10 - 0.1));
      }

      if (options?.pitch) {
        // text2wav uses pitch 0-99, default is 50
        // Convert from pitch (0.1-2) to 0-99
        const pitchNum =
          typeof options.pitch === "string" ? Number.parseFloat(options.pitch) : options.pitch;
        const pitch = Math.max(0.1, Math.min(2, pitchNum));
        text2wavOptions.pitch = Math.round(((pitch - 0.1) * 99) / (2 - 0.1));
      }

      // Call text2wav to generate audio
      const audioBuffer = await text2wavModule(text, text2wavOptions);

      // text2wav returns a Uint8Array, which is what we need
      return audioBuffer;
    } catch (err) {
      console.error("eSpeak TTS synthesis error:", err);
      throw new Error(
        `Failed to synthesize speech with eSpeak: ${err instanceof Error ? err.message : String(err)}`
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

  // TODO: Add voice/language/rate/pitch options, browser WASM loader, etc.

  /**
   * Return available voices for eSpeak
   */
  async _getVoices(): Promise<UnifiedVoice[]> {
    // eSpeak supports many languages, here's a subset of common ones
    // text2wav uses voice files from espeak-ng-data directory
    const commonVoices = [
      { id: "en", name: "English", language: "English" },
      { id: "en+f3", name: "English (Female 3)", language: "English" },
      { id: "en+m3", name: "English (Male 3)", language: "English" },
      { id: "en+whisper", name: "English (Whisper)", language: "English" },
      { id: "es", name: "Spanish", language: "Spanish" },
      { id: "fr", name: "French", language: "French" },
      { id: "de", name: "German", language: "German" },
      { id: "it", name: "Italian", language: "Italian" },
      { id: "pt", name: "Portuguese", language: "Portuguese" },
      { id: "ru", name: "Russian", language: "Russian" },
      { id: "zh", name: "Chinese (Mandarin)", language: "Chinese" },
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
      name: `${voice.name} (eSpeak)`,
      gender: "Unknown", // eSpeak doesn't typically provide gender info
      provider: "espeak-ng",
      languageCodes: [
        {
          bcp47: voice.id.split("+")[0], // Use the base language code
          iso639_3: "", // Would need mapping
          display: voice.language,
        },
      ],
    }));

    return voices;
  }
}

// Backward compatibility export
export { EspeakNodeTTSClient as EspeakTTSClient };
