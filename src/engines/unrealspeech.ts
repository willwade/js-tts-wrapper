import { AbstractTTSClient } from "../core/abstract-tts";
import * as SSMLUtils from "../core/ssml-utils";
import * as SpeechMarkdown from "../markdown/converter";
import type { SpeakOptions, TTSCredentials, UnifiedVoice } from "../types";
import { getFetch } from "../utils/fetch-utils";
import { toIso639_3, toLanguageDisplay } from "../utils/language-utils";

const fetch = getFetch();

export interface UnrealSpeechTTSOptions extends SpeakOptions {
  voice?: string;
  audioFormat?: "mp3" | "wav" | "pcm";
  providerOptions?: Record<string, unknown>;
}

export interface UnrealSpeechTTSCredentials extends TTSCredentials {
  apiKey?: string;
  baseURL?: string;
  properties?: Record<string, unknown> | string;
  propertiesJson?: string;
}

export class UnrealSpeechTTSClient extends AbstractTTSClient {
  private apiKey: string;
  private baseUrl: string;

  static readonly VOICES = [
    { id: "Sierra", name: "Sierra", gender: "Female" as const, language: "en-US" },
    { id: "Dan", name: "Dan", gender: "Male" as const, language: "en-US" },
    { id: "Will", name: "Will", gender: "Male" as const, language: "en-US" },
    { id: "Scarlett", name: "Scarlett", gender: "Female" as const, language: "en-US" },
    { id: "Liv", name: "Liv", gender: "Female" as const, language: "en-US" },
    { id: "Amy", name: "Amy", gender: "Female" as const, language: "en-US" },
    { id: "Eric", name: "Eric", gender: "Male" as const, language: "en-US" },
    { id: "Brian", name: "Brian", gender: "Male" as const, language: "en-US" },
  ];

  constructor(credentials: UnrealSpeechTTSCredentials = {}) {
    super(credentials);
    this.apiKey = credentials.apiKey || process.env.UNREAL_SPEECH_API_KEY || "";
    this.baseUrl = credentials.baseURL || "https://api.v8.unrealspeech.com";
    this.voiceId = "Sierra";
    this.sampleRate = 24000;

    this.applyCredentialProperties(credentials);
  }

  private applyCredentialProperties(credentials: UnrealSpeechTTSCredentials): void {
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
      const response = await fetch(`${this.baseUrl}/speech`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          Text: "test",
          VoiceId: "Sierra",
          AudioFormat: "mp3",
          OutputFormat: "uri",
        }),
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
    return UnrealSpeechTTSClient.VOICES;
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
      provider: "unrealspeech" as any,
    }));
  }

  async synthToBytes(text: string, options: UnrealSpeechTTSOptions = {}): Promise<Uint8Array> {
    const preparedText = await this.prepareText(text, options);
    const voiceId = options.voice || this.voiceId;

    const body: Record<string, unknown> = {
      ...options.providerOptions,
      AudioFormat: options.audioFormat || "mp3",
      OutputFormat: "uri",
      VoiceId: voiceId,
      Text: preparedText,
    };

    const response = await fetch(`${this.baseUrl}/speech`, {
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
        `Unreal Speech API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const json = (await response.json()) as { OutputUri: string };
    const audioResponse = await fetch(json.OutputUri);

    if (!audioResponse.ok) {
      throw new Error(`Unreal Speech download error: ${audioResponse.status}`);
    }

    const arrayBuffer = await audioResponse.arrayBuffer();
    this._createEstimatedWordTimings(preparedText);
    return new Uint8Array(arrayBuffer);
  }

  async synthToBytestream(
    text: string,
    options: UnrealSpeechTTSOptions = {}
  ): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
  }> {
    const preparedText = await this.prepareText(text, options);
    const voiceId = options.voice || this.voiceId;

    const body: Record<string, unknown> = {
      ...options.providerOptions,
      AudioFormat: options.audioFormat || "mp3",
      VoiceId: voiceId,
      Text: preparedText,
    };

    const response = await fetch(`${this.baseUrl}/stream`, {
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
        `Unreal Speech API error: ${response.status} ${response.statusText} - ${errorText}`
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
