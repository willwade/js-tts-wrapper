// Node-only imports moved inside Node-only code paths below for browser compatibility.
import { AbstractTTSClient } from "../core/abstract-tts";
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

// Use the mock OpenAI class if the openai package is not installed
let OpenAIClass: any;
let openaiPackageLoaded = false;

// Function to load OpenAI package on demand
function getOpenAIClass() {
  if (!openaiPackageLoaded) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      OpenAIClass = require("openai").OpenAI;
      openaiPackageLoaded = true;
    } catch (_error) {
      console.warn("OpenAI package not found, using mock implementation");
      OpenAIClass = MockOpenAI;
      openaiPackageLoaded = true;
    }
  }
  return OpenAIClass;
}

/**
 * OpenAI TTS Client Credentials
 */
/**
 * Extended options for OpenAI TTS
 */
export interface OpenAITTSOptions extends SpeakOptions {
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
  private client: OpenAI;
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

    // Initialize OpenAI client
    const OpenAIClass = getOpenAIClass();
    this.client = new OpenAIClass({
      apiKey: credentials.apiKey || process.env.OPENAI_API_KEY,
      baseURL: credentials.baseURL,
      organization: credentials.organization,
    });

    // Set default values
    this.model = "gpt-4o-mini-tts";
    this.voice = "coral";
    this.instructions = "";
    this.responseFormat = "mp3";
  }

  /**
   * Check if the credentials are valid
   * @returns Promise resolving to true if credentials are valid, false otherwise
   */
  async checkCredentials(): Promise<boolean> {
    try {
      // Try to list models to check if the API key is valid
      await this.client.models.list();
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
  async synthToBytes(text: string | string[], _options: OpenAITTSOptions = {}): Promise<Uint8Array> {
    try {
      // Create speech
      const mp3 = await this.client.audio.speech.create({
        model: this.model,
        voice: this.voice,
        input: typeof text === "string" ? text : text.join(" "),
        instructions: this.instructions || undefined,
        response_format: this.responseFormat as any,
      });

      // Convert to bytes
      const buffer = Buffer.from(await mp3.arrayBuffer());
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
  async synthToBytestream(
    text: string,
    _options: SpeakOptions = {}
  ): Promise<ReadableStream<Uint8Array>> {
    try {
      // Create speech with streaming
      const response = await this.client.audio.speech.create({
        model: this.model,
        voice: this.voice,
        input: text,
        instructions: this.instructions || undefined,
        response_format: this.responseFormat as any,
      });

      // Return the stream
      return response.body;
    } catch (error) {
      console.error("Error converting text to speech stream:", error);
      throw error;
    }
  }
}
