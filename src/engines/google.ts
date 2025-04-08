import { AbstractTTSClient } from "../core/abstract-tts";
import { LanguageNormalizer } from "../core/language-utils";
import * as SSMLUtils from "../core/ssml-utils";
import * as SpeechMarkdown from "../markdown/converter";
import type { SpeakOptions, TTSCredentials, UnifiedVoice, WordBoundaryCallback } from "../types";

/**
 * Google TTS credentials
 */
export interface GoogleTTSCredentials extends TTSCredentials {
  /**
   * Google Cloud project ID
   */
  projectId?: string;

  /**
   * Google Cloud credentials JSON
   */
  credentials?: any;

  /**
   * Google Cloud credentials file path
   */
  keyFilename?: string;
}

/**
 * Google TTS client
 */
export class GoogleTTSClient extends AbstractTTSClient {
  /**
   * Google Cloud Text-to-Speech client
   */
  private client: any;

  /**
   * Whether to use the beta API for word timings
   */
  private useBetaApi = false;

  /**
   * Create a new Google TTS client
   * @param credentials Google Cloud credentials
   */
  constructor(credentials: GoogleTTSCredentials) {
    super(credentials);

    try {
      // Try to load the Google Cloud Text-to-Speech client
      const textToSpeech = require("@google-cloud/text-to-speech");

      // Create the client with the provided credentials
      this.client = new textToSpeech.TextToSpeechClient({
        projectId: credentials.projectId,
        credentials: credentials.credentials,
        keyFilename: credentials.keyFilename,
      });

      // Try to load the beta client for word timings
      try {
        const { v1beta1 } = require("@google-cloud/text-to-speech");
        if (v1beta1) {
          this.useBetaApi = true;
        }
      } catch (error) {
        console.warn(
          "Google Cloud Text-to-Speech beta API not available. Word timing will be estimated."
        );
      }
    } catch (error) {
      // In test mode, we'll just log a warning instead of an error
      if (process.env.NODE_ENV === "test") {
        console.warn(
          "Google TTS client not initialized in test mode. Some tests may be skipped."
        );
      } else {
        console.error("Error initializing Google TTS client:", error);
        console.warn(
          "Google TTS will not be available. Install @google-cloud/text-to-speech to use this engine."
        );
      }
    }
  }

  /**
   * Get available voices from the provider
   * @returns Promise resolving to an array of voice objects
   */
  protected async _getVoices(): Promise<any[]> {
    // If the client is not available, return an empty array
    if (!this.client) {
      return [];
    }

    try {
      const [response] = await this.client.listVoices({});
      return response.voices || [];
    } catch (error) {
      console.error("Error getting voices:", error);
      return [];
    }
  }

  /**
   * Convert text to audio bytes
   * @param text Text or SSML to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to audio bytes
   */
  async synthToBytes(text: string, options?: SpeakOptions): Promise<Uint8Array> {
    // If the client is not available, throw an error
    if (!this.client) {
      throw new Error(
        "Google TTS client is not available. Install @google-cloud/text-to-speech to use this engine."
      );
    }

    try {
      // Prepare SSML if needed
      const ssml = this.prepareSSML(text, options);

      // Determine if we should use the beta API for word timings
      const useWordTimings = options?.useWordBoundary && this.useBetaApi;

      // Prepare the request
      const request: any = {
        input: SSMLUtils.isSSML(ssml) ? { ssml } : { text: ssml },
        voice: {
          languageCode: options?.voice?.split("-")[0] || this.lang || "en-US",
          name: options?.voice || this.voiceId,
        },
        audioConfig: {
          audioEncoding: options?.format === "mp3" ? "MP3" : "LINEAR16",
        },
      };

      // Add voice gender if no specific voice is set
      if (!options?.voice && !this.voiceId) {
        request.voice.ssmlGender = "NEUTRAL";
      }

      // Add timepoint type for word timings if using beta API
      if (useWordTimings) {
        request.enableTimePointing = ["SSML_MARK"];
      }

      // Synthesize speech
      let response;
      if (useWordTimings) {
        // Use beta API for word timings
        const betaClient =
          new (require("@google-cloud/text-to-speech").v1beta1.TextToSpeechClient)();
        [response] = await betaClient.synthesizeSpeech(request);
      } else {
        // Use standard API
        [response] = await this.client.synthesizeSpeech(request);
      }

      // Process word timings if available
      if (useWordTimings && response.timepoints) {
        this.processTimepoints(response.timepoints, text);
      } else {
        // Create estimated word timings
        this._createEstimatedWordTimings(text);
      }

      return response.audioContent;
    } catch (error) {
      console.error("Error synthesizing speech:", error);
      throw error;
    }
  }

  /**
   * Synthesize text to a byte stream
   * @param text Text or SSML to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to a readable stream of audio bytes or stream with word boundaries
   */
  async synthToBytestream(
    text: string,
    options?: SpeakOptions
  ): Promise<
    | ReadableStream<Uint8Array>
    | {
        audioStream: ReadableStream<Uint8Array>;
        wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
      }
  > {
    // If the client is not available, throw an error
    if (!this.client) {
      throw new Error(
        "Google TTS client is not available. Install @google-cloud/text-to-speech to use this engine."
      );
    }

    try {
      // For Google TTS, we'll convert to bytes first and then create a stream
      // This is because Google's API doesn't provide a streaming endpoint
      const audioBytes = await this.synthToBytes(text, options);

      // Create a readable stream from the audio bytes
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(audioBytes);
          controller.close();
        },
      });

      // If word boundary information is requested and available
      if (options?.useWordBoundary && this.timings.length > 0) {
        // Convert our internal timing format to the expected format
        const wordBoundaries = this.timings.map(([start, end, word]) => ({
          text: word,
          offset: Math.round(start * 10000), // Convert to 100-nanosecond units
          duration: Math.round((end - start) * 10000),
        }));

        return {
          audioStream: stream,
          wordBoundaries,
        };
      }

      return stream;
    } catch (error) {
      console.error("Error synthesizing speech stream:", error);
      throw error;
    }
  }

  /**
   * Start playback with word boundary callbacks
   * @param text Text to speak
   * @param callback Callback function for word boundaries
   * @param options Synthesis options
   */
  async startPlaybackWithCallbacks(
    text: string,
    callback: WordBoundaryCallback,
    options?: SpeakOptions
  ): Promise<void> {
    // Register the callback
    this.on("boundary", callback);

    // Enable word boundary information
    const enhancedOptions = { ...options, useWordBoundary: true };

    // Start playback with word boundary information
    await this.speakStreamed(text, enhancedOptions);
  }

  /**
   * Get available voices
   * @returns Promise resolving to an array of available voices
   */
  /**
   * Map Google voice objects to unified format
   * @param rawVoices Array of Google voice objects
   * @returns Promise resolving to an array of unified voice objects
   */
  protected async _mapVoicesToUnified(rawVoices: any[]): Promise<UnifiedVoice[]> {
    // Convert Google voices to unified format
    return rawVoices.map((voice: any) => ({
      id: voice.name,
      name: voice.name,
      gender: this.mapGender(voice.ssmlGender),
      languageCodes: voice.languageCodes.map((code: string) => {
        // Use LanguageNormalizer to get standardized language information
        const normalized = LanguageNormalizer.normalize(code);
        return {
          bcp47: normalized.bcp47,
          iso639_3: normalized.iso639_3,
          display: normalized.display,
        };
      }),
      provider: "google",
    }));
  }

  /**
   * Prepare SSML for synthesis
   * @param text Text or SSML to prepare
   * @param options Synthesis options
   * @returns SSML ready for synthesis
   */
  private prepareSSML(text: string, options?: SpeakOptions): string {
    // Convert from Speech Markdown if requested
    if (options?.useSpeechMarkdown && SpeechMarkdown.isSpeechMarkdown(text)) {
      text = SpeechMarkdown.toSSML(text, "google");
    }

    // If text is already SSML, return it
    if (SSMLUtils.isSSML(text)) {
      return this.addWordTimingMarks(text);
    }

    // Create SSML from plain text
    let ssml = SSMLUtils.wrapWithSpeakTags(text);

    // Add prosody if properties are set
    if (this.properties.rate || this.properties.pitch || this.properties.volume) {
      const attrs: string[] = [];

      if (this.properties.rate) {
        attrs.push(`rate="${this.properties.rate}"`);
      }

      if (this.properties.pitch) {
        attrs.push(`pitch="${this.properties.pitch}"`);
      }

      if (this.properties.volume) {
        attrs.push(`volume="${this.properties.volume}dB"`);
      }

      if (attrs.length > 0) {
        // Extract content between speak tags
        const match = ssml.match(/<speak[^>]*>(.*?)<\/speak>/s);
        if (match) {
          const content = match[1];
          const prosodyContent = `<prosody ${attrs.join(" ")}>${content}</prosody>`;
          ssml = ssml.replace(content, prosodyContent);
        }
      }
    }

    // Add word timing marks
    return this.addWordTimingMarks(ssml);
  }

  /**
   * Add SSML mark tags for word timing
   * @param ssml SSML to add mark tags to
   * @returns SSML with mark tags
   */
  private addWordTimingMarks(ssml: string): string {
    // Only add marks if using beta API
    if (!this.useBetaApi) {
      return ssml;
    }

    // Extract plain text from SSML
    const plainText = SSMLUtils.stripSSML(ssml);

    // Split into words
    const words = plainText.split(/\s+/).filter((word) => word.length > 0);

    // If no words, return original SSML
    if (!words.length) {
      return ssml;
    }

    // Add mark tags to each word
    let markedText = plainText;
    for (let i = words.length - 1; i >= 0; i--) {
      const word = words[i];
      const regex = new RegExp(`\\b${word}\\b`);
      markedText = markedText.replace(regex, `<mark name="word_${i}"/>${word}`);
    }

    // Replace content in SSML
    if (SSMLUtils.isSSML(ssml)) {
      return ssml.replace(/>([^<]+)</g, (match, content) => {
        if (content.trim() === plainText.trim()) {
          return `>${markedText}<`;
        }
        return match;
      });
    }

    // Wrap with speak tags if not already SSML
    return `<speak>${markedText}</speak>`;
  }

  /**
   * Process timepoints from Google TTS response
   * @param timepoints Timepoints from Google TTS response
   * @param text Original text
   */
  private processTimepoints(timepoints: any[], text: string): void {
    // Extract plain text from SSML if needed
    const plainText = SSMLUtils.isSSML(text) ? SSMLUtils.stripSSML(text) : text;

    // Split into words
    const words = plainText.split(/\s+/).filter((word) => word.length > 0);

    // Create word timings from timepoints
    this.timings = [];

    for (let i = 0; i < timepoints.length; i++) {
      const timepoint = timepoints[i];
      const wordIndex = Number.parseInt(timepoint.markName.replace("word_", ""));

      if (wordIndex >= 0 && wordIndex < words.length) {
        const word = words[wordIndex];
        const startTime = timepoint.timeSeconds;

        // Estimate end time (next timepoint or start + word length * average time per character)
        let endTime;
        if (i < timepoints.length - 1) {
          endTime = timepoints[i + 1].timeSeconds;
        } else {
          // Estimate based on word length (assuming ~0.1s per character)
          endTime = startTime + word.length * 0.1;
        }

        this.timings.push([startTime, endTime, word]);
      }
    }

    // Sort timings by start time
    this.timings.sort((a, b) => a[0] - b[0]);
  }

  /**
   * Map Google SSML gender to unified gender format
   * @param ssmlGender Google SSML gender
   * @returns Unified gender format
   */
  private mapGender(ssmlGender: string): "Male" | "Female" | "Unknown" {
    switch (ssmlGender) {
      case "MALE":
        return "Male";
      case "FEMALE":
        return "Female";
      default:
        return "Unknown";
    }
  }

  /**
   * Check if credentials are valid
   * @returns Promise resolving to true if credentials are valid
   */
  async checkCredentials(): Promise<boolean> {
    // If we're in test mode and the Google Cloud Text-to-Speech package is not installed,
    // we'll check if the credentials file exists
    if (process.env.NODE_ENV === "test" && !this.client) {
      try {
        const fs = require("fs");
        const credentials = this.credentials as GoogleTTSCredentials;

        // Check if the keyFilename exists
        if (credentials.keyFilename && fs.existsSync(credentials.keyFilename)) {
          return true;
        }

        // Check if the GOOGLE_APPLICATION_CREDENTIALS environment variable is set
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS &&
            fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
          return true;
        }

        // Check if the GOOGLE_SA_PATH environment variable is set
        if (process.env.GOOGLE_SA_PATH && fs.existsSync(process.env.GOOGLE_SA_PATH)) {
          return true;
        }
      } catch (error) {
        console.error("Error checking Google credentials:", error);
      }
      return false;
    }

    // Use the default implementation for non-test mode
    return super.checkCredentials();
  }
}
