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
      // Try to list voices to check if the API key is valid
      await this._getVoices();
      return true;
    } catch (error) {
      console.error("Error checking ElevenLabs credentials:", error);
      return false;
    }
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

      // Prepare request options
      const requestOptions = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": this.apiKey,
        },
        body: JSON.stringify({
          text: preparedText,
          model_id: "eleven_monolingual_v1",
          output_format: options?.format === "mp3" ? "mp3_44100_128" : "pcm_44100",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            use_speaker_boost: true,
            style: 0,
            speed: typeof this.properties.rate === "number" ? this.properties.rate : 1.0,
          },
        }),
      };

      // Make API request
      const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, requestOptions);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `ElevenLabs API error: ${response.status} ${response.statusText}\nResponse: ${errorText}`
        );
        throw new Error(`Failed to synthesize speech: ${response.statusText}`);
      }

      // Get audio data as array buffer
      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      console.error("Error synthesizing speech:", error);
      throw error;
    }
  }

  /**
   * Synthesize text to a byte stream
   * @param text Text to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to an object containing the audio stream and an empty word boundaries array
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

      // Prepare request options
      const requestOptions = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": this.apiKey,
        },
        body: JSON.stringify({
          text: preparedText,
          model_id: "eleven_monolingual_v1",
          output_format: options?.format === "mp3" ? "mp3_44100_128" : "pcm_44100",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            use_speaker_boost: true,
            style: 0,
            speed: typeof this.properties.rate === "number" ? this.properties.rate : 1.0,
          },
        }),
      };

      // Make API request with streaming option
      const response = await fetch(
        `${this.baseUrl}/text-to-speech/${voiceId}/stream`,
        requestOptions
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `ElevenLabs API error: ${response.status} ${response.statusText}\nResponse: ${errorText}`
        );
        throw new Error(`Failed to synthesize speech stream: ${response.statusText}`);
      }

      // Convert the response body to a proper ReadableStream
      const responseArrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(responseArrayBuffer);

      // Create a ReadableStream from the Uint8Array
      const readableStream = new ReadableStream({
        start(controller) {
          controller.enqueue(uint8Array);
          controller.close();
        },
      });

      return { audioStream: readableStream, wordBoundaries: [] };
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

    // Start playback
    await this.speakStreamed(text, options);
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
}
