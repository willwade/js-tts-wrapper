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
import * as SSMLUtils from "./ssml-utils";

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
  protected callbacks: Record<string, Function[]> = {};

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
   * Synthesize text to a byte stream
   * @param text Text or SSML to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to a readable stream of audio bytes
   */
  abstract synthToBytestream(
    text: string,
    options?: SpeakOptions
  ): Promise<ReadableStream<Uint8Array>>;

  /**
   * Get available voices from the provider with normalized language codes
   * @returns Promise resolving to an array of unified voice objects
   */
  async getVoices(): Promise<UnifiedVoice[]> {
    // Get raw voices from the engine-specific implementation
    const rawVoices = await this._getVoices();

    // Process and normalize the voices
    // In a full implementation, we would normalize language codes here
    // similar to the Python version's language_utils.LanguageNormalizer

    return rawVoices;
  }

  // --- Optional overrides ---

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
    let url = '';
    if (typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
      // Create audio blob and URL
      const blob = new Blob([audioBytes], { type: "audio/wav" }); // default to WAV
      url = URL.createObjectURL(blob);
    }

    // Check if we're in a browser environment
    if (typeof Audio !== 'undefined') {
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
    } else {
      // In Node.js environment, we can't play audio
      // Just emit the end event immediately
      this.emit("end");
    }

    // Create estimated word timings if needed
    this._createEstimatedWordTimings(text);

    // Play the audio if in browser environment
    if (this.audio.audioElement) {
      await this.audio.audioElement.play();
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
      const stream = await this.synthToBytestream(text, options);
      const reader = stream.getReader();
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

      // Create estimated word timings
      this._createEstimatedWordTimings(text);

      // Play the audio
      const blob = new Blob([audioBytes], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      this.audio.audioElement = audio;
      this.audio.isPlaying = true;
      this.audio.isPaused = false;

      audio.onended = () => {
        this.emit("end");
        this.audio.isPlaying = false;
        URL.revokeObjectURL(url);
      };

      await audio.play();
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
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
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
  on(event: TTSEventType, fn: Function): void {
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
    const voices = await this.getVoices();
    return voices.filter(voice =>
      voice.languageCodes.some(lang => lang.bcp47 === language)
    );
  }
}
