import { AbstractTTSClient } from "../core/abstract-tts";
import * as SSMLUtils from "../core/ssml-utils";
import * as SpeechMarkdown from "../markdown/converter";
import type { SpeakOptions, TTSCredentials, UnifiedVoice } from "../types";
import { getFetch } from "../utils/fetch-utils";
import { toIso639_3, toLanguageDisplay } from "../utils/language-utils";

const fetch = getFetch();

export interface XaiTTSOptions extends SpeakOptions {
  model?: string;
  voice?: string;
  language?: string;
  providerOptions?: Record<string, unknown>;
}

export interface XaiTTSCredentials extends TTSCredentials {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  properties?: Record<string, unknown> | string;
  propertiesJson?: string;
}

export class XaiTTSClient extends AbstractTTSClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private language: string;

  static readonly VOICES = [
    { id: "avalon-47", name: "Avalon", gender: "Female" as const, language: "en-US" },
    { id: "orion-56", name: "Orion", gender: "Male" as const, language: "en-US" },
    { id: "luna-30", name: "Luna", gender: "Female" as const, language: "en-US" },
    { id: "atlas-84", name: "Atlas", gender: "Male" as const, language: "en-US" },
    { id: "aria-42", name: "Aria", gender: "Female" as const, language: "en-US" },
    { id: "cosmo-01", name: "Cosmo", gender: "Male" as const, language: "en-US" },
  ];

  constructor(credentials: XaiTTSCredentials = {}) {
    super(credentials);
    this.apiKey = credentials.apiKey || process.env.XAI_API_KEY || "";
    this.baseUrl = credentials.baseURL || "https://api.x.ai/v1";
    this.model = (credentials as any).model || "grok-tts";
    this.voiceId = "avalon-47";
    this.language = "auto";
    this.sampleRate = 24000;

    this.applyCredentialProperties(credentials);
  }

  private applyCredentialProperties(credentials: XaiTTSCredentials): void {
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
    return text;
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
      case "language":
        return this.language;
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
      case "language":
        this.language = value;
        break;
      default:
        super.setProperty(property, value);
        break;
    }
  }

  async checkCredentials(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const response = await fetch(`${this.baseUrl}/tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ text: "test", language: "auto" }),
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
    return XaiTTSClient.VOICES;
  }

  protected async _mapVoicesToUnified(rawVoices: any[]): Promise<UnifiedVoice[]> {
    return rawVoices.map((voice) => ({
      id: voice.id,
      name: voice.name,
      gender: voice.gender as "Male" | "Female" | "Unknown",
      languageCodes: [
        {
          bcp47: voice.language || "en-US",
          iso639_3: toIso639_3(voice.language || "en-US"),
          display: toLanguageDisplay(voice.language || "en-US"),
        },
      ],
      provider: "xai" as any,
    }));
  }

  async synthToBytes(text: string, options: XaiTTSOptions = {}): Promise<Uint8Array> {
    const preparedText = await this.prepareText(text, options);
    const voiceId = options.voice || this.voiceId;

    const body: Record<string, unknown> = {
      language: options.language || this.language,
      ...options.providerOptions,
      text: preparedText,
    };
    if (voiceId) {
      body.voice_id = voiceId;
    }

    const response = await fetch(`${this.baseUrl}/tts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`xAI API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    this._createEstimatedWordTimings(preparedText);
    return new Uint8Array(arrayBuffer);
  }

  async synthToBytestream(
    text: string,
    options: XaiTTSOptions = {}
  ): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
  }> {
    const preparedText = await this.prepareText(text, options);
    const voiceId = options.voice || this.voiceId;

    const body: Record<string, unknown> = {
      language: options.language || this.language,
      ...options.providerOptions,
      text: preparedText,
    };
    if (voiceId) {
      body.voice_id = voiceId;
    }

    const response = await fetch(`${this.baseUrl}/tts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`xAI API error: ${response.status} ${response.statusText} - ${errorText}`);
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
