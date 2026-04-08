import { AbstractTTSClient } from "../core/abstract-tts";
import * as SSMLUtils from "../core/ssml-utils";
import * as SpeechMarkdown from "../markdown/converter";
import type { SpeakOptions, TTSCredentials, UnifiedVoice } from "../types";
import { getFetch } from "../utils/fetch-utils";

const fetch = getFetch();

export interface MistralTTSOptions extends SpeakOptions {
  model?: string;
  voice?: string;
  responseFormat?: "mp3" | "wav" | "opus";
  providerOptions?: Record<string, unknown>;
}

export interface MistralTTSCredentials extends TTSCredentials {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  properties?: Record<string, unknown> | string;
  propertiesJson?: string;
}

export class MistralTTSClient extends AbstractTTSClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private responseFormat: string;

  constructor(credentials: MistralTTSCredentials = {}) {
    super(credentials);
    this.apiKey = credentials.apiKey || process.env.MISTRAL_API_KEY || "";
    this.baseUrl = credentials.baseURL || "https://api.mistral.ai/v1";
    this.model = (credentials as any).model || "voxtral-mini-tts-2603";
    this.voiceId = "";
    this.responseFormat = "mp3";
    this.sampleRate = 24000;

    this.applyCredentialProperties(credentials);
  }

  private applyCredentialProperties(credentials: MistralTTSCredentials): void {
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
      case "responseFormat":
        return this.responseFormat;
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
      case "responseFormat":
        this.responseFormat = value;
        break;
      default:
        super.setProperty(property, value);
        break;
    }
  }

  async checkCredentials(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
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
    return [];
  }

  protected async _mapVoicesToUnified(_rawVoices: any[]): Promise<UnifiedVoice[]> {
    return [];
  }

  async synthToBytes(text: string, options: MistralTTSOptions = {}): Promise<Uint8Array> {
    const preparedText = await this.prepareText(text, options);
    const modelId = options.model || this.model;
    const voiceId = options.voice || this.voiceId;

    const body: Record<string, unknown> = {
      response_format: options.responseFormat || this.responseFormat,
      ...options.providerOptions,
      model: modelId,
      input: preparedText,
    };
    if (voiceId) {
      body.voice_id = voiceId;
    }

    const response = await fetch(`${this.baseUrl}/audio/speech`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Mistral API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const json = (await response.json()) as { audio_data: string };
    const binaryStr = atob(json.audio_data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    this._createEstimatedWordTimings(preparedText);
    return bytes;
  }

  async synthToBytestream(
    text: string,
    options: MistralTTSOptions = {}
  ): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
  }> {
    const preparedText = await this.prepareText(text, options);
    const modelId = options.model || this.model;
    const voiceId = options.voice || this.voiceId;

    const body: Record<string, unknown> = {
      response_format: options.responseFormat || this.responseFormat,
      ...options.providerOptions,
      model: modelId,
      input: preparedText,
      stream: true,
    };
    if (voiceId) {
      body.voice_id = voiceId;
    }

    const response = await fetch(`${this.baseUrl}/audio/speech`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "text/event-stream",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Mistral API error: ${response.status} ${response.statusText} - ${errorText}`
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

    const sseStream = this.parseSseBase64Stream(response.body);
    return { audioStream: sseStream, wordBoundaries: [] };
  }

  private parseSseBase64Stream(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    return new ReadableStream<Uint8Array>({
      async pull(controller) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (!data || data === "[DONE]") continue;

            try {
              const json = JSON.parse(data);
              if (json.type === "speech.audio.delta" && typeof json.audio_data === "string") {
                const binaryStr = atob(json.audio_data);
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) {
                  bytes[i] = binaryStr.charCodeAt(i);
                }
                controller.enqueue(bytes);
              }
            } catch {
              /* skip malformed */
            }
          }
        }
      },
    });
  }
}
