import { AbstractTTSClient } from "../core/abstract-tts";
import { LanguageNormalizer } from "../core/language-utils";
import type { SpeakOptions, TTSCredentials, UnifiedVoice, WordBoundaryCallback } from "../types";

// Use global fetch if available, otherwise try to import node-fetch
const fetchApi = typeof fetch !== 'undefined' ? fetch : require('node-fetch');

/**
 * ElevenLabs TTS credentials
 */
export interface ElevenLabsCredentials extends TTSCredentials {
  /**
   * ElevenLabs API key
   */
  apiKey: string;
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
  constructor(credentials: ElevenLabsCredentials) {
    super(credentials);
    this.apiKey = credentials.apiKey;
  }

  /**
   * Get available voices from the provider
   * @returns Promise resolving to an array of voice objects
   */
  protected async _getVoices(): Promise<any[]> {
    const response = await fetchApi(`${this.baseUrl}/voices`, {
      method: "GET",
      headers: {
        "xi-api-key": this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get voices: ${response.statusText}`);
    }

    const data = await response.json();
    return data.voices;
  }

  /**
   * Convert text to audio bytes
   * @param text Text to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to audio bytes
   */
  async synthToBytes(
    text: string,
    options?: SpeakOptions
  ): Promise<Uint8Array> {
    try {
      // Use voice from options or the default voice
      const voiceId = options?.voice || this.voiceId || "21m00Tcm4TlvDq8ikWAM"; // Default voice (Rachel)

      // Prepare request options
      const requestOptions = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": this.apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_monolingual_v1",
          output_format: options?.format === "mp3" ? "mp3_44100_128" : "pcm_44100",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            use_speaker_boost: true,
            style: 0,
            speed: this.properties.rate || 1.0,
          },
        }),
      };

      // Make API request
      const response = await fetchApi(
        `${this.baseUrl}/text-to-speech/${voiceId}`,
        requestOptions
      );

      if (!response.ok) {
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
   * @returns Promise resolving to a readable stream of audio bytes
   */
  async synthToBytestream(
    text: string,
    options?: SpeakOptions
  ): Promise<ReadableStream<Uint8Array>> {
    try {
      // Use voice from options or the default voice
      const voiceId = options?.voice || this.voiceId || "21m00Tcm4TlvDq8ikWAM"; // Default voice (Rachel)

      // Prepare request options
      const requestOptions = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": this.apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_monolingual_v1",
          output_format: options?.format === "mp3" ? "mp3_44100_128" : "pcm_44100",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            use_speaker_boost: true,
            style: 0,
            speed: this.properties.rate || 1.0,
          },
        }),
      };

      // Make API request with streaming option
      const response = await fetchApi(
        `${this.baseUrl}/text-to-speech/${voiceId}/stream`,
        requestOptions
      );

      if (!response.ok) {
        throw new Error(`Failed to synthesize speech: ${response.statusText}`);
      }

      // Return the response body as a stream
      return response.body as ReadableStream<Uint8Array>;
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
    // Convert ElevenLabs voices to unified format
    return rawVoices.map((voice) => ({
      id: voice.voice_id,
      name: voice.name,
      gender: voice.labels?.gender === "female" ? "Female" :
              voice.labels?.gender === "male" ? "Male" : "Unknown",
      languageCodes: [
        {
          bcp47: voice.labels?.language || "en-US",
          iso639_3: voice.labels?.language?.split("-")[0] || "eng",
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
      const response = await fetchApi(`${this.baseUrl}/voices/${voiceId}`, {
        method: "GET",
        headers: {
          "xi-api-key": this.apiKey,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to get voice: ${response.statusText}`);
      }

      const voice = await response.json();

      // Map to unified format using the same logic as _mapVoicesToUnified
      const unifiedVoice: UnifiedVoice = {
        id: voice.voice_id,
        name: voice.name,
        gender: voice.labels?.gender === "female" ? "Female" :
                voice.labels?.gender === "male" ? "Male" : "Unknown",
        languageCodes: [
          {
            bcp47: voice.labels?.language || "en-US",
            iso639_3: voice.labels?.language?.split("-")[0] || "eng",
            display: voice.labels?.accent || "English",
          },
        ],
        provider: "elevenlabs",
      };

      // Apply language normalization
      const normalizedLanguageCodes = unifiedVoice.languageCodes.map(lang => {
        const normalized = LanguageNormalizer.normalize(lang.bcp47);
        return {
          bcp47: normalized.bcp47,
          iso639_3: normalized.iso639_3,
          display: normalized.display
        };
      });

      return {
        ...unifiedVoice,
        languageCodes: normalizedLanguageCodes
      };
    } catch (error) {
      console.error("Error getting voice:", error);
      throw error;
    }
  }
}
