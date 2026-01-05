import { AbstractTTSClient } from "../core/abstract-tts";
import * as SpeechMarkdown from "../markdown/converter";
import type { SpeakOptions, TTSCredentials, UnifiedVoice, WordBoundaryCallback } from "../types";
import { getFetch } from "../utils/fetch-utils";

// Get the fetch implementation for the current environment
const fetch = getFetch();

/**
 * Extended options for ElevenLabs TTS
 */
export interface ElevenLabsTTSOptions extends SpeakOptions {
  format?: "mp3" | "wav"; // Define formats supported by this client logic (maps to pcm)
  useTimestamps?: boolean; // Enable character-level timing data
  model?: string; // Override model per request
  modelId?: string; // Alias for model
  outputFormat?: string; // Override output_format per request
  voiceSettings?: Record<string, unknown>; // Override voice_settings per request
  requestOptions?: Record<string, unknown>; // Additional request payload overrides
}

/**
 * ElevenLabs TTS credentials
 */
export interface ElevenLabsCredentials extends TTSCredentials {
  /**
   * ElevenLabs API key
   */
  apiKey?: string;
  /**
   * Optional default model selection
   */
  model?: string;
  modelId?: string;
  /**
   * Override default output format (e.g. mp3_44100_128)
   */
  outputFormat?: string;
  /**
   * Pass-through configuration as object or JSON string
   */
  properties?: Record<string, unknown> | string;
  propertiesJson?: string;
}

/**
 * ElevenLabs character alignment data
 */
export interface ElevenLabsAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

/**
 * ElevenLabs API response with timestamps
 */
export interface ElevenLabsTimestampResponse {
  audio_base64: string;
  alignment: ElevenLabsAlignment;
  normalized_alignment?: ElevenLabsAlignment;
}

/**
 * ElevenLabs TTS client
 */
export class ElevenLabsTTSClient extends AbstractTTSClient {
  /**
   * ElevenLabs API key
   */
  private apiKey: string;

  /**
   * Base URL for ElevenLabs API
   */
  private baseUrl = "https://api.elevenlabs.io/v1";

  /**
   * Default model to use for synthesis
   */
  private modelId: string;

  /**
   * Default output format for requests
   */
  private outputFormat = "mp3_44100_128";

  /**
   * Request-level overrides provided via credentials/properties
   */
  private requestOverrides: Record<string, unknown> = {};

  /**
   * Create a new ElevenLabs TTS client
   * @param credentials ElevenLabs credentials
   */
  constructor(credentials: ElevenLabsCredentials = {}) {
    super(credentials);
    this.apiKey = credentials.apiKey || process.env.ELEVENLABS_API_KEY || "";
    this.modelId =
      (credentials as any).modelId || (credentials as any).model || "eleven_multilingual_v2";

    if (typeof (credentials as any).outputFormat === "string") {
      this.outputFormat = (credentials as any).outputFormat;
    }

    this.applyCredentialProperties(credentials);
  }

  /**
   * Apply any configuration passed through credentials (including JSON strings)
   */
  private applyCredentialProperties(credentials: ElevenLabsCredentials): void {
    const directProps: Record<string, unknown>[] = [];

    if (typeof (credentials as any).output_format === "string") {
      directProps.push({ output_format: (credentials as any).output_format });
    }

    const rawProps =
      (credentials as any).properties ??
      (credentials as any).propertiesJson ??
      (credentials as any).propertiesJSON;

    if (rawProps) {
      if (typeof rawProps === "string") {
        try {
          const parsed = JSON.parse(rawProps);
          if (parsed && typeof parsed === "object") {
            directProps.push(parsed as Record<string, unknown>);
          }
        } catch (error) {
          console.warn("Failed to parse ElevenLabs properties JSON:", error);
        }
      } else if (typeof rawProps === "object") {
        directProps.push(rawProps as Record<string, unknown>);
      }
    }

    for (const props of directProps) {
      for (const [key, value] of Object.entries(props)) {
        this.setProperty(key, value);
      }
    }
  }

  /**
   * Resolve the model ID for a request
   */
  private resolveModelId(
    options?: ElevenLabsTTSOptions,
    extraOverrides: Record<string, unknown> = {}
  ): string {
    return (
      options?.model ||
      options?.modelId ||
      (options?.requestOptions as any)?.model_id ||
      (extraOverrides as any)?.model_id ||
      (extraOverrides as any)?.model ||
      this.modelId
    );
  }

  /**
   * Resolve the output format for a request
   */
  private resolveOutputFormat(
    options?: ElevenLabsTTSOptions,
    extraOverrides: Record<string, unknown> = {}
  ): string {
    return (
      options?.outputFormat ||
      (options?.requestOptions as any)?.output_format ||
      (extraOverrides as any)?.output_format ||
      (this.requestOverrides as any).output_format ||
      this.outputFormat
    );
  }

  /**
   * Merge default and override voice settings
   */
  private resolveVoiceSettings(
    options?: ElevenLabsTTSOptions,
    extraOverrides: Record<string, unknown> = {}
  ): Record<string, unknown> {
    const defaultVoiceSettings = {
      stability: 0.5,
      similarity_boost: 0.75,
      use_speaker_boost: true,
      style: 0,
      speed: typeof this.properties.rate === "number" ? this.properties.rate : 1.0,
    };

    const overridesFromCredentials =
      (this.requestOverrides as any).voice_settings &&
      typeof (this.requestOverrides as any).voice_settings === "object"
        ? (this.requestOverrides as any).voice_settings
        : {};

    const overridesFromOptions =
      options?.voiceSettings && typeof options.voiceSettings === "object"
        ? options.voiceSettings
        : {};

    const overridesFromRequestOptions =
      options?.requestOptions && typeof (options.requestOptions as any).voice_settings === "object"
        ? (options.requestOptions as any).voice_settings
        : {};

    const overridesFromExtra =
      extraOverrides && typeof (extraOverrides as any).voice_settings === "object"
        ? (extraOverrides as any).voice_settings
        : {};

    return {
      ...defaultVoiceSettings,
      ...overridesFromCredentials,
      ...overridesFromRequestOptions,
      ...overridesFromOptions,
      ...overridesFromExtra,
    };
  }

  /**
   * Remove voice_settings from an overrides object to avoid double-merging
   */
  private withoutVoiceSettings(overrides?: Record<string, unknown>): Record<string, unknown> {
    if (!overrides || typeof overrides !== "object") return {};
    const { voice_settings, ...rest } = overrides as Record<string, unknown>;
    return rest;
  }

  /**
   * Build a request payload honoring defaults and user overrides
   */
  private buildRequestPayload(
    text: string,
    options?: ElevenLabsTTSOptions,
    extraOverrides: Record<string, unknown> = {}
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      text,
      model_id: this.resolveModelId(options, extraOverrides),
      output_format: this.resolveOutputFormat(options, extraOverrides),
      voice_settings: this.resolveVoiceSettings(options, extraOverrides),
    };

    const merged = {
      ...payload,
      ...this.withoutVoiceSettings(this.requestOverrides),
      ...this.withoutVoiceSettings(options?.requestOptions),
      ...this.withoutVoiceSettings(extraOverrides),
    };

    // Ensure required fields are preserved
    merged.text = text;
    merged.model_id = this.resolveModelId(options, merged);
    merged.output_format = this.resolveOutputFormat(options, merged);
    merged.voice_settings = this.resolveVoiceSettings(options, merged);

    return merged;
  }

  /**
   * Set default model ID
   */
  setModelId(modelId: string): void {
    if (modelId) {
      this.modelId = modelId;
    }
  }

  /**
   * Get a property value
   */
  getProperty(property: string): any {
    switch (property) {
      case "model":
      case "model_id":
      case "modelId":
        return this.modelId;
      case "outputFormat":
      case "output_format":
        return this.resolveOutputFormat();
      default:
        return super.getProperty(property);
    }
  }

  /**
   * Set a property value
   */
  setProperty(property: string, value: any): void {
    switch (property) {
      case "model":
      case "model_id":
      case "modelId":
        this.setModelId(String(value));
        break;
      case "outputFormat":
      case "output_format":
        if (typeof value === "string") {
          this.outputFormat = value;
        }
        break;
      case "voice_settings":
        if (value && typeof value === "object") {
          this.requestOverrides.voice_settings = value as Record<string, unknown>;
        }
        break;
      case "voice":
      case "voiceId":
        if (typeof value === "string") {
          this.setVoice(value);
        }
        break;
      default:
        super.setProperty(property, value);
        if (!["rate", "pitch", "volume"].includes(property) && value !== undefined) {
          this.requestOverrides[property] = value;
        }
        break;
    }
  }

  /**
   * Check if the credentials are valid
   * @returns Promise resolving to true if credentials are valid, false otherwise
   */
  async checkCredentials(): Promise<boolean> {
    if (!this.apiKey) {
      console.error("ElevenLabs API key is required");
      return false;
    }

    try {
      // 1) Basic auth probe: list voices
      const voices = await this._getVoices();
      if (!voices || voices.length === 0) return false;

      // 2) Quota probe: attempt a tiny synthesis to detect quota/Unauthorized early
      const quotaOk = await this._quotaProbe();
      return quotaOk;
    } catch (error) {
      console.error("Error checking ElevenLabs credentials:", error);
      return false;
    }
  }

  /**
   * Perform a tiny synthesis to detect quota/Unauthorized issues up-front
   * Returns false if quota is exceeded or API key is unauthorized for synthesis
   */
  private async _quotaProbe(): Promise<boolean> {
    try {
      const voiceId = this.voiceId || "21m00Tcm4TlvDq8ikWAM"; // Rachel
      const payload = this.buildRequestPayload("hello", undefined, {
        output_format: "mp3_44100_64", // keep tiny
      });
      const requestOptions = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": this.apiKey,
        },
        body: JSON.stringify(payload),
      } as const;

      const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, requestOptions);
      if (!response.ok) {
        const errorText = await response.text();
        const lower = (errorText || "").toLowerCase();
        if (
          response.status === 401 ||
          response.status === 402 ||
          response.status === 429 ||
          lower.includes("quota") ||
          lower.includes("exceeded your current quota") ||
          lower.includes("insufficient")
        ) {
          console.log("ElevenLabs: quota/authorization not sufficient for tests; skipping.");
          return false;
        }
        // Other failures count as invalid
        console.error(
          `ElevenLabs quota probe failed: ${response.status} ${response.statusText} - ${errorText}`
        );
        return false;
      }
      // success
      return true;
    } catch (err) {
      console.error("ElevenLabs quota probe error:", err);
      return false;
    }
  }

  /**
   * Get the list of required credential types for this engine
   * @returns Array of required credential field names
   */
  protected getRequiredCredentials(): string[] {
    return ["apiKey"];
  }

  /**
   * Get available voices from the provider
   * @returns Promise resolving to an array of voice objects
   */
  protected async _getVoices(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        method: "GET",
        headers: {
          "xi-api-key": this.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `ElevenLabs API error: ${response.status} ${response.statusText}\nResponse: ${errorText}`
        );
        throw new Error(`Failed to get voices: ${response.statusText}`);
      }

      const data = await response.json();
      return data.voices;
    } catch (error) {
      console.error("Error getting ElevenLabs voices:", error);
      return [];
    }
  }

  /**
   * Prepare text for synthesis by stripping SSML tags
   * @param text Text to prepare
   * @param options Synthesis options
   * @returns Prepared text
   */
  private async prepareText(text: string, options?: SpeakOptions): Promise<string> {
    let processedText = text;

    // Convert from Speech Markdown if requested
    if (options?.useSpeechMarkdown && SpeechMarkdown.isSpeechMarkdown(processedText)) {
      // Convert to SSML first, then strip SSML tags
      // Use "elevenlabs" platform for ElevenLabs-specific Speech Markdown features
      const ssml = await SpeechMarkdown.toSSML(processedText, "elevenlabs");
      processedText = this._stripSSML(ssml);
    }

    // If text is SSML, strip the tags as ElevenLabs doesn't support SSML
    // and has its own emotion analysis
    if (this._isSSML(processedText)) {
      processedText = this._stripSSML(processedText);
    }

    return processedText;
  }

  /**
   * Convert text to audio bytes
   * @param text Text to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to audio bytes
   */
  async synthToBytes(text: string, options?: ElevenLabsTTSOptions): Promise<Uint8Array> {
    try {
      // Use voice from options or the default voice
      const voiceId = options?.voice || this.voiceId || "21m00Tcm4TlvDq8ikWAM"; // Default voice (Rachel)

      // Prepare text for synthesis (strip SSML tags)
      const preparedText = await this.prepareText(text, options);

      // Check if we need timing data for word boundaries
      const useTimestamps = options?.useTimestamps || options?.useWordBoundary;

      let audioData: Uint8Array;

      if (useTimestamps) {
        // Use the with-timestamps endpoint for timing data
        const timestampResponse = await this.synthWithTimestamps(preparedText, voiceId, options);

        // Decode base64 audio data
        const audioBase64 = timestampResponse.audio_base64;
        const audioBuffer = Buffer.from(audioBase64, "base64");
        audioData = new Uint8Array(audioBuffer);

        // Convert character timing to word boundaries and store for events
        if (timestampResponse.alignment) {
          const wordBoundaries = this.convertCharacterTimingToWordBoundaries(
            preparedText,
            timestampResponse.alignment
          );

          // Store timing data for word boundary events
          this.timings = wordBoundaries.map((wb) => [
            wb.offset / 10000, // Convert from 100-nanosecond units to seconds
            (wb.offset + wb.duration) / 10000,
            wb.text,
          ]);
        }
      } else {
        // Use the regular endpoint (no timing data)
        const payload = this.buildRequestPayload(preparedText, options);
        const requestOptions = {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": this.apiKey,
          },
          body: JSON.stringify(payload),
        };

        const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, requestOptions);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `ElevenLabs API error: ${response.status} ${response.statusText}\nResponse: ${errorText}`
          );
          const err = new Error(
            `Failed to synthesize speech: ${response.status} ${response.statusText} - ${errorText}`
          );
          (err as any).status = response.status;
          throw err;
        }

        const arrayBuffer = await response.arrayBuffer();
        audioData = new Uint8Array(arrayBuffer);

        // Create estimated word timings if no timing data available
        this._createEstimatedWordTimings(preparedText);
      }

      // Convert to WAV if requested (since we always get MP3 from ElevenLabs)
      if (options?.format === "wav") {
        audioData = await this.convertMp3ToWav(audioData);
      }

      return audioData;
    } catch (error) {
      console.error("Error synthesizing speech:", error);
      throw error;
    }
  }

  /**
   * Synthesize text to a byte stream
   * @param text Text to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to an object containing the audio stream and word boundaries array
   */
  async synthToBytestream(
    text: string,
    options?: ElevenLabsTTSOptions
  ): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
  }> {
    try {
      // Use voice from options or the default voice
      const voiceId = options?.voice || this.voiceId || "21m00Tcm4TlvDq8ikWAM"; // Default voice (Rachel)

      // Prepare text for synthesis (strip SSML tags)
      const preparedText = await this.prepareText(text, options);

      // Check if we need timing data
      const useTimestamps = options?.useTimestamps || options?.useWordBoundary;

      let audioData: Uint8Array;
      let wordBoundaries: Array<{ text: string; offset: number; duration: number }> = [];

      if (useTimestamps) {
        // Use the with-timestamps endpoint for timing data
        const timestampResponse = await this.synthWithTimestamps(preparedText, voiceId, options);

        // Decode base64 audio data
        const audioBase64 = timestampResponse.audio_base64;
        const audioBuffer = Buffer.from(audioBase64, "base64");
        audioData = new Uint8Array(audioBuffer);

        // Convert character timing to word boundaries
        if (timestampResponse.alignment) {
          wordBoundaries = this.convertCharacterTimingToWordBoundaries(
            preparedText,
            timestampResponse.alignment
          );
        }
      } else {
        // Use the regular streaming endpoint (no timing data)
        const payload = this.buildRequestPayload(preparedText, options);
        const requestOptions = {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": this.apiKey,
          },
          body: JSON.stringify(payload),
        };

        const response = await fetch(
          `${this.baseUrl}/text-to-speech/${voiceId}/stream`,
          requestOptions
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `ElevenLabs API error: ${response.status} ${response.statusText}\nResponse: ${errorText}`
          );
          const err = new Error(
            `Failed to synthesize speech stream: ${response.status} ${response.statusText} - ${errorText}`
          );
          (err as any).status = response.status;
          throw err;
        }

        const responseArrayBuffer = await response.arrayBuffer();
        audioData = new Uint8Array(responseArrayBuffer);
      }

      // Convert to WAV if requested (since we always get MP3 from ElevenLabs)
      if (options?.format === "wav") {
        audioData = await this.convertMp3ToWav(audioData);
      }

      // Create a ReadableStream from the Uint8Array
      const readableStream = new ReadableStream({
        start(controller) {
          controller.enqueue(audioData);
          controller.close();
        },
      });

      return { audioStream: readableStream, wordBoundaries };
    } catch (error) {
      console.error("Error synthesizing speech stream:", error);
      throw error;
    }
  }

  /**
   * Call ElevenLabs API with timestamps endpoint
   * @param text Text to synthesize
   * @param voiceId Voice ID to use
   * @param options Synthesis options
   * @returns Promise resolving to timestamp response
   */
  private async synthWithTimestamps(
    text: string,
    voiceId: string,
    options?: ElevenLabsTTSOptions
  ): Promise<ElevenLabsTimestampResponse> {
    const payload = this.buildRequestPayload(text, options);
    const requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": this.apiKey,
      },
      body: JSON.stringify(payload),
    };

    const response = await fetch(
      `${this.baseUrl}/text-to-speech/${voiceId}/with-timestamps`,
      requestOptions
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `ElevenLabs API error: ${response.status} ${response.statusText}\nResponse: ${errorText}`
      );
      const err = new Error(
        `Failed to synthesize speech with timestamps: ${response.status} ${response.statusText} - ${errorText}`
      );
      (err as any).status = response.status;
      throw err;
    }

    return (await response.json()) as ElevenLabsTimestampResponse;
  }

  /**
   * Convert character-level timing data to word boundaries
   * @param text Original text
   * @param alignment Character alignment data from ElevenLabs
   * @returns Array of word boundary objects
   */
  private convertCharacterTimingToWordBoundaries(
    text: string,
    alignment: ElevenLabsAlignment
  ): Array<{ text: string; offset: number; duration: number }> {
    const wordBoundaries: Array<{ text: string; offset: number; duration: number }> = [];

    // Split text into words while preserving positions
    const words: Array<{ word: string; startIndex: number; endIndex: number }> = [];
    const wordRegex = /\S+/g;
    let match: RegExpExecArray | null = wordRegex.exec(text);

    while (match !== null) {
      words.push({
        word: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length - 1,
      });
      match = wordRegex.exec(text);
    }

    // Convert each word to boundary data using character timing
    for (const wordInfo of words) {
      // Find the character timing for the start and end of this word
      const startCharIndex = wordInfo.startIndex;
      const endCharIndex = wordInfo.endIndex;

      // Make sure we have timing data for these character positions
      if (
        startCharIndex < alignment.character_start_times_seconds.length &&
        endCharIndex < alignment.character_end_times_seconds.length
      ) {
        const startTime = alignment.character_start_times_seconds[startCharIndex];
        const endTime = alignment.character_end_times_seconds[endCharIndex];

        wordBoundaries.push({
          text: wordInfo.word,
          offset: Math.round(startTime * 10000), // Convert to 100-nanosecond units
          duration: Math.round((endTime - startTime) * 10000),
        });
      }
    }

    return wordBoundaries;
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
    options?: ElevenLabsTTSOptions
  ): Promise<void> {
    // Register the callback
    this.on("boundary", callback);

    // Enable timestamps for better word boundary accuracy
    const enhancedOptions = {
      ...options,
      useTimestamps: true,
    };

    // Start playback
    await this.speakStreamed(text, enhancedOptions);
  }

  /**
   * Map ElevenLabs voice objects to unified format
   * @param rawVoices Array of ElevenLabs voice objects
   * @returns Promise resolving to an array of unified voice objects
   */
  protected async _mapVoicesToUnified(rawVoices: any[]): Promise<UnifiedVoice[]> {
    // Map raw voices directly without language normalization for now
    return rawVoices.map((voice) => ({
      id: voice.voice_id,
      name: voice.name,
      gender: undefined, // ElevenLabs doesn't provide gender
      languageCodes: [
        {
          bcp47: voice.labels?.accent || "en-US",
          iso639_3: (voice.labels?.accent || "en-US").split("-")[0] || "eng",
          display: voice.labels?.accent || "English",
        },
      ],
      provider: "elevenlabs",
    }));
  }

  /**
   * Get voice by ID
   * @param voiceId Voice ID
   * @returns Promise resolving to voice details
   */
  async getVoice(voiceId: string): Promise<UnifiedVoice | null> {
    try {
      const response = await fetch(`${this.baseUrl}/voices/${voiceId}`, {
        method: "GET",
        headers: {
          "xi-api-key": this.apiKey,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        const errorText = await response.text();
        console.error(
          `ElevenLabs API error: ${response.status} ${response.statusText}\nResponse: ${errorText}`
        );
        throw new Error(`Failed to get voice: ${response.statusText}`);
      }

      const voice = await response.json();

      // Map to unified format using the same logic as _mapVoicesToUnified
      const unifiedVoice: UnifiedVoice = {
        id: voice.voice_id,
        name: voice.name,
        gender:
          voice.labels?.gender === "female"
            ? "Female"
            : voice.labels?.gender === "male"
              ? "Male"
              : "Unknown",
        languageCodes: [
          {
            bcp47: voice.labels?.language || "en-US",
            iso639_3: voice.labels?.language?.split("-")[0] || "eng",
            display: voice.labels?.accent || "English",
          },
        ],
        provider: "elevenlabs",
      };

      return unifiedVoice;
    } catch (error) {
      console.error("Error getting voice:", error);
      throw error;
    }
  }

  /**
   * Convert MP3 audio data to WAV format using the audio converter utility
   * @param mp3Data MP3 audio data from ElevenLabs
   * @returns WAV audio data
   */
  private async convertMp3ToWav(mp3Data: Uint8Array): Promise<Uint8Array> {
    try {
      // Import the audio converter utility (Node-only) using a truly dynamic import
      const dyn: any = new Function("m", "return import(m)");
      const { convertAudioFormat } = await dyn("../utils/audio-converter");

      // Convert MP3 to WAV
      const result = await convertAudioFormat(mp3Data, "wav");
      return result.audioBytes;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn("Failed to convert MP3 to WAV, returning original MP3 data:", errorMessage);
      // Fallback: return the original MP3 data
      // The playback system should handle MP3 files even when WAV was requested
      return mp3Data;
    }
  }
}
