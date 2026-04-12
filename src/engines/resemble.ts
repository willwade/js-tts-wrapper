import { AbstractTTSClient } from "../core/abstract-tts";
import * as SSMLUtils from "../core/ssml-utils";
import * as SpeechMarkdown from "../markdown/converter";
import type { SpeakOptions, TTSCredentials, UnifiedVoice } from "../types";
import { base64ToUint8Array } from "../utils/base64-utils";
import { getFetch } from "../utils/fetch-utils";
import { toIso639_3, toLanguageDisplay } from "../utils/language-utils";

const fetch = getFetch();

export interface ResembleTTSOptions extends SpeakOptions {
  voice?: string;
  providerOptions?: Record<string, unknown>;
}

export interface ResembleTTSCredentials extends TTSCredentials {
  apiKey?: string;
  baseURL?: string;
  properties?: Record<string, unknown> | string;
  propertiesJson?: string;
}

export class ResembleTTSClient extends AbstractTTSClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(credentials: ResembleTTSCredentials = {}) {
    super(credentials);
    this.apiKey = credentials.apiKey || process.env.RESEMBLE_API_KEY || "";
    this.baseUrl = credentials.baseURL || "https://f.cluster.resemble.ai";
    this.voiceId = "";
    this._models = [
      { id: "default", features: ["streaming", "inline-voice-cloning", "open-source"] },
    ];
    this.sampleRate = 22050;

    this.applyCredentialProperties(credentials);
  }

  private applyCredentialProperties(credentials: ResembleTTSCredentials): void {
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

  setVoice(voiceId: string): void {
    this.voiceId = voiceId;
  }

  getProperty(property: string): any {
    switch (property) {
      case "voice":
        return this.voiceId;
      default:
        return super.getProperty(property);
    }
  }

  setProperty(property: string, value: any): void {
    switch (property) {
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
      const response = await fetch(`${this.baseUrl}/v2/voices`, {
        method: "GET",
        headers: {
          Authorization: this.apiKey,
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
      const response = await fetch(`${this.baseUrl}/v2/voices`, {
        method: "GET",
        headers: {
          Authorization: this.apiKey,
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
    return rawVoices.map((voice: any) => ({
      id: voice.uuid || voice.id || voice.voice_uuid,
      name: voice.name || voice.uuid || voice.id,
      gender: AbstractTTSClient.normalizeGender(voice.gender),
      languageCodes: [
        {
          bcp47: voice.language || "en-US",
          iso639_3: toIso639_3(voice.language || "en-US"),
          display: toLanguageDisplay(voice.language || "en-US"),
        },
      ],
      provider: "resemble" as any,
    }));
  }

  async synthToBytes(text: string, options: ResembleTTSOptions = {}): Promise<Uint8Array> {
    const preparedText = await this.prepareText(text, options);
    const voiceId = options.voice || this.voiceId;

    const body: Record<string, unknown> = {
      ...options.providerOptions,
      voice_uuid: voiceId,
      data: preparedText,
    };

    const response = await fetch(`${this.baseUrl}/synthesize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Resemble API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const json = (await response.json()) as { audio_content: string };
    const bytes = base64ToUint8Array(json.audio_content);

    this._createEstimatedWordTimings(preparedText);
    return bytes;
  }

  async synthToBytestream(
    text: string,
    options: ResembleTTSOptions = {}
  ): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
  }> {
    const preparedText = await this.prepareText(text, options);
    const voiceId = options.voice || this.voiceId;

    const body: Record<string, unknown> = {
      ...options.providerOptions,
      voice_uuid: voiceId,
      data: preparedText,
    };

    const response = await fetch(`${this.baseUrl}/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Resemble API error: ${response.status} ${response.statusText} - ${errorText}`
      );
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
