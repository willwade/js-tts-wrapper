import { SSMLBuilder } from "../ssml/builder";
import type {
  PropertyType,
  SimpleCallback,
  SpeakOptions,
  TTSCredentials,
  TTSEventType,
  UnifiedVoice,
  WordBoundaryCallback,
} from "../types";
import { LanguageNormalizer } from "./language-utils";
import * as SSMLUtils from "./ssml-utils";
import { isBrowser, isNode } from "../utils/environment";

/**
 * Abstract base class for all TTS clients
 * This provides a unified interface for all TTS providers
 */
export abstract class AbstractTTSClient {
  /**
   * Currently selected voice ID
   */
  protected voiceId: string | null = null;

  /**
   * Currently selected language
   */
  protected lang = "en-US";

  /**
   * Event callbacks
   */
  protected callbacks: Record<string, ((...args: any[]) => void)[]> = {};

  /**
   * SSML builder instance
   */
  public ssml: SSMLBuilder;

  /**
   * Audio playback properties
   */
  protected audio: {
    isPlaying: boolean;
    isPaused: boolean;
    audioElement: HTMLAudioElement | null;
    position: number;
    duration: number;
  };

  /**
   * TTS properties (rate, pitch, volume)
   */
  protected properties: Record<string, PropertyType> = {
    volume: 100,
    rate: "medium",
    pitch: "medium",
  };

  /**
   * Word timings for the current audio
   */
  protected timings: Array<[number, number, string]> = [];

  /**
   * Audio sample rate
   */
  protected audioRate = 24000;

  /**
   * Creates a new TTS client
   * @param credentials Provider-specific credentials
   */
  constructor(protected credentials: TTSCredentials) {
    this.ssml = new SSMLBuilder();
    this.audio = {
      isPlaying: false,
      isPaused: false,
      audioElement: null,
      position: 0,
      duration: 0,
    };
  }

  // --- Required abstract methods ---

  /**
   * Get raw voices from the provider
   * This is an internal method that should be implemented by each engine
   * @returns Promise resolving to an array of raw voice objects
   */
  protected abstract _getVoices(): Promise<UnifiedVoice[]>;

  /**
   * Synthesize text to audio bytes
   * @param text Text or SSML to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to audio bytes
   */
  abstract synthToBytes(text: string, options?: SpeakOptions): Promise<Uint8Array>;

  /**
   * Synthesize text to a byte stream and optionally provide word boundaries.
   * @param text Text or SSML to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to an object containing the audio stream and an array of word boundaries.
   *          The wordBoundaries array will be empty if the engine does not support them.
   */
  abstract synthToBytestream(
    text: string,
    options?: SpeakOptions
  ): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
  }>;

  /**
   * Get available voices from the provider with normalized language codes
   * @returns Promise resolving to an array of unified voice objects
   */
  async getVoices(): Promise<UnifiedVoice[]> {
    // Get raw voices from the engine-specific implementation
    const rawVoices = await this._getVoices();

    // Process and normalize the voices
    // Each engine should implement _mapVoiceToUnified to convert its raw voice format
    // to a partially filled UnifiedVoice object
    const voices = await this._mapVoicesToUnified(rawVoices);

    // Normalize language codes for all voices
    return voices.map((voice) => {
      // Normalize language codes for each language
      const normalizedLanguageCodes = voice.languageCodes.map((lang) => {
        const normalized = LanguageNormalizer.normalize(lang.bcp47);
        return {
          bcp47: normalized.bcp47,
          iso639_3: normalized.iso639_3,
          display: normalized.display,
        };
      });

      // Return the voice with normalized language codes
      return {
        ...voice,
        languageCodes: normalizedLanguageCodes,
      };
    });
  }

  // --- Optional overrides ---

  /**
   * Map provider-specific voice objects to unified format
   * @param rawVoices Array of provider-specific voice objects
   * @returns Promise resolving to an array of partially unified voice objects
   */
  protected async _mapVoicesToUnified(rawVoices: any[]): Promise<UnifiedVoice[]> {
    // Default implementation that assumes rawVoices are already in UnifiedVoice format
    // Engine-specific implementations should override this method
    return rawVoices as UnifiedVoice[];
  }

  /**
   * Speak text using the default audio output
   * @param text Text or SSML to speak
   * @param options Synthesis options
   * @returns Promise resolving when audio playback starts
   */
  async speak(text: string, options?: SpeakOptions): Promise<void> {
    // Trigger onStart callback
    this.emit("start");

    // Convert text to audio bytes
    const audioBytes = await this.synthToBytes(text, options);

    // Check if we're in a browser environment
    if (isBrowser) {
      // Create audio blob and URL
      const blob = new Blob([audioBytes], { type: "audio/wav" }); // default to WAV
      const url = URL.createObjectURL(blob);

      // Create and play audio element
      const audio = new Audio(url);
      this.audio.audioElement = audio;
      this.audio.isPlaying = true;
      this.audio.isPaused = false;

      // Set up event handlers
      audio.onended = () => {
        this.emit("end");
        this.audio.isPlaying = false;
        URL.revokeObjectURL(url); // Clean up the URL
      };

      // Create estimated word timings if needed
      this._createEstimatedWordTimings(text);

      // Play the audio
      await audio.play();
    } else {
      // In Node.js environment, we can't play audio
      // Just emit the end event immediately
      this.emit("end");
    }
  }

  /**
   * Speak text using streaming synthesis
   * @param text Text or SSML to speak
   * @param options Synthesis options
   * @returns Promise resolving when audio playback starts
   */
  async speakStreamed(text: string, options?: SpeakOptions): Promise<void> {
    // Trigger onStart callback
    this.emit("start");

    try {
      // Get streaming audio data
      const streamResult = await this.synthToBytestream(text, options);

      // Get audio stream and word boundaries
      const audioStream = streamResult.audioStream;
      const wordBoundaries = streamResult.wordBoundaries;

      const reader = audioStream.getReader();
      const chunks: Uint8Array[] = [];

      // Read all chunks from the stream
      let result = await reader.read();
      while (!result.done) {
        chunks.push(result.value);
        result = await reader.read();
      }

      // Combine chunks into a single audio buffer
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const audioBytes = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        audioBytes.set(chunk, offset);
        offset += chunk.length;
      }

      // Use actual word boundaries if available, otherwise create estimated ones
      if (wordBoundaries.length > 0) {
        // Convert the word boundaries to our internal format
        this.timings = wordBoundaries.map((wb) => [
          wb.offset / 10000, // Convert from 100-nanosecond units to seconds
          (wb.offset + wb.duration) / 10000,
          wb.text,
        ]);
      } else {
        // Create estimated word timings
        this._createEstimatedWordTimings(text);
      }

      // Check if we're in a browser environment
      if (isBrowser) {
        // Create audio blob and URL
        const blob = new Blob([audioBytes], { type: "audio/wav" });
        const url = URL.createObjectURL(blob);

        // Create and play audio element
        const audio = new Audio(url);
        this.audio.audioElement = audio;
        this.audio.isPlaying = true;
        this.audio.isPaused = false;

        // Set up event handlers
        audio.onended = () => {
          this.emit("end");
          this.audio.isPlaying = false;
          URL.revokeObjectURL(url);
        };

        // Play the audio
        await audio.play();
      } else {
        // In Node.js environment, just emit events
        // Fire word boundary events immediately
        setTimeout(() => {
          this._fireWordBoundaryCallbacks();
          this.emit("end");
        }, 100);
      }
    } catch (error) {
      console.error("Error in streaming synthesis:", error);
      this.emit("end"); // Ensure end event is triggered even on error
      throw error;
    }
  }

  /**
   * Synthesize text to audio and save it to a file (browser download)
   * @param text Text or SSML to synthesize
   * @param filename Filename to save as
   * @param format Audio format (mp3 or wav)
   * @param options Synthesis options
   */
  async synthToFile(
    text: string,
    filename: string,
    format: "mp3" | "wav" = "wav",
    options?: SpeakOptions
  ): Promise<void> {
    // Convert text to audio bytes
    const audioBytes = await this.synthToBytes(text, options);

    if (isBrowser) {
      // Create blob with appropriate MIME type
      const mimeType = format === "mp3" ? "audio/mpeg" : "audio/wav";
      const blob = new Blob([audioBytes], { type: mimeType });

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename.endsWith(`.${format}`) ? filename : `${filename}.${format}`;

      // Trigger download
      document.body.appendChild(a);
      a.click();

      // Clean up
      setTimeout(() => {
        if (document && document.body) {
          document.body.removeChild(a);
        }
        URL.revokeObjectURL(url);
      }, 100);
    } else if (isNode) {
      // In Node.js, use the file system
      const fs = require('node:fs');
      const outputPath = filename.endsWith(`.${format}`) ? filename : `${filename}.${format}`;
      fs.writeFileSync(outputPath, Buffer.from(audioBytes));
    } else {
      console.warn("File saving not implemented for this environment.");
    }
  }

  /**
   * Set the voice to use for synthesis
   * @param voiceId Voice ID to use
   * @param lang Language code (optional)
   */
  setVoice(voiceId: string, lang?: string): void {
    this.voiceId = voiceId;
    if (lang) {
      this.lang = lang;
    }
  }

  // --- Playback control methods ---

  /**
   * Pause audio playback
   */
  pause(): void {
    if (this.audio.audioElement && this.audio.isPlaying && !this.audio.isPaused) {
      this.audio.audioElement.pause();
      this.audio.isPaused = true;
    }
  }

  /**
   * Resume audio playback
   */
  resume(): void {
    if (this.audio.audioElement && this.audio.isPlaying && this.audio.isPaused) {
      this.audio.audioElement.play();
      this.audio.isPaused = false;
    }
  }

  /**
   * Stop audio playback
   */
  stop(): void {
    if (this.audio.audioElement) {
      this.audio.audioElement.pause();
      this.audio.audioElement.currentTime = 0;
      this.audio.isPlaying = false;
      this.audio.isPaused = false;
    }
  }

  /**
   * Create estimated word timings for non-streaming engines
   * @param text Text to create timings for
   */
  protected _createEstimatedWordTimings(text: string): void {
    // Extract plain text from SSML if needed
    const plainText = this._isSSML(text) ? this._stripSSML(text) : text;

    // Split into words
    const words = plainText.split(/\s+/).filter((word) => word.length > 0);
    if (!words.length) return;

    // Estimate duration (assuming average speaking rate)
    const estimatedDuration = words.length * 0.3; // ~300ms per word
    const wordDuration = estimatedDuration / words.length;

    // Create evenly-spaced word timings
    this.timings = [];
    for (let i = 0; i < words.length; i++) {
      const startTime = i * wordDuration;
      const endTime = (i + 1) * wordDuration;
      this.timings.push([startTime, endTime, words[i]]);
    }
  }

  /**
   * Fire word boundary callbacks based on timing data
   */
  protected _fireWordBoundaryCallbacks(): void {
    if (!this.timings.length) return;

    // Get all boundary callbacks
    const callbacks = this.callbacks["boundary"] || [];
    if (!callbacks.length) return;

    // Fire callbacks for each word
    for (const [start, end, word] of this.timings) {
      for (const callback of callbacks) {
        callback(word, start, end);
      }
    }
  }

  /**
   * Check if text is SSML
   * @param text Text to check
   * @returns True if text is SSML
   */
  protected _isSSML(text: string): boolean {
    return SSMLUtils.isSSML(text);
  }

  /**
   * Strip SSML tags from text
   * @param ssml SSML text
   * @returns Plain text without SSML tags
   */
  protected _stripSSML(ssml: string): string {
    return SSMLUtils.stripSSML(ssml);
  }

  // --- Event system ---

  /**
   * Register a callback for an event
   * @param event Event type
   * @param fn Callback function
   */
  on(event: TTSEventType, fn: (...args: any[]) => void): void {
    this.callbacks[event] = this.callbacks[event] || [];
    this.callbacks[event].push(fn);
  }

  /**
   * Emit an event to all registered callbacks
   * @param event Event type
   * @param args Event arguments
   */
  protected emit(event: string, ...args: any[]): void {
    for (const fn of this.callbacks[event] || []) {
      fn(...args);
    }
  }

  /**
   * Start playback with word boundary callbacks
   * @param text Text or SSML to speak
   * @param callback Callback function for word boundaries
   * @param options Synthesis options
   */
  async startPlaybackWithCallbacks(
    text: string,
    callback: WordBoundaryCallback,
    options?: SpeakOptions
  ): Promise<void> {
    // Speak the text
    await this.speak(text, options);

    // Use the timings to schedule callbacks
    for (const [start, end, word] of this.timings) {
      setTimeout(() => {
        callback(word, start, end);
      }, start * 1000);
    }
  }

  /**
   * Connect a callback to an event
   * @param event Event name
   * @param callback Callback function
   */
  connect(event: "onStart" | "onEnd", callback: SimpleCallback): void {
    if (event === "onStart") {
      this.on("start", callback);
    } else if (event === "onEnd") {
      this.on("end", callback);
    }
  }

  /**
   * Get the value of a property
   * @param propertyName Property name
   * @returns Property value
   */
  getProperty(propertyName: string): PropertyType {
    return this.properties[propertyName];
  }

  /**
   * Set a property value
   * @param propertyName Property name
   * @param value Property value
   */
  setProperty(propertyName: string, value: PropertyType): void {
    this.properties[propertyName] = value;
  }

  /**
   * Create a prosody tag with the current properties
   * @param text Text to wrap with prosody
   * @returns Text with prosody tag
   */
  constructProsodyTag(text: string): string {
    const attrs: string[] = [];

    if (this.properties.rate) {
      attrs.push(`rate="${this.properties.rate}"`);
    }

    if (this.properties.pitch) {
      attrs.push(`pitch="${this.properties.pitch}"`);
    }

    if (this.properties.volume) {
      attrs.push(`volume="${this.properties.volume}%"`);
    }

    if (attrs.length === 0) {
      return text;
    }

    return `<prosody ${attrs.join(" ")}>${text}</prosody>`;
  }

  /**
   * Check if credentials are valid
   * @returns Promise resolving to true if credentials are valid
   */
  async checkCredentials(): Promise<boolean> {
    try {
      const voices = await this._getVoices();
      return voices.length > 0;
    } catch (error) {
      console.error("Error checking credentials:", error);
      return false;
    }
  }

  /**
   * Get available voices for a specific language
   * @param language Language code (BCP-47 format, e.g., 'en-US')
   * @returns Promise resolving to an array of available voices for the specified language
   */
  async getVoicesByLanguage(language: string): Promise<UnifiedVoice[]> {
    // Normalize the input language code
    const normalizedLanguage = LanguageNormalizer.normalize(language);

    // Get all voices
    const voices = await this.getVoices();

    // Filter voices by language
    return voices.filter((voice) =>
      voice.languageCodes.some(
        (lang) =>
          // Match by BCP-47 code
          lang.bcp47 === normalizedLanguage.bcp47 ||
          // Or by ISO 639-3 code
          lang.iso639_3 === normalizedLanguage.iso639_3
      )
    );
  }
}
