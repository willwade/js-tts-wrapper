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
}

/**
 * ElevenLabs TTS credentials
 */
export interface ElevenLabsCredentials extends TTSCredentials {
  /**
   * ElevenLabs API key
   */
  apiKey?: string;
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
   * Create a new ElevenLabs TTS client
   * @param credentials ElevenLabs credentials
   */
  constructor(credentials: ElevenLabsCredentials = {}) {
    super(credentials);
    this.apiKey = credentials.apiKey || process.env.ELEVENLABS_API_KEY || "";
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
      const requestOptions = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": this.apiKey,
        },
        body: JSON.stringify({
          text: "hello",
          model_id: "eleven_monolingual_v1",
          output_format: "mp3_44100_64", // keep tiny
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            use_speaker_boost: true,
            style: 0,
            speed: 1.0,
          },
        }),
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
        console.error(`ElevenLabs quota probe failed: ${response.status} ${response.statusText} - ${errorText}`);
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
    return ['apiKey'];
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
      const ssml = await SpeechMarkdown.toSSML(processedText);
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
        const timestampResponse = await this.synthWithTimestamps(preparedText, voiceId);

        // Decode base64 audio data
        const audioBase64 = timestampResponse.audio_base64;
        const audioBuffer = Buffer.from(audioBase64, 'base64');
        audioData = new Uint8Array(audioBuffer);

        // Convert character timing to word boundaries and store for events
        if (timestampResponse.alignment) {
          const wordBoundaries = this.convertCharacterTimingToWordBoundaries(
            preparedText,
            timestampResponse.alignment
          );

          // Store timing data for word boundary events
          this.timings = wordBoundaries.map(wb => [
            wb.offset / 10000, // Convert from 100-nanosecond units to seconds
            (wb.offset + wb.duration) / 10000,
            wb.text
          ]);
        }
      } else {
        // Use the regular endpoint (no timing data)
        const requestOptions = {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": this.apiKey,
          },
          body: JSON.stringify({
            text: preparedText,
            model_id: "eleven_monolingual_v1",
            output_format: "mp3_44100_128",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              use_speaker_boost: true,
              style: 0,
              speed: typeof this.properties.rate === "number" ? this.properties.rate : 1.0,
            },
          }),
        };

        const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, requestOptions);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `ElevenLabs API error: ${response.status} ${response.statusText}\nResponse: ${errorText}`
          );
          const err = new Error(`Failed to synthesize speech: ${response.status} ${response.statusText} - ${errorText}`);
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
        const timestampResponse = await this.synthWithTimestamps(preparedText, voiceId);

        // Decode base64 audio data
        const audioBase64 = timestampResponse.audio_base64;
        const audioBuffer = Buffer.from(audioBase64, 'base64');
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
        const requestOptions = {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": this.apiKey,
          },
          body: JSON.stringify({
            text: preparedText,
            model_id: "eleven_monolingual_v1",
            output_format: "mp3_44100_128",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              use_speaker_boost: true,
              style: 0,
              speed: typeof this.properties.rate === "number" ? this.properties.rate : 1.0,
            },
          }),
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
          const err = new Error(`Failed to synthesize speech stream: ${response.status} ${response.statusText} - ${errorText}`);
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
   * @returns Promise resolving to timestamp response
   */
  private async synthWithTimestamps(
    text: string,
    voiceId: string
  ): Promise<ElevenLabsTimestampResponse> {
    const requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": this.apiKey,
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_monolingual_v1",
        output_format: "mp3_44100_128",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          use_speaker_boost: true,
          style: 0,
          speed: typeof this.properties.rate === "number" ? this.properties.rate : 1.0,
        },
      }),
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
      const err = new Error(`Failed to synthesize speech with timestamps: ${response.status} ${response.statusText} - ${errorText}`);
      (err as any).status = response.status;
      throw err;
    }

    return await response.json() as ElevenLabsTimestampResponse;
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
    let match;

    while ((match = wordRegex.exec(text)) !== null) {
      words.push({
        word: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length - 1
      });
    }

    // Convert each word to boundary data using character timing
    for (const wordInfo of words) {
      // Find the character timing for the start and end of this word
      const startCharIndex = wordInfo.startIndex;
      const endCharIndex = wordInfo.endIndex;

      // Make sure we have timing data for these character positions
      if (startCharIndex < alignment.character_start_times_seconds.length &&
          endCharIndex < alignment.character_end_times_seconds.length) {

        const startTime = alignment.character_start_times_seconds[startCharIndex];
        const endTime = alignment.character_end_times_seconds[endCharIndex];

        wordBoundaries.push({
          text: wordInfo.word,
          offset: Math.round(startTime * 10000), // Convert to 100-nanosecond units
          duration: Math.round((endTime - startTime) * 10000)
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
    options?: SpeakOptions
  ): Promise<void> {
    // Register the callback
    this.on("boundary", callback);

    // Enable timestamps for better word boundary accuracy
    const enhancedOptions = {
      ...options,
      useTimestamps: true
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
      const dyn: any = new Function('m','return import(m)');
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
