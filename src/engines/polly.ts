import { AbstractTTSClient } from "../core/abstract-tts";
import * as SpeechMarkdown from "../markdown/converter";
import type { SpeakOptions, TTSCredentials, UnifiedVoice } from "../types";

// Import AWS SDK v3 Polly client
import {
  PollyClient,
  SynthesizeSpeechCommand,
  DescribeVoicesCommand,
  OutputFormat,
  SpeechMarkType,
  SynthesizeSpeechCommandInput,
  VoiceId,
} from "@aws-sdk/client-polly";

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
  private client!: PollyClient;

  /**
   * Create a new AWS Polly TTS client
   * @param credentials AWS credentials
   */
  constructor(credentials: PollyTTSCredentials) {
    super(credentials);

    try {
      // Create the Polly client
      this.client = new PollyClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
        },
      });
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
    if (!this.client) {
      return [];
    }

    try {
      // Create the command to describe voices
      const command = new DescribeVoicesCommand({});
      
      // Execute the command
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
  async synthToBytes(text: string, options?: SpeakOptions): Promise<Uint8Array> {
    if (!this.client) {
      throw new Error(
        "AWS Polly client is not available. Make sure you have valid AWS credentials."
      );
    }

    try {
      // Prepare SSML
      const ssml = this.prepareSSML(text, options);

      // Determine output format
      const outputFormat = options?.format === "mp3" ? OutputFormat.MP3 : OutputFormat.PCM;

      // Use voice from options or the default voice
      const voiceId = (options?.voice || this.voiceId || "Joanna") as VoiceId; // Default voice

      // Prepare the command input
      const input: SynthesizeSpeechCommandInput = {
        Text: ssml,
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
   * @returns Promise resolving to a readable stream of audio bytes with word boundaries
   */
  async synthToBytestream(
    text: string,
    options?: SpeakOptions
  ): Promise<
    | ReadableStream<Uint8Array>
    | {
        audioStream: ReadableStream<Uint8Array>;
        wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
      }
  > {
    if (!this.client) {
      throw new Error(
        "AWS Polly client is not available. Make sure you have valid AWS credentials."
      );
    }

    try {
      // Check if word boundary information is requested
      const useWordBoundary = options?.useWordBoundary !== false;

      if (useWordBoundary) {
        // First, get the audio
        const audioBytes = await this.synthToBytes(text, options);
        
        // Then, get the speech marks for word boundaries
        const wordBoundaries = await this.getSpeechMarks(text, options);
        
        // Create a readable stream from the audio bytes
        const audioStream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(audioBytes);
            controller.close();
          },
        });

        // Return both the audio stream and word boundaries
        return {
          audioStream,
          wordBoundaries,
        };
      } else {
        // If word boundaries are not needed, just return the audio as a stream
        const audioBytes = await this.synthToBytes(text, options);
        
        // Create a readable stream from the audio bytes
        return new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(audioBytes);
            controller.close();
          },
        });
      }
    } catch (error) {
      console.error("Error synthesizing speech stream:", error);
      throw error;
    }
  }

  /**
   * Get speech marks (word boundaries) for text
   * @param inputText Text or SSML to get speech marks for
   * @param options Synthesis options
   * @returns Promise resolving to an array of word boundaries
   */
  private async getSpeechMarks(
    inputText: string,
    options?: SpeakOptions
  ): Promise<Array<{ text: string; offset: number; duration: number }>> {
    // Prepare SSML
    const ssml = this.prepareSSML(inputText, options);

    // Use voice from options or the default voice
    const voiceId = (options?.voice || this.voiceId || "Joanna") as VoiceId; // Default voice

    // Prepare the command input for speech marks
    const input: SynthesizeSpeechCommandInput = {
      Text: ssml,
      TextType: "ssml",
      OutputFormat: OutputFormat.JSON,
      VoiceId: voiceId,
      Engine: "neural", // Use neural engine for better quality
      SpeechMarkTypes: [SpeechMarkType.WORD],
    };

    // Create the command
    const command = new SynthesizeSpeechCommand(input);
    
    // Execute the command
    const response = await this.client.send(command);
    
    // Get speech marks data
    if (!response.AudioStream) {
      return [];
    }

    // Convert audio stream to string
    const arrayBuffer = await response.AudioStream.transformToByteArray();
    const buffer = new Uint8Array(arrayBuffer);
    
    // Convert buffer to string
    const content = new TextDecoder().decode(buffer);
    
    // Parse speech marks (each line is a JSON object)
    const speechMarks = content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
    
    // Convert to our format
    return speechMarks.map((mark) => ({
      text: mark.value,
      offset: mark.time,
      duration: mark.end ? mark.end - mark.time : 0, // Some marks might not have end time
    }));
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
      // Try to list voices as a simple API call to check credentials
      const command = new DescribeVoicesCommand({});
      const response = await this.client.send(command);
      
      return Array.isArray(response.Voices) && response.Voices.length > 0;
    } catch (error) {
      console.error("Error checking AWS Polly credentials:", error);
      return false;
    }
  }
}
