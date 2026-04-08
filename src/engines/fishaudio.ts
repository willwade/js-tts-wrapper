import { AbstractTTSClient } from "../core/abstract-tts";
import * as SSMLUtils from "../core/ssml-utils";
import * as SpeechMarkdown from "../markdown/converter";
import type { SpeakOptions, TTSCredentials, UnifiedVoice } from "../types";
import { getFetch } from "../utils/fetch-utils";

const fetch = getFetch();

const AUDIO_TAG_MODELS = ["s2-pro"];

const AUDIO_TAG_REGEX = /\[[^\]]+\]/g;

export interface FishAudioTTSOptions extends SpeakOptions {
  model?: string;
  voice?: string;
  providerOptions?: Record<string, unknown>;
}

export interface FishAudioTTSCredentials extends TTSCredentials {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  properties?: Record<string, unknown> | string;
  propertiesJson?: string;
}

export class FishAudioTTSClient extends AbstractTTSClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(credentials: FishAudioTTSCredentials = {}) {
    super(credentials);
    this.apiKey = credentials.apiKey || process.env.FISH_AUDIO_API_KEY || "";
    this.baseUrl = credentials.baseURL || "https://api.fish.audio";
    this.model = (credentials as any).model || "s2-pro";
    this.voiceId = "";
    this.sampleRate = 44100;

    this.applyCredentialProperties(credentials);
  }

  private applyCredentialProperties(credentials: FishAudioTTSCredentials): void {
    const rawProps =
      (credentials as any).properties ??
      (credentials as any).propertiesJson ??
      (credentials as any).propertiesJSON;

    if (rawProps) {
      let parsed: Record<string, unknown> | null = null;
      if (typeof rawProps === "string") {
        try {
          parsed = JSON.parse(rawProps);
        } catch {
          /* ignore */
        }
      } else if (typeof rawProps === "object") {
        parsed = rawProps as Record<string, unknown>;
      }
      if (parsed) {
        for (const [key, value] of Object.entries(parsed)) {
          this.setProperty(key, value);
        }
      }
    }
  }

  private processAudioTags(text: string): string {
    if (AUDIO_TAG_MODELS.includes(this.model)) {
      return text;
    }

    if (!AUDIO_TAG_REGEX.test(text)) return text;

    return text.replace(AUDIO_TAG_REGEX, "").replace(/\s+/g, " ").trim();
  }

  private async prepareText(text: string, options?: SpeakOptions): Promise<string> {
    let processedText = text;

    if (options?.useSpeechMarkdown && SpeechMarkdown.isSpeechMarkdown(processedText)) {
      const ssml = await SpeechMarkdown.toSSML(processedText, "w3c");
      processedText = SSMLUtils.stripSSML(ssml);
    }

    if (SSMLUtils.isSSML(processedText)) {
      processedText = SSMLUtils.stripSSML(processedText);
    }

    processedText = this.processAudioTags(processedText);
    return processedText;
  }

  setModel(model: string): void {
    this.model = model;
  }

  setVoice(voiceId: string): void {
    this.voiceId = voiceId;
  }

  getProperty(property: string): any {
    switch (property) {
      case "model":
        return this.model;
      case "voice":
        return this.voiceId;
      default:
        return super.getProperty(property);
    }
  }

  setProperty(property: string, value: any): void {
    switch (property) {
      case "model":
        this.setModel(value);
        break;
      case "voice":
        this.setVoice(value);
        break;
      default:
        super.setProperty(property, value);
        break;
    }
  }

  async checkCredentials(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const response = await fetch(`${this.baseUrl}/v1/model`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  protected getRequiredCredentials(): string[] {
    return ["apiKey"];
  }

  protected async _getVoices(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/model`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  protected async _mapVoicesToUnified(rawVoices: any[]): Promise<UnifiedVoice[]> {
    return rawVoices
      .filter((v: any) => v.type === "tts" || v.task === "tts")
      .map((voice: any) => ({
        id: voice._id || voice.id,
        name: voice.title || voice.name || "Unknown",
        gender: (voice.gender || "Unknown") as "Male" | "Female" | "Unknown",
        languageCodes: voice.languages
          ? voice.languages.map((lang: string) => ({
              bcp47: lang,
              iso639_3: lang.split("-")[0],
              display: lang,
            }))
          : [{ bcp47: "en", iso639_3: "eng", display: "English" }],
        provider: "fishaudio" as any,
      }));
  }

  async synthToBytes(text: string, options: FishAudioTTSOptions = {}): Promise<Uint8Array> {
    const preparedText = await this.prepareText(text, options);
    const modelId = options.model || this.model;
    const voiceId = options.voice || this.voiceId;

    const body: Record<string, unknown> = {
      ...options.providerOptions,
      text: preparedText,
    };
    if (voiceId) {
      body.reference_id = voiceId;
    }

    const response = await fetch(`${this.baseUrl}/v1/tts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        model: modelId,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Fish Audio API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    this._createEstimatedWordTimings(preparedText);
    return new Uint8Array(arrayBuffer);
  }

  async synthToBytestream(
    text: string,
    options: FishAudioTTSOptions = {}
  ): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
  }> {
    const preparedText = await this.prepareText(text, options);
    const modelId = options.model || this.model;
    const voiceId = options.voice || this.voiceId;

    const body: Record<string, unknown> = {
      ...options.providerOptions,
      text: preparedText,
    };
    if (voiceId) {
      body.reference_id = voiceId;
    }

    const response = await fetch(`${this.baseUrl}/v1/tts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        model: modelId,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Fish Audio API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    if (!response.body) {
      const arrayBuffer = await response.arrayBuffer();
      const audioData = new Uint8Array(arrayBuffer);
      const readableStream = new ReadableStream({
        start(controller) {
          controller.enqueue(audioData);
          controller.close();
        },
      });
      return { audioStream: readableStream, wordBoundaries: [] };
    }

    return { audioStream: response.body, wordBoundaries: [] };
  }
}
