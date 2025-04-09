import { AbstractTTSClient } from "../core/abstract-tts";
import { SpeakOptions, TTSCredentials, UnifiedVoice } from "../types";
import { estimateWordBoundaries, WordBoundary } from "../utils/word-timing-estimator";
import { getFetch } from "../utils/fetch-utils";
import * as fs from "node:fs";
import * as path from "node:path";

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
    this.voiceEngine = "PlayHT1.0";
    this.outputFormat = "wav";
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
    return rawVoices.map((voice) => {
      // Create language code object
      const languageCode = {
        bcp47: voice.language_code || "en-US",
        iso639_3: voice.language_code ? voice.language_code.split("-")[0] : "eng",
        display: voice.language || "English (US)",
      };

      return {
        id: voice.id,
        name: voice.name,
        gender: (voice.gender as "Male" | "Female" | "Unknown") || "Unknown",
        provider: "playht",
        languageCodes: [languageCode],
      };
    });
  }

  /**
   * Set the voice to use for synthesis
   * @param voiceId Voice ID to use
   */
  setVoice(voiceId: string): void {
    this.voice = voiceId;
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
      console.log('PlayHT API streaming response:', JSON.stringify(data, null, 2));

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

        // Check if the job is completed
        if ((statusData.status === "completed" || statusData.status === "complete") && statusData.output && statusData.output.url) {
          audioUrl = statusData.output.url;
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

      // Get the audio data
      const audioBuffer = await audioResponse.arrayBuffer();

      // Create a writable stream to the output file
      const writer = fs.createWriteStream(outputPath);

      // Write the audio data to the file
      writer.write(Buffer.from(audioBuffer));

      // Close the writer
      writer.end();

      // Wait for the file to be written
      await new Promise<void>((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

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
   * Synthesize text to audio bytes
   * @param text Text to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to audio bytes
   */
  async synthToBytes(text: string | string[], _options: PlayHTTTSOptions = {}): Promise<Uint8Array> {
    try {
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
          text: typeof text === 'string' ? text : text.join(' '),
          voice: this.voice,
          output_format: this.outputFormat,
          voice_engine: this.voiceEngine,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`PlayHT API error: ${response.status} ${response.statusText}\nResponse: ${errorText}`);
        throw new Error(`Failed to convert text to speech: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('PlayHT API response:', JSON.stringify(data, null, 2));

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
        console.log(`Polling for result (attempt ${attempts}/${maxAttempts})...`);

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
        console.log(`Job status: ${statusData.status}`);
        console.log(`Job output: ${JSON.stringify(statusData.output)}`);

        // Check if the job is completed
        if ((statusData.status === "completed" || statusData.status === "complete") && statusData.output && statusData.output.url) {
          audioUrl = statusData.output.url;
          break;
        }

        // Check if the job failed
        if (statusData.status === "failed") {
          throw new Error(`Job failed: ${JSON.stringify(statusData)}`);
        }
      }

      if (!audioUrl) {
        throw new Error(`Timed out waiting for job to complete after ${maxAttempts} attempts`);
      }

      // Download the audio file
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        throw new Error(`Failed to download audio file: ${audioResponse.statusText}`);
      }

      const buffer = Buffer.from(await audioResponse.arrayBuffer());
      return new Uint8Array(buffer);
    } catch (error) {
      console.error("Error converting text to speech bytes:", error);
      throw error;
    }
  }

  /**
   * Synthesize text to audio byte stream
   * @param text Text to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to audio byte stream
   */
  async synthToBytestream(text: string, _options: SpeakOptions = {}): Promise<ReadableStream<Uint8Array>> {
    try {
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
      console.log('PlayHT API bytestream response:', JSON.stringify(data, null, 2));

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
        console.log(`Polling for bytestream result (attempt ${attempts}/${maxAttempts})...`);

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
        console.log(`Bytestream job status: ${statusData.status}`);

        // Check if the job is completed
        if ((statusData.status === "completed" || statusData.status === "complete") && statusData.output && statusData.output.url) {
          audioUrl = statusData.output.url;
          break;
        }

        // Check if the job failed
        if (statusData.status === "failed") {
          throw new Error(`Bytestream job failed: ${JSON.stringify(statusData)}`);
        }
      }

      if (!audioUrl) {
        throw new Error(`Timed out waiting for bytestream job to complete after ${maxAttempts} attempts`);
      }

      // Download the audio file
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        throw new Error(`Failed to download bytestream audio file: ${audioResponse.statusText}`);
      }

      // Get the audio data as a ReadableStream
      return audioResponse.body;
    } catch (error) {
      console.error("Error converting text to speech stream:", error);
      throw error;
    }
  }
}
