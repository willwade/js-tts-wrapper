import { AbstractTTSClient } from "../core/abstract-tts";
import * as SSMLUtils from "../core/ssml-utils";
import * as SpeechMarkdown from "../markdown/converter";
import type { SpeakOptions, TTSCredentials, UnifiedVoice } from "../types";
import { getFetch } from "../utils/fetch-utils";

/**
 * ModelsLab TTS Client Credentials
 */
export interface ModelsLabTTSCredentials extends TTSCredentials {
  /** ModelsLab API key (also reads MODELSLAB_API_KEY env var) */
  apiKey?: string;
}

/**
 * Extended speak options for ModelsLab TTS
 */
export interface ModelsLabTTSOptions extends SpeakOptions {
  /** Language descriptor e.g. "american english", "british english" */
  language?: string;
  /** Speed multiplier (default 1.0) */
  speed?: number;
  /** Enable emotion tags in the prompt (English only) */
  emotion?: boolean;
}

/** Static list of available voices */
const MODELSLAB_VOICES: UnifiedVoice[] = [
  // Emotion-capable female voices
  { id: "madison",  name: "Madison",  gender: "Female", provider: "modelslab", languageCodes: [{ bcp47: "en-US", iso639_3: "eng", display: "English (US)" }] },
  { id: "tara",     name: "Tara",     gender: "Female", provider: "modelslab", languageCodes: [{ bcp47: "en-US", iso639_3: "eng", display: "English (US)" }] },
  { id: "leah",     name: "Leah",     gender: "Female", provider: "modelslab", languageCodes: [{ bcp47: "en-US", iso639_3: "eng", display: "English (US)" }] },
  { id: "jess",     name: "Jess",     gender: "Female", provider: "modelslab", languageCodes: [{ bcp47: "en-US", iso639_3: "eng", display: "English (US)" }] },
  { id: "mia",      name: "Mia",      gender: "Female", provider: "modelslab", languageCodes: [{ bcp47: "en-US", iso639_3: "eng", display: "English (US)" }] },
  { id: "zoe",      name: "Zoe",      gender: "Female", provider: "modelslab", languageCodes: [{ bcp47: "en-US", iso639_3: "eng", display: "English (US)" }] },
  // Emotion-capable male voices
  { id: "leo",      name: "Leo",      gender: "Male",   provider: "modelslab", languageCodes: [{ bcp47: "en-US", iso639_3: "eng", display: "English (US)" }] },
  { id: "dan",      name: "Dan",      gender: "Male",   provider: "modelslab", languageCodes: [{ bcp47: "en-US", iso639_3: "eng", display: "English (US)" }] },
  { id: "zac",      name: "Zac",      gender: "Male",   provider: "modelslab", languageCodes: [{ bcp47: "en-US", iso639_3: "eng", display: "English (US)" }] },
];

const API_URL = "https://modelslab.com/api/v6/voice/text_to_speech";
const DEFAULT_VOICE = "madison";
const DEFAULT_LANGUAGE = "american english";
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 20;

/**
 * ModelsLab TTS Client
 *
 * Provides text-to-speech via the ModelsLab Voice API.
 * API docs: https://docs.modelslab.com/voice-cloning/text-to-speech
 *
 * @example
 * ```ts
 * const client = new ModelsLabTTSClient({ apiKey: "your-api-key" });
 * await client.synthToFile("Hello world!", "output.mp3");
 * ```
 */
export class ModelsLabTTSClient extends AbstractTTSClient {
  private apiKey: string;
  private defaultLanguage: string;
  private defaultSpeed: number;
  protected sampleRate = 24000;

  constructor(credentials: ModelsLabTTSCredentials = {}) {
    super(credentials);
    this.apiKey =
      credentials.apiKey ||
      (typeof process !== "undefined" ? process.env.MODELSLAB_API_KEY ?? "" : "");
    this.defaultLanguage = DEFAULT_LANGUAGE;
    this.defaultSpeed = 1.0;
    if (!this.voiceId) {
      this.voiceId = DEFAULT_VOICE;
    }
  }

  /** Check if credentials are present */
  async checkCredentials(): Promise<boolean> {
    if (!this.apiKey) {
      console.error("ModelsLab API key is required. Set MODELSLAB_API_KEY or pass apiKey.");
      return false;
    }
    return true;
  }

  protected getRequiredCredentials(): string[] {
    return ["apiKey"];
  }

  protected async _getVoices(): Promise<UnifiedVoice[]> {
    return MODELSLAB_VOICES;
  }

  /**
   * Synthesize text to audio bytes (Uint8Array).
   * Handles async generation — polls until audio is ready.
   */
  async synthToBytes(text: string, options: ModelsLabTTSOptions = {}): Promise<Uint8Array> {
    const { audioStream } = await this.synthToBytestream(text, options);
    const reader = audioStream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const totalLen = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }

  /**
   * Synthesize text to a ReadableStream of audio chunks.
   */
  async synthToBytestream(
    text: string,
    options: ModelsLabTTSOptions = {}
  ): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
  }> {
    let processedText = text;

    // Convert SpeechMarkdown → SSML → plain text if needed
    if (options.useSpeechMarkdown && SpeechMarkdown.isSpeechMarkdown(processedText)) {
      const ssml = await SpeechMarkdown.toSSML(processedText);
      processedText = SSMLUtils.stripSSML(ssml);
    } else if (SSMLUtils.isSSML(processedText)) {
      // ModelsLab doesn't support SSML — strip tags
      processedText = SSMLUtils.stripSSML(processedText);
    }

    const voiceId = options.voice || this.voiceId || DEFAULT_VOICE;
    this.voiceId = voiceId;

    const speed = options.speed ?? this.defaultSpeed;
    const language = options.language ?? this.defaultLanguage;

    const audioBytes = await this._synthesize(processedText, voiceId, language, speed, options.emotion ?? false);

    const audioStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(audioBytes);
        controller.close();
      },
    });

    return { audioStream, wordBoundaries: [] };
  }

  /** Internal: call ModelsLab API and return audio bytes. */
  private async _synthesize(
    text: string,
    voiceId: string,
    language: string,
    speed: number,
    emotion: boolean
  ): Promise<Uint8Array> {
    const fetch = getFetch();

    const resp = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: this.apiKey,
        prompt: text,
        language,
        voice_id: voiceId,
        speed,
        emotion,
      }),
    });

    if (!resp.ok) {
      throw new Error(`ModelsLab API error: ${resp.status} ${resp.statusText}`);
    }

    const data = (await resp.json()) as {
      status: string;
      output?: string[];
      fetch_result?: string;
      link?: string;
      message?: string;
    };

    if (data.status === "error") {
      throw new Error(`ModelsLab TTS error: ${data.message ?? JSON.stringify(data)}`);
    }

    let audioUrl: string | undefined;

    if (data.status === "success" && data.output?.length) {
      audioUrl = data.output[0];
    } else if (data.status === "processing") {
      const fetchUrl = data.fetch_result ?? data.link;
      if (!fetchUrl) {
        throw new Error("ModelsLab returned processing status with no fetch URL");
      }
      audioUrl = await this._poll(fetchUrl, fetch);
    } else {
      throw new Error(`Unexpected ModelsLab status: ${data.status}`);
    }

    if (!audioUrl) {
      throw new Error("ModelsLab returned no audio URL");
    }

    return this._downloadAudio(audioUrl, fetch);
  }

  /** Poll the fetch_result URL until audio is ready. */
  private async _poll(
    fetchUrl: string,
    fetch: ReturnType<typeof getFetch>
  ): Promise<string> {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await this._sleep(POLL_INTERVAL_MS);

      const resp = await fetch(fetchUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: this.apiKey }),
      });

      if (!resp.ok) continue;

      const data = (await resp.json()) as {
        status: string;
        output?: string[];
        message?: string;
      };

      if (data.status === "success" && data.output?.length) {
        return data.output[0];
      }
      if (data.status === "error") {
        throw new Error(`ModelsLab poll error: ${data.message}`);
      }
    }
    throw new Error(`ModelsLab audio generation timed out after ${MAX_POLL_ATTEMPTS} attempts`);
  }

  /** Download audio from URL and return as Uint8Array. */
  private async _downloadAudio(
    url: string,
    fetch: ReturnType<typeof getFetch>
  ): Promise<Uint8Array> {
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Failed to download audio: ${resp.status} ${resp.statusText}`);
    }
    const buf = await resp.arrayBuffer();
    return new Uint8Array(buf);
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default ModelsLabTTSClient;
