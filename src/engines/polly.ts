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
  format?: 'mp3' | 'wav' | 'ogg'; // Define formats supported by this client logic
  filePath?: string; // Path to save the file (if provided, it's for file saving, not playback)
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

    // Set the default sample rate for PCM format to match the Python implementation
    // The Python implementation uses wav.setparams((1, 2, 16000, 0, "NONE", "NONE"))
    this.sampleRate = 16000; // Default sample rate for Polly PCM format

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
   * Check if a voice is a neural voice
   * @param voiceId Voice ID to check
   * @returns True if the voice is a neural voice
   */
  private async isNeuralVoice(voiceId?: string): Promise<boolean> {
    // If no voice ID is provided, use the current voice
    const voice = voiceId || this.voiceId || "";

    // If the voice name includes "Neural", it's definitely a neural voice
    if (voice.includes("Neural")) {
      return true;
    }

    try {
      // Get the raw voices from Polly to check the SupportedEngines property
      const rawVoices = await this._getVoices();
      const voiceDetails = rawVoices.find(v => v.Id === voice);

      // Check if the voice supports the neural engine and we're using the neural engine
      return voiceDetails?.SupportedEngines?.includes("neural") || false;
    } catch (error) {
      console.warn(`Error checking if voice ${voice} is neural:`, error);
      // Default to false if we can't determine
      return false;
    }
  }

  /**
   * Prepare SSML for AWS Polly
   * @param text Text or SSML to prepare
   * @param options Synthesis options
   * @returns Promise resolving to prepared SSML or plain text
   */
  private async prepareSSML(text: string, options?: SpeakOptions): Promise<string> {
    // Get the voice ID from options or the current voice
    const voiceId = options?.voice || this.voiceId || "";

    // Convert from Speech Markdown if requested
    if (options?.useSpeechMarkdown && SpeechMarkdown.isSpeechMarkdown(text)) {
      const ssmlText = SpeechMarkdown.toSSML(text, "amazon-polly");
      text = ssmlText;
    }

    // Check if the voice is neural
    const isNeural = await this.isNeuralVoice(voiceId);

    // If using a neural voice and the text is SSML, strip SSML tags
    // Neural voices don't support SSML
    if (isNeural && this._isSSML(text)) {
      console.warn(`Voice ${voiceId} is a neural voice and doesn't support SSML. Stripping SSML tags.`);
      return this._stripSSML(text);
    }

    // If text is not SSML, wrap it in speak tags
    if (!this._isSSML(text)) {
      text = `<speak>${text}</speak>`;
      return text;
    }

    // Fix common SSML issues for Polly (only for non-neural voices)
    if (!isNeural) {
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

      // Determine the output format
      // For Polly, we always request PCM for WAV (so we can add the header)
      // and MP3/OGG directly for those formats
      const requestedFormat = options?.format || "wav";
      let outputFormat;

      if (requestedFormat === "mp3") {
        // Request MP3 directly from Polly
        outputFormat = OutputFormat.MP3;
      } else if (requestedFormat === "ogg") {
        // Request OGG directly from Polly
        outputFormat = OutputFormat.OGG_VORBIS;
      } else {
        // For WAV, request PCM and we'll add the WAV header
        outputFormat = OutputFormat.PCM;
      }

      // Get the voice ID
      const VoiceIdType = VoiceId; // Get the RUNTIME VoiceId enum/object
      const voiceIdString = options?.voice || this.voiceId || "Joanna";
      const voiceId = voiceIdString as unknown as typeof VoiceIdType; // Cast using the runtime type

      // Prepare text or SSML
      const preparedText = await this.prepareSSML(text, options);

      // Determine if the prepared text is SSML
      const isSSML = this._isSSML(preparedText);

      // Determine the engine to use based on the voice
      // Standard voices: Geraint, Raveena, Aditi, etc.
      // Neural voices: Joanna, Matthew, Lupe, etc.
      const standardVoices = ['Geraint', 'Raveena', 'Aditi', 'Carmen', 'Maxim', 'Tatyana', 'Conchita', 'Enrique', 'Russell', 'Nicole', 'Amy', 'Brian', 'Emma', 'Gwyneth', 'Raveena', 'Ivy', 'Joanna', 'Kendra', 'Kimberly', 'Salli', 'Joey', 'Justin', 'Matthew'];
      const engine = standardVoices.includes(voiceIdString) ? "standard" : "neural";

      // Create input parameters
      const input: SynthesizeSpeechCommandInput = {
        Text: preparedText,
        TextType: isSSML ? "ssml" : "text",
        OutputFormat: outputFormat,
        VoiceId: voiceId,
        Engine: engine, // Use standard engine for standard voices, neural for neural voices
        // Set sample rate based on format
        // For PCM, always use 16000 Hz to match the Python implementation
        // For MP3 and OGG, use 24000 Hz for better quality
        SampleRate: outputFormat === OutputFormat.PCM ? "16000" : "24000",
      };

      // We use a fixed sample rate of 4000 Hz for playback
      // This is set in the constructor and doesn't need to be updated here

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
      const audioData = new Uint8Array(arrayBuffer);

      // If we requested WAV format but got PCM data, add a WAV header
      if (options?.format === "wav" && outputFormat === OutputFormat.PCM) {
        // Determine if this is for playback or file saving
        const isForPlayback = !options?.filePath; // If no filePath, it's for playback

        // Add the WAV header with the appropriate sample rate
        // For playback, we use a much lower sample rate (4000 Hz)
        // For file saving, we use the actual sample rate (16000 Hz)
        return this.addWavHeader(audioData, 16000, isForPlayback);
      }

      return audioData;
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

      // Prepare text or SSML
      const preparedText = await this.prepareSSML(text, options);

      // Determine if the prepared text is SSML
      const textType = this._isSSML(preparedText) ? "ssml" : "text";

      // Determine the engine to use based on the voice
      // Standard voices: Geraint, Raveena, Aditi, etc.
      // Neural voices: Joanna, Matthew, Lupe, etc.
      const standardVoices = ['Geraint', 'Raveena', 'Aditi', 'Carmen', 'Maxim', 'Tatyana', 'Conchita', 'Enrique', 'Russell', 'Nicole', 'Amy', 'Brian', 'Emma', 'Gwyneth', 'Raveena', 'Ivy', 'Joanna', 'Kendra', 'Kimberly', 'Salli', 'Joey', 'Justin', 'Matthew'];
      const engine = standardVoices.includes(voiceId) ? "standard" : "neural";

      let wordBoundaries: Array<{ text: string; offset: number; duration: number }> = [];

      // Request Speech Marks (JSON)
      try {
        const marksParams: typeof SynthesizeSpeechCommandInput = {
          Text: preparedText,
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

      // Request Audio Stream (PCM/MP3/OGG)
      // For Polly, we always request PCM for WAV (so we can add the header)
      // and MP3/OGG directly for those formats
      const requestedFormat = options?.format || "wav";
      let outputFormat;

      if (requestedFormat === "mp3") {
        // Request MP3 directly from Polly
        outputFormat = OutputFormat.MP3;
      } else if (requestedFormat === "ogg") {
        // Request OGG directly from Polly
        outputFormat = OutputFormat.OGG_VORBIS;
      } else {
        // For WAV, request PCM and we'll add the WAV header
        outputFormat = OutputFormat.PCM;
      }
      const audioParams: typeof SynthesizeSpeechCommandInput = {
        Text: preparedText,
        VoiceId: voiceId, // Use the same casted voiceId
        OutputFormat: outputFormat,
        TextType: textType,
        Engine: engine,
        // Set sample rate based on format
        // For PCM, always use 16000 Hz to match the Python implementation
        // For MP3 and OGG, use 24000 Hz for better quality
        SampleRate: outputFormat === OutputFormat.PCM ? "16000" : "24000",
      };

      // We use a fixed sample rate of 4000 Hz for playback
      // This is set in the constructor and doesn't need to be updated here

      try {
        const audioCommand = new SynthesizeSpeechCommand(audioParams);
        const audioResponse: SynthesizeSpeechCommandOutput = await this.client.send(audioCommand);

        if (!audioResponse.AudioStream) {
          throw new Error("No AudioStream received from Polly for audio data");
        }

        // Get the audio stream
        let audioStream = audioResponse.AudioStream as ReadableStream<Uint8Array>;

        // If we requested WAV format but got PCM data, add a WAV header
        if (requestedFormat === "wav" && outputFormat === OutputFormat.PCM) {
          // For streaming, we'll need to convert the entire stream to a buffer first,
          // add the WAV header, and then create a new stream
          try {
            // For streaming, we're always doing playback
            const isForPlayback = true;

            // Convert the stream to a buffer
            const streamData = await streamToBuffer(audioResponse.AudioStream as any);

            // Add WAV header to the PCM data with a fixed sample rate of 4000 Hz for playback
            // This compensates for the sound-play library playing Polly audio too fast
            const wavData = this.addWavHeader(new Uint8Array(streamData), 16000, isForPlayback);

            // Create a new ReadableStream from the WAV data
            audioStream = new ReadableStream({
              start(controller) {
                controller.enqueue(wavData);
                controller.close();
              }
            });
          } catch (error) {
            console.error("Error adding WAV header to PCM stream:", error);
            // Fall back to the original stream if there's an error
          }
        }

        // Return combined result
        return {
          audioStream: audioStream,
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
   * Strip SSML tags from text
   * @param text Text with SSML tags
   * @returns Plain text without SSML tags
   */
  protected _stripSSML(text: string): string {
    // If text is not SSML, return as is
    if (!this._isSSML(text)) {
      return text;
    }

    // Remove all XML tags
    let plainText = text.replace(/<[^>]+>/g, "");

    // Decode XML entities
    plainText = plainText.replace(/&lt;/g, "<");
    plainText = plainText.replace(/&gt;/g, ">");
    plainText = plainText.replace(/&amp;/g, "&");
    plainText = plainText.replace(/&quot;/g, '"');
    plainText = plainText.replace(/&apos;/g, "'");

    // Remove extra whitespace
    plainText = plainText.replace(/\s+/g, " ").trim();

    return plainText;
  }

  /**
   * Add a WAV header to PCM audio data
   * This matches the Python implementation using wave.setparams((1, 2, 16000, 0, "NONE", "NONE"))
   * @param pcmData PCM audio data from AWS Polly (signed 16-bit, 1 channel, little-endian)
   * @param sampleRate Sample rate in Hz (default: 16000)
   * @returns PCM audio data with WAV header
   */
  private addWavHeader(pcmData: Uint8Array, sampleRate: number = 16000, _isForPlayback: boolean = false): Uint8Array {
    // Always use 16000 Hz for Polly PCM data to match the Python implementation
    // The Python implementation uses wav.setparams((1, 2, 16000, 0, "NONE", "NONE"))
    sampleRate = 16000;

    // WAV header is 44 bytes
    const headerSize = 44;
    const wavData = new Uint8Array(headerSize + pcmData.length);

    // Set up WAV header
    // "RIFF" chunk descriptor
    wavData[0] = 0x52; // 'R'
    wavData[1] = 0x49; // 'I'
    wavData[2] = 0x46; // 'F'
    wavData[3] = 0x46; // 'F'

    // Chunk size (file size - 8)
    const fileSize = pcmData.length + headerSize - 8;
    wavData[4] = fileSize & 0xFF;
    wavData[5] = (fileSize >> 8) & 0xFF;
    wavData[6] = (fileSize >> 16) & 0xFF;
    wavData[7] = (fileSize >> 24) & 0xFF;

    // "WAVE" format
    wavData[8] = 0x57; // 'W'
    wavData[9] = 0x41; // 'A'
    wavData[10] = 0x56; // 'V'
    wavData[11] = 0x45; // 'E'

    // "fmt " sub-chunk
    wavData[12] = 0x66; // 'f'
    wavData[13] = 0x6D; // 'm'
    wavData[14] = 0x74; // 't'
    wavData[15] = 0x20; // ' '

    // Sub-chunk size (16 for PCM)
    wavData[16] = 16;
    wavData[17] = 0;
    wavData[18] = 0;
    wavData[19] = 0;

    // Audio format (1 for PCM)
    wavData[20] = 1;
    wavData[21] = 0;

    // Number of channels (1 for mono)
    wavData[22] = 1;
    wavData[23] = 0;

    // Sample rate (always 16000 Hz for Polly PCM)
    wavData[24] = sampleRate & 0xFF;
    wavData[25] = (sampleRate >> 8) & 0xFF;
    wavData[26] = (sampleRate >> 16) & 0xFF;
    wavData[27] = (sampleRate >> 24) & 0xFF;

    // Byte rate (SampleRate * NumChannels * BitsPerSample/8)
    const byteRate = sampleRate * 1 * 16 / 8;
    wavData[28] = byteRate & 0xFF;
    wavData[29] = (byteRate >> 8) & 0xFF;
    wavData[30] = (byteRate >> 16) & 0xFF;
    wavData[31] = (byteRate >> 24) & 0xFF;

    // Block align (NumChannels * BitsPerSample/8)
    wavData[32] = 2; // 1 * 16 / 8
    wavData[33] = 0;

    // Bits per sample
    wavData[34] = 16;
    wavData[35] = 0;

    // "data" sub-chunk
    wavData[36] = 0x64; // 'd'
    wavData[37] = 0x61; // 'a'
    wavData[38] = 0x74; // 't'
    wavData[39] = 0x61; // 'a'

    // Sub-chunk size (data size)
    wavData[40] = pcmData.length & 0xFF;
    wavData[41] = (pcmData.length >> 8) & 0xFF;
    wavData[42] = (pcmData.length >> 16) & 0xFF;
    wavData[43] = (pcmData.length >> 24) & 0xFF;

    // Copy PCM data after header
    wavData.set(pcmData, headerSize);

    return wavData;
  }

  /**
   * Check if credentials are valid
   * @returns Promise resolving to true if credentials are valid
   */
  async checkCredentials(): Promise<boolean> {
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
