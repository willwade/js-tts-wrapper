import { AbstractTTSClient } from "../core/abstract-tts";
import type {
  SpeakOptions,
  TTSCredentials,
  UnifiedVoice,
} from "../types";
import * as SpeechMarkdown from "../markdown/converter";
import type { SynthesizeSpeechCommandInput, SynthesizeSpeechCommandOutput } from "@aws-sdk/client-polly";
import { streamToBuffer } from "../utils/stream-utils";

/**
 * Extended options for Polly TTS
 */
export interface PollyTTSOptions extends SpeakOptions {
  format?: 'mp3' | 'wav'; // Define formats supported by this client logic (maps to pcm)
}

/**
 * AWS Polly TTS credentials
 */
export interface PollyTTSCredentials extends TTSCredentials {
  /**
   * AWS region
   */
  region: string;

  /**
   * AWS access key ID
   */
  accessKeyId: string;

  /**
   * AWS secret access key
   */
  secretAccessKey: string;
}

/**
 * AWS Polly TTS client
 */
export class PollyTTSClient extends AbstractTTSClient {
  /**
   * AWS Polly client
   */
  private client: any; // PollyClient type is only available at runtime in Node
  private _pollyModule: any;

  /**
   * Create a new AWS Polly TTS client
   * @param credentials AWS credentials
   */
  constructor(credentials: PollyTTSCredentials) {
    super(credentials);

    if (typeof window !== "undefined") {
      throw new Error("AWS Polly is not supported in the browser. Use synthToBytes or synthToBytestream if available.");
    }
    try {
      // Do not import here, only store credentials. Actual import is done in each async method.
      this._pollyModule = null;
      this.client = null;
      this.credentials = credentials;
    } catch (error) {
      console.error("Error initializing AWS Polly client:", error);
      console.warn(
        "AWS Polly TTS will not be available. Make sure you have valid AWS credentials."
      );
    }
  }

  /**
   * Get available voices from the provider
   * @returns Promise resolving to an array of voice objects
   */
  protected async _getVoices(): Promise<any[]> {
    try {
      const pollyModule = this._pollyModule || (await import("@aws-sdk/client-polly"));
      if (!this.client) {
        const PollyClient = pollyModule.PollyClient;
        this.client = new PollyClient({
          region: this.credentials.region, // Reverted: Directly use credentials
          credentials: {
            accessKeyId: this.credentials.accessKeyId,
            secretAccessKey: this.credentials.secretAccessKey,
          },
        });
        this._pollyModule = pollyModule;
      }
      const DescribeVoicesCommand = pollyModule.DescribeVoicesCommand;
      const command = new DescribeVoicesCommand({});
      const response = await this.client.send(command);
      return response.Voices || [];
    } catch (error) {
      console.error("Error getting voices:", error);
      return [];
    }
  }

  /**
   * Map AWS Polly voice objects to unified format
   * @param rawVoices Array of AWS Polly voice objects
   * @returns Promise resolving to an array of unified voice objects
   */
  protected async _mapVoicesToUnified(rawVoices: any[]): Promise<UnifiedVoice[]> {
    return rawVoices.map((voice) => {
      // Map gender
      let gender: "Male" | "Female" | "Unknown" = "Unknown";
      if (voice.Gender === "Female") {
        gender = "Female";
      } else if (voice.Gender === "Male") {
        gender = "Male";
      }

      // Get language code
      const langCode = voice.LanguageCode || "en-US";
      
      // Create language code object
      const languageCode = {
        bcp47: langCode,
        iso639_3: langCode.split("-")[0],
        display: voice.LanguageName || langCode,
      };

      return {
        id: voice.Id,
        name: voice.Name,
        gender,
        provider: "polly",
        languageCodes: [languageCode],
      };
    });
  }

  /**
   * Prepare SSML for AWS Polly
   * @param text Text or SSML to prepare
   * @param options Synthesis options
   * @returns Prepared SSML
   */
  private prepareSSML(text: string, options?: SpeakOptions): string {
    // Convert from Speech Markdown if requested
    if (options?.useSpeechMarkdown && SpeechMarkdown.isSpeechMarkdown(text)) {
      const ssmlText = SpeechMarkdown.toSSML(text, "amazon-polly");
      text = ssmlText;
    }

    // If text is not SSML, wrap it in speak tags
    if (!this._isSSML(text)) {
      text = `<speak>${text}</speak>`;
      return text;
    }

    // Fix common SSML issues for Polly
    
    // 1. Make sure the speak tag has the correct xmlns attribute
    // Polly requires the xmlns attribute to be present
    if (!text.includes('xmlns="http://www.w3.org/2001/10/synthesis"')) {
      text = text.replace(/<speak>/i, '<speak xmlns="http://www.w3.org/2001/10/synthesis">');
    }
    
    // 2. Fix any self-closing tags that Polly doesn't support
    text = text.replace(/<break\s+([^>]+)\/>/gi, '<break $1></break>');
    
    // 3. Apply prosody settings if needed
    if (
      this.properties.rate !== "medium" ||
      this.properties.pitch !== "medium" ||
      this.properties.volume !== 100
    ) {
      // Extract the content inside the speak tags
      const speakTagMatch = /<speak[^>]*>(.*?)<\/speak>/s.exec(text);
      if (speakTagMatch && speakTagMatch[1]) {
        const content = speakTagMatch[1];
        
        // Wrap with prosody tag
        const prosodyContent = this.constructProsodyTag(content);
        
        // Put back inside speak tags with the original attributes
        const openingTag = text.substring(0, text.indexOf('>') + 1);
        text = `${openingTag}${prosodyContent}</speak>`;
      }
    }

    return text;
  }

  /**
   * Convert text to audio bytes
   * @param text Text or SSML to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to audio bytes
   */
  async synthToBytes(
    text: string,
    options?: PollyTTSOptions
  ): Promise<Uint8Array> {
    try {
      const pollyModule = this._pollyModule || (await import("@aws-sdk/client-polly"));
      if (!this.client) {
        const PollyClient = pollyModule.PollyClient;
        this.client = new PollyClient({
          region: this.credentials.region, // Reverted
          credentials: {
            accessKeyId: this.credentials.accessKeyId,
            secretAccessKey: this.credentials.secretAccessKey,
          },
        });
        this._pollyModule = pollyModule;
      }

      const { OutputFormat, SynthesizeSpeechCommand, VoiceId } = pollyModule;
      const outputFormat = options?.format === "mp3" ? OutputFormat.MP3 : OutputFormat.PCM;
      const VoiceIdType = VoiceId; // Get the RUNTIME VoiceId enum/object
      const voiceIdString = options?.voice || this.voiceId || "Joanna";
      const voiceId = voiceIdString as unknown as typeof VoiceIdType; // Cast using the runtime type
      const input: SynthesizeSpeechCommandInput = {
        Text: this.prepareSSML(text, options),
        TextType: "ssml",
        OutputFormat: outputFormat,
        VoiceId: voiceId,
        Engine: "neural", // Use neural engine for better quality
      };

      // Create the command
      const command = new SynthesizeSpeechCommand(input);
      
      // Execute the command
      const response = await this.client.send(command);
      
      // Get audio data
      if (!response.AudioStream) {
        throw new Error("No audio data returned from AWS Polly");
      }

      // Convert audio stream to Uint8Array
      const arrayBuffer = await response.AudioStream.transformToByteArray();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      console.error("Error synthesizing speech:", error);
      throw error;
    }
  }

  /**
   * Synthesize text to a byte stream with word boundaries
   * @param text Text or SSML to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to an object containing the audio stream and word boundaries
   */
  async synthToBytestream(
    text: string,
    options?: PollyTTSOptions
  ): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
  }> {
    try {
      const pollyModule = this._pollyModule || (await import("@aws-sdk/client-polly"));
      if (!this.client) {
        const PollyClient = pollyModule.PollyClient;
        this.client = new PollyClient({
          region: this.credentials.region, // Reverted
          credentials: {
            accessKeyId: this.credentials.accessKeyId,
            secretAccessKey: this.credentials.secretAccessKey,
          },
        });
        this._pollyModule = pollyModule;
      }
      const { OutputFormat, SynthesizeSpeechCommandInput, SynthesizeSpeechCommand, VoiceId, SpeechMarkType } = pollyModule;
      const VoiceIdType = VoiceId; // Get the RUNTIME VoiceId enum/object
      const voiceIdString = options?.voice || this.voiceId || "Joanna";
      const voiceId = voiceIdString as unknown as typeof VoiceIdType; // Cast via unknown
      const ssml = this.prepareSSML(text, options);
      const textType = this._isSSML(ssml) ? "ssml" : "text";
      const engine = "neural"; // Or make configurable
      let wordBoundaries: Array<{ text: string; offset: number; duration: number }> = [];

      // Request Speech Marks (JSON)
      try {
        const marksParams: typeof SynthesizeSpeechCommandInput = {
          Text: ssml,
          VoiceId: voiceId,
          OutputFormat: "json",
          SpeechMarkTypes: [SpeechMarkType.WORD],
          TextType: textType,
          Engine: engine,
        };
        const marksCommand = new SynthesizeSpeechCommand(marksParams);
        const marksResponse: SynthesizeSpeechCommandOutput = await this.client.send(marksCommand);

        if (marksResponse.AudioStream) { 
          const streamData = await streamToBuffer(marksResponse.AudioStream as any); // Use correct util
          const marksJsonString = new TextDecoder().decode(streamData); // Decode Buffer/Uint8Array
          const jsonLines = marksJsonString.trim().split("\n");
          for (const line of jsonLines) {
            try {
              const mark = JSON.parse(line);
              if (mark.type === "word") {
                wordBoundaries.push({
                  text: mark.value,
                  offset: mark.time, // Use Polly's time (ms) as offset
                  duration: 0, // Polly doesn't provide duration for word marks
                });
              }
            } catch (parseError) {
              console.warn(`Skipping invalid JSON line in speech marks: ${line}`, parseError);
            }
          }
        } else {
          console.warn("No AudioStream received from Polly for speech marks");
        }
      } catch (error) {
        console.error("Error getting speech marks from Polly:", error);
        // Don't throw here, allow audio synthesis to proceed if possible
        // Caller should check wordBoundaries array length if marks are critical
      }

      // Request Audio Stream (PCM/MP3)
      const outputFormat = options?.format === "mp3" ? OutputFormat.MP3 : OutputFormat.PCM;
      const audioParams: typeof SynthesizeSpeechCommandInput = {
        Text: ssml,
        VoiceId: voiceId, // Use the same casted voiceId
        OutputFormat: outputFormat,
        TextType: textType,
        Engine: engine,
        // Add SampleRate if needed, based on options?.sampleRateHertz
        // SampleRate: options?.sampleRateHertz ? options.sampleRateHertz.toString() : undefined,
      };

      try {
        const audioCommand = new SynthesizeSpeechCommand(audioParams);
        const audioResponse: SynthesizeSpeechCommandOutput = await this.client.send(audioCommand);

        if (!audioResponse.AudioStream) {
          throw new Error("No AudioStream received from Polly for audio data");
        }

        // Return combined result
        return {
          audioStream: audioResponse.AudioStream as ReadableStream<Uint8Array>,
          wordBoundaries: wordBoundaries,
        };
      } catch (error) {
        console.error("Error synthesizing audio stream from Polly:", error);
        throw error; // Re-throw the audio synthesis error
      }
    } catch (error) {
      console.error("Error initializing Polly client:", error);
      throw error;
    }
  }

  /**
   * Check if credentials are valid
   * @returns Promise resolving to true if credentials are valid
   */
  async checkCredentials(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const pollyModule = this._pollyModule || (await import("@aws-sdk/client-polly"));
      if (!this.client) {
        const PollyClient = pollyModule.PollyClient;
        this.client = new PollyClient({
          region: this.credentials.region,
          credentials: {
            accessKeyId: this.credentials.accessKeyId,
            secretAccessKey: this.credentials.secretAccessKey,
          },
        });
        this._pollyModule = pollyModule;
      }
      const DescribeVoicesCommand = pollyModule.DescribeVoicesCommand;
      const command = new DescribeVoicesCommand({});
      const response = await this.client.send(command);
      return Array.isArray(response.Voices) && response.Voices.length > 0;
    } catch (error) {
      console.error("Error checking AWS Polly credentials:", error);
      return false;
    }
  }
}
