import { AbstractTTSClient } from "../core/abstract-tts";
import * as SSMLUtils from "../core/ssml-utils";
import * as SpeechMarkdown from "../markdown/converter";
import type { SpeakOptions, TTSCredentials, UnifiedVoice } from "../types";
import { getFetch } from "../utils/fetch-utils";
import { toIso639_3, toLanguageDisplay } from "../utils/language-utils";

const fetch = getFetch();

export interface DeepgramTTSOptions extends SpeakOptions {
  model?: string;
  voice?: string;
  format?: "mp3" | "wav" | "ogg" | "opus" | "aac" | "flac" | "pcm";
  outputDir?: string;
  outputFile?: string;
  returnWordBoundaries?: boolean;
  onEnd?: () => void;
  providerOptions?: Record<string, unknown>;
}

export interface DeepgramTTSCredentials extends TTSCredentials {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  properties?: Record<string, unknown> | string;
  propertiesJson?: string;
}

export class DeepgramTTSClient extends AbstractTTSClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  static readonly VOICES = [
    { id: "aura-asteria-english", name: "Asteria", gender: "Female" as const, language: "en-US" },
    { id: "aura-luna-english", name: "Luna", gender: "Female" as const, language: "en-US" },
    { id: "aura-stella-english", name: "Stella", gender: "Female" as const, language: "en-US" },
    { id: "aura-athena-english", name: "Athena", gender: "Female" as const, language: "en-US" },
    { id: "aura-hera-english", name: "Hera", gender: "Female" as const, language: "en-US" },
    { id: "aura-orion-english", name: "Orion", gender: "Male" as const, language: "en-US" },
    { id: "aura-arcas-english", name: "Arcas", gender: "Male" as const, language: "en-US" },
    { id: "aura-perseus-english", name: "Perseus", gender: "Male" as const, language: "en-US" },
    { id: "aura-angus-english", name: "Angus", gender: "Male" as const, language: "en-US" },
    { id: "aura-orpheus-english", name: "Orpheus", gender: "Male" as const, language: "en-US" },
    { id: "aura-helios-english", name: "Helios", gender: "Male" as const, language: "en-US" },
    { id: "aura-zeus-english", name: "Zeus", gender: "Male" as const, language: "en-US" },
    { id: "aura-2-andromeda-en", name: "Andromeda", gender: "Female" as const, language: "en-US" },
    {
      id: "aura-2-cassiopeia-en",
      name: "Cassiopeia",
      gender: "Female" as const,
      language: "en-US",
    },
    { id: "aura-2-dianna-en", name: "Dianna", gender: "Female" as const, language: "en-US" },
    { id: "aura-2-thalia-en", name: "Thalia", gender: "Female" as const, language: "en-US" },
    { id: "aura-2-algernon-en", name: "Algernon", gender: "Male" as const, language: "en-US" },
    {
      id: "aura-2-bellerophon-en",
      name: "Bellerophon",
      gender: "Male" as const,
      language: "en-US",
    },
    { id: "aura-2-callisto-en", name: "Callisto", gender: "Female" as const, language: "en-US" },
    { id: "aura-2-apollo-en", name: "Apollo", gender: "Male" as const, language: "en-US" },
  ];

  constructor(credentials: DeepgramTTSCredentials = {}) {
    super(credentials);
    this.apiKey = credentials.apiKey || process.env.DEEPGRAM_API_KEY || "";
    this.baseUrl = credentials.baseURL || "https://api.deepgram.com/v1";
    this.model = (credentials as any).model || "aura-2";
    this.voiceId = "aura-2-apollo-en";

    this.applyCredentialProperties(credentials);
  }

  private applyCredentialProperties(credentials: DeepgramTTSCredentials): void {
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
      const response = await fetch(`${this.baseUrl}/voices`, {
        method: "GET",
        headers: {
          Authorization: `Token ${this.apiKey}`,
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
    return DeepgramTTSClient.VOICES;
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
      provider: "deepgram" as any,
    }));
  }

  async synthToBytes(text: string, options: DeepgramTTSOptions = {}): Promise<Uint8Array> {
    const preparedText = await this.prepareText(text, options);

    const voiceParam = options.voice || this.voiceId || "aura-2-apollo-en";
    const modelParam = `${options.model || this.model}-${voiceParam}`;
    const url = `${this.baseUrl}/speak?model=${encodeURIComponent(modelParam)}`;

    const body: Record<string, unknown> = {
      ...options.providerOptions,
      text: preparedText,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Deepgram API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    this._createEstimatedWordTimings(preparedText);
    return new Uint8Array(arrayBuffer);
  }

  async synthToBytestream(
    text: string,
    options: DeepgramTTSOptions = {}
  ): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
  }> {
    const preparedText = await this.prepareText(text, options);

    const voiceParam = options.voice || this.voiceId || "aura-2-apollo-en";
    const modelParam = `${options.model || this.model}-${voiceParam}`;
    const url = `${this.baseUrl}/speak?model=${encodeURIComponent(modelParam)}`;

    const body: Record<string, unknown> = {
      ...options.providerOptions,
      text: preparedText,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Deepgram API error: ${response.status} ${response.statusText} - ${errorText}`
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
