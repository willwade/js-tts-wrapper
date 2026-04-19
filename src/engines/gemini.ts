import { AbstractTTSClient } from "../core/abstract-tts";
import * as SSMLUtils from "../core/ssml-utils";
import * as SpeechMarkdown from "../markdown/converter";
import type { SpeakOptions, TTSCredentials, UnifiedVoice } from "../types";
import { getFetch } from "../utils/fetch-utils";
import { toIso639_3, toLanguageDisplay } from "../utils/language-utils";

export type GeminiTTSModel = "gemini-3.1-flash-tts-preview" | "gemini-2.5-flash-preview-tts";

export type GeminiTTSVoice =
  | "Zephyr"
  | "Puck"
  | "Charon"
  | "Kore"
  | "Fenrir"
  | "Leda"
  | "Orus"
  | "Aoede"
  | "Callirrhoe"
  | "Autonoe"
  | "Enceladus"
  | "Iapetus"
  | "Umbriel"
  | "Algieba"
  | "Despina"
  | "Erinome"
  | "Algenib"
  | "Rasalgethi"
  | "Laomedeia"
  | "Achernar"
  | "Alnilam"
  | "Schedar"
  | "Gacrux"
  | "Pulcherrima"
  | "Achird"
  | "Zubenelgenubi"
  | "Vindemiatrix"
  | "Sadachbia"
  | "Sadaltager"
  | "Sulafat";

export interface GeminiTTSOptions extends SpeakOptions {
  model?: GeminiTTSModel | string;
  voice?: GeminiTTSVoice | string;
  format?: "wav" | "pcm" | "mp3";
  providerOptions?: Record<string, unknown>;
}

export interface GeminiTTSCredentials extends TTSCredentials {
  apiKey?: string;
  baseURL?: string;
  model?: GeminiTTSModel | string;
  voice?: GeminiTTSVoice | string;
  properties?: Record<string, unknown> | string;
  propertiesJson?: string;
}

type GeminiVoiceInfo = {
  id: GeminiTTSVoice;
  name: GeminiTTSVoice;
  style: string;
};

const SUPPORTED_LANGUAGES = [
  "ar",
  "fil",
  "bn",
  "fi",
  "nl",
  "gl",
  "en",
  "ka",
  "fr",
  "el",
  "de",
  "gu",
  "hi",
  "ht",
  "id",
  "he",
  "it",
  "hu",
  "ja",
  "is",
  "ko",
  "jv",
  "mr",
  "kn",
  "pl",
  "kok",
  "pt",
  "lo",
  "ro",
  "la",
  "ru",
  "lv",
  "es",
  "lt",
  "ta",
  "lb",
  "te",
  "mk",
  "th",
  "mai",
  "tr",
  "mg",
  "uk",
  "ms",
  "vi",
  "ml",
  "af",
  "mn",
  "sq",
  "ne",
  "am",
  "nb",
  "hy",
  "nn",
  "az",
  "or",
  "eu",
  "ps",
  "be",
  "fa",
  "bg",
  "pa",
  "my",
  "sr",
  "ca",
  "sd",
  "ceb",
  "si",
  "cmn",
  "sk",
  "hr",
  "sl",
  "cs",
  "sw",
  "da",
  "sv",
  "et",
  "ur",
];

/**
 * Gemini Flash TTS client.
 *
 * Uses the Gemini generateContent REST API directly. Gemini TTS returns PCM audio;
 * this client wraps it as WAV by default so normal playback and conversion paths work.
 */
export class GeminiTTSClient extends AbstractTTSClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  static readonly DEFAULT_MODEL: GeminiTTSModel = "gemini-3.1-flash-tts-preview";
  static readonly DEFAULT_VOICE: GeminiTTSVoice = "Kore";

  static readonly VOICES: GeminiVoiceInfo[] = [
    { id: "Zephyr", name: "Zephyr", style: "Bright" },
    { id: "Puck", name: "Puck", style: "Upbeat" },
    { id: "Charon", name: "Charon", style: "Informative" },
    { id: "Kore", name: "Kore", style: "Firm" },
    { id: "Fenrir", name: "Fenrir", style: "Excitable" },
    { id: "Leda", name: "Leda", style: "Youthful" },
    { id: "Orus", name: "Orus", style: "Firm" },
    { id: "Aoede", name: "Aoede", style: "Breezy" },
    { id: "Callirrhoe", name: "Callirrhoe", style: "Easy-going" },
    { id: "Autonoe", name: "Autonoe", style: "Bright" },
    { id: "Enceladus", name: "Enceladus", style: "Breathy" },
    { id: "Iapetus", name: "Iapetus", style: "Clear" },
    { id: "Umbriel", name: "Umbriel", style: "Easy-going" },
    { id: "Algieba", name: "Algieba", style: "Smooth" },
    { id: "Despina", name: "Despina", style: "Smooth" },
    { id: "Erinome", name: "Erinome", style: "Clear" },
    { id: "Algenib", name: "Algenib", style: "Gravelly" },
    { id: "Rasalgethi", name: "Rasalgethi", style: "Informative" },
    { id: "Laomedeia", name: "Laomedeia", style: "Upbeat" },
    { id: "Achernar", name: "Achernar", style: "Soft" },
    { id: "Alnilam", name: "Alnilam", style: "Firm" },
    { id: "Schedar", name: "Schedar", style: "Even" },
    { id: "Gacrux", name: "Gacrux", style: "Mature" },
    { id: "Pulcherrima", name: "Pulcherrima", style: "Forward" },
    { id: "Achird", name: "Achird", style: "Friendly" },
    { id: "Zubenelgenubi", name: "Zubenelgenubi", style: "Casual" },
    { id: "Vindemiatrix", name: "Vindemiatrix", style: "Gentle" },
    { id: "Sadachbia", name: "Sadachbia", style: "Lively" },
    { id: "Sadaltager", name: "Sadaltager", style: "Knowledgeable" },
    { id: "Sulafat", name: "Sulafat", style: "Warm" },
  ];

  constructor(credentials: GeminiTTSCredentials = {}) {
    super(credentials);
    this.apiKey = credentials.apiKey || this.getEnv("GEMINI_API_KEY");
    this.baseUrl = credentials.baseURL || "https://generativelanguage.googleapis.com/v1beta";
    this.model = credentials.model || GeminiTTSClient.DEFAULT_MODEL;
    this.voiceId = credentials.voice || GeminiTTSClient.DEFAULT_VOICE;
    this.sampleRate = 24000;
    this.capabilities = { browserSupported: true, nodeSupported: true };
    this._models = [
      { id: "gemini-3.1-flash-tts-preview", features: ["audio-tags"] },
      { id: "gemini-2.5-flash-preview-tts", features: ["audio-tags"] },
    ];

    this.applyCredentialProperties(credentials);
  }

  private getEnv(name: string): string {
    if (typeof process !== "undefined" && process.env?.[name]) {
      return process.env[name] || "";
    }
    return "";
  }

  private applyCredentialProperties(credentials: GeminiTTSCredentials): void {
    const rawProps =
      (credentials as any).properties ??
      (credentials as any).propertiesJson ??
      (credentials as any).propertiesJSON;

    if (!rawProps) return;

    let parsed: Record<string, unknown> | null = null;
    if (typeof rawProps === "string") {
      try {
        parsed = JSON.parse(rawProps);
      } catch {
        return;
      }
    } else if (typeof rawProps === "object") {
      parsed = rawProps as Record<string, unknown>;
    }

    if (!parsed) return;

    for (const [key, value] of Object.entries(parsed)) {
      this.setProperty(key, value);
    }
  }

  private async prepareText(text: string, options?: GeminiTTSOptions): Promise<string> {
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
      case "baseURL":
      case "baseUrl":
        return this.baseUrl;
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
      case "baseURL":
      case "baseUrl":
        this.baseUrl = value;
        break;
      default:
        super.setProperty(property, value);
        break;
    }
  }

  protected getRequiredCredentials(): string[] {
    return ["apiKey"];
  }

  async checkCredentials(): Promise<boolean> {
    if (!this.apiKey) return false;

    try {
      const response = await getFetch()(`${this.baseUrl}/models`, {
        method: "GET",
        headers: {
          "x-goog-api-key": this.apiKey,
        },
      });

      if (!response.ok) return false;

      const json = await response.json().catch(() => null);
      if (!json || !Array.isArray(json.models)) return true;

      return json.models.some((model: any) => {
        const name = String(model?.name || model?.id || "");
        return name === this.model || name === `models/${this.model}`;
      });
    } catch {
      return false;
    }
  }

  async checkCredentialsDetailed(): Promise<{
    success: boolean;
    error?: string;
    voiceCount?: number;
  }> {
    try {
      const success = await this.checkCredentials();
      return success
        ? { success: true, voiceCount: GeminiTTSClient.VOICES.length }
        : {
            success: false,
            error: this.apiKey ? "Gemini credentials are invalid" : "Missing apiKey",
          };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  protected async _getVoices(): Promise<any[]> {
    return GeminiTTSClient.VOICES;
  }

  protected async _mapVoicesToUnified(rawVoices: any[]): Promise<UnifiedVoice[]> {
    return rawVoices.map((voice: GeminiVoiceInfo) => ({
      id: voice.id,
      name: voice.name,
      gender: "Unknown",
      provider: "gemini",
      languageCodes: SUPPORTED_LANGUAGES.map((language) => ({
        bcp47: language,
        iso639_3: toIso639_3(language),
        display: toLanguageDisplay(language),
      })),
      metadata: {
        style: voice.style,
      },
    }));
  }

  async synthToBytes(text: string, options: GeminiTTSOptions = {}): Promise<Uint8Array> {
    if (!this.apiKey) {
      throw new Error("Gemini TTS API key is required. Set apiKey or GEMINI_API_KEY.");
    }

    const preparedText = await this.prepareText(text, options);
    const model = options.model || this.model;
    const voiceName = options.voice || this.voiceId || GeminiTTSClient.DEFAULT_VOICE;
    const generationConfig = {
      ...options.providerOptions,
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName,
          },
        },
      },
    };

    const request = {
      contents: [
        {
          parts: [
            {
              text: preparedText,
            },
          ],
        },
      ],
      generationConfig,
      model,
    };

    const response = await getFetch()(`${this.baseUrl}/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.apiKey,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Gemini TTS API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const json = await response.json();
    const pcmBytes = this.extractAudioBytes(json);
    this._createEstimatedWordTimings(preparedText);

    if (options.format === "pcm") {
      return pcmBytes;
    }

    return this.pcm16ToWav(pcmBytes, this.sampleRate, 1);
  }

  async synthToBytestream(
    text: string,
    options: GeminiTTSOptions = {}
  ): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
  }> {
    const audioBytes = await this.synthToBytes(text, options);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(audioBytes);
        controller.close();
      },
    });

    const wordBoundaries = options.useWordBoundary
      ? this.timings.map(([start, end, word]) => ({
          text: word,
          offset: Math.round(start * 10000),
          duration: Math.round((end - start) * 10000),
        }))
      : [];

    return { audioStream: stream, wordBoundaries };
  }

  private extractAudioBytes(response: any): Uint8Array {
    const candidates = Array.isArray(response?.candidates) ? response.candidates : [];
    const textParts: string[] = [];

    for (const candidate of candidates) {
      const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
      for (const part of parts) {
        const inlineData = part?.inlineData || part?.inline_data;
        if (typeof inlineData?.data === "string" && inlineData.data.length > 0) {
          return this.base64ToBytes(inlineData.data);
        }
        if (typeof part?.text === "string") {
          textParts.push(part.text);
        }
      }
    }

    const finishReasons = candidates
      .map((candidate: any) => candidate?.finishReason || candidate?.finish_reason)
      .filter(Boolean)
      .join(", ");
    const details = [
      finishReasons ? `finish reason: ${finishReasons}` : "",
      textParts.length ? `text parts: ${textParts.join(" ")}` : "",
    ]
      .filter(Boolean)
      .join("; ");
    throw new Error(
      `Gemini TTS response did not include audio data${details ? ` (${details})` : ""}.`
    );
  }

  private base64ToBytes(base64: string): Uint8Array {
    try {
      if (typeof Buffer !== "undefined" && typeof Buffer.from === "function") {
        return new Uint8Array(Buffer.from(base64, "base64"));
      }

      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    } catch (error) {
      throw new Error(
        `Failed to decode Gemini TTS audio data: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private pcm16ToWav(pcmBytes: Uint8Array, sampleRate = 24000, channels = 1): Uint8Array {
    const bitsPerSample = 16;
    const byteRate = (sampleRate * channels * bitsPerSample) / 8;
    const blockAlign = (channels * bitsPerSample) / 8;
    const headerSize = 44;
    const wavBytes = new Uint8Array(headerSize + pcmBytes.length);
    const view = new DataView(wavBytes.buffer);

    this.writeAscii(wavBytes, 0, "RIFF");
    view.setUint32(4, 36 + pcmBytes.length, true);
    this.writeAscii(wavBytes, 8, "WAVE");
    this.writeAscii(wavBytes, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    this.writeAscii(wavBytes, 36, "data");
    view.setUint32(40, pcmBytes.length, true);
    wavBytes.set(pcmBytes, headerSize);

    return wavBytes;
  }

  private writeAscii(target: Uint8Array, offset: number, value: string): void {
    for (let i = 0; i < value.length; i++) {
      target[offset + i] = value.charCodeAt(i);
    }
  }
}
