// Node-only imports moved inside Node-only code paths below for browser compatibility.
import { AbstractTTSClient } from "../core/abstract-tts";
import * as SpeechMarkdown from "../markdown/converter";
import * as SSMLUtils from "../core/ssml-utils";
import type { SpeakOptions, TTSCredentials, UnifiedVoice } from "../types";
import { type WordBoundary, estimateWordBoundaries } from "../utils/word-timing-estimator";

// Mock OpenAI types for TypeScript compilation
// These will be replaced by the actual types when the openai package is installed
interface OpenAI {
  models: {
    list: () => Promise<{ data: any[] }>;
  };
  audio: {
    speech: {
      create: (params: any) => Promise<{
        arrayBuffer: () => Promise<ArrayBuffer>;
        body: ReadableStream<Uint8Array>;
      }>;
    };
  };
}

// Mock implementation of OpenAI class
class MockOpenAI implements OpenAI {
  // Constructor accepts options but doesn't use them
  constructor(_options?: Record<string, unknown>) {}
  models = {
    list: async () => ({ data: [] }),
  };
  audio = {
    speech: {
      create: async () => ({
        arrayBuffer: async () => new ArrayBuffer(0),
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.close();
          },
        }),
      }),
    },
  };
}

// SDK will be loaded dynamically

/**
 * OpenAI TTS Client Credentials
 */
/**
 * Extended options for OpenAI TTS
 */
export interface OpenAITTSOptions extends SpeakOptions {
  /** OpenAI Model */
  model?: string;
  /** OpenAI Voice */
  voice?: string;
  /** OpenAI Speed (maps to rate) */
  speed?: number;
  /** Output format */
  format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';

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
 * OpenAI TTS Client Credentials
 */
export interface OpenAITTSCredentials extends TTSCredentials {
  /** OpenAI API Key */
  apiKey?: string;
  /** Base URL for OpenAI API */
  baseURL?: string;
  /** Organization ID */
  organization?: string;
}

/**
 * OpenAI TTS Client
 *
 * This client uses the OpenAI API to convert text to speech.
 * It supports streaming audio but does not support SSML.
 * Word boundaries are estimated since OpenAI doesn't provide word events.
 */
export class OpenAITTSClient extends AbstractTTSClient {
  // Use 'any' for client to accommodate both real and mock SDK types easily
  private client: any | null = null;
  private clientLoadingPromise: Promise<any | null> | null = null;
  // Make credentials protected to match base class expectations
  protected credentials: OpenAITTSCredentials;

  private model: string;
  private voice: string;
  private instructions: string;
  private responseFormat: string;
  private lastWordBoundaries: WordBoundary[] = [];

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
   * Create a new OpenAI TTS Client
   * @param credentials OpenAI API credentials
   */
  constructor(credentials: OpenAITTSCredentials = {}) {
    super(credentials);
    this.credentials = credentials;

    // Don't initialize client here, load it on demand

    // Set default values
    this.model = "tts-1"; // Default model
    this.voice = "alloy"; // Default voice
    this.instructions = "";
    this.responseFormat = "mp3"; // Default format
  }

  /**
   * Load the OpenAI SDK dynamically.
   * Returns the initialized client (real or mock).
   */
  private async loadClient(): Promise<any> {
    if (this.client) {
      return this.client;
    }
    if (this.clientLoadingPromise) {
      const client = await this.clientLoadingPromise;
      if (client) return client;
      console.warn("Client loading promise resolved unexpectedly to null, using mock.");
      this.client = new MockOpenAI();
      return this.client;
    }

    // Only attempt dynamic import in Node.js environment
    if (typeof window !== "undefined") {
      console.warn("OpenAI SDK dynamic import skipped in browser environment, using mock.");
      this.client = new MockOpenAI();
      return this.client;
    }

    this.clientLoadingPromise = import("openai")
      .then((openaiModule) => {
        const OpenAIClass = openaiModule.OpenAI;
        this.client = new OpenAIClass({
          apiKey: this.credentials.apiKey || process.env.OPENAI_API_KEY,
          baseURL: this.credentials.baseURL,
          organization: this.credentials.organization,
        });
        this.clientLoadingPromise = null;
        console.log("OpenAI SDK loaded successfully.");
        return this.client;
      })
      .catch((_error) => {
        console.warn("OpenAI package not found or failed to load, using mock implementation.");
        this.client = new MockOpenAI();
        this.clientLoadingPromise = null;
        return this.client; // Return the mock client
      })
      .finally(() => {
        this.clientLoadingPromise = null; // Clear promise once settled (success or fail)
      });

    // Wait for the promise to resolve and return the client (could be real or mock)
    return this.clientLoadingPromise;
  }

  /**
   * Check if the credentials are valid
   * @returns Promise resolving to true if credentials are valid, false otherwise
   */
  async checkCredentials(): Promise<boolean> {
    try {
      const client = await this.loadClient();
      if (client instanceof MockOpenAI) {
        console.warn("Cannot check credentials with mock OpenAI client.");
        return false; // Cannot validate with mock
      }
      // Try to list models to check if the real API key is valid
      await client.models.list();
      return true;
    } catch (error) {
      console.error("Error checking OpenAI credentials:", error);
      return false;
    }
  }

  /**
   * Get available voices
   * @returns Promise resolving to an array of unified voice objects
   */
  protected async _getVoices(): Promise<UnifiedVoice[]> {
    // OpenAI has a fixed set of voices
    const voices = [
      { id: "alloy", name: "Alloy", gender: "Unknown" },
      { id: "ash", name: "Ash", gender: "Male" },
      { id: "ballad", name: "Ballad", gender: "Male" },
      { id: "coral", name: "Coral", gender: "Female" },
      { id: "echo", name: "Echo", gender: "Male" },
      { id: "fable", name: "Fable", gender: "Female" },
      { id: "onyx", name: "Onyx", gender: "Male" },
      { id: "nova", name: "Nova", gender: "Female" },
      { id: "sage", name: "Sage", gender: "Male" },
      { id: "shimmer", name: "Shimmer", gender: "Female" },
    ];

    return this._mapVoicesToUnified(voices);
  }

  /**
   * Map OpenAI voice objects to unified format
   * @param rawVoices Array of OpenAI voice objects
   * @returns Promise resolving to an array of unified voice objects
   */
  protected async _mapVoicesToUnified(rawVoices: any[]): Promise<UnifiedVoice[]> {
    return rawVoices.map((voice) => {
      // Create language code object
      const languageCode = {
        bcp47: "en-US",
        iso639_3: "eng",
        display: "English (US)",
      };

      return {
        id: voice.id,
        name: voice.name,
        gender: voice.gender as "Male" | "Female" | "Unknown",
        provider: "openai",
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
   * Set the model to use for synthesis
   * @param model Model ID to use
   */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * Set instructions for the TTS engine
   * @param instructions Instructions for the TTS engine
   */
  setInstructions(instructions: string): void {
    this.instructions = instructions;
  }

  /**
   * Set the response format
   * @param format Response format (mp3, opus, aac, flac, wav, pcm)
   */
  setResponseFormat(format: string): void {
    this.responseFormat = format;
  }

  /**
   * Get a property value
   * @param property Property name
   * @returns Property value
   */
  getProperty(property: string): any {
    switch (property) {
      case "model":
        return this.model;
      case "voice":
        return this.voice;
      case "instructions":
        return this.instructions;
      case "responseFormat":
        return this.responseFormat;
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
      case "model":
        this.setModel(value);
        break;
      case "voice":
        this.setVoice(value);
        break;
      case "instructions":
        this.setInstructions(value);
        break;
      case "responseFormat":
        this.setResponseFormat(value);
        break;
      default:
        super.setProperty(property, value);
        break;
    }
  }

  /**
   * Convert text to speech
   * @param text Text to convert to speech
   * @param options TTS options
   * @returns Promise resolving to the path of the generated audio file
   */
  async textToSpeech(text: string, options: OpenAITTSOptions = {}): Promise<string> {
    if (typeof window !== "undefined") {
      throw new Error("textToSpeech with file output is not supported in the browser. Use synthToBytes or synthToBytestream instead.");
    }
    // Node.js only
    const fs = await import("node:fs");
    const path = await import("node:path");
    try {
      // Create output directory if it doesn't exist
      const outputDir = options.outputDir || ".";
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      // Generate output file path
      const outputFile = options.outputFile || `openai-output.${this.responseFormat}`;
      const outputPath = path.join(outputDir, outputFile);
      // Synthesize audio
      const audioBytes = await this.synthToBytes(text, options);
      // Write audio to file
      fs.writeFileSync(outputPath, audioBytes);
      // Estimate word boundaries
      if (options.returnWordBoundaries) {
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
  async textToSpeechStreaming(text: string, options: OpenAITTSOptions = {}): Promise<string> {
    if (typeof window !== "undefined") {
      throw new Error("textToSpeechStreaming with file output is not supported in the browser. Use synthToBytes or synthToBytestream instead.");
    }
    const fs = await import("node:fs");
    const path = await import("node:path");
    try {
      // Create output directory if it doesn't exist
      const outputDir = options.outputDir || ".";
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Generate output file path
      const outputFile = options.outputFile || `openai-streaming-output.${this.responseFormat}`;
      const outputPath = path.join(outputDir, outputFile);

      // Create speech with streaming
      const response = await this.client.audio.speech.create({
        model: this.model,
        voice: this.voice,
        input: text,
        instructions: this.instructions || undefined,
        response_format: this.responseFormat as any,
      });

      // Get the stream
      const stream = response.body;

      // Create a writable stream to the output file
      const writer = fs.createWriteStream(outputPath);

      // Pipe the stream to the file
      const reader = stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          writer.write(value);
        }
      } finally {
        reader.releaseLock();
      }

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
   * Convert SSML to speech (not supported by OpenAI)
   * @param ssml SSML to convert to speech
   * @param options TTS options
   * @returns Promise resolving to the path of the generated audio file
   */
  async ssmlToSpeech(_ssml: string, _options: OpenAITTSOptions = {}): Promise<string> {
    throw new Error("SSML is not supported by OpenAI TTS");
  }

  /**
   * Convert SSML to speech with streaming (not supported by OpenAI)
   * @param ssml SSML to convert to speech
   * @param options TTS options
   * @returns Promise resolving to the path of the generated audio file
   */
  async ssmlToSpeechStreaming(_ssml: string, _options: OpenAITTSOptions = {}): Promise<string> {
    throw new Error("SSML is not supported by OpenAI TTS");
  }

  /**
   * Synthesize text to audio bytes
   * @param text Text to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to audio bytes
   */
  async synthToBytes(text: string | string[], options: OpenAITTSOptions = {}): Promise<Uint8Array> {
    try {
      // Prepare text for synthesis (handle Speech Markdown and SSML)
      let processedText = typeof text === "string" ? text : text.join(" ");

      // Convert from Speech Markdown if requested
      if (options?.useSpeechMarkdown && SpeechMarkdown.isSpeechMarkdown(processedText)) {
        // Convert to SSML first, then strip SSML tags since OpenAI doesn't support SSML
        const ssml = await SpeechMarkdown.toSSML(processedText);
        processedText = SSMLUtils.stripSSML(ssml);
      }

      // If text is SSML, strip the tags as OpenAI doesn't support SSML
      if (SSMLUtils.isSSML(processedText)) {
        processedText = SSMLUtils.stripSSML(processedText);
      }

      const client = await this.loadClient();
      const params: any = {
        model: options.model || this.model,
        voice: options.voice || this.voice,
        input: processedText,
        instructions: this.instructions || undefined,
        response_format: options.format || this.responseFormat,
        // Map rate to speed if provided (_options.speed takes precedence over _options.rate)
        speed: options.speed ?? options.rate,
      };

      // Use the initialized client (could be mock or real)
      const response = await client.audio.speech.create(params);
      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      console.error("Error converting text to speech bytes:", error);
      throw error;
    }
  }

  /**
   * Synthesize text to a byte stream using OpenAI API.
   * @param text Text to synthesize.
   * @param _options Synthesis options (currently unused for streaming, uses defaults).
   * @returns Promise resolving to an object containing the audio stream and an empty word boundaries array.
   */
  async synthToBytestream(text: string, _options?: SpeakOptions): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
  }> {
    try {
      const client = await this.loadClient();
      // Use the initialized client (could be mock or real)
      const response = await client.audio.speech.create({
        model: this.model,
        voice: this.voice,
        input: text,
        instructions: this.instructions || undefined,
        response_format: this.responseFormat as any,
      });

      // Get the stream
      const stream = response.body;

      // Return the stream and an empty word boundaries array
      return { audioStream: stream, wordBoundaries: [] };
    } catch (error) {
      console.error("Error converting text to speech stream:", error);
      throw error;
    }
  }
}
