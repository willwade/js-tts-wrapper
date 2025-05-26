import { AbstractTTSClient } from "../core/abstract-tts";
import * as SSMLUtils from "../core/ssml-utils";
import * as SpeechMarkdown from "../markdown/converter";
import type { SpeakOptions, TTSCredentials, UnifiedVoice } from "../types";

/**
 * IBM Watson TTS Client Credentials
 */
export interface WatsonTTSCredentials extends TTSCredentials {
  apiKey: string;
  region: string;
  instanceId: string;
  disableSSLVerification?: boolean;
}

/**
 * IBM Watson TTS Client
 */
export class WatsonTTSClient extends AbstractTTSClient {
  private apiKey: string;
  private region: string;
  private instanceId: string;
  // Word boundaries from the last synthesis
  protected wordBoundaries: Array<{ text: string; offset: number; duration: number }> = [];
  private iamToken: string | null = null;
  private wsUrl: string | null = null;

  /**
   * Create a new IBM Watson TTS client
   * @param credentials Watson credentials object with apiKey, region, and instanceId
   */
  constructor(credentials: WatsonTTSCredentials) {
    super(credentials);
    this.apiKey = credentials.apiKey as string;
    this.region = credentials.region as string;
    this.instanceId = credentials.instanceId as string;
    // SSL verification can be disabled but we don't use it directly in the browser
    this.sampleRate = 22050; // Default sample rate for Watson TTS
  }

  /**
   * Get raw voices from Watson
   * @returns Promise resolving to an array of unified voice objects
   */
  protected async _getVoices(): Promise<any[]> {
    try {
      // Ensure we have a valid IAM token
      await this._refreshIAMToken();

      const response = await fetch(
        `https://api.${this.region}.text-to-speech.watson.cloud.ibm.com/v1/voices`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.iamToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.statusText}`);
      }

      const data = await response.json();
      return data.voices || [];
    } catch (error) {
      console.error("Error fetching Watson voices:", error);
      return [];
    }
  }

  /**
   * Map Watson voice objects to unified format
   * @param rawVoices Array of Watson voice objects
   * @returns Promise resolving to an array of unified voice objects
   */
  protected async _mapVoicesToUnified(rawVoices: any[]): Promise<UnifiedVoice[]> {
    // Transform Watson voices to unified format
    return rawVoices.map((voice: any) => ({
      id: voice.name,
      name: voice.name.split("_")[1].replace("V3Voice", ""),
      gender: voice.gender === "female" ? "Female" : voice.gender === "male" ? "Male" : "Unknown",
      provider: "ibm",
      languageCodes: [
        {
          bcp47: voice.language,
          iso639_3: voice.language.split("-")[0], // Simple extraction of language code
          display: voice.description || voice.language,
        },
      ],
    }));
  }

  /**
   * Refresh the IAM token for Watson API
   * @returns Promise resolving when token is refreshed
   */
  private async _refreshIAMToken(): Promise<void> {
    try {
      const response = await fetch("https://iam.cloud.ibm.com/identity/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          apikey: this.apiKey,
          grant_type: "urn:ibm:params:oauth:grant-type:apikey",
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to refresh IAM token: ${response.statusText}`);
      }

      const data = await response.json();
      this.iamToken = data.access_token;

      // Construct the WebSocket URL for streaming
      this.wsUrl = `wss://api.${this.region}.text-to-speech.watson.cloud.ibm.com/instances/${this.instanceId}/v1/synthesize`;
    } catch (error) {
      console.error("Error refreshing IAM token:", error);
      throw error;
    }
  }

  /**
   * Prepare SSML for synthesis
   * @param text Text or SSML to prepare
   * @param options Synthesis options
   * @returns SSML string ready for synthesis
   */
  private prepareSSML(text: string, options?: SpeakOptions): string {
    // Use the provided voice or the one set with setVoice
    const voice = options?.voice || this.voiceId;

    // Check if the input is already SSML
    const isSSML = SSMLUtils.isSSML(text);

    let processedText = text;

    // If the input is SpeechMarkdown and useSpeechMarkdown is enabled, convert it to SSML
    if (options?.useSpeechMarkdown && SpeechMarkdown.isSpeechMarkdown(processedText)) {
      processedText = SpeechMarkdown.toSSML(processedText);
    }

    // If the input is already SSML, use it directly
    if (isSSML) {
      return processedText;
    }

    // Otherwise, create SSML from plain text
    this.ssml.clearSSML();

    // Create SSML with voice and prosody
    let ssmlContent = processedText;

    // Apply prosody settings if specified
    if (options?.rate || options?.pitch || options?.volume) {
      const prosodyAttrs = [];
      if (options.rate) prosodyAttrs.push(`rate="${options.rate}"`);
      if (options.pitch) prosodyAttrs.push(`pitch="${options.pitch}"`);
      if (options.volume !== undefined) prosodyAttrs.push(`volume="${options.volume}%"`);

      ssmlContent = `<prosody ${prosodyAttrs.join(" ")}>${ssmlContent}</prosody>`;
    }

    // Add voice tag
    ssmlContent = `<voice name="${voice || "en-US_AllisonV3Voice"}">${ssmlContent}</voice>`;

    // Wrap with speak tags
    return this.ssml.wrapWithSpeak(ssmlContent);
  }

  // Using the checkCredentials method from AbstractTTSClient

  /**
   * Synthesize text to audio bytes
   * @param text Text or SSML to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to audio bytes
   */
  async synthToBytes(text: string, options?: SpeakOptions): Promise<Uint8Array> {
    try {
      // Ensure we have a valid IAM token
      await this._refreshIAMToken();

      // Prepare SSML for synthesis
      const ssml = this.prepareSSML(text, options);

      // Use provided voice_id or the one set with setVoice
      const voice = options?.voice || this.voiceId || "en-US_AllisonV3Voice";

      const response = await fetch(
        `https://api.${this.region}.text-to-speech.watson.cloud.ibm.com/v1/synthesize`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.iamToken}`,
            "Content-Type": "application/json",
            Accept: "audio/wav",
          },
          body: JSON.stringify({
            text: ssml,
            voice: voice,
            accept: "audio/wav",
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to synthesize speech: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      console.error("Error synthesizing speech:", error);
      throw error;
    }
  }

  /**
   * Synthesize text to a byte stream with word boundary information
   * @param text Text or SSML to synthesize
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
    // Ensure we have a valid IAM token
    await this._refreshIAMToken();

    // Prepare SSML for synthesis
    const ssml = this.prepareSSML(text, options);

    // Use provided voice_id or the one set with setVoice
    const voice = options?.voice || this.voiceId || "en-US_AllisonV3Voice";

    // Reset word boundaries
    this.wordBoundaries = [];

    // Check if we're in a browser environment
    if (typeof window !== "undefined" && "WebSocket" in window) {
      return this._synthToBytestreamWithBrowserWebSocket(ssml, voice);
    }
    // In Node.js environment, use the REST API
    return this._synthToBytestreamWithREST(ssml, options);
  }

  /**
   * Synthesize text to a byte stream using the WebSocket API in browser
   * @param ssml SSML to synthesize
   * @param voice Voice to use
   * @returns Promise resolving to an object containing the audio stream and word boundary information
   */
  private async _synthToBytestreamWithBrowserWebSocket(
    ssml: string,
    voice: string
  ): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
  }> {
    return new Promise((resolve, reject) => {
      if (!this.wsUrl || !this.iamToken) {
        reject(new Error("WebSocket URL or IAM token not available"));
        return;
      }

      const ws = new WebSocket(`${this.wsUrl}?access_token=${this.iamToken}&voice=${voice}`);
      const chunks: Uint8Array[] = [];
      const wordTimings: Array<{ text: string; offset: number; duration: number }> = [];

      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        const message = {
          text: ssml,
          accept: "audio/wav",
          voice: voice,
          timings: ["words"],
        };
        ws.send(JSON.stringify(message));
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          // Audio data
          chunks.push(new Uint8Array(event.data));
        } else {
          // Word timing data
          try {
            const data = JSON.parse(event.data);
            if (data.words) {
              for (const timing of data.words as [string, number, number][]) {
                wordTimings.push({
                  text: timing[0],
                  offset: timing[1] * 1000, // Convert to milliseconds
                  duration: (timing[2] - timing[1]) * 1000, // Convert to milliseconds
                });
              }
              this.wordBoundaries = wordTimings;
            }
          } catch (e) {
            console.error("Error parsing WebSocket message:", e);
          }
        }
      };

      ws.onerror = (error) => {
        reject(error);
      };

      ws.onclose = () => {
        // Store word boundaries for later use
        this.wordBoundaries = wordTimings;

        // Create a ReadableStream from the collected chunks
        const audioStream = new ReadableStream<Uint8Array>({
          start(controller) {
            for (const chunk of chunks) {
              controller.enqueue(chunk);
            }
            controller.close();
          },
        });

        resolve({
          audioStream,
          wordBoundaries: wordTimings,
        });
      };
    });
  }

  /**
   * Synthesize text to a byte stream using the REST API
   * @param ssml SSML to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to an object containing the audio stream and word boundary information
   */
  private async _synthToBytestreamWithREST(
    ssml: string,
    options?: SpeakOptions
  ): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
  }> {
    try {
      // Use provided voice_id or the one set with setVoice
      const voice = options?.voice || this.voiceId || "en-US_AllisonV3Voice";

      const response = await fetch(
        `https://api.${this.region}.text-to-speech.watson.cloud.ibm.com/v1/synthesize`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.iamToken}`,
            "Content-Type": "application/json",
            Accept: "audio/wav",
          },
          body: JSON.stringify({
            text: ssml,
            voice: voice,
            accept: "audio/wav",
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to synthesize speech: ${response.statusText}`);
      }

      // Create estimated word timings based on text length
      const words = ssml.replace(/<[^>]*>/g, "").split(/\s+/);
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

      // Store word boundaries for later use
      this.wordBoundaries = wordBoundaries;

      return {
        audioStream: response.body as ReadableStream<Uint8Array>,
        wordBoundaries,
      };
    } catch (error) {
      console.error("Error synthesizing speech:", error);
      throw error;
    }
  }

  /**
   * Set the voice to use for synthesis
   * @param voiceId Voice ID to use
   * @param lang Language code (not used in Watson)
   */
  setVoice(voiceId: string, lang?: string): void {
    this.voiceId = voiceId;
    if (lang) {
      this.lang = lang;
    }
  }
}

/**
 * Extended options for Watson TTS
 */
export interface WatsonTTSOptions extends SpeakOptions {
  format?: "mp3" | "wav";
}
