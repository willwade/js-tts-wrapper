import { SSMLBuilder } from "../ssml/builder";
import type {
  CredentialsCheckResult,
  PropertyType,
  SimpleCallback,
  SpeakInput,
  SpeakOptions,
  TTSCredentials,
  TTSEventType,
  UnifiedVoice,
  WordBoundaryCallback,
} from "../types";
import { LanguageNormalizer } from "./language-utils";
import * as SSMLUtils from "./ssml-utils";
import { isBrowser, isNode } from "../utils/environment";
import { isNodeAudioAvailable, playAudioInNode } from "../utils/node-audio";
import { convertAudioFormat, isAudioConversionAvailable, getMimeTypeForFormat, type AudioFormat } from "../utils/audio-converter";
import { detectAudioFormat } from "../utils/audio-input";

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
   * Audio sample rate in Hz
   * This is used for playback and word timing estimation
   * Default is 24000 Hz, but engines can override this
   */
  protected sampleRate = 24000;

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

  // --- Format conversion support ---

  /**
   * Synthesize text to audio bytes with format conversion support
   * This method wraps the engine's native synthToBytes and adds format conversion
   * @param text Text or SSML to synthesize
   * @param options Synthesis options including format
   * @returns Promise resolving to audio bytes in the requested format
   */
  async synthToBytesWithConversion(text: string, options?: SpeakOptions): Promise<Uint8Array> {
    // Get audio from the engine's native implementation
    const nativeAudioBytes = await this.synthToBytes(text, options);

    // If no format specified, return native audio
    if (!options?.format) {
      return nativeAudioBytes;
    }

    // Check if conversion is needed and available
    const requestedFormat = options.format as AudioFormat;
    const nativeFormat = this.detectNativeFormat(nativeAudioBytes);

    // If already in requested format, return as-is
    if (nativeFormat === requestedFormat) {
      return nativeAudioBytes;
    }

    // Try to convert if conversion is available
    if (isAudioConversionAvailable()) {
      try {
        const conversionResult = await convertAudioFormat(nativeAudioBytes, requestedFormat);
        return conversionResult.audioBytes;
      } catch (error) {
        console.warn(`Audio format conversion failed: ${error instanceof Error ? error.message : String(error)}`);
        console.warn(`Returning native format (${nativeFormat}) instead of requested format (${requestedFormat})`);
      }
    } else {
      console.warn(`Audio format conversion not available. Returning native format (${nativeFormat}) instead of requested format (${requestedFormat})`);
    }

    // Fallback: return native audio
    return nativeAudioBytes;
  }

  /**
   * Detect the native audio format produced by this engine
   * @param audioBytes Audio bytes to analyze
   * @returns Detected audio format
   */
  protected detectNativeFormat(audioBytes: Uint8Array): AudioFormat {
    const detectedMimeType = detectAudioFormat(audioBytes);

    switch (detectedMimeType) {
      case "audio/mpeg":
        return "mp3";
      case "audio/ogg":
        return "ogg";
      case "audio/wav":
      default:
        return "wav";
    }
  }

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
   * Speak text using the default audio output, or play audio from file/bytes/stream
   * @param input Text to speak, or audio input (filename, audioBytes, or audioStream)
   * @param options Synthesis options
   * @returns Promise resolving when audio playback starts
   */
  async speak(input: string | SpeakInput, options?: SpeakOptions): Promise<void> {
    // Trigger onStart callback
    this.emit("start");

    try {
      let audioBytes: Uint8Array;
      let mimeType: string;

      // Handle different input types
      if (typeof input === "string") {
        // Traditional text input with format conversion support
        audioBytes = await this.synthToBytesWithConversion(input, options);

        // Determine MIME type based on actual audio format
        const actualFormat = this.detectNativeFormat(audioBytes);
        mimeType = getMimeTypeForFormat(actualFormat);
      } else {
        // Audio input (file, bytes, or stream)
        const { processAudioInput } = await import("../utils/audio-input");
        const result = await processAudioInput(input);
        audioBytes = result.audioBytes;
        mimeType = result.mimeType;
      }

      // Check if we're in a browser environment
      if (isBrowser) {

        // Create audio blob and URL with the correct MIME type
        const blob = new Blob([audioBytes], { type: mimeType });
        const url = URL.createObjectURL(blob);

        // Create and play audio element
        const audio = new Audio();

        // Set up event handlers before setting the source
        audio.oncanplay = async () => {
          try {
            this.audio.audioElement = audio;
            this.audio.isPlaying = true;
            this.audio.isPaused = false;

            // Create estimated word timings if needed (only for text input)
            if (typeof input === "string") {
              this._createEstimatedWordTimings(input);
            }

            // Play the audio
            await audio.play();
          } catch (playError) {
            console.error("Error playing audio:", playError);
            this.emit("end");
          }
        };

        audio.onerror = (e) => {
          console.error("Audio playback error:", e);
          this.emit("end");
          URL.revokeObjectURL(url);
        };

        audio.onended = () => {
          this.emit("end");
          this.audio.isPlaying = false;
          URL.revokeObjectURL(url); // Clean up the URL
        };

        // Set the source after setting up event handlers
        audio.src = url;
      } else if (isNode) {
        // In Node.js environment, try to use sound-play
        try {
          // Check if Node.js audio playback is available
          const audioAvailable = await isNodeAudioAvailable();

          if (audioAvailable) {
            // Emit start event
            this.emit("start");

            // Play audio using our node-audio utility
            // Pass the engine name to handle Polly audio differently
            await playAudioInNode(audioBytes, this.sampleRate, this.constructor.name.replace('TTSClient', '').toLowerCase());

            // Emit end event
            this.emit("end");
          } else {
            console.log("Audio playback in Node.js requires the sound-play package.");
            console.log("Install it with: npm install js-tts-wrapper[node-audio]");
            console.log("Or use synthToFile() to save audio to a file and play it with an external player.");
            this.emit("end");
          }
        } catch (nodeAudioError) {
          console.error("Error playing audio in Node.js:", nodeAudioError);
          this.emit("end");
        }
      } else {
        // Unknown environment
        console.log("Audio playback is not supported in this environment.");
        console.log("Use synthToFile() to save audio to a file and play it with an external player.");
        this.emit("end");
      }
    } catch (error) {
      console.error("Error in speak method:", error);
      this.emit("end"); // Ensure end event is triggered even on error
      throw error;
    }
  }

  /**
   * Speak text using streaming synthesis, or play audio from file/bytes/stream
   * @param input Text to speak, or audio input (filename, audioBytes, or audioStream)
   * @param options Synthesis options
   * @returns Promise resolving when audio playback starts
   */
  async speakStreamed(input: string | SpeakInput, options?: SpeakOptions): Promise<void> {
    // Trigger onStart callback
    this.emit("start");

    try {
      let audioBytes: Uint8Array;
      let mimeType: string;
      let wordBoundaries: Array<{ text: string; offset: number; duration: number }> = [];
      let text: string = "";

      // Handle different input types
      if (typeof input === "string") {
        // Traditional text input - use streaming synthesis
        text = input;
        const streamResult = await this.synthToBytestream(text, options);

        // Get audio stream and word boundaries
        const audioStream = streamResult.audioStream;
        wordBoundaries = streamResult.wordBoundaries;

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
        audioBytes = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          audioBytes.set(chunk, offset);
          offset += chunk.length;
        }

        // Apply format conversion if needed (for streaming, we convert the final buffer)
        if (options?.format && isAudioConversionAvailable()) {
          try {
            const conversionResult = await convertAudioFormat(audioBytes, options.format as AudioFormat);
            audioBytes = conversionResult.audioBytes;
            mimeType = conversionResult.mimeType;
          } catch (error) {
            console.warn(`Streaming format conversion failed: ${error instanceof Error ? error.message : String(error)}`);
            // Fallback to detecting actual format
            const actualFormat = this.detectNativeFormat(audioBytes);
            mimeType = getMimeTypeForFormat(actualFormat);
          }
        } else {
          // Determine MIME type based on actual audio format
          const actualFormat = this.detectNativeFormat(audioBytes);
          mimeType = getMimeTypeForFormat(actualFormat);
        }
      } else {
        // Audio input (file, bytes, or stream)
        const { processAudioInput } = await import("../utils/audio-input");
        const result = await processAudioInput(input);
        audioBytes = result.audioBytes;
        mimeType = result.mimeType;

        // For audio input, we don't have word boundaries or text
        // We'll create estimated timings if needed
        text = ""; // No text available for audio input
      }



      // Use actual word boundaries if available, otherwise create estimated ones
      if (wordBoundaries.length > 0) {
        // Convert the word boundaries to our internal format
        this.timings = wordBoundaries.map((wb) => [
          wb.offset / 10000, // Convert from 100-nanosecond units to seconds
          (wb.offset + wb.duration) / 10000,
          wb.text,
        ]);
      } else if (text) {
        // Create estimated word timings only if we have text
        this._createEstimatedWordTimings(text);
      } else {
        // No text available (audio input), clear timings
        this.timings = [];
      }

      // Check if we're in a browser environment
      if (isBrowser) {

        // Create audio blob and URL with the correct MIME type
        const blob = new Blob([audioBytes], { type: mimeType });
        const url = URL.createObjectURL(blob);

        // Create and play audio element
        const audio = new Audio();

        // Set up event handlers before setting the source
        audio.oncanplay = async () => {
          try {
            this.audio.audioElement = audio;
            this.audio.isPlaying = true;
            this.audio.isPaused = false;

            // Play the audio
            await audio.play();
          } catch (playError) {
            console.error("Error playing audio:", playError);
            this.emit("end");
          }
        };

        audio.onerror = (e) => {
          console.error("Audio playback error:", e);
          this.emit("end");
          URL.revokeObjectURL(url);
        };

        audio.onended = () => {
          this.emit("end");
          this.audio.isPlaying = false;
          URL.revokeObjectURL(url);
        };

        // Set the source after setting up event handlers
        audio.src = url;
      } else if (isNode) {
        // In Node.js environment, try to use sound-play
        try {
          // Check if Node.js audio playback is available
          const audioAvailable = await isNodeAudioAvailable();

          // Create estimated word timings if needed and we have text
          if (text) {
            this._createEstimatedWordTimings(text);
          }

          if (audioAvailable) {
            // Schedule word boundary callbacks
            this._scheduleWordBoundaryCallbacks();

            // Play audio using our node-audio utility with the engine's sample rate
            // Pass the engine name to handle Polly audio differently
            await playAudioInNode(audioBytes, this.sampleRate, this.constructor.name.replace('TTSClient', '').toLowerCase());

            // Emit end event
            this.emit("end");
          } else {
            console.log("Audio playback in Node.js requires the sound-play package.");
            console.log("Install it with: npm install js-tts-wrapper[node-audio]");
            console.log("Or use synthToFile() to save audio to a file and play it with an external player.");

            // Fire word boundary callbacks immediately
            this._fireWordBoundaryCallbacks();
            this.emit("end");
          }
        } catch (nodeAudioError) {
          console.error("Error playing audio in Node.js:", nodeAudioError);
          this._fireWordBoundaryCallbacks();
          this.emit("end");
        }
      } else {
        // Unknown environment
        console.log("Audio playback is not supported in this environment.");
        console.log("Use synthToFile() to save audio to a file and play it with an external player.");

        // Create estimated word timings if needed and we have text
        if (text) {
          this._createEstimatedWordTimings(text);
        }

        // Fire word boundary callbacks immediately
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
    // Convert text to audio bytes with the specified format (with conversion support)
    const audioBytes = await this.synthToBytesWithConversion(text, { ...options, format });

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

      // Clean up: Use requestAnimationFrame for potentially smoother cleanup
      requestAnimationFrame(() => {
        if (document?.body?.contains(a)) {
          document.body.removeChild(a);
        }
        URL.revokeObjectURL(url);
      });
    } else if (isNode) {
      // In Node.js, use the file system
      const outputPath = filename.endsWith(`.${format}`) ? filename : `${filename}.${format}`;
      const fs = await import('node:fs');
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
    if (isBrowser) {
      // Browser environment - use HTML5 Audio element
      if (this.audio.audioElement && this.audio.isPlaying && !this.audio.isPaused) {
        this.audio.audioElement.pause();
        this.audio.isPaused = true;
      }
    } else if (isNode) {
      // Node.js environment - use node-speaker
      try {
        // Import dynamically to avoid circular dependencies
        import('./node-audio-control').then(nodeAudio => {
          const paused = nodeAudio.pauseAudioPlayback();
          if (paused) {
            this.audio.isPaused = true;
          }
        }).catch(error => {
          console.error("Error importing node-audio-control:", error);
        });
      } catch (error) {
        console.error("Error pausing audio in Node.js:", error);
      }
    }
  }

  /**
   * Resume audio playback
   */
  resume(): void {
    if (isBrowser) {
      // Browser environment - use HTML5 Audio element
      if (this.audio.audioElement && this.audio.isPlaying && this.audio.isPaused) {
        this.audio.audioElement.play();
        this.audio.isPaused = false;
      }
    } else if (isNode) {
      // Node.js environment - use node-speaker
      try {
        // Import dynamically to avoid circular dependencies
        import('./node-audio-control').then(nodeAudio => {
          const resumed = nodeAudio.resumeAudioPlayback();
          if (resumed) {
            this.audio.isPaused = false;
          }
        }).catch(error => {
          console.error("Error importing node-audio-control:", error);
        });
      } catch (error) {
        console.error("Error resuming audio in Node.js:", error);
      }
    }
  }

  /**
   * Stop audio playback
   */
  stop(): void {
    if (isBrowser) {
      // Browser environment - use HTML5 Audio element
      if (this.audio.audioElement) {
        this.audio.audioElement.pause();
        this.audio.audioElement.currentTime = 0;
        this.audio.isPlaying = false;
        this.audio.isPaused = false;
      }
    } else if (isNode) {
      // Node.js environment - use node-speaker
      try {
        // Import dynamically to avoid circular dependencies
        import('./node-audio-control').then(nodeAudio => {
          const stopped = nodeAudio.stopAudioPlayback();
          if (stopped) {
            this.audio.isPlaying = false;
            this.audio.isPaused = false;
          }
        }).catch(error => {
          console.error("Error importing node-audio-control:", error);
        });
      } catch (error) {
        console.error("Error stopping audio in Node.js:", error);
      }
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
   * Schedule word boundary callbacks based on timing information
   * This is used when we have audio playback but need to schedule callbacks
   */
  protected _scheduleWordBoundaryCallbacks(): void {
    if (!this.timings.length) return;

    // Get all boundary callbacks
    const callbacks = this.callbacks["boundary"] || [];
    if (!callbacks.length) return;

    // Schedule callbacks for each word
    for (const [start, end, word] of this.timings) {
      setTimeout(() => {
        for (const callback of callbacks) {
          callback(word, start, end);
        }
      }, start * 1000);
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
   * Check if credentials are valid with detailed response
   * @returns Promise resolving to an object with success flag and optional error message
   */
  async checkCredentialsDetailed(): Promise<CredentialsCheckResult> {
    try {
      const voices = await this._getVoices();
      return {
        success: voices.length > 0,
        voiceCount: voices.length
      };
    } catch (error) {
      console.error("Error checking credentials:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get comprehensive credential validation information
   * @returns Promise resolving to detailed credential status
   */
  async getCredentialStatus(): Promise<{
    valid: boolean;
    engine: string;
    environment: 'browser' | 'node';
    requiresCredentials: boolean;
    credentialTypes: string[];
    message: string;
    details?: Record<string, any>;
    error?: string;
  }> {
    const isBrowser = typeof window !== 'undefined';
    const engineName = this.constructor.name.replace('TTSClient', '').toLowerCase();

    try {
      const isValid = await this.checkCredentials();
      const voices = isValid ? await this._getVoices() : [];

      return {
        valid: isValid,
        engine: engineName,
        environment: isBrowser ? 'browser' : 'node',
        requiresCredentials: this.getRequiredCredentials().length > 0,
        credentialTypes: this.getRequiredCredentials(),
        message: isValid ?
          `${engineName} credentials are valid and ${voices.length} voices are available` :
          `${engineName} credentials are invalid or service is unavailable`,
        details: {
          voiceCount: voices.length,
          hasCredentials: Object.keys(this.credentials || {}).length > 0
        }
      };
    } catch (error) {
      return {
        valid: false,
        engine: engineName,
        environment: isBrowser ? 'browser' : 'node',
        requiresCredentials: this.getRequiredCredentials().length > 0,
        credentialTypes: this.getRequiredCredentials(),
        message: `Error validating ${engineName} credentials`,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get the list of required credential types for this engine
   * Override in subclasses to provide engine-specific requirements
   * @returns Array of required credential field names
   */
  protected getRequiredCredentials(): string[] {
    return []; // Default: no credentials required
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
