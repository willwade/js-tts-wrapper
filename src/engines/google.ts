import { AbstractTTSClient } from "../core/abstract-tts";
import type { SpeakOptions, TTSCredentials, UnifiedVoice, WordBoundaryCallback } from "../types";
import * as SSMLUtils from "../core/ssml-utils";
import * as SpeechMarkdown from "../markdown/converter";

// Dynamic import for Google Cloud Text-to-Speech (Node.js only)
// This avoids browser import errors for Node.js-only packages

/**
 * Google TTS credentials
 */
export interface GoogleTTSCredentials extends TTSCredentials {
  /**
   * Google Cloud project ID (Node/service-account usage)
   */
  projectId?: string;

  /**
   * Google Cloud credentials JSON (Node/service-account usage)
   */
  credentials?: any;

  /**
   * Google Cloud credentials file path (Node/service-account usage)
   */
  keyFilename?: string;

  /**
   * API key for REST usage (browser-safe). If provided, we will use the REST API via fetch
   * instead of the @google-cloud/text-to-speech client.
   */
  apiKey?: string;
}

/**
 * Extended options for Google TTS
 */
export interface GoogleTTSOptions extends SpeakOptions {
  format?: 'mp3' | 'wav'; // Define formats supported by this client logic (maps to LINEAR16)
}

/**
 * Google TTS client
 */
export class GoogleTTSClient extends AbstractTTSClient {
  /**
   * Google Cloud Text-to-Speech client
   */
  private client: any | null;

  /**
   * Whether to use the beta API for word timings
   */
  private useBetaApi = false;

  /**
   * Google Cloud credentials
   */
  private googleCredentials: GoogleTTSCredentials;

  /**
   * Create a new Google TTS client
   * @param credentials Google Cloud credentials
   */
  constructor(credentials: GoogleTTSCredentials) {
    super(credentials);

    // Store the credentials for later use
    this.googleCredentials = credentials;
    this.client = null;



    // Don't initialize the client here - do it lazily on first use
    // This follows the same pattern as Polly and Azure engines
  }

  /**
   * Initialize the Google TTS client
   * @param credentials Google TTS credentials
   */
  private async initializeClient(credentials: GoogleTTSCredentials): Promise<void> {
    // If apiKey is provided, use REST mode (browser-safe) and skip Node client init
    if (credentials.apiKey) {
      this.client = null;
      this.useBetaApi = false; // v1 REST doesn't return timepoints; we'll estimate timings
      return;
    }

    try {
      // Try to load the Google Cloud Text-to-Speech client (Node.js only)
      const dynamicImport: any = new Function('m', 'return import(m)');
      const ttsModule = await dynamicImport("@google-cloud/text-to-speech");
      const { TextToSpeechClient } = ttsModule;

      this.client = new TextToSpeechClient({
        projectId: credentials.projectId,
        credentials: credentials.credentials,
        keyFilename: credentials.keyFilename,
      });

      // Try to load the beta client for word timings
      try {
        if (ttsModule.v1beta1) {
          this.useBetaApi = true;
        }
      } catch (error) {
        console.warn(
          "Google Cloud Text-to-Speech beta API not available. Word timing will be estimated."
        );
      }
    } catch (error) {
      // Always log the actual error for debugging
      console.error("Error initializing Google TTS client:", error);

      // In test mode, we'll just log a warning instead of an error
      if (process.env.NODE_ENV === "test") {
        console.warn(
          "Google TTS client not initialized in test mode. Some tests may be skipped."
        );
      } else {
        console.warn(
          "Google TTS will not be available. Install @google-cloud/text-to-speech to use this engine."
        );
      }
      this.client = null;
    }
  }

  /**
   * Get available voices from the provider
   * @returns Promise resolving to an array of voice objects
   */
  protected async _getVoices(): Promise<any[]> {
    try {
      // If using REST mode with API key (browser or Node), call REST voices endpoint
      if (this.googleCredentials.apiKey) {
        const json = await this.restListVoices(this.googleCredentials.apiKey);
        return Array.isArray(json.voices) ? json.voices : [];
      }

      // Lazy initialization - initialize client on first use
      if (!this.client) {
        await this.initializeClient(this.googleCredentials);
      }

      // If client is still null after initialization, return empty array
      if (!this.client) {
        console.log("Google TTS: Client initialization failed, returning empty array");
        return [];
      }

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
  async synthToBytes(text: string, options?: GoogleTTSOptions): Promise<Uint8Array> {
    // If API key provided, use REST mode (browser-safe, no Node deps)
    if (this.googleCredentials.apiKey) {
      try {
        const ssml = await this.prepareSSML(text, options);
        const voiceName = options?.voice || this.voiceId;
        const supportsSSML = !voiceName || (voiceName.includes("Standard") || voiceName.includes("Wavenet"));
        let languageCode = this.lang || "en-US";
        if (voiceName) {
          const parts = voiceName.split("-");
          if (parts.length >= 2) languageCode = `${parts[0]}-${parts[1]}`;
        }
        const request: any = {
          input: supportsSSML && SSMLUtils.isSSML(ssml) ? { ssml } : { text: SSMLUtils.isSSML(ssml) ? SSMLUtils.stripSSML(ssml) : ssml },
          voice: { languageCode, name: voiceName },
          audioConfig: { audioEncoding: options?.format === "mp3" ? "MP3" : "LINEAR16" },
        };
        if (!options?.voice && !this.voiceId) request.voice.ssmlGender = "NEUTRAL";
        // REST v1 does not return timepoints; estimate timings
        const bytes = await this.restSynthesize(this.googleCredentials.apiKey, request);
        this._createEstimatedWordTimings(text);
        return bytes;
      } catch (error) {
        console.error("Error synthesizing speech via REST (apiKey):", error);
        throw error;
      }
    }

    // Lazy initialization - initialize client on first use
    if (!this.client) {
      await this.initializeClient(this.googleCredentials);
    }

    // If the client is still not available after initialization, throw an error
    if (!this.client) {
      throw new Error(
        "Google TTS client is not available. Install @google-cloud/text-to-speech to use this engine."
      );
    }

    try {
      // Prepare SSML if needed
      const ssml = await this.prepareSSML(text, options);

      // Determine if we should use the beta API for word timings
      const useWordTimings = options?.useWordBoundary && this.useBetaApi;

      // Check if the voice supports SSML
      const voiceName = options?.voice || this.voiceId;
      // Only Standard and Wavenet voices support SSML
      const supportsSSML = !voiceName || (voiceName.includes("Standard") || voiceName.includes("Wavenet"));

      // Extract language code from voice name if available
      let languageCode = this.lang || "en-US";
      if (voiceName) {
        // Extract language code from voice name (e.g., en-AU-Chirp-HD-D -> en-AU)
        const parts = voiceName.split("-");
        if (parts.length >= 2) {
          languageCode = `${parts[0]}-${parts[1]}`;
        }
      }

      // Prepare the request
      const request: any = {
        input: supportsSSML && SSMLUtils.isSSML(ssml) ? { ssml } : { text: SSMLUtils.isSSML(ssml) ? SSMLUtils.stripSSML(ssml) : ssml },
        voice: {
          languageCode: languageCode,
          name: voiceName,
        },
        audioConfig: {
          audioEncoding: options?.format === "mp3" ? "MP3" : "LINEAR16",
        },
      };

      // Log a warning if SSML is being stripped
      if (!supportsSSML && SSMLUtils.isSSML(ssml)) {
        console.warn(`Voice ${voiceName} does not support SSML. Falling back to plain text.`);
      }

      // Add voice gender if no specific voice is set
      if (!options?.voice && !this.voiceId) {
        request.voice.ssmlGender = "NEUTRAL";
      }

      // Add timepoint type for word timings if using beta API
      if (useWordTimings) {
        request.enableTimePointing = ["SENTENCE", "SSML_MARK"];
      }

      // Synthesize speech
      let response;
      if (useWordTimings) {
        // Use beta API for word timings
        try {
          // Use dynamic import for ESM compatibility without static specifiers for bundlers
          const dynamicImport: any = new Function('m', 'return import(m)');
          const ttsModule = await dynamicImport("@google-cloud/text-to-speech");
          const betaClient = new ttsModule.v1beta1.TextToSpeechClient({
            projectId: this.googleCredentials.projectId,
            credentials: this.googleCredentials.credentials,
            keyFilename: this.googleCredentials.keyFilename,
          });
          [response] = await betaClient.synthesizeSpeech(request);
        } catch (error) {
          console.warn("Error using beta API for word timings, falling back to standard API:", error);
          [response] = await this.client.synthesizeSpeech(request);
        }
      } else {
        // Use standard API
        [response] = await this.client.synthesizeSpeech(request);
      }

      // Process word timings if available
      if (useWordTimings && response && 'timepoints' in response && Array.isArray(response.timepoints)) {
        this.processTimepoints(response.timepoints as Array<{markName: string; timeSeconds: number}>, text);
      } else {
        // Create estimated word timings
        this._createEstimatedWordTimings(text);
      }

      // Return audio content, ensuring it's a Uint8Array
      return response && response.audioContent ?
        new Uint8Array(response.audioContent as Uint8Array) :
        new Uint8Array(0);
    } catch (error) {
      console.error("Error synthesizing speech:", error);
      throw error;
    }
  }

  /**
   * Synthesize text to a byte stream
   * @param text Text to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to an object containing the audio stream and word boundaries
   */
  async synthToBytestream(text: string, options?: GoogleTTSOptions): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
  }> {
    // Lazy initialization - initialize client on first use
    if (!this.client) {
      await this.initializeClient(this.googleCredentials);
    }

    // If the client is still not available after initialization, throw an error
    if (!this.client) {
      throw new Error(
        "Google TTS client is not available. Install @google-cloud/text-to-speech to use this engine."
      );
    }

    try {
      // For Google TTS, we'll convert to bytes first and then create a stream
      // This is because Google's API doesn't provide a streaming endpoint
      const audioBytes = await this.synthToBytes(text, options);

      // Create a standard ReadableStream
      const stream = new ReadableStream<Uint8Array>({
        start(controller: ReadableStreamDefaultController<Uint8Array>) {
          controller.enqueue(audioBytes);
          controller.close();
        },
      });

      // Always return the structure, populate boundaries only if requested AND available
      const finalBoundaries = options?.useWordBoundary ? this.timings.map(([start, end, word]) => ({
        text: word,
        offset: Math.round(start * 10000), // Convert to 100-nanosecond units
        duration: Math.round((end - start) * 10000),
      })) : [];

      return {
        audioStream: stream,
        wordBoundaries: finalBoundaries
      };
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
    options?: GoogleTTSOptions
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
      name: voice.name || 'Unknown',
      gender: voice.ssmlGender?.toLowerCase() || undefined,
      languageCodes: voice.languageCodes,
      provider: 'google' as const,
      raw: voice, // Keep the original raw voice data
    }));
  }

  /**
   * Prepare SSML for synthesis
   * @param text Text or SSML to prepare
   * @param options Synthesis options
   * @returns SSML ready for synthesis
   */
  private async prepareSSML(text: string, options?: GoogleTTSOptions): Promise<string> {
    // Convert from Speech Markdown if requested
    if (options?.useSpeechMarkdown && SpeechMarkdown.isSpeechMarkdown(text)) {
      text = await SpeechMarkdown.toSSML(text, "google");
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
  private processTimepoints(timepoints: Array<{markName: string; timeSeconds: number}>, text: string): void {
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
   * Get the list of required credential types for this engine
   * @returns Array of required credential field names
   */
  protected getRequiredCredentials(): string[] {
    return ['keyFilename']; // Primary credential type, though projectId and credentials are also supported
  }

  /**
   * Check if credentials are valid
   * @returns Promise resolving to true if credentials are valid
   */
  async checkCredentials(): Promise<boolean> {
    // If using API key mode, consider presence of key as valid for basic checks
    if (this.googleCredentials.apiKey) {
      return typeof this.googleCredentials.apiKey === "string" && this.googleCredentials.apiKey.length > 10;
    }

    // If the client is not available, check if the credentials file exists
    if (!this.client) {
      try {
        // Only import fs in Node.js environment
        if (typeof window === "undefined") {
          const dyn: any = new Function('m','return import(m)');
          const fs = await dyn('node:fs');
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
        } else {
          // In browser environment without apiKey, we can't check file existence
          console.warn("Cannot check Google credentials file existence in browser environment");
          return false;
        }
      } catch (error) {
        console.error("Error checking Google credentials:", error);
      }
      return false;
    }

    // Use the default implementation if client is available
    return super.checkCredentials();
  }

  /**
   * Check if credentials are valid with detailed response
   * @returns Promise resolving to an object with success flag and optional error message
   */
  async checkCredentialsDetailed(): Promise<{ success: boolean; error?: string; voiceCount?: number }> {
    // API key mode: try listing voices to validate the key
    if (this.googleCredentials.apiKey) {
      try {
        const json = await this.restListVoices(this.googleCredentials.apiKey);
        const count = Array.isArray(json.voices) ? json.voices.length : 0;
        return { success: true, voiceCount: count };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }

    // If the client is not available, check if the credentials file exists
    if (!this.client) {
      try {
        // Only import fs in Node.js environment
        if (typeof window === "undefined") {
          const dyn: any = new Function('m','return import(m)');
          const fs = await dyn('node:fs');
          const credentials = this.credentials as GoogleTTSCredentials;

          // Check if the keyFilename exists
          if (credentials.keyFilename && fs.existsSync(credentials.keyFilename)) {
            return { success: true, error: "Credentials file exists but client not initialized" };
          }

          // Check if the GOOGLE_APPLICATION_CREDENTIALS environment variable is set
          if (process.env.GOOGLE_APPLICATION_CREDENTIALS &&
              fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
            return { success: true, error: "GOOGLE_APPLICATION_CREDENTIALS file exists but client not initialized" };
          }

          // Check if the GOOGLE_SA_PATH environment variable is set
          if (process.env.GOOGLE_SA_PATH && fs.existsSync(process.env.GOOGLE_SA_PATH)) {
            return { success: true, error: "GOOGLE_SA_PATH file exists but client not initialized" };
          }

          return {
            success: false,
            error: "No valid credentials file found"
          };
        } else {
          // In browser environment without apiKey, we can't check file existence
          return {
            success: false,
            error: "Cannot check Google credentials file existence in browser environment"
          };
        }
      } catch (error) {
        console.error("Error checking Google credentials:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }

    // Use the default implementation if client is available
    return super.checkCredentialsDetailed();
  }

  // ===== REST helpers for API key mode (browser-safe) =====
  private async restListVoices(apiKey: string): Promise<any> {
    const url = `https://texttospeech.googleapis.com/v1/voices?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Google TTS voices failed: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  private async restSynthesize(apiKey: string, request: any): Promise<Uint8Array> {
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Google TTS synth failed: ${res.status} ${res.statusText} ${text}`);
    }
    const json = await res.json();
    const b64 = json?.audioContent as string | undefined;
    if (!b64) return new Uint8Array(0);
    return this.base64ToBytes(b64);
  }

  private base64ToBytes(b64: string): Uint8Array {
    // Node path
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (typeof Buffer !== "undefined" && typeof (Buffer as any).from === "function") {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const buf = (Buffer as any).from(b64, "base64");
      return buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    }
    // Browser path
    const binary = typeof atob === "function" ? atob(b64) : "";
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }

}
