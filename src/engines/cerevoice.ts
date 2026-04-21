import { AbstractTTSClient } from "../core/abstract-tts";
import * as SSMLUtils from "../core/ssml-utils";
import * as SpeechMarkdown from "../markdown/converter";
import type { SpeakOptions, TTSCredentials, UnifiedVoice } from "../types";
import { getFetch } from "../utils/fetch-utils";
import { toIso639_3, toLanguageDisplay } from "../utils/language-utils";

export interface CereVoiceTTSCredentials extends TTSCredentials {
  email?: string;
  password?: string;
  accessToken?: string;
  refreshToken?: string;
  baseURL?: string;
  voice?: string;
  sampleRate?: number;
  audioFormat?: "wav" | "mp3" | "ogg";
  properties?: Record<string, unknown> | string;
  propertiesJson?: string;
}

export interface CereVoiceTTSOptions extends SpeakOptions {
  voice?: string;
  audioFormat?: "wav" | "mp3" | "ogg";
  sampleRate?: number;
  language?: string;
  accent?: string;
  metadata?: boolean;
  providerOptions?: Record<string, string | number | boolean | undefined>;
}

type CereVoiceVoice = {
  name?: string;
  sample_rate?: number[];
  language_iso?: string;
  country_iso?: string;
  accent_code?: string;
  gender?: string;
  language_ms?: string;
  country?: string;
  region?: string;
  accent?: string;
  language?: string;
};

type WordBoundaryResult = Array<{ text: string; offset: number; duration: number }>;

const TOKEN_LIFETIME_MS = 3 * 60 * 60 * 1000;
const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;
const SUPPORTED_AUDIO_FORMATS = new Set(["wav", "mp3", "ogg"]);

export class CereVoiceTTSClient extends AbstractTTSClient {
  private email: string;
  private password: string;
  private accessToken: string;
  private refreshToken: string;
  private baseUrl: string;
  private audioFormat: "wav" | "mp3" | "ogg";
  private outputSampleRate?: number;
  private language?: string;
  private accent?: string;
  private metadata = false;
  private tokenExpiresAt = 0;

  constructor(credentials: CereVoiceTTSCredentials = {}) {
    super(credentials);

    this.email =
      credentials.email ||
      (typeof process !== "undefined" ? process.env.CEREVOICE_EMAIL || "" : "");
    this.password =
      credentials.password ||
      (typeof process !== "undefined" ? process.env.CEREVOICE_PASSWORD || "" : "");
    this.accessToken =
      credentials.accessToken ||
      (typeof process !== "undefined" ? process.env.CEREVOICE_ACCESS_TOKEN || "" : "");
    this.refreshToken =
      credentials.refreshToken ||
      (typeof process !== "undefined" ? process.env.CEREVOICE_REFRESH_TOKEN || "" : "");
    this.baseUrl = (credentials.baseURL || "https://api.cerevoice.com/v2").replace(/\/+$/, "");
    this.voiceId = credentials.voice || "Heather";
    this.audioFormat = credentials.audioFormat || "wav";
    this.outputSampleRate = credentials.sampleRate;
    if (this.outputSampleRate) {
      this.sampleRate = this.outputSampleRate;
    }

    this.capabilities = {
      browserSupported: true,
      nodeSupported: true,
      needsWasm: false,
    };
    this._models = [
      { id: "cerevoice-cloud-v2", features: ["streaming", "ssml", "word-boundary-events"] },
    ];

    if (this.accessToken) {
      this.tokenExpiresAt = Number.POSITIVE_INFINITY;
    }

    this.applyCredentialProperties(credentials);
  }

  private applyCredentialProperties(credentials: CereVoiceTTSCredentials): void {
    const rawProps =
      credentials.properties ??
      credentials.propertiesJson ??
      (credentials as Record<string, unknown>).propertiesJSON;

    if (!rawProps) {
      return;
    }

    let parsed: Record<string, unknown> | null = null;
    if (typeof rawProps === "string") {
      try {
        parsed = JSON.parse(rawProps) as Record<string, unknown>;
      } catch {
        parsed = null;
      }
    } else if (typeof rawProps === "object") {
      parsed = rawProps as Record<string, unknown>;
    }

    if (!parsed) {
      return;
    }

    for (const [key, value] of Object.entries(parsed)) {
      this.setProperty(key, value as any);
    }
  }

  setVoice(voiceId: string, lang?: string): void {
    this.voiceId = voiceId;
    if (lang) {
      this.lang = lang;
    }
  }

  getProperty(property: string): any {
    switch (property) {
      case "voice":
        return this.voiceId;
      case "baseURL":
        return this.baseUrl;
      case "audioFormat":
        return this.audioFormat;
      case "sampleRate":
        return this.outputSampleRate;
      case "language":
        return this.language;
      case "accent":
        return this.accent;
      case "metadata":
        return this.metadata;
      default:
        return super.getProperty(property);
    }
  }

  setProperty(property: string, value: any): void {
    switch (property) {
      case "voice":
        this.setVoice(String(value));
        break;
      case "baseURL":
      case "baseUrl":
        this.baseUrl = String(value).replace(/\/+$/, "");
        break;
      case "audioFormat":
        if (this.isSupportedAudioFormat(value)) {
          this.audioFormat = value;
        }
        break;
      case "sampleRate": {
        const sampleRate = Number(value);
        if (Number.isFinite(sampleRate) && sampleRate > 0) {
          this.outputSampleRate = sampleRate;
          this.sampleRate = sampleRate;
        }
        break;
      }
      case "language":
        this.language = String(value);
        break;
      case "accent":
        this.accent = String(value);
        break;
      case "metadata":
        this.metadata = Boolean(value);
        break;
      default:
        super.setProperty(property, value);
        break;
    }
  }

  async checkCredentials(): Promise<boolean> {
    if (!this.accessToken && !this.refreshToken && (!this.email || !this.password)) {
      return false;
    }

    try {
      const voices = await this._getVoices();
      return voices.length > 0;
    } catch {
      return false;
    }
  }

  protected getRequiredCredentials(): string[] {
    return ["email", "password"];
  }

  protected async _getVoices(): Promise<any[]> {
    try {
      const response = await this.fetchWithAuth(this.buildUrl("/voices"));
      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as { voices?: CereVoiceVoice[] };
      return Array.isArray(data.voices) ? data.voices : [];
    } catch {
      return [];
    }
  }

  protected async _mapVoicesToUnified(rawVoices: any[]): Promise<UnifiedVoice[]> {
    return (rawVoices as CereVoiceVoice[]).map((voice) => {
      const language = voice.language_iso || "en";
      const country = voice.country_iso || undefined;
      const bcp47 = country ? `${language.toLowerCase()}-${country.toUpperCase()}` : language;

      return {
        id: voice.name || "unknown",
        name: voice.name || "Unknown",
        gender: this.mapGender(voice.gender),
        provider: "cerevoice",
        languageCodes: [
          {
            bcp47,
            iso639_3: toIso639_3(bcp47),
            display: toLanguageDisplay(bcp47),
          },
        ],
        metadata: {
          sample_rate: voice.sample_rate,
          accent_code: voice.accent_code,
          accent: voice.accent,
          country: voice.country,
          region: voice.region,
          language_iso: voice.language_iso,
          country_iso: voice.country_iso,
          language_ms: voice.language_ms,
          language: voice.language,
        },
      };
    });
  }

  async synthToBytes(text: string, options: CereVoiceTTSOptions = {}): Promise<Uint8Array> {
    const prepared = await this.prepareInput(text, options);
    const wantsMetadata = this.shouldRequestMetadata(options);
    const response = await this.requestSynthesis(prepared, options, wantsMetadata);
    const audioBytes = new Uint8Array(await response.arrayBuffer());

    if (wantsMetadata) {
      const wordBoundaries = await this.getWordBoundariesFromResponse(response);
      if (wordBoundaries.length > 0) {
        this.timings = wordBoundaries.map((wb) => [
          wb.offset / 10000,
          (wb.offset + wb.duration) / 10000,
          wb.text,
        ]);
      }
    } else {
      this._createEstimatedWordTimings(prepared.plainText);
    }

    return audioBytes;
  }

  async synthToBytestream(
    text: string,
    options: CereVoiceTTSOptions = {}
  ): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: WordBoundaryResult;
  }> {
    const prepared = await this.prepareInput(text, options);
    const wantsMetadata = this.shouldRequestMetadata(options);
    const response = await this.requestSynthesis(prepared, options, wantsMetadata);
    const wordBoundaries = wantsMetadata ? await this.getWordBoundariesFromResponse(response) : [];

    if (wordBoundaries.length > 0) {
      this.timings = wordBoundaries.map((wb) => [
        wb.offset / 10000,
        (wb.offset + wb.duration) / 10000,
        wb.text,
      ]);
    }

    if (response.body) {
      return {
        audioStream: response.body,
        wordBoundaries,
      };
    }

    const audioBytes = new Uint8Array(await response.arrayBuffer());
    const audioStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(audioBytes);
        controller.close();
      },
    });

    return {
      audioStream,
      wordBoundaries,
    };
  }

  private async requestSynthesis(
    prepared: { body: string; contentType: "text/plain" | "text/xml" },
    options: CereVoiceTTSOptions,
    metadata: boolean
  ) {
    const audioFormat = this.resolveAudioFormat(options);
    const providerOptions = options.providerOptions || {};
    const url = this.buildUrl("/speak", {
      voice: options.voice || this.voiceId || undefined,
      audio_format: audioFormat,
      sample_rate: options.sampleRate || this.outputSampleRate,
      language: options.language || this.language,
      accent: options.accent || this.accent,
      metadata,
      ...providerOptions,
    });

    const response = await this.fetchWithAuth(url, {
      method: "POST",
      headers: {
        Accept: this.acceptHeaderForFormat(audioFormat),
        "Content-Type": prepared.contentType,
      },
      body: prepared.body,
    });

    if (!response.ok) {
      const errorText = await this.safeReadErrorText(response);
      throw new Error(
        `CereVoice API error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`
      );
    }

    return response;
  }

  private async prepareInput(
    text: string,
    options: CereVoiceTTSOptions
  ): Promise<{ body: string; contentType: "text/plain" | "text/xml"; plainText: string }> {
    let processedText = text;

    if (options.useSpeechMarkdown && SpeechMarkdown.isSpeechMarkdown(processedText)) {
      processedText = await SpeechMarkdown.toSSML(processedText, "w3c");
    }

    if (options.rawSSML || this.isXmlLike(processedText)) {
      const body =
        options.rawSSML && !this.isXmlLike(processedText)
          ? SSMLUtils.wrapWithSpeakTags(this.escapeXml(processedText))
          : processedText;
      return {
        body,
        contentType: "text/xml",
        plainText: SSMLUtils.stripSSML(body),
      };
    }

    if (this.shouldApplyProsody(options)) {
      const attrs: string[] = [];
      const rate = options.rate ?? this.properties.rate;
      const pitch = options.pitch ?? this.properties.pitch;
      const volume = options.volume ?? this.properties.volume;

      if (rate && rate !== "medium") {
        attrs.push(`rate="${rate}"`);
      }
      if (pitch && pitch !== "medium") {
        attrs.push(`pitch="${pitch}"`);
      }
      if (volume !== undefined && volume !== 100) {
        attrs.push(`volume="${volume}"`);
      }

      const escapedText = this.escapeXml(processedText);
      const body =
        attrs.length > 0
          ? `<speak><prosody ${attrs.join(" ")}>${escapedText}</prosody></speak>`
          : `<speak>${escapedText}</speak>`;

      return {
        body,
        contentType: "text/xml",
        plainText: processedText,
      };
    }

    return {
      body: processedText,
      contentType: "text/plain",
      plainText: processedText,
    };
  }

  private shouldApplyProsody(options: SpeakOptions): boolean {
    return (
      options.rate !== undefined ||
      options.pitch !== undefined ||
      options.volume !== undefined ||
      this.properties.rate !== "medium" ||
      this.properties.pitch !== "medium" ||
      this.properties.volume !== 100
    );
  }

  private shouldRequestMetadata(options: CereVoiceTTSOptions): boolean {
    return Boolean(options.useWordBoundary || options.metadata || this.metadata);
  }

  private async getWordBoundariesFromResponse(response: {
    headers?: Headers;
  }): Promise<WordBoundaryResult> {
    const metadataUrl = this.getHeader(response.headers, "X-CereVoice-Metadata");
    if (!metadataUrl) {
      return [];
    }

    try {
      const metadataResponse = await getFetch()(metadataUrl, {
        method: "GET",
        headers: {
          Accept: "text/xml, application/xml, text/plain",
        },
      });

      if (!metadataResponse.ok) {
        return [];
      }

      return this.parseMetadataXml(await metadataResponse.text());
    } catch {
      return [];
    }
  }

  private parseMetadataXml(xml: string): WordBoundaryResult {
    if (!xml.trim()) {
      return [];
    }

    if (typeof DOMParser !== "undefined") {
      try {
        const document = new DOMParser().parseFromString(xml, "application/xml");
        const words = Array.from(document.getElementsByTagName("word"));
        const parsed = words
          .map((word) =>
            this.createWordBoundary(
              word.getAttribute("name"),
              word.getAttribute("start"),
              word.getAttribute("end")
            )
          )
          .filter((word): word is { text: string; offset: number; duration: number } =>
            Boolean(word)
          );

        if (parsed.length > 0) {
          return this.fillMissingDurations(parsed);
        }
      } catch {
        return [];
      }
    }

    const wordBoundaries: WordBoundaryResult = [];
    const wordTagRegex = /<word\b([^>]*)\/?>/gi;
    let wordMatch: RegExpExecArray | null = wordTagRegex.exec(xml);

    while (wordMatch !== null) {
      const attributes = this.parseXmlAttributes(wordMatch[1]);
      const boundary = this.createWordBoundary(attributes.name, attributes.start, attributes.end);
      if (boundary) {
        wordBoundaries.push(boundary);
      }
      wordMatch = wordTagRegex.exec(xml);
    }

    return this.fillMissingDurations(wordBoundaries);
  }

  private fillMissingDurations(wordBoundaries: WordBoundaryResult): WordBoundaryResult {
    return wordBoundaries.map((boundary, index) => {
      if (boundary.duration > 0) {
        return boundary;
      }

      const next = wordBoundaries[index + 1];
      const fallbackDuration = next ? Math.max(next.offset - boundary.offset, 0) : 5000;

      return {
        ...boundary,
        duration: fallbackDuration,
      };
    });
  }

  private parseXmlAttributes(attributeText: string): Record<string, string> {
    const attributes: Record<string, string> = {};
    const attrRegex = /([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let attrMatch: RegExpExecArray | null = attrRegex.exec(attributeText);

    while (attrMatch !== null) {
      attributes[attrMatch[1]] = this.decodeXmlEntities(attrMatch[2] ?? attrMatch[3] ?? "");
      attrMatch = attrRegex.exec(attributeText);
    }

    return attributes;
  }

  private createWordBoundary(
    name: string | null | undefined,
    start: string | null | undefined,
    end: string | null | undefined
  ): { text: string; offset: number; duration: number } | null {
    if (!name || start === undefined || start === null || end === undefined || end === null) {
      return null;
    }

    const startSeconds = Number(start);
    const endSeconds = Number(end);
    if (
      !Number.isFinite(startSeconds) ||
      !Number.isFinite(endSeconds) ||
      endSeconds < startSeconds
    ) {
      return null;
    }

    return {
      text: name,
      offset: Math.round(startSeconds * 10000),
      duration: Math.round((endSeconds - startSeconds) * 10000),
    };
  }

  private async fetchWithAuth(
    url: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: string | ArrayBuffer | Uint8Array;
    } = {},
    retry = true
  ) {
    const token = await this.ensureAccessToken();
    const response = await getFetch()(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401 && retry) {
      const refreshedToken = await this.ensureAccessToken(true);
      return getFetch()(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${refreshedToken}`,
        },
      });
    }

    return response;
  }

  private async ensureAccessToken(forceRefresh = false): Promise<string> {
    if (!forceRefresh && this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    if (this.refreshToken) {
      try {
        await this.refreshAccessToken();
        return this.accessToken;
      } catch {
        if (!this.email || !this.password) {
          throw new Error("CereVoice refresh token is invalid or expired");
        }
      }
    }

    if (!this.email || !this.password) {
      throw new Error("CereVoice email and password are required for authentication");
    }

    await this.login();
    return this.accessToken;
  }

  private async login(): Promise<void> {
    const response = await getFetch()(this.buildUrl("/auth"), {
      method: "GET",
      headers: {
        Authorization: `Basic ${this.encodeBasicCredentials(`${this.email}:${this.password}`)}`,
      },
    });

    if (!response.ok) {
      const errorText = await this.safeReadErrorText(response);
      throw new Error(
        `CereVoice auth error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`
      );
    }

    const data = (await response.json()) as { access_token?: string; refresh_token?: string };
    if (!data.access_token) {
      throw new Error("CereVoice auth response did not include an access token");
    }

    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token || this.refreshToken;
    this.tokenExpiresAt = Date.now() + TOKEN_LIFETIME_MS - TOKEN_EXPIRY_BUFFER_MS;
  }

  private async refreshAccessToken(): Promise<void> {
    const response = await getFetch()(
      this.buildUrl("/auth/refresh", { refresh_token: this.refreshToken }),
      {
        method: "GET",
      }
    );

    if (!response.ok) {
      const errorText = await this.safeReadErrorText(response);
      throw new Error(
        `CereVoice refresh error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`
      );
    }

    const data = (await response.json()) as { access_token?: string };
    if (!data.access_token) {
      throw new Error("CereVoice refresh response did not include an access token");
    }

    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + TOKEN_LIFETIME_MS - TOKEN_EXPIRY_BUFFER_MS;
  }

  private buildUrl(
    path: string,
    params: Record<string, string | number | boolean | undefined> = {}
  ): string {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  private resolveAudioFormat(options: CereVoiceTTSOptions): "wav" | "mp3" | "ogg" {
    const requested = options.audioFormat || options.format || this.audioFormat;
    return this.isSupportedAudioFormat(requested) ? requested : this.audioFormat;
  }

  private isSupportedAudioFormat(value: unknown): value is "wav" | "mp3" | "ogg" {
    return typeof value === "string" && SUPPORTED_AUDIO_FORMATS.has(value);
  }

  private acceptHeaderForFormat(format: "wav" | "mp3" | "ogg"): string {
    switch (format) {
      case "mp3":
        return "audio/mpeg";
      case "ogg":
        return "audio/ogg";
      case "wav":
      default:
        return "audio/wav";
    }
  }

  private mapGender(gender: string | undefined): "Male" | "Female" | "Unknown" {
    const normalized = gender?.toLowerCase();
    if (normalized === "male") {
      return "Male";
    }
    if (normalized === "female") {
      return "Female";
    }
    return "Unknown";
  }

  private isXmlLike(text: string): boolean {
    return /^\s*(<\?xml|<speak\b|<doc\b|<[A-Za-z][\w:.-]*(\s|>|\/>))/i.test(text);
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  private decodeXmlEntities(text: string): string {
    return text
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&gt;/g, ">")
      .replace(/&lt;/g, "<")
      .replace(/&amp;/g, "&");
  }

  private getHeader(headers: Headers | undefined, name: string): string | null {
    if (!headers) {
      return null;
    }

    if (typeof headers.get === "function") {
      return headers.get(name) || headers.get(name.toLowerCase());
    }

    const record = headers as unknown as Record<string, string | undefined>;
    return record[name] || record[name.toLowerCase()] || null;
  }

  private encodeBasicCredentials(value: string): string {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(value, "utf8").toString("base64");
    }

    const bytes = new TextEncoder().encode(value);
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }

    return btoa(binary);
  }

  private async safeReadErrorText(response: { text(): Promise<string> }): Promise<string> {
    try {
      return await response.text();
    } catch {
      return "";
    }
  }
}
