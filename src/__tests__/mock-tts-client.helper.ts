import { AbstractTTSClient } from "../core/abstract-tts";
import type { SpeakOptions, UnifiedVoice, WordBoundaryCallback, WordBoundary } from "../types";

/**
 * Mock TTS client for testing
 */
export class MockTTSClient extends AbstractTTSClient {
  /**
   * Get available voices (internal implementation)
   * @returns Promise resolving to an array of unified voice objects
   */
  protected async _getVoices(): Promise<UnifiedVoice[]> {
    return [
      {
        id: "mock-voice-1",
        name: "Mock Voice 1",
        languageCodes: [
          {
            bcp47: "en-US",
            iso639_3: "eng",
            display: "English (United States)",
          },
        ],
        gender: "Female",
        provider: "azure", // Use a supported provider
      },
    ];
  }

  /**
   * Convert text to audio bytes
   * @param _text Text to synthesize
   * @param _options Synthesis options
   * @returns Promise resolving to audio bytes
   */
  async synthToBytes(_text: string, _options?: SpeakOptions): Promise<Uint8Array> {
    // Return a small WAV file header (44 bytes)
    return new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
      0x66, 0x6d, 0x74, 0x20, 0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
      0x44, 0xac, 0x00, 0x00, 0x88, 0x58, 0x01, 0x00, 0x02, 0x00, 0x10, 0x00,
      0x64, 0x61, 0x74, 0x61, 0x00, 0x00, 0x00, 0x00,
    ]);
  }

  /**
   * Synthesize text to a readable byte stream.
   * @param text The text to synthesize.
   * @param options Synthesis options.
   * @returns Promise resolving to an object containing the audio stream and word boundaries.
   */
  async synthToBytestream(text: string, options?: SpeakOptions): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: WordBoundary[];
  }> {
    const bytes = await this.synthToBytes(text, options);

    // Create a readable stream from the bytes
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });

    // If word boundary information is requested
    if (options?.useWordBoundary) {
      // Create mock word boundaries
      const wordBoundaries: WordBoundary[] = [
        { text: 'Mock', offset: 0, duration: 500 },
        { text: 'boundary', offset: 500, duration: 500 },
        { text: 'test.', offset: 1000, duration: 500 }
      ];

      return {
        audioStream: stream,
        wordBoundaries,
      };
    }

    return { audioStream: stream, wordBoundaries: [] };
  }

  /**
   * Start playback with word boundary callbacks
   * @param text Text to speak
   * @param callback Callback function for word boundaries
   * @param _options Synthesis options
   */
  async startPlaybackWithCallbacks(
    text: string,
    callback: WordBoundaryCallback,
    _options?: SpeakOptions
  ): Promise<void> {
    // Emit the start event
    this.emit("start");

    // Create mock word boundaries
    const words = text.split(/\s+/);

    // Call the callback for each word
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const offset = i * 500; // 500ms per word
      callback(word, offset, offset + 500);
    }

    // Emit the end event
    this.emit("end");
  }
}
