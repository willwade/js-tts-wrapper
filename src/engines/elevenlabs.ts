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
      const voices = await this._getVoices();
      // Check if we actually got voices back (empty array means failed request)
      return voices.length > 0;
    } catch (error) {
      console.error("Error checking ElevenLabs credentials:", error);
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
      let audioData = new Uint8Array(arrayBuffer);

      // If we requested WAV format but got PCM data, add a WAV header
      if (options?.format === "wav") {
        audioData = this.addWavHeader(audioData, 44100);
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
      let uint8Array = new Uint8Array(responseArrayBuffer);

      // If we requested WAV format but got PCM data, add a WAV header
      if (options?.format === "wav") {
        uint8Array = this.addWavHeader(uint8Array, 44100);
      }

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

  /**
   * Add a WAV header to PCM audio data
   * @param pcmData PCM audio data from ElevenLabs (signed 16-bit, 1 channel, little-endian)
   * @param sampleRate Sample rate in Hz (default: 44100)
   * @returns PCM audio data with WAV header
   */
  private addWavHeader(pcmData: Uint8Array, sampleRate: number = 44100): Uint8Array {
    // WAV header is 44 bytes
    const headerSize = 44;
    const wavData = new Uint8Array(headerSize + pcmData.length);

    // RIFF header
    wavData[0] = 0x52; // 'R'
    wavData[1] = 0x49; // 'I'
    wavData[2] = 0x46; // 'F'
    wavData[3] = 0x46; // 'F'

    // File size (total file size - 8 bytes)
    const fileSize = headerSize + pcmData.length - 8;
    wavData[4] = fileSize & 0xff;
    wavData[5] = (fileSize >> 8) & 0xff;
    wavData[6] = (fileSize >> 16) & 0xff;
    wavData[7] = (fileSize >> 24) & 0xff;

    // WAVE header
    wavData[8] = 0x57; // 'W'
    wavData[9] = 0x41; // 'A'
    wavData[10] = 0x56; // 'V'
    wavData[11] = 0x45; // 'E'

    // fmt chunk
    wavData[12] = 0x66; // 'f'
    wavData[13] = 0x6d; // 'm'
    wavData[14] = 0x74; // 't'
    wavData[15] = 0x20; // ' '

    // fmt chunk size (16 bytes)
    wavData[16] = 16;
    wavData[17] = 0;
    wavData[18] = 0;
    wavData[19] = 0;

    // Audio format (1 = PCM)
    wavData[20] = 1;
    wavData[21] = 0;

    // Number of channels (1 = mono)
    wavData[22] = 1;
    wavData[23] = 0;

    // Sample rate
    wavData[24] = sampleRate & 0xff;
    wavData[25] = (sampleRate >> 8) & 0xff;
    wavData[26] = (sampleRate >> 16) & 0xff;
    wavData[27] = (sampleRate >> 24) & 0xff;

    // Byte rate (sample rate * channels * bits per sample / 8)
    const byteRate = sampleRate * 1 * 16 / 8;
    wavData[28] = byteRate & 0xff;
    wavData[29] = (byteRate >> 8) & 0xff;
    wavData[30] = (byteRate >> 16) & 0xff;
    wavData[31] = (byteRate >> 24) & 0xff;

    // Block align (channels * bits per sample / 8)
    const blockAlign = 1 * 16 / 8;
    wavData[32] = blockAlign & 0xff;
    wavData[33] = (blockAlign >> 8) & 0xff;

    // Bits per sample
    wavData[34] = 16;
    wavData[35] = 0;

    // data chunk
    wavData[36] = 0x64; // 'd'
    wavData[37] = 0x61; // 'a'
    wavData[38] = 0x74; // 't'
    wavData[39] = 0x61; // 'a'

    // Data chunk size
    wavData[40] = pcmData.length & 0xff;
    wavData[41] = (pcmData.length >> 8) & 0xff;
    wavData[42] = (pcmData.length >> 16) & 0xff;
    wavData[43] = (pcmData.length >> 24) & 0xff;

    // Copy PCM data
    wavData.set(pcmData, headerSize);

    return wavData;
  }
}
