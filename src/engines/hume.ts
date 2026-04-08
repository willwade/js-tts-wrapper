import { AbstractTTSClient } from "../core/abstract-tts";
import * as SSMLUtils from "../core/ssml-utils";
import * as SpeechMarkdown from "../markdown/converter";
import type { SpeakOptions, TTSCredentials, UnifiedVoice } from "../types";
import { getFetch } from "../utils/fetch-utils";

const fetch = getFetch();

export interface HumeTTSOptions extends SpeakOptions {
  model?: string;
  voice?: string;
  providerOptions?: Record<string, unknown>;
}

export interface HumeTTSCredentials extends TTSCredentials {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  properties?: Record<string, unknown> | string;
  propertiesJson?: string;
}

export class HumeTTSClient extends AbstractTTSClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(credentials: HumeTTSCredentials = {}) {
    super(credentials);
    this.apiKey = credentials.apiKey || process.env.HUME_API_KEY || "";
    this.baseUrl = credentials.baseURL || "https://api.hume.ai/v0";
    this.model = (credentials as any).model || "octave-2";
    this.voiceId = "aac4caff-e2e1-4088-9d58-a29c5d22dce6";
    this.sampleRate = 24000;

    this.applyCredentialProperties(credentials);
  }

  private applyCredentialProperties(credentials: HumeTTSCredentials): void {
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

  private resolveVersion(modelId: string): string | undefined {
    if (modelId === "octave-2") return "2";
    if (modelId === "octave-1") return "1";
    return undefined;
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
      const response = await fetch(`${this.baseUrl}/tts/file`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Hume-Api-Key": this.apiKey,
        },
        body: JSON.stringify({ utterances: [{ text: "test" }] }),
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
    return [];
  }

  protected async _mapVoicesToUnified(_rawVoices: any[]): Promise<UnifiedVoice[]> {
    return [];
  }

  async synthToBytes(text: string, options: HumeTTSOptions = {}): Promise<Uint8Array> {
    const preparedText = await this.prepareText(text, options);
    const modelId = options.model || this.model;
    const voiceId = options.voice || this.voiceId;

    const utterance: Record<string, unknown> = { text: preparedText };
    if (voiceId) {
      utterance.voice = { name: voiceId, provider: "HUME_AI" };
    }

    const body: Record<string, unknown> = {
      ...options.providerOptions,
      utterances: [utterance],
    };

    const version = this.resolveVersion(modelId);
    if (version != null) {
      body.version = version;
    }

    const response = await fetch(`${this.baseUrl}/tts/file`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hume-Api-Key": this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Hume API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    this._createEstimatedWordTimings(preparedText);
    return new Uint8Array(arrayBuffer);
  }

  async synthToBytestream(
    text: string,
    options: HumeTTSOptions = {}
  ): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
  }> {
    const preparedText = await this.prepareText(text, options);
    const modelId = options.model || this.model;
    const voiceId = options.voice || this.voiceId;

    const utterance: Record<string, unknown> = { text: preparedText };
    if (voiceId) {
      utterance.voice = { name: voiceId, provider: "HUME_AI" };
    }

    const body: Record<string, unknown> = {
      ...options.providerOptions,
      utterances: [utterance],
    };

    const version = this.resolveVersion(modelId);
    if (version != null) {
      body.version = version;
    }

    const response = await fetch(`${this.baseUrl}/tts/stream/file`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hume-Api-Key": this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Hume API error: ${response.status} ${response.statusText} - ${errorText}`);
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
