import { AbstractTTSClient } from "../core/abstract-tts";
import * as SSMLUtils from "../core/ssml-utils";
import * as SpeechMarkdown from "../markdown/converter";
import type { SpeakOptions, TTSCredentials, UnifiedVoice } from "../types";
import { base64ToUint8Array } from "../utils/base64-utils";
import { getFetch } from "../utils/fetch-utils";
import { toIso639_3, toLanguageDisplay } from "../utils/language-utils";

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

  static readonly VOICES = [
    { id: "Amalthea", name: "Amalthea", gender: "Unknown" as const, language: "en-US" },
    { id: "Achan", name: "Achan", gender: "Unknown" as const, language: "en-US" },
    { id: "Brave", name: "Brave", gender: "Unknown" as const, language: "en-US" },
    { id: "Contessa", name: "Contessa", gender: "Unknown" as const, language: "en-US" },
    { id: "Daintree", name: "Daintree", gender: "Unknown" as const, language: "en-US" },
    { id: "Eugora", name: "Eugora", gender: "Unknown" as const, language: "en-US" },
    { id: "Fornax", name: "Fornax", gender: "Unknown" as const, language: "en-US" },
    { id: "Griffin", name: "Griffin", gender: "Unknown" as const, language: "en-US" },
    { id: "Hestia", name: "Hestia", gender: "Unknown" as const, language: "en-US" },
    { id: "Irving", name: "Irving", gender: "Unknown" as const, language: "en-US" },
    { id: "Jasmine", name: "Jasmine", gender: "Unknown" as const, language: "en-US" },
    { id: "Kestra", name: "Kestra", gender: "Unknown" as const, language: "en-US" },
    { id: "Lorentz", name: "Lorentz", gender: "Unknown" as const, language: "en-US" },
    { id: "Mara", name: "Mara", gender: "Unknown" as const, language: "en-US" },
    { id: "Nettle", name: "Nettle", gender: "Unknown" as const, language: "en-US" },
    { id: "Orin", name: "Orin", gender: "Unknown" as const, language: "en-US" },
    { id: "Puck", name: "Puck", gender: "Unknown" as const, language: "en-US" },
    { id: "Quinn", name: "Quinn", gender: "Unknown" as const, language: "en-US" },
    { id: "Rune", name: "Rune", gender: "Unknown" as const, language: "en-US" },
    { id: "Simbe", name: "Simbe", gender: "Unknown" as const, language: "en-US" },
    { id: "Tertia", name: "Tertia", gender: "Unknown" as const, language: "en-US" },
    { id: "Umbriel", name: "Umbriel", gender: "Unknown" as const, language: "en-US" },
    { id: "Vesta", name: "Vesta", gender: "Unknown" as const, language: "en-US" },
    { id: "Wystan", name: "Wystan", gender: "Unknown" as const, language: "en-US" },
    { id: "Xeno", name: "Xeno", gender: "Unknown" as const, language: "en-US" },
    { id: "Yara", name: "Yara", gender: "Unknown" as const, language: "en-US" },
    { id: "Zephyr", name: "Zephyr", gender: "Unknown" as const, language: "en-US" },
  ];

  constructor(credentials: MistralTTSCredentials = {}) {
    super(credentials);
    this.apiKey = credentials.apiKey || process.env.MISTRAL_API_KEY || "";
    this.baseUrl = credentials.baseURL || "https://api.mistral.ai/v1";
    this.model = (credentials as any).model || "voxtral-mini-tts-2603";
    this.voiceId = "";
    this.responseFormat = "mp3";
    this._models = [
      {
        id: "voxtral-mini-tts-2603",
        features: ["streaming", "inline-voice-cloning", "open-source"],
      },
    ];
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
    return MistralTTSClient.VOICES;
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
      provider: "mistral" as any,
    }));
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
    this._createEstimatedWordTimings(preparedText);
    return base64ToUint8Array(json.audio_data);
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
                controller.enqueue(base64ToUint8Array(json.audio_data));
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
