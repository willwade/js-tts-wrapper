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
    if (typeof window !== "undefined") {
      // TODO: Browser: Use speak.js to synthesize
      throw new Error("Not implemented: eSpeak synthToBytes for browser (speak.js)");
    } else {
      // Node.js implementation using child_process and espeak binary
      const { spawn } = await import('child_process');

      return new Promise<Uint8Array>((resolve, reject) => {
        const args = [
          '--stdout',
          ...(options?.voice ? ['-v', options.voice] : []),
          ...(options?.rate ? ['-s', String(options.rate)] : []),
          ...(options?.pitch ? ['-p', String(options.pitch)] : []),
          text,
        ];
        const espeak = spawn('espeak', args);
        const chunks: Buffer[] = [];
        espeak.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
        espeak.stderr.on('data', (err: Buffer) => {
          // Only log, don't reject on stderr alone
          console.error('eSpeak stderr:', err.toString());
        });
        espeak.on('error', (err: Error) => reject(err));
        espeak.on('close', (code: number) => {
          if (code !== 0) {
            reject(new Error(`eSpeak exited with code ${code}`));
          } else {
            resolve(Buffer.concat(chunks));
          }
        });
      });
    }
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
    return new ReadableStream({
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
        provider: "sherpa",
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
