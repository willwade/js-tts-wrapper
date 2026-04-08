import { AbstractTTSClient } from "../core/abstract-tts";
import * as SSMLUtils from "../core/ssml-utils";
import * as SpeechMarkdown from "../markdown/converter";
import type { SpeakOptions, TTSCredentials, UnifiedVoice } from "../types";
import { base64ToUint8Array } from "../utils/base64-utils";
import { getFetch } from "../utils/fetch-utils";
import { toIso639_3, toLanguageDisplay } from "../utils/language-utils";

const fetch = getFetch();

export interface MurfTTSOptions extends SpeakOptions {
  model?: string;
  voice?: string;
  providerOptions?: Record<string, unknown>;
}

export interface MurfTTSCredentials extends TTSCredentials {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  properties?: Record<string, unknown> | string;
  propertiesJson?: string;
}

export class MurfTTSClient extends AbstractTTSClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  static readonly VOICES = [
    { id: "en-US-natalie", name: "Natalie", gender: "Female" as const, language: "en-US" },
    { id: "en-US-owen", name: "Owen", gender: "Male" as const, language: "en-US" },
    { id: "en-US-amira", name: "Amira", gender: "Female" as const, language: "en-US" },
    { id: "en-US-daniel", name: "Daniel", gender: "Male" as const, language: "en-US" },
    { id: "en-US-taylor", name: "Taylor", gender: "Female" as const, language: "en-US" },
    { id: "en-US-alex", name: "Alex", gender: "Male" as const, language: "en-US" },
    { id: "en-US-emily", name: "Emily", gender: "Female" as const, language: "en-US" },
    { id: "en-US-ben", name: "Ben", gender: "Male" as const, language: "en-US" },
    { id: "en-US-claire", name: "Claire", gender: "Female" as const, language: "en-US" },
    { id: "en-US-glen", name: "Glen", gender: "Male" as const, language: "en-US" },
    { id: "de-DE-detlef", name: "Detlef", gender: "Male" as const, language: "de-DE" },
    { id: "es-ES-rosalyn", name: "Rosalyn", gender: "Female" as const, language: "es-ES" },
    { id: "fr-FR-henri", name: "Henri", gender: "Male" as const, language: "fr-FR" },
    { id: "pt-BR-thomas", name: "Thomas", gender: "Male" as const, language: "pt-BR" },
    { id: "it-IT-giulia", name: "Giulia", gender: "Female" as const, language: "it-IT" },
  ];

  constructor(credentials: MurfTTSCredentials = {}) {
    super(credentials);
    this.apiKey = credentials.apiKey || process.env.MURF_API_KEY || "";
    this.baseUrl = credentials.baseURL || "https://api.murf.ai/v1";
    this.model = (credentials as any).model || "GEN2";
    this.voiceId = "en-US-natalie";
    this.sampleRate = 24000;

    this.applyCredentialProperties(credentials);
  }

  private applyCredentialProperties(credentials: MurfTTSCredentials): void {
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

  private async prepareText(text: string, options?: SpeakOptions): Promise<string> {
    let processedText = text;

    if (options?.useSpeechMarkdown && SpeechMarkdown.isSpeechMarkdown(processedText)) {
      const ssml = await SpeechMarkdown.toSSML(processedText, "w3c");
      processedText = SSMLUtils.stripSSML(ssml);
    }

    if (SSMLUtils.isSSML(processedText)) {
      processedText = SSMLUtils.stripSSML(processedText);
    }

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
      const response = await fetch(`${this.baseUrl}/speech/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": this.apiKey,
        },
        body: JSON.stringify({ voiceId: "test", text: "test", encodeAsBase64: true }),
      });
      return response.status !== 401;
    } catch {
      return false;
    }
  }

  protected getRequiredCredentials(): string[] {
    return ["apiKey"];
  }

  protected async _getVoices(): Promise<any[]> {
    return MurfTTSClient.VOICES;
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
      provider: "murf" as any,
    }));
  }

  async synthToBytes(text: string, options: MurfTTSOptions = {}): Promise<Uint8Array> {
    const preparedText = await this.prepareText(text, options);
    const modelId = options.model || this.model;
    const voiceId = options.voice || this.voiceId;
    const isFalcon = modelId === "FALCON";

    const body: Record<string, unknown> = {
      ...options.providerOptions,
      voiceId,
      text: preparedText,
    };

    if (isFalcon) {
      body.model = "FALCON";
    } else {
      body.encodeAsBase64 = true;
    }

    const url = isFalcon ? `${this.baseUrl}/speech/stream` : `${this.baseUrl}/speech/generate`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Murf API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    if (isFalcon) {
      const arrayBuffer = await response.arrayBuffer();
      this._createEstimatedWordTimings(preparedText);
      return new Uint8Array(arrayBuffer);
    }

    const json = (await response.json()) as { encodedAudio: string };
    const bytes = base64ToUint8Array(json.encodedAudio);
    this._createEstimatedWordTimings(preparedText);
    return bytes;
  }

  async synthToBytestream(
    text: string,
    options: MurfTTSOptions = {}
  ): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
  }> {
    const preparedText = await this.prepareText(text, options);
    const modelId = options.model || this.model;
    const voiceId = options.voice || this.voiceId;

    const body: Record<string, unknown> = {
      ...options.providerOptions,
      voiceId,
      text: preparedText,
      model: modelId,
    };

    const response = await fetch(`${this.baseUrl}/speech/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Murf API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    if (!response.body) {
      const bytes = await this.synthToBytes(text, options);
      const readableStream = new ReadableStream({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      });
      return { audioStream: readableStream, wordBoundaries: [] };
    }

    return { audioStream: response.body, wordBoundaries: [] };
  }
}
