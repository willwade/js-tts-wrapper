import { AbstractTTSClient } from "../core/abstract-tts";
import * as SpeechMarkdown from "../markdown/converter";
import * as SSMLUtils from "../core/ssml-utils";
import type { SpeakOptions, TTSCredentials, UnifiedVoice } from "../types";
import { getFetch } from "../utils/fetch-utils";

/**
 * UpliftAI TTS Client Credentials
 */
export interface UpliftAITTSCredentials extends TTSCredentials {
  /** UpliftAI API key */
  apiKey?: string;
}

/**
 * Extended options for UpliftAI TTS
 */
export interface UpliftAITTSOptions extends SpeakOptions {
  /** Output format supported by UpliftAI */
  outputFormat?: string;
  /** Callback for end of speech */
  onEnd?: () => void;
}

// Static voice list as provider doesn't expose voice query API
const UPLIFTAI_VOICES: UnifiedVoice[] = [
  {
    id: "v_8eelc901",
    name: "Info/Education",
    gender: "Unknown",
    provider: "upliftai",
    languageCodes: [
      {
        bcp47: "ur-PK",
        iso639_3: "urd",
        display: "Urdu (Pakistan)",
      },
    ],
  },
  {
    id: "v_30s70t3a",
    name: "Nostalgic News",
    gender: "Unknown",
    provider: "upliftai",
    languageCodes: [
      {
        bcp47: "ur-PK",
        iso639_3: "urd",
        display: "Urdu (Pakistan)",
      },
    ],
  },
  {
    id: "v_yypgzenx",
    name: "Dada Jee",
    gender: "Unknown",
    provider: "upliftai",
    languageCodes: [
      {
        bcp47: "ur-PK",
        iso639_3: "urd",
        display: "Urdu (Pakistan)",
      },
    ],
  },
  {
    id: "v_kwmp7zxt",
    name: "Gen Z (beta)",
    gender: "Unknown",
    provider: "upliftai",
    languageCodes: [
      {
        bcp47: "ur-PK",
        iso639_3: "urd",
        display: "Urdu (Pakistan)",
      },
    ],
  },
];

/**
 * UpliftAI TTS Client
 */
export class UpliftAITTSClient extends AbstractTTSClient {
  private apiKey: string;
  private baseUrl = "https://api.upliftai.org/v1/synthesis";
  private outputFormat: string;
  protected sampleRate = 22050;

  /**
   * Create a new UpliftAI TTS client
   * @param credentials Credentials including API key
   */
  constructor(credentials: UpliftAITTSCredentials = {}) {
    super(credentials);
    this.apiKey = credentials.apiKey || process.env.UPLIFTAI_API_KEY || "";
    this.outputFormat = "MP3_22050_128"; // Default format
  }

  /**
   * Check if credentials are valid
   */
  async checkCredentials(): Promise<boolean> {
    if (!this.apiKey) {
      console.error("UpliftAI API key is required");
      return false;
    }
    return true;
  }

  /**
   * Get required credential field names
   */
  protected getRequiredCredentials(): string[] {
    return ["apiKey"];
  }

  /**
   * Get available voices (static list)
   */
  protected async _getVoices(): Promise<UnifiedVoice[]> {
    return UPLIFTAI_VOICES;
  }

  /**
   * Synthesize text to audio bytes
   */
  async synthToBytes(text: string, options: UpliftAITTSOptions = {}): Promise<Uint8Array> {
    const { audioStream } = await this.synthToBytestream(text, options);
    const reader = audioStream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const totalLength = chunks.reduce((acc, cur) => acc + cur.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }

  /**
   * Synthesize text to a byte stream
   */
  async synthToBytestream(
    text: string,
    options: UpliftAITTSOptions = {}
  ): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
  }> {
    let processedText = text;

    if (options.useSpeechMarkdown && SpeechMarkdown.isSpeechMarkdown(processedText)) {
      const ssml = await SpeechMarkdown.toSSML(processedText);
      processedText = SSMLUtils.stripSSML(ssml);
    }

    if (SSMLUtils.isSSML(processedText)) {
      processedText = SSMLUtils.stripSSML(processedText);
    }

    const voiceId = options.voice || this.voiceId || UPLIFTAI_VOICES[0].id;
    this.voiceId = voiceId;

    const response = await getFetch()(`${this.baseUrl}/text-to-speech/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        voiceId,
        text: processedText,
        outputFormat: options.outputFormat || this.outputFormat,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Failed to synthesize speech: ${response.status} ${response.statusText}`);
    }

    options.onEnd?.();

    return { audioStream: response.body, wordBoundaries: [] };
  }
}

export default UpliftAITTSClient;
