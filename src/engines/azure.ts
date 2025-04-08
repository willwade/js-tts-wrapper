import { AbstractTTSClient } from "../core/abstract-tts";
import * as SSMLUtils from "../core/ssml-utils";
import * as SpeechMarkdown from "../markdown/converter";
import type { SpeakOptions, UnifiedVoice, WordBoundaryCallback } from "../types";

/**
 * Azure TTS Client
 */
export class AzureTTSClient extends AbstractTTSClient {
  private subscriptionKey: string;
  private region: string;

  /**
   * Create a new Azure TTS client
   * @param credentials Azure credentials object with subscriptionKey and region
   */
  constructor(credentials: { subscriptionKey: string; region: string }) {
    super(credentials);
    this.subscriptionKey = credentials.subscriptionKey;
    this.region = credentials.region;
  }

  /**
   * Get raw voices from Azure
   * @returns Promise resolving to an array of unified voice objects
   */
  protected async _getVoices(): Promise<UnifiedVoice[]> {
    try {
      const response = await fetch(
        `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/voices/list`,
        {
          method: "GET",
          headers: {
            "Ocp-Apim-Subscription-Key": this.subscriptionKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.statusText}`);
      }

      const voices = await response.json();

      // Transform Azure voices to unified format
      return voices.map((voice: any) => ({
        id: voice.ShortName,
        name: voice.DisplayName,
        gender: voice.Gender === "Female" ? "Female" : voice.Gender === "Male" ? "Male" : "Unknown",
        provider: "azure",
        languageCodes: [
          {
            bcp47: voice.Locale,
            iso639_3: this.bcp47ToIso639_3(voice.Locale),
            display: voice.LocaleName,
          },
        ],
      }));
    } catch (error) {
      console.error("Error fetching Azure voices:", error);
      return [];
    }
  }

  /**
   * Synthesize text to audio bytes
   * @param text Text or SSML to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to audio bytes
   */
  async synthToBytes(text: string, options?: SpeakOptions): Promise<Uint8Array> {
    const ssml = this.prepareSSML(text, options);

    try {
      const response = await fetch(
        `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`,
        {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": this.subscriptionKey,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat":
              options?.format === "mp3"
                ? "audio-24khz-96kbitrate-mono-mp3"
                : "riff-24khz-16bit-mono-pcm",
            "User-Agent": "js-tts-wrapper",
          },
          body: ssml,
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to synthesize speech: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      console.error("Error synthesizing speech:", error);
      throw error;
    }
  }

  /**
   * Synthesize text to a byte stream
   * @param text Text or SSML to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to a readable stream of audio bytes
   */
  async synthToBytestream(
    text: string,
    options?: SpeakOptions
  ): Promise<ReadableStream<Uint8Array>> {
    const ssml = this.prepareSSML(text, options);

    try {
      const response = await fetch(
        `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`,
        {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": this.subscriptionKey,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat":
              options?.format === "mp3"
                ? "audio-24khz-96kbitrate-mono-mp3"
                : "riff-24khz-16bit-mono-pcm",
            "User-Agent": "js-tts-wrapper",
          },
          body: ssml,
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to synthesize speech: ${response.statusText}`);
      }

      // Return the response body as a stream
      return response.body as ReadableStream<Uint8Array>;
    } catch (error) {
      console.error("Error synthesizing speech stream:", error);
      throw error;
    }
  }

  /**
   * Start playback with word boundary callbacks
   * @param text Text or SSML to speak
   * @param callback Callback function for word boundaries
   * @param options Synthesis options
   */
  async startPlaybackWithCallbacks(
    text: string,
    callback: WordBoundaryCallback,
    options?: SpeakOptions
  ): Promise<void> {
    // This is a simplified implementation
    // A full implementation would use the Azure Speech SDK to get word boundary events
    await super.startPlaybackWithCallbacks(text, callback, options);
  }

  /**
   * Prepare SSML for synthesis
   * @param text Text or SSML to prepare
   * @param options Synthesis options
   * @returns SSML ready for synthesis
   */
  private prepareSSML(text: string, options?: SpeakOptions): string {
    // Convert from Speech Markdown if requested
    if (options?.useSpeechMarkdown && SpeechMarkdown.isSpeechMarkdown(text)) {
      text = SpeechMarkdown.toSSML(text, 'microsoft-azure');
    }

    // Ensure text is wrapped in SSML
    let ssml = SSMLUtils.isSSML(text) ? text : SSMLUtils.wrapWithSpeakTags(text);

    // Add voice selection if a voice is set
    if (this.voiceId) {
      // Insert voice tag after <speak> tag
      ssml = ssml.replace(
        "<speak",
        `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${this.lang}"`
      );

      // Insert voice tag before the content
      ssml = ssml.replace(">", `><voice name="${this.voiceId}">`);

      // Close voice tag before </speak>
      ssml = ssml.replace("</speak>", "</voice></speak>");
    }

    // Add prosody if properties are set
    if (this.properties.rate || this.properties.pitch || this.properties.volume) {
      // Extract content between voice tags or speak tags
      let content = "";
      if (ssml.includes("<voice")) {
        const match = ssml.match(/<voice[^>]*>(.*?)<\/voice>/s);
        if (match) {
          content = match[1];
          const prosodyContent = this.constructProsodyTag(content);
          ssml = ssml.replace(content, prosodyContent);
        }
      } else {
        const match = ssml.match(/<speak[^>]*>(.*?)<\/speak>/s);
        if (match) {
          content = match[1];
          const prosodyContent = this.constructProsodyTag(content);
          ssml = ssml.replace(content, prosodyContent);
        }
      }
    }

    // Also add prosody from options if provided
    if (options?.rate || options?.pitch || options?.volume !== undefined) {
      // Create prosody attributes
      const attrs: string[] = [];
      if (options.rate) attrs.push(`rate="${options.rate}"`);
      if (options.pitch) attrs.push(`pitch="${options.pitch}"`);
      if (options.volume !== undefined) attrs.push(`volume="${options.volume}%"`);

      if (attrs.length > 0) {
        // Extract content
        const match = ssml.match(/<speak[^>]*>(.*?)<\/speak>/s);
        if (match) {
          const content = match[1];
          const prosodyContent = `<prosody ${attrs.join(" ")}>${content}</prosody>`;
          ssml = ssml.replace(content, prosodyContent);
        }
      }
    }

    return ssml;
  }

  /**
   * Convert BCP-47 language code to ISO 639-3
   * @param bcp47 BCP-47 language code
   * @returns ISO 639-3 language code
   */
  private bcp47ToIso639_3(bcp47: string): string {
    // This is a simplified mapping
    // A full implementation would use a complete mapping table
    const map: Record<string, string> = {
      en: "eng",
      fr: "fra",
      es: "spa",
      de: "deu",
      it: "ita",
      ja: "jpn",
      ko: "kor",
      pt: "por",
      ru: "rus",
      zh: "zho",
    };

    const lang = bcp47.split("-")[0].toLowerCase();
    return map[lang] || "und"; // 'und' for undefined
  }
}
