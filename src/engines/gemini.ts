import { AbstractTTSClient } from "../core/abstract-tts";
import * as SSMLUtils from "../core/ssml-utils";
import * as SpeechMarkdown from "../markdown/converter";
import type { SpeakOptions, TTSCredentials, UnifiedVoice } from "../types";
import { getFetch } from "../utils/fetch-utils";
import { toIso639_3 } from "../utils/language-utils";

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

type GeminiVoiceGender = "Male" | "Female";

type GeminiVoiceInfo = {
  id: GeminiTTSVoice;
  name: GeminiTTSVoice;
  style: string;
  gender: GeminiVoiceGender;
};

type GeminiLanguageReadiness = "GA" | "Preview";

type GeminiLanguageInfo = {
  bcp47: string;
  display: string;
  readiness: GeminiLanguageReadiness;
};

const GEMINI_SUPPORTED_LANGUAGES: GeminiLanguageInfo[] = [
  { bcp47: "ar-EG", display: "Arabic (Egypt)", readiness: "GA" },
  { bcp47: "bn-BD", display: "Bangla (Bangladesh)", readiness: "GA" },
  { bcp47: "nl-NL", display: "Dutch (Netherlands)", readiness: "GA" },
  { bcp47: "en-IN", display: "English (India)", readiness: "GA" },
  { bcp47: "en-US", display: "English (United States)", readiness: "GA" },
  { bcp47: "fr-FR", display: "French (France)", readiness: "GA" },
  { bcp47: "de-DE", display: "German (Germany)", readiness: "GA" },
  { bcp47: "hi-IN", display: "Hindi (India)", readiness: "GA" },
  { bcp47: "id-ID", display: "Indonesian (Indonesia)", readiness: "GA" },
  { bcp47: "it-IT", display: "Italian (Italy)", readiness: "GA" },
  { bcp47: "ja-JP", display: "Japanese (Japan)", readiness: "GA" },
  { bcp47: "ko-KR", display: "Korean (South Korea)", readiness: "GA" },
  { bcp47: "mr-IN", display: "Marathi (India)", readiness: "GA" },
  { bcp47: "pl-PL", display: "Polish (Poland)", readiness: "GA" },
  { bcp47: "pt-BR", display: "Portuguese (Brazil)", readiness: "GA" },
  { bcp47: "ro-RO", display: "Romanian (Romania)", readiness: "GA" },
  { bcp47: "ru-RU", display: "Russian (Russia)", readiness: "GA" },
  { bcp47: "es-ES", display: "Spanish (Spain)", readiness: "GA" },
  { bcp47: "ta-IN", display: "Tamil (India)", readiness: "GA" },
  { bcp47: "te-IN", display: "Telugu (India)", readiness: "GA" },
  { bcp47: "th-TH", display: "Thai (Thailand)", readiness: "GA" },
  { bcp47: "tr-TR", display: "Turkish (Turkey)", readiness: "GA" },
  { bcp47: "uk-UA", display: "Ukrainian (Ukraine)", readiness: "GA" },
  { bcp47: "vi-VN", display: "Vietnamese (Vietnam)", readiness: "GA" },
  { bcp47: "af-ZA", display: "Afrikaans (South Africa)", readiness: "Preview" },
  { bcp47: "sq-AL", display: "Albanian (Albania)", readiness: "Preview" },
  { bcp47: "am-ET", display: "Amharic (Ethiopia)", readiness: "Preview" },
  { bcp47: "ar-001", display: "Arabic (World)", readiness: "Preview" },
  { bcp47: "hy-AM", display: "Armenian (Armenia)", readiness: "Preview" },
  { bcp47: "az-AZ", display: "Azerbaijani (Azerbaijan)", readiness: "Preview" },
  { bcp47: "eu-ES", display: "Basque (Spain)", readiness: "Preview" },
  { bcp47: "be-BY", display: "Belarusian (Belarus)", readiness: "Preview" },
  { bcp47: "bg-BG", display: "Bulgarian (Bulgaria)", readiness: "Preview" },
  { bcp47: "my-MM", display: "Burmese (Myanmar)", readiness: "Preview" },
  { bcp47: "ca-ES", display: "Catalan (Spain)", readiness: "Preview" },
  { bcp47: "ceb-PH", display: "Cebuano (Philippines)", readiness: "Preview" },
  { bcp47: "cmn-CN", display: "Chinese, Mandarin (China)", readiness: "Preview" },
  { bcp47: "cmn-TW", display: "Chinese, Mandarin (Taiwan)", readiness: "Preview" },
  { bcp47: "hr-HR", display: "Croatian (Croatia)", readiness: "Preview" },
  { bcp47: "cs-CZ", display: "Czech (Czech Republic)", readiness: "Preview" },
  { bcp47: "da-DK", display: "Danish (Denmark)", readiness: "Preview" },
  { bcp47: "en-AU", display: "English (Australia)", readiness: "Preview" },
  { bcp47: "en-GB", display: "English (United Kingdom)", readiness: "Preview" },
  { bcp47: "et-EE", display: "Estonian (Estonia)", readiness: "Preview" },
  { bcp47: "fil-PH", display: "Filipino (Philippines)", readiness: "Preview" },
  { bcp47: "fi-FI", display: "Finnish (Finland)", readiness: "Preview" },
  { bcp47: "fr-CA", display: "French (Canada)", readiness: "Preview" },
  { bcp47: "gl-ES", display: "Galician (Spain)", readiness: "Preview" },
  { bcp47: "ka-GE", display: "Georgian (Georgia)", readiness: "Preview" },
  { bcp47: "el-GR", display: "Greek (Greece)", readiness: "Preview" },
  { bcp47: "gu-IN", display: "Gujarati (India)", readiness: "Preview" },
  { bcp47: "ht-HT", display: "Haitian Creole (Haiti)", readiness: "Preview" },
  { bcp47: "he-IL", display: "Hebrew (Israel)", readiness: "Preview" },
  { bcp47: "hu-HU", display: "Hungarian (Hungary)", readiness: "Preview" },
  { bcp47: "is-IS", display: "Icelandic (Iceland)", readiness: "Preview" },
  { bcp47: "jv-JV", display: "Javanese (Java)", readiness: "Preview" },
  { bcp47: "kn-IN", display: "Kannada (India)", readiness: "Preview" },
  { bcp47: "kok-IN", display: "Konkani (India)", readiness: "Preview" },
  { bcp47: "lo-LA", display: "Lao (Laos)", readiness: "Preview" },
  { bcp47: "la-VA", display: "Latin (Vatican City)", readiness: "Preview" },
  { bcp47: "lv-LV", display: "Latvian (Latvia)", readiness: "Preview" },
  { bcp47: "lt-LT", display: "Lithuanian (Lithuania)", readiness: "Preview" },
  { bcp47: "lb-LU", display: "Luxembourgish (Luxembourg)", readiness: "Preview" },
  { bcp47: "mk-MK", display: "Macedonian (North Macedonia)", readiness: "Preview" },
  { bcp47: "mai-IN", display: "Maithili (India)", readiness: "Preview" },
  { bcp47: "mg-MG", display: "Malagasy (Madagascar)", readiness: "Preview" },
  { bcp47: "ms-MY", display: "Malay (Malaysia)", readiness: "Preview" },
  { bcp47: "ml-IN", display: "Malayalam (India)", readiness: "Preview" },
  { bcp47: "mn-MN", display: "Mongolian (Mongolia)", readiness: "Preview" },
  { bcp47: "ne-NP", display: "Nepali (Nepal)", readiness: "Preview" },
  { bcp47: "nb-NO", display: "Norwegian, Bokmal (Norway)", readiness: "Preview" },
  { bcp47: "nn-NO", display: "Norwegian, Nynorsk (Norway)", readiness: "Preview" },
  { bcp47: "or-IN", display: "Odia (India)", readiness: "Preview" },
  { bcp47: "ps-AF", display: "Pashto (Afghanistan)", readiness: "Preview" },
  { bcp47: "fa-IR", display: "Persian (Iran)", readiness: "Preview" },
  { bcp47: "pt-PT", display: "Portuguese (Portugal)", readiness: "Preview" },
  { bcp47: "pa-IN", display: "Punjabi (India)", readiness: "Preview" },
  { bcp47: "sr-RS", display: "Serbian (Serbia)", readiness: "Preview" },
  { bcp47: "sd-IN", display: "Sindhi (India)", readiness: "Preview" },
  { bcp47: "si-LK", display: "Sinhala (Sri Lanka)", readiness: "Preview" },
  { bcp47: "sk-SK", display: "Slovak (Slovakia)", readiness: "Preview" },
  { bcp47: "sl-SI", display: "Slovenian (Slovenia)", readiness: "Preview" },
  { bcp47: "es-419", display: "Spanish (Latin America)", readiness: "Preview" },
  { bcp47: "es-MX", display: "Spanish (Mexico)", readiness: "Preview" },
  { bcp47: "sw-KE", display: "Swahili (Kenya)", readiness: "Preview" },
  { bcp47: "sv-SE", display: "Swedish (Sweden)", readiness: "Preview" },
  { bcp47: "ur-PK", display: "Urdu (Pakistan)", readiness: "Preview" },
];

const GEMINI_SUPPORTED_LANGUAGE_CODES = GEMINI_SUPPORTED_LANGUAGES.map(
  (language) => language.bcp47
);

const GEMINI_LANGUAGE_READINESS: Record<string, GeminiLanguageReadiness> =
  GEMINI_SUPPORTED_LANGUAGES.reduce<Record<string, GeminiLanguageReadiness>>(
    (readiness, language) => {
      readiness[language.bcp47] = language.readiness;
      return readiness;
    },
    {}
  );

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
    { id: "Zephyr", name: "Zephyr", style: "Bright", gender: "Female" },
    { id: "Puck", name: "Puck", style: "Upbeat", gender: "Male" },
    { id: "Charon", name: "Charon", style: "Informative", gender: "Male" },
    { id: "Kore", name: "Kore", style: "Firm", gender: "Female" },
    { id: "Fenrir", name: "Fenrir", style: "Excitable", gender: "Male" },
    { id: "Leda", name: "Leda", style: "Youthful", gender: "Female" },
    { id: "Orus", name: "Orus", style: "Firm", gender: "Male" },
    { id: "Aoede", name: "Aoede", style: "Breezy", gender: "Female" },
    { id: "Callirrhoe", name: "Callirrhoe", style: "Easy-going", gender: "Female" },
    { id: "Autonoe", name: "Autonoe", style: "Bright", gender: "Female" },
    { id: "Enceladus", name: "Enceladus", style: "Breathy", gender: "Male" },
    { id: "Iapetus", name: "Iapetus", style: "Clear", gender: "Male" },
    { id: "Umbriel", name: "Umbriel", style: "Easy-going", gender: "Male" },
    { id: "Algieba", name: "Algieba", style: "Smooth", gender: "Male" },
    { id: "Despina", name: "Despina", style: "Smooth", gender: "Female" },
    { id: "Erinome", name: "Erinome", style: "Clear", gender: "Female" },
    { id: "Algenib", name: "Algenib", style: "Gravelly", gender: "Male" },
    { id: "Rasalgethi", name: "Rasalgethi", style: "Informative", gender: "Male" },
    { id: "Laomedeia", name: "Laomedeia", style: "Upbeat", gender: "Female" },
    { id: "Achernar", name: "Achernar", style: "Soft", gender: "Female" },
    { id: "Alnilam", name: "Alnilam", style: "Firm", gender: "Male" },
    { id: "Schedar", name: "Schedar", style: "Even", gender: "Male" },
    { id: "Gacrux", name: "Gacrux", style: "Mature", gender: "Female" },
    { id: "Pulcherrima", name: "Pulcherrima", style: "Forward", gender: "Female" },
    { id: "Achird", name: "Achird", style: "Friendly", gender: "Male" },
    { id: "Zubenelgenubi", name: "Zubenelgenubi", style: "Casual", gender: "Male" },
    { id: "Vindemiatrix", name: "Vindemiatrix", style: "Gentle", gender: "Female" },
    { id: "Sadachbia", name: "Sadachbia", style: "Lively", gender: "Male" },
    { id: "Sadaltager", name: "Sadaltager", style: "Knowledgeable", gender: "Male" },
    { id: "Sulafat", name: "Sulafat", style: "Warm", gender: "Female" },
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
      gender: voice.gender,
      provider: "gemini",
      languageCodes: GEMINI_SUPPORTED_LANGUAGES.map((language) => ({
        bcp47: language.bcp47,
        iso639_3: toIso639_3(language.bcp47),
        display: language.display,
      })),
      metadata: {
        style: voice.style,
        genderSource: "google-cloud-gemini-tts",
        supportedLanguageCodes: [...GEMINI_SUPPORTED_LANGUAGE_CODES],
        languageReadiness: { ...GEMINI_LANGUAGE_READINESS },
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
