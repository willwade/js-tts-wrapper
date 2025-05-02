import { AbstractTTSClient } from "../core/abstract-tts";
import type { SpeakOptions, TTSCredentials, UnifiedVoice } from "../types";

/**
 * eSpeak TTS Client (supports both Node.js and browser via speak.js)
 *
 * TODO: Implement browser-side using speak.js WASM/asm.js
 * TODO: Implement Node.js using either child_process (native espeak) or speak.js
 */
export class EspeakTTSClient extends AbstractTTSClient {
  constructor(credentials: TTSCredentials = {}) {
    super(credentials);
    // TODO: Store options, detect environment, etc.
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
    // Use espeak-ng WASM/JS for both Node.js and browser
    let espeakng: any;
    try {
      // Try dynamic import (ESM environments)
      espeakng = (await import('espeak-ng')).default || (await import('espeak-ng'));
    } catch (err) {
      try {
        // Fallback to require (CJS environments, Jest)
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        espeakng = require('espeak-ng');
      } catch (err2) {
        throw new Error('espeak-ng module not found. Please install with `npm install espeak-ng`.');
      }
    }

    // Map SpeakOptions to espeak-ng options
    const synthOptions: Record<string, any> = {
      ...(options?.voice ? { voice: options.voice } : {}),
      ...(options?.rate ? { rate: options.rate } : {}),
      ...(options?.pitch ? { pitch: options.pitch } : {}),
      // Add more mappings as needed
    };

    const { buffer } = await espeakng.synthesize(text, synthOptions);
    return buffer;
  }

  /**
   * Synthesize text to a byte stream (ReadableStream)
   * @param text Text to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to a readable stream of audio bytes
   */
  async synthToBytestream(text: string, options?: SpeakOptions): Promise<ReadableStream<Uint8Array>> {
    const audioBytes = await this.synthToBytes(text, options);
    // "Fake" streaming by wrapping full audio in a ReadableStream
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(audioBytes);
        controller.close();
      }
    });
  }

  // TODO: Add voice/language/rate/pitch options, browser WASM loader, etc.

  /**
   * Return at least one default voice for eSpeak
   */
  async _getVoices(): Promise<UnifiedVoice[]> {
    return [
      {
        id: "en",
        name: "English (default)",
        gender: "Unknown",
        provider: "espeak-ng",
        languageCodes: [
          {
            bcp47: "en",
            iso639_3: "eng",
            display: "English"
          }
        ]
      }
    ];
  }
}
