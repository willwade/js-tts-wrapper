import { AbstractTTSClient } from "../core/abstract-tts";
import * as SSMLUtils from "../core/ssml-utils";
import * as SpeechMarkdown from "../markdown/converter";
import type { SpeakOptions, TTSCredentials, UnifiedVoice } from "../types";

/**
 * WitAI TTS Client Credentials
 */
export interface WitAITTSCredentials extends TTSCredentials {
  token: string;
}

/**
 * WitAI TTS Client
 */
export class WitAITTSClient extends AbstractTTSClient {
  private token: string;
  private baseUrl = "https://api.wit.ai";
  private apiVersion = "20240601";
  private headers: Record<string, string>;
  protected sampleRate = 24000; // Default sample rate for WitAI

  /**
   * Create a new WitAI TTS client
   * @param credentials WitAI credentials object with token
   */
  constructor(credentials: WitAITTSCredentials) {
    super(credentials);

    if (!credentials.token) {
      throw new Error("An API token for Wit.ai must be provided");
    }

    this.token = credentials.token as string;
    this.headers = {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Get raw voices from WitAI
   * @returns Promise resolving to an array of unified voice objects
   */
  protected async _getVoices(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/voices?v=${this.apiVersion}`, {
        method: "GET",
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.statusText}`);
      }

      const voices = await response.json();
      console.log("WitAI Raw Voices Response:", JSON.stringify(voices, null, 2));

      const standardizedVoices = [];

      for (const localeKey in voices) {
        // Get the original locale (e.g., "en_US")
        const locale = localeKey.replace("_", "-");

        for (const voice of voices[localeKey]) {
          const standardizedVoice = {
            id: voice.name,
            languageCodes: [locale],
            name: voice.name.split("$")[1] || voice.name,
            gender: voice.gender,
            styles: voice.styles || [],
          };
          standardizedVoices.push(standardizedVoice);
          console.log("WitAI Standardized Voice:", standardizedVoice);
        }
      }

      return standardizedVoices;
    } catch (error) {
      console.error("Error fetching WitAI voices:", error);
      return [];
    }
  }

  /**
   * Map WitAI voice objects to unified format
   * @param rawVoices Array of WitAI voice objects
   * @returns Promise resolving to an array of unified voice objects
   */
  protected async _mapVoicesToUnified(rawVoices: any[]): Promise<UnifiedVoice[]> {
    // Transform WitAI voices to unified format
    return rawVoices.map((voice: any) => ({
      id: voice.id,
      name: voice.name,
      gender: voice.gender === "female" ? "Female" : voice.gender === "male" ? "Male" : "Unknown",
      provider: "witai",
      languageCodes: voice.languageCodes.map((locale: string) => {
        const [language, region] = locale.split("-");
        return {
          bcp47: locale,
          iso639_3: language, // Simple extraction of language code
          display: `${language.toUpperCase()} (${region || language})`,
        };
      }),
    }));
  }

  /**
   * Prepare text/SSML for synthesis
   * @param text Text or SSML to prepare
   * @param options Synthesis options
   * @returns Prepared text or SSML
   */
  private async prepareText(text: string, options?: SpeakOptions): Promise<string> {
    let processedText = text;

    // Check if the input is SpeechMarkdown and useSpeechMarkdown is enabled, convert it to SSML
    if (options?.useSpeechMarkdown && SpeechMarkdown.isSpeechMarkdown(processedText)) {
      // Convert SpeechMarkdown to SSML - WitAI supports SSML
      const ssml = await SpeechMarkdown.toSSML(processedText, "wit-ai");
      processedText = ssml;
    }

    // WitAI supports SSML, so we can pass SSML directly
    // If text is not SSML, wrap it in speak tags for consistency
    if (!SSMLUtils.isSSML(processedText)) {
      processedText = SSMLUtils.wrapWithSpeakTags(processedText);
    }

    return processedText;
  }

  /**
   * Get the appropriate Accept header based on the format option
   * @param format Format option from WitAITTSOptions
   * @returns MIME type string
   */
  private getAcceptHeader(format?: string): string {
    const formats: Record<string, string> = {
      pcm: "audio/raw",
      mp3: "audio/mpeg",
      wav: "audio/wav",
    };

    return formats[format || ""] || "audio/raw"; // Default to PCM if unspecified
  }

  /**
   * Synthesize text to audio bytes
   * @param text Text to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to audio bytes
   */
  async synthToBytes(text: string, options?: SpeakOptions): Promise<Uint8Array> {
    try {
      // Prepare text for synthesis (strip SSML/Markdown if present)
      const preparedText = await this.prepareText(text, options);

      // Use provided voice or the one set with setVoice
      let voice = options?.voice || this.voiceId;

      if (!voice) {
        // Use a default voice if none is set
        const voices = await this._getVoices();
        if (voices.length === 0) {
          throw new Error("No voice ID provided and no default voice available");
        }
        voice = voices[0].id;
        this.voiceId = voice;
        console.log(`Using default voice: ${voice}`);
      }

      // Get format from options if available
      const format = (options as WitAITTSOptions)?.format;

      // Set headers for audio format
      const headers = {
        ...this.headers,
        Accept: this.getAcceptHeader(format),
      };

      const data = {
        q: preparedText,
        voice: voice,
        style: "default", // Add a default style
      };

      console.log("WitAI TTS Request:", {
        url: `${this.baseUrl}/synthesize?v=${this.apiVersion}`,
        headers: headers,
        data: data,
      });

      const response = await fetch(`${this.baseUrl}/synthesize?v=${this.apiVersion}`, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        // Try to get more detailed error information
        let errorMessage = `Failed to synthesize speech: ${response.statusText}`;
        try {
          const errorData = await response.text();
          console.error("WitAI TTS Error Response:", errorData);
          errorMessage += ` - ${errorData}`;
        } catch (_e) {
          // Ignore error parsing error
        }
        throw new Error(errorMessage);
      }

      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      console.error("Error synthesizing speech with WitAI:", error);
      throw error;
    }
  }

  /**
   * Synthesize text to a byte stream with word boundary information
   * @param text Text to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to an object containing the audio stream and word boundary information
   */
  async synthToBytestream(
    text: string,
    options?: SpeakOptions
  ): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
  }> {
    try {
      // Prepare text for synthesis
      const preparedText = await this.prepareText(text, options);

      // Use provided voice or the one set with setVoice
      let voice = options?.voice || this.voiceId;

      if (!voice) {
        // Use a default voice if none is set
        const voices = await this._getVoices();
        if (voices.length === 0) {
          throw new Error("No voice ID provided and no default voice available");
        }
        voice = voices[0].id;
        this.voiceId = voice;
        console.log(`Using default voice for bytestream: ${voice}`);
      }

      // Get format from options if available
      const format = (options as WitAITTSOptions)?.format;

      // Set headers for audio format
      const headers = {
        ...this.headers,
        Accept: this.getAcceptHeader(format),
      };

      const data = {
        q: preparedText,
        voice: voice,
        style: "default", // Add a default style
      };

      console.log("WitAI TTS Bytestream Request:", {
        url: `${this.baseUrl}/synthesize?v=${this.apiVersion}`,
        headers: headers,
        data: data,
      });

      const response = await fetch(`${this.baseUrl}/synthesize?v=${this.apiVersion}`, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        // Try to get more detailed error information
        let errorMessage = `Failed to synthesize speech: ${response.statusText}`;
        try {
          const errorData = await response.text();
          console.error("WitAI TTS Bytestream Error Response:", errorData);
          errorMessage += ` - ${errorData}`;
        } catch (_e) {
          // Ignore error parsing error
        }
        throw new Error(errorMessage);
      }

      // Create estimated word boundaries based on text length
      const words = preparedText.split(/\s+/);
      const estimatedDuration = 0.3; // Estimated duration per word in seconds
      const wordBoundaries: Array<{ text: string; offset: number; duration: number }> = [];

      let currentTime = 0;
      for (const word of words) {
        if (word.trim()) {
          wordBoundaries.push({
            text: word,
            offset: currentTime * 1000, // Convert to milliseconds
            duration: estimatedDuration * 1000, // Convert to milliseconds
          });
          currentTime += estimatedDuration;
        }
      }

      return {
        audioStream: response.body as ReadableStream<Uint8Array>,
        wordBoundaries,
      };
    } catch (error) {
      console.error("Error synthesizing speech with WitAI:", error);
      throw error;
    }
  }

  /**
   * Set the voice to use for synthesis
   * @param voiceId Voice ID to use
   * @param lang Language code (not used in WitAI)
   */
  setVoice(voiceId: string, lang?: string): void {
    console.log(`Setting WitAI voice to: ${voiceId}`);
    this.voiceId = voiceId;
    if (lang) {
      this.lang = lang;
    }
  }
}

/**
 * Extended options for WitAI TTS
 */
export interface WitAITTSOptions extends SpeakOptions {
  format?: "mp3" | "wav" | "pcm";
}
