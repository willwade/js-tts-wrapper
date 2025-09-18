import { AbstractTTSClient } from "../core/abstract-tts";
import * as SpeechMarkdown from "../markdown/converter";
import * as SSMLUtils from "../core/ssml-utils";
import { SpeakOptions, TTSCredentials, UnifiedVoice } from "../types";
import { estimateWordBoundaries, WordBoundary } from "../utils/word-timing-estimator";
import { getFetch } from "../utils/fetch-utils";
// Node-only imports moved inside Node-only code paths below for browser compatibility.

// Get the fetch implementation for the current environment
const fetch = getFetch();

/**
 * PlayHT TTS Client Credentials
 */
export interface PlayHTTTSCredentials extends TTSCredentials {
  /** PlayHT API Key */
  apiKey?: string;
  /** PlayHT User ID */
  userId?: string;
}

/**
 * Extended options for PlayHT TTS
 */
export interface PlayHTTTSOptions extends SpeakOptions {
  /**
   * Output directory for audio files
   */
  outputDir?: string;

  /**
   * Output file name
   */
  outputFile?: string;

  /**
   * Callback for word boundary events
   */
  onWord?: (wordBoundary: WordBoundary) => void;

  /**
   * Whether to return word boundaries
   */
  returnWordBoundaries?: boolean;

  /**
   * Callback for end of speech event
   */
  onEnd?: () => void;
}

/**
 * PlayHT Voice Engine
 */
export type PlayHTVoiceEngine = "PlayHT1.0" | "PlayHT2.0" | null;

/**
 * PlayHT TTS Client
 *
 * This client uses the PlayHT API to convert text to speech.
 * It supports streaming audio but does not support SSML.
 * Word boundaries are estimated since PlayHT doesn't provide word events.
 */
export class PlayHTTTSClient extends AbstractTTSClient {
  private apiKey: string;
  private userId: string;
  private voice: string;
  private voiceEngine: PlayHTVoiceEngine;
  private outputFormat: string;
  private lastWordBoundaries: WordBoundary[] = [];

  /**
   * Create a new PlayHT TTS Client
   * @param credentials PlayHT API credentials
   */
  constructor(credentials: PlayHTTTSCredentials = {}) {
    super(credentials);

    // Set credentials
    this.apiKey = credentials.apiKey || process.env.PLAYHT_API_KEY || "";
    this.userId = credentials.userId || process.env.PLAYHT_USER_ID || "";

    // Set default values
    this.voice = "s3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/female-cs/manifest.json";
    this.voiceEngine = "PlayHT2.0"; // Use PlayHT2.0 for cloned voices
    this.outputFormat = "mp3"; // Use MP3 as default for better compatibility
  }

  /**
   * Check if the credentials are valid
   * @returns Promise resolving to true if credentials are valid, false otherwise
   */
  async checkCredentials(): Promise<boolean> {
    if (!this.apiKey || !this.userId) {
      console.error("PlayHT API key and user ID are required");
      return false;
    }

    try {
      // Try to list voices to check if the API key is valid
      await this._fetchVoices();
      return true;
    } catch (error) {
      console.error("Error checking PlayHT credentials:", error);
      return false;
    }
  }

  /**
   * Get the list of required credential types for this engine
   * @returns Array of required credential field names
   */
  protected getRequiredCredentials(): string[] {
    return ['apiKey', 'userId'];
  }

  /**
   * Fetch voices from the PlayHT API
   * @returns Promise resolving to an array of PlayHT voice objects
   */
  private async _fetchVoices(): Promise<any[]> {
    try {
      // Fetch standard voices
      const standardResponse = await fetch("https://api.play.ht/api/v2/voices", {
        method: "GET",
        headers: {
          accept: "application/json",
          "AUTHORIZATION": this.apiKey,
          "X-USER-ID": this.userId,
        },
      });

      if (!standardResponse.ok) {
        throw new Error(`Failed to fetch PlayHT voices: ${standardResponse.statusText}`);
      }

      const standardVoices = await standardResponse.json();

      // Fetch cloned voices
      const clonedResponse = await fetch("https://api.play.ht/api/v2/cloned-voices", {
        method: "GET",
        headers: {
          accept: "application/json",
          "AUTHORIZATION": this.apiKey,
          "X-USER-ID": this.userId,
        },
      });

      if (!clonedResponse.ok) {
        throw new Error(`Failed to fetch PlayHT cloned voices: ${clonedResponse.statusText}`);
      }

      const clonedVoices = await clonedResponse.json();

      // Merge standard and cloned voices
      return [...standardVoices, ...clonedVoices];
    } catch (error) {
      console.error("Error fetching PlayHT voices:", error);
      throw error;
    }
  }

  /**
   * Get available voices
   * @returns Promise resolving to an array of unified voice objects
   */
  protected async _getVoices(): Promise<UnifiedVoice[]> {
    try {
      const rawVoices = await this._fetchVoices();
      return this._mapVoicesToUnified(rawVoices);
    } catch (error) {
      console.error("Error getting PlayHT voices:", error);
      return [];
    }
  }

  /**
   * Map PlayHT voice objects to unified format
   * @param rawVoices Array of PlayHT voice objects
   * @returns Promise resolving to an array of unified voice objects
   */
  protected async _mapVoicesToUnified(rawVoices: any[]): Promise<UnifiedVoice[]> {
    // Track seen voice IDs to handle duplicates
    const seenVoiceIds = new Set<string>();
    const unifiedVoices: UnifiedVoice[] = [];

    for (const voice of rawVoices) {
      // Create language code object
      const languageCode = {
        bcp47: voice.language_code || "en-US",
        iso639_3: voice.language_code ? voice.language_code.split("-")[0] : "eng",
        display: voice.language || "English (US)",
      };

      const voiceId = voice.id;

      // Handle duplicate voice IDs by appending a suffix
      let uniqueId = voiceId;
      if (seenVoiceIds.has(voiceId)) {
        // If this is a duplicate, append the voice name to make it unique
        uniqueId = `${voiceId}#${voice.name}`;
        console.warn(`Found duplicate voice ID: ${voiceId}. Using ${uniqueId} instead.`);
      }

      // Add the voice ID to the set of seen IDs
      seenVoiceIds.add(voiceId);

      unifiedVoices.push({
        id: uniqueId,
        name: voice.name,
        gender: (voice.gender as "Male" | "Female" | "Unknown") || "Unknown",
        provider: "playht",
        languageCodes: [languageCode],
      });
    }

    return unifiedVoices;
  }

  /**
   * Set the voice to use for synthesis
   * @param voiceId Voice ID to use
   */
  setVoice(voiceId: string): void {
    // If the voice ID contains a '#' character, it's a modified ID to handle duplicates
    // Extract the original ID (everything before the '#')
    if (voiceId.includes('#')) {
      const originalId = voiceId.split('#')[0];
      this.voice = originalId;
      console.log(`Using original voice ID: ${originalId} (from modified ID: ${voiceId})`);
    } else {
      this.voice = voiceId;
    }

    // Auto-detect voice engine based on voice ID
    this.autoDetectVoiceEngine(voiceId);
  }

  /**
   * Auto-detect voice engine based on voice ID
   * @param voiceId Voice ID to analyze
   */
  private autoDetectVoiceEngine(voiceId: string): void {
    // Extract the original voice ID if it has a '#' suffix
    const originalVoiceId = voiceId.includes('#') ? voiceId.split('#')[0] : voiceId;

    // Cloned voices (s3:// URLs) work better with PlayHT2.0
    if (originalVoiceId.startsWith('s3://')) {
      this.voiceEngine = "PlayHT2.0";
      console.log(`Auto-detected cloned voice, using PlayHT2.0 engine`);
    } else {
      // Standard voices work with PlayHT1.0
      this.voiceEngine = "PlayHT1.0";
      console.log(`Auto-detected standard voice, using PlayHT1.0 engine`);
    }
  }

  /**
   * Set the voice engine to use for synthesis
   * @param engine Voice engine to use
   */
  setVoiceEngine(engine: PlayHTVoiceEngine): void {
    this.voiceEngine = engine;
  }

  /**
   * Set the output format
   * @param format Output format (wav, mp3)
   */
  setOutputFormat(format: string): void {
    this.outputFormat = format;
  }

  /**
   * Get a property value
   * @param property Property name
   * @returns Property value
   */
  getProperty(property: string): any {
    switch (property) {
      case "voice":
        return this.voice;
      case "voiceEngine":
        return this.voiceEngine;
      case "outputFormat":
        return this.outputFormat;
      default:
        return super.getProperty(property);
    }
  }

  /**
   * Set a property value
   * @param property Property name
   * @param value Property value
   */
  setProperty(property: string, value: any): void {
    switch (property) {
      case "voice":
        this.setVoice(value);
        break;
      case "voiceEngine":
        this.setVoiceEngine(value);
        break;
      case "outputFormat":
        this.setOutputFormat(value);
        break;
      default:
        super.setProperty(property, value);
        break;
    }
  }

  /**
   * Get the last word boundaries
   * @returns Array of word boundary objects
   */
  getLastWordBoundaries(): WordBoundary[] {
    return this.lastWordBoundaries;
  }

  /**
   * Set the last word boundaries
   * @param wordBoundaries Array of word boundary objects
   */
  setLastWordBoundaries(wordBoundaries: WordBoundary[]): void {
    this.lastWordBoundaries = wordBoundaries;
  }

  /**
   * Convert text to speech
   * @param text Text to convert to speech
   * @param options TTS options
   * @returns Promise resolving to the path of the generated audio file
   */
  async textToSpeech(text: string, options: PlayHTTTSOptions = {}): Promise<string> {
    try {
      if (typeof window !== "undefined") {
        throw new Error("File output is not supported in the browser. Use synthToBytes or synthToBytestream instead.");
      }
      const dyn: any = new Function('m','return import(m)');
      const fs = await dyn('node:fs');
      const path = await dyn('node:path');
      // Create output directory if it doesn't exist
      const outputDir = options.outputDir || ".";
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      // Generate output file path
      const outputFile = options.outputFile || `playht-output.${this.outputFormat}`;
      const outputPath = path.join(outputDir, outputFile);

      // Create speech
      const response = await fetch("https://api.play.ht/api/v2/tts", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "AUTHORIZATION": this.apiKey,
          "X-USER-ID": this.userId,
        },
        body: JSON.stringify({
          text,
          voice: this.voice,
          output_format: this.outputFormat,
          voice_engine: this.voiceEngine,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to convert text to speech: ${response.statusText}`);
      }

      const data = await response.json();

      // Download the audio file
      const audioResponse = await fetch(data.url);
      if (!audioResponse.ok) {
        throw new Error(`Failed to download audio file: ${audioResponse.statusText}`);
      }

      const buffer = Buffer.from(await audioResponse.arrayBuffer());
      fs.writeFileSync(outputPath, buffer);

      // Estimate word boundaries
      if (options.onWord || options.returnWordBoundaries) {
        const wordBoundaries = estimateWordBoundaries(text);

        // Call onWord callback for each word
        if (options.onWord) {
          for (const wb of wordBoundaries) {
            options.onWord(wb);
          }
        }

        // Store word boundaries if requested
        if (options.returnWordBoundaries) {
          this.setLastWordBoundaries(wordBoundaries);
        }
      } else {
        // Always estimate word boundaries for tests
        const wordBoundaries = estimateWordBoundaries(text);
        this.setLastWordBoundaries(wordBoundaries);
      }

      // Call onEnd callback
      if (options.onEnd) {
        options.onEnd();
      }

      return outputPath;
    } catch (error) {
      console.error("Error converting text to speech:", error);
      throw error;
    }
  }

  /**
   * Convert text to speech with streaming
   * @param text Text to convert to speech
   * @param options TTS options
   * @returns Promise resolving to the path of the generated audio file
   */
  async textToSpeechStreaming(text: string, options: PlayHTTTSOptions = {}): Promise<string> {
    try {
      if (typeof window !== "undefined") {
        throw new Error("File output is not supported in the browser. Use synthToBytes or synthToBytestream instead.");
      }
      const dyn: any = new Function('m','return import(m)');
      const fs = await dyn('node:fs');
      const path = await dyn('node:path');
      // Create output directory if it doesn't exist
      const outputDir = options.outputDir || ".";
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Generate output file path
      const outputFile = options.outputFile || `playht-streaming-output.${this.outputFormat}`;
      const outputPath = path.join(outputDir, outputFile);

      // Create speech with streaming - use the regular API since the streaming API returns a WAV file directly
      const response = await fetch("https://api.play.ht/api/v2/tts", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "AUTHORIZATION": this.apiKey,
          "X-USER-ID": this.userId,
        },
        body: JSON.stringify({
          text,
          voice: this.voice,
          output_format: this.outputFormat,
          voice_engine: this.voiceEngine,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`PlayHT API error: ${response.status} ${response.statusText}\nResponse: ${errorText}`);
        throw new Error(`Failed to convert text to speech with streaming: ${response.statusText}`);
      }

      const data = await response.json();

      // Poll for the result
      const jobId = data.id;
      if (!jobId) {
        throw new Error(`PlayHT API did not return a job ID: ${JSON.stringify(data)}`);
      }

      // Get the job status URL
      const jobStatusUrl = `https://api.play.ht/api/v2/tts/${jobId}`;

      // Poll for the result
      let audioUrl = null;
      let attempts = 0;
      const maxAttempts = 30; // Maximum number of polling attempts
      const pollingInterval = 1000; // Polling interval in milliseconds

      while (!audioUrl && attempts < maxAttempts) {
        attempts++;
        console.log(`Polling for streaming result (attempt ${attempts}/${maxAttempts})...`);

        // Wait for the polling interval
        await new Promise(resolve => setTimeout(resolve, pollingInterval));

        // Get the job status
        const statusResponse = await fetch(jobStatusUrl, {
          method: "GET",
          headers: {
            accept: "application/json",
            "AUTHORIZATION": this.apiKey,
            "X-USER-ID": this.userId,
          },
        });

        if (!statusResponse.ok) {
          throw new Error(`Failed to get job status: ${statusResponse.statusText}`);
        }

        const statusData = await statusResponse.json();
        console.log(`Streaming job status: ${statusData.status}`);

        // Check if the job is completed (using multiple possible status strings and URL paths)
        const isSuccessStatus = statusData.status === "completed" || statusData.status === "complete" || statusData.status === "SUCCESS";
        let potentialUrl = null;

        if (statusData.output && statusData.output.url) {
          potentialUrl = statusData.output.url;
        } else if (statusData.metadata && statusData.metadata.output && Array.isArray(statusData.metadata.output) && statusData.metadata.output.length > 0) {
          potentialUrl = statusData.metadata.output[0];
        }

        if (isSuccessStatus && potentialUrl) {
          audioUrl = potentialUrl;
          console.log(`Streaming job finished successfully. Audio URL: ${audioUrl}`);
          break;
        }

        // Check if the job failed
        if (statusData.status === "failed") {
          throw new Error(`Streaming job failed: ${JSON.stringify(statusData)}`);
        }
      }

      if (!audioUrl) {
        throw new Error(`Timed out waiting for streaming job to complete after ${maxAttempts} attempts`);
      }

      // Download the audio file
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        throw new Error(`Failed to download streaming audio file: ${audioResponse.statusText}`);
      }

      const buffer = Buffer.from(await audioResponse.arrayBuffer());
      fs.writeFileSync(outputPath, buffer);

      // Estimate word boundaries
      if (options.onWord || options.returnWordBoundaries) {
        const wordBoundaries = estimateWordBoundaries(text);

        // Call onWord callback for each word
        if (options.onWord) {
          for (const wb of wordBoundaries) {
            options.onWord(wb);
          }
        }

        // Store word boundaries if requested
        if (options.returnWordBoundaries) {
          this.setLastWordBoundaries(wordBoundaries);
        }
      } else {
        // Always estimate word boundaries for tests
        const wordBoundaries = estimateWordBoundaries(text);
        this.setLastWordBoundaries(wordBoundaries);
      }

      // Call onEnd callback
      if (options.onEnd) {
        options.onEnd();
      }

      return outputPath;
    } catch (error) {
      console.error("Error converting text to speech with streaming:", error);
      throw error;
    }
  }

  /**
   * Convert SSML to speech (not supported by PlayHT)
   * @param ssml SSML to convert to speech
   * @param options TTS options
   * @returns Promise resolving to the path of the generated audio file
   */
  async ssmlToSpeech(_ssml: string, _options: PlayHTTTSOptions = {}): Promise<string> {
    throw new Error("SSML is not supported by PlayHT TTS");
  }

  /**
   * Convert SSML to speech with streaming (not supported by PlayHT)
   * @param ssml SSML to convert to speech
   * @param options TTS options
   * @returns Promise resolving to the path of the generated audio file
   */
  async ssmlToSpeechStreaming(_ssml: string, _options: PlayHTTTSOptions = {}): Promise<string> {
    throw new Error("SSML is not supported by PlayHT TTS");
  }

  /**
   * Synthesize text to audio and save it to a file
   * @param text Text or SSML to synthesize
   * @param filename Filename to save as
   * @param format Audio format (mp3 or wav)
   * @param options Synthesis options
   */
  async synthToFile(
    text: string,
    filename: string,
    format: "mp3" | "wav" = "mp3", // Default to MP3 for PlayHT
    options?: PlayHTTTSOptions
  ): Promise<void> {
    // PlayHT works best with MP3, so we'll always use MP3 internally
    // and warn if a different format is requested
    if (format !== "mp3") {
      console.warn(`PlayHT TTS works best with MP3 format. Converting ${format} request to MP3.`);
    }

    // Use MP3 as the native format
    const audioBytes = await this.synthToBytes(text, { ...options, format: 'mp3' });

    // Handle file saving (use requested filename but MP3 content)
    if (typeof window !== "undefined") {
      // Browser environment
      const mimeType = "audio/mpeg";
      const blob = new Blob([audioBytes], { type: mimeType });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Use the requested filename as-is (even if it has .wav extension)
      a.download = filename.endsWith(`.${format}`) ? filename : `${filename}.${format}`;

      document.body.appendChild(a);
      a.click();

      requestAnimationFrame(() => {
        if (document?.body?.contains(a)) {
          document.body.removeChild(a);
        }
        URL.revokeObjectURL(url);
      });
    } else {
      // Node.js environment
      const dyn: any = new Function('m','return import(m)');
      const fs = await dyn('node:fs');
      // Use the requested filename as-is (even if it has .wav extension)
      const outputPath = filename.endsWith(`.${format}`) ? filename : `${filename}.${format}`;
      fs.writeFileSync(outputPath, Buffer.from(audioBytes));
    }
  }

  /**
   * Synthesize text to audio bytes
   * @param text Text to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to audio bytes
   */
  async synthToBytes(text: string, options?: PlayHTTTSOptions): Promise<Buffer> {
    try {
      console.debug('PlayHT synthToBytes: Calling synthToBytestream internally...');

      // For PlayHT, we'll always use MP3 as the native format for better compatibility
      const audioStream = await this.synthToBytestream(text, options);

      if (!audioStream) {
        throw new Error('synthToBytestream returned null, cannot generate Buffer.');
      }

      console.debug('PlayHT synthToBytes: Buffering stream...');
      // Helper function to read the entire stream into a Buffer
      const streamToBuffer = async (stream: ReadableStream<Uint8Array>): Promise<Buffer> => {
        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];
        let totalLength = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          chunks.push(value);
          totalLength += value.length;
        }
        return Buffer.concat(chunks, totalLength);
      }

      const buffer = await streamToBuffer(audioStream.audioStream);
      console.debug(`PlayHT synthToBytes: Buffering complete (${buffer.length} bytes).`);
      return buffer;
    } catch (error) {
      console.error("Error in PlayHT synthToBytes (using streaming internally):", error);
      throw error; // Re-throw the error
    }
  }

  /**
   * Synthesize text to audio byte stream
   * @param text Text to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to an object containing the audio stream and an empty word boundaries array.
   */
  async synthToBytestream(text: string, _options: SpeakOptions = {}): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
  }> {
    try {
      // Prepare text for synthesis (handle Speech Markdown and SSML)
      let processedText = text;

      // Convert from Speech Markdown if requested
      if (_options?.useSpeechMarkdown && SpeechMarkdown.isSpeechMarkdown(processedText)) {
        // Convert to SSML first, then strip SSML tags since PlayHT doesn't support SSML
        const ssml = await SpeechMarkdown.toSSML(processedText);
        processedText = SSMLUtils.stripSSML(ssml);
      }

      // If text is SSML, strip the tags as PlayHT doesn't support SSML
      if (SSMLUtils.isSSML(processedText)) {
        processedText = SSMLUtils.stripSSML(processedText);
      }

      // PlayHT works best with MP3 format, especially for cloned voices
      // Use MP3 as the native format regardless of what's requested
      const nativeFormat = 'mp3';
      const acceptHeader = 'audio/mpeg';

      const response = await fetch("https://api.play.ht/api/v2/tts/stream", {
        method: "POST",
        headers: {
          'accept': acceptHeader,
          'content-type': 'application/json',
          'AUTHORIZATION': this.apiKey,
          'X-USER-ID': this.userId,
        },
        body: JSON.stringify({
          text: processedText, // Use processed text with Speech Markdown/SSML handling
          voice: this.voice,
          output_format: nativeFormat,
          voice_engine: this.voiceEngine, // Ensure this is set appropriately
          // Add other relevant options like speed, sample_rate if needed
        }),
      });

      if (!response.ok) {
        // Attempt to read error response body for more details
        let errorBody = '';
        try {
          errorBody = await response.text();
        } catch (e) { /* Ignore error reading body */ }
        console.error(`PlayHT Streaming API error: ${response.status} ${response.statusText}\nResponse Body: ${errorBody}`);
        throw new Error(`Failed to stream text to speech: ${response.status} ${response.statusText}`);
      }

      // The response body is the audio stream
      if (!response.body) {
        throw new Error('PlayHT Streaming API did not return a response body stream.');
      }

      // Return the stream along with an empty word boundaries array
      return { audioStream: response.body, wordBoundaries: [] };
    } catch (error) {
      console.error("Error converting text to speech stream:", error);
      throw error;
    }
  }
}
