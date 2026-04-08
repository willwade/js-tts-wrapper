import { AbstractTTSClient } from "../core/abstract-tts";
import * as SSMLUtils from "../core/ssml-utils";
import * as SpeechMarkdown from "../markdown/converter";
import type { SpeakOptions, TTSCredentials, UnifiedVoice } from "../types";
import { getFetch } from "../utils/fetch-utils";
import { toIso639_3, toLanguageDisplay } from "../utils/language-utils";

const fetch = getFetch();

const AUDIO_TAG_REGEX = /\[[^\]]+\]/g;

const CARTESIA_PASSTHROUGH_TAGS = ["laughter"];

const CARTESIA_EMOTIONS = [
  "neutral",
  "angry",
  "excited",
  "content",
  "sad",
  "scared",
  "happy",
  "euphoric",
  "anxious",
  "panicked",
  "calm",
  "confident",
  "curious",
  "frustrated",
  "sarcastic",
  "melancholic",
  "surprised",
  "disgusted",
  "contemplative",
  "determined",
  "proud",
  "distant",
  "skeptical",
  "mysterious",
  "anticipation",
  "grateful",
  "affectionate",
  "sympathetic",
  "nostalgic",
  "wistful",
  "apologetic",
  "hesitant",
  "insecure",
  "confused",
  "resigned",
  "alarmed",
  "bored",
  "tired",
  "rejected",
  "hurt",
  "disappointed",
  "dejected",
  "guilty",
  "envious",
  "contempt",
  "threatened",
  "agitated",
  "outraged",
  "mad",
  "triumphant",
  "amazed",
  "flirtatious",
  "joking/comedic",
  "serene",
  "peaceful",
  "enthusiastic",
  "elated",
  "trust",
];

export interface CartesiaTTSOptions extends SpeakOptions {
  model?: string;
  voice?: string;
  format?: "mp3" | "wav" | "ogg" | "opus" | "aac" | "flac" | "pcm";
  outputDir?: string;
  outputFile?: string;
  returnWordBoundaries?: boolean;
  onEnd?: () => void;
  providerOptions?: Record<string, unknown>;
}

export interface CartesiaTTSCredentials extends TTSCredentials {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  properties?: Record<string, unknown> | string;
  propertiesJson?: string;
}

export class CartesiaTTSClient extends AbstractTTSClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private outputFormat: Record<string, unknown>;

  constructor(credentials: CartesiaTTSCredentials = {}) {
    super(credentials);
    this.apiKey = credentials.apiKey || process.env.CARTESIA_API_KEY || "";
    this.baseUrl = credentials.baseURL || "https://api.cartesia.ai";
    this.model = (credentials as any).model || "sonic-3";
    this.voiceId = "694f938dd2a74762ba554ff8e2a9d786";
    this.outputFormat = {
      container: "wav",
      encoding: "pcm_f32le",
      sample_rate: 44100,
    };
    this.sampleRate = 44100;

    this.applyCredentialProperties(credentials);
  }

  private applyCredentialProperties(credentials: CartesiaTTSCredentials): void {
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
    if (this.model !== "sonic-3") {
      return text.replace(AUDIO_TAG_REGEX, "").replace(/\s+/g, " ").trim();
    }

    const tags = text.match(AUDIO_TAG_REGEX) ?? [];
    if (tags.length === 0) return text;

    let processed = text;
    for (const tag of tags) {
      const inner = tag.slice(1, -1).toLowerCase();
      if (CARTESIA_PASSTHROUGH_TAGS.includes(inner)) continue;
      if (CARTESIA_EMOTIONS.includes(inner)) {
        processed = processed.replace(tag, `<emotion value="${inner}"/>`);
        continue;
      }
      processed = processed.replace(tag, "");
    }
    return processed.replace(/\s+/g, " ").trim();
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
      case "outputFormat":
        return this.outputFormat;
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
      case "outputFormat":
        if (typeof value === "object") this.outputFormat = value as Record<string, unknown>;
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
          "X-API-Key": this.apiKey,
          "Cartesia-Version": "2025-04-16",
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
      const response = await fetch(`${this.baseUrl}/voices`, {
        method: "GET",
        headers: {
          "X-API-Key": this.apiKey,
          "Cartesia-Version": "2025-04-16",
        },
      });
      if (!response.ok) return [];
      return await response.json();
    } catch {
      return [];
    }
  }

  protected async _mapVoicesToUnified(rawVoices: any[]): Promise<UnifiedVoice[]> {
    return rawVoices.map((voice) => ({
      id: voice.id,
      name: voice.name,
      gender: (voice.description?.toLowerCase().includes("female")
        ? "Female"
        : voice.description?.toLowerCase().includes("male")
          ? "Male"
          : "Unknown") as "Male" | "Female" | "Unknown",
      languageCodes: voice.language
        ? [
            {
              bcp47: voice.language,
              iso639_3: toIso639_3(voice.language),
              display: toLanguageDisplay(voice.language),
            },
          ]
        : [{ bcp47: "en-US", iso639_3: "eng", display: "English (US)" }],
      provider: "cartesia" as any,
    }));
  }

  async synthToBytes(text: string, options: CartesiaTTSOptions = {}): Promise<Uint8Array> {
    const preparedText = await this.prepareText(text, options);
    const voiceId = options.voice || this.voiceId || "694f938dd2a74762ba554ff8e2a9d786";

    const body: Record<string, unknown> = {
      output_format: this.outputFormat,
      ...options.providerOptions,
      model_id: options.model || this.model,
      transcript: preparedText,
      voice: { mode: "id", id: voiceId },
    };

    const response = await fetch(`${this.baseUrl}/tts/bytes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
        "Cartesia-Version": "2025-04-16",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Cartesia API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    this._createEstimatedWordTimings(preparedText);
    return new Uint8Array(arrayBuffer);
  }

  async synthToBytestream(
    text: string,
    options: CartesiaTTSOptions = {}
  ): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
  }> {
    const preparedText = await this.prepareText(text, options);
    const voiceId = options.voice || this.voiceId || "694f938dd2a74762ba554ff8e2a9d786";

    const body: Record<string, unknown> = {
      output_format: this.outputFormat,
      ...options.providerOptions,
      model_id: options.model || this.model,
      transcript: preparedText,
      voice: { mode: "id", id: voiceId },
    };

    const response = await fetch(`${this.baseUrl}/tts/bytes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
        "Cartesia-Version": "2025-04-16",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Cartesia API error: ${response.status} ${response.statusText} - ${errorText}`
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
