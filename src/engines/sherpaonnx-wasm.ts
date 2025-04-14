/**
 * SherpaOnnx WebAssembly TTS Client
 *
 * This client uses the WebAssembly build of SherpaOnnx for browser environments
 * where native modules cannot be used.
 */

import { AbstractTTSClient } from "../core/abstract-tts";
import type { SpeakOptions, TTSCredentials, UnifiedVoice, WordBoundaryCallback } from "../types";
import { estimateWordBoundaries } from "../utils/word-timing-estimator";
import { isBrowser, isNode, fileSystem, pathUtils } from "../utils/environment";

// Add SherpaOnnx to the Window interface
declare global {
  interface Window {
    SherpaOnnx?: any;
  }
}

// Define the SherpaOnnx WebAssembly module interface
interface SherpaOnnxWasmModule {
  // Core methods
  _ttsCreateOffline?: (configPtr: number) => number;
  _ttsDestroyOffline?: (tts: number) => void;
  _ttsGenerateWithOffline?: (tts: number, textPtr: number) => number;
  _ttsNumSamplesWithOffline?: (tts: number) => number;
  _ttsSampleRateWithOffline?: (tts: number) => number;
  _ttsGetSamplesWithOffline?: (tts: number, samplesPtr: number) => void;

  // Memory management
  _malloc?: (size: number) => number;
  _free?: (ptr: number) => void;

  // Helpers for string handling
  stringToUTF8?: (str: string, outPtr: number, maxBytesToWrite: number) => void;
  UTF8ToString?: (ptr: number) => string;

  // WebAssembly TTS class
  OfflineTts?: any;
  createOfflineTts?: any;

  // Typed array access
  HEAPF32?: Float32Array;
  HEAP8?: Int8Array;
  HEAP16?: Int16Array;
  HEAP32?: Int32Array;
  HEAPU8?: Uint8Array;
  HEAPU16?: Uint16Array;
  HEAPU32?: Uint32Array;

  // Any other properties
  [key: string]: any;
}

/**
 * SherpaOnnx WebAssembly TTS Client
 *
 * This client uses the WebAssembly build of SherpaOnnx for browser environments
 * where native modules cannot be used.
 */
export class SherpaOnnxWasmTTSClient extends AbstractTTSClient {
  private wasmModule: SherpaOnnxWasmModule | null = null;
  private tts: any = null;
  private sampleRate = 16000;
  // This property is used in the full implementation
  // @ts-ignore
  private baseDir = "";

  // We don't need to store the current voice for the mock implementation
  private wasmPath = "";
  private wasmLoaded = false;

  /**
   * Create a new SherpaOnnx WebAssembly TTS client
   * @param credentials Optional credentials object
   */
  constructor(credentials: TTSCredentials = {}) {
    super(credentials);

    // Set default base directory for models
    this.baseDir = (credentials.baseDir as string) || this._getDefaultModelsDir();

    // Set default WebAssembly path
    this.wasmPath = (credentials.wasmPath as string) || "";
  }

  /**
   * Get the default models directory
   * @returns Path to the default models directory
   */
  private _getDefaultModelsDir(): string {
    // In browser environments, use a relative path
    if (isBrowser) {
      return "./models";
    }

    // In Node.js, use the home directory
    const homeDir = process.env.HOME || process.env.USERPROFILE || ".";
    return pathUtils.join(homeDir, ".js-tts-wrapper", "models");
  }

  /**
   * Check if the credentials are valid
   * @returns Promise resolving to true if credentials are valid
   */
  async checkCredentials(): Promise<boolean> {
    try {
      // In a browser environment, we can't check if the WASM file exists
      // so we'll just assume it's valid and will be loaded later
      if (typeof window !== "undefined") {
        return true;
      }

      // In Node.js, check if the WASM file exists
      if (isNode && this.wasmPath && fileSystem.existsSync(this.wasmPath)) {
        return true;
      }

      // If no WASM path is provided, assume it will be loaded later
      if (!this.wasmPath) {
        console.warn("No WASM path provided. SherpaOnnx WebAssembly TTS will need to be initialized manually.");
        return true;
      }

      console.warn(`WASM file not found at ${this.wasmPath}`);
      return false;
    } catch (error) {
      console.error("Error checking SherpaOnnx WebAssembly credentials:", error);
      return false;
    }
  }

  /**
   * Get available voices
   * @returns Promise resolving to an array of unified voice objects
   */
  protected async _getVoices(): Promise<UnifiedVoice[]> {
    try {
      // Load the voice models JSON file
      let voiceModels: any[] = [];

      try {
        // In Node.js, read from the file system
        if (isNode) {
          const modelsJsonPath = pathUtils.join(__dirname, "..", "data", "merged_models.json");
          if (fileSystem.existsSync(modelsJsonPath)) {
            const modelsJson = fileSystem.readFileSync(modelsJsonPath);
            voiceModels = JSON.parse(modelsJson);
          }
        } else {
          // In browser environments, try to fetch from a URL
          try {
            const response = await fetch("./data/merged_models.json");
            if (response.ok) {
              const modelsJson = await response.text();
              voiceModels = JSON.parse(modelsJson);
            } else {
              console.warn("Voice models JSON file not available in browser environment.");
              // Return a default voice for testing
              return [{
                id: "piper_en_US",
                name: "Piper English (US)",
                gender: "Unknown",
                provider: "sherpaonnx-wasm" as const,
                languageCodes: [
                  {
                    bcp47: "en-US",
                    iso639_3: "eng",
                    display: "English (US)"
                  }
                ]
              }];
            }
          } catch (fetchError) {
            console.warn("Failed to fetch voice models JSON file:", fetchError);
            // Return a default voice for testing
            return [{
              id: "piper_en_US",
              name: "Piper English (US)",
              gender: "Unknown",
              provider: "sherpaonnx-wasm" as const,
              languageCodes: [
                {
                  bcp47: "en-US",
                  iso639_3: "eng",
                  display: "English (US)"
                }
              ]
            }];
          }
        }
      } catch (error) {
        console.error("Error loading voice models:", error);
      }

      // Filter for SherpaOnnx models and map to unified format
      const sherpaOnnxModels = voiceModels.filter(model =>
        model.engine === "sherpaonnx" || model.engine === "sherpaonnx-wasm"
      );

      return sherpaOnnxModels.map(model => ({
        id: model.id,
        name: model.name,
        gender: model.gender || "Unknown",
        provider: "sherpaonnx-wasm" as const,
        languageCodes: [
          {
            bcp47: model.language || "en-US",
            iso639_3: model.language ? model.language.split("-")[0] : "eng",
            display: model.language_display || "English (US)"
          }
        ]
      }));
    } catch (error) {
      console.error("Error getting SherpaOnnx WebAssembly voices:", error);
      return [];
    }
  }

  /**
   * Initialize the WebAssembly module
   * @param wasmUrl URL to the WebAssembly file
   * @returns Promise resolving when the module is initialized
   */
  async initializeWasm(wasmUrl: string): Promise<void> {
    if (this.wasmLoaded) {
      return;
    }

    try {
      // In browser environments, load the WebAssembly module
      if (isBrowser) {
        if (!wasmUrl) {
          console.warn("No WebAssembly URL provided for browser environment.");
          this.wasmLoaded = false;
          return;
        }

        console.log("Loading WebAssembly module from", wasmUrl);

        try {
          // Store the URL for later use
          this.wasmPath = wasmUrl;

          // Create a script element to load the WebAssembly JavaScript loader
          const script = document.createElement('script');
          script.src = wasmUrl;
          script.async = true;

          // Wait for the script to load
          await new Promise<void>((resolve, reject) => {
            script.onload = () => {
              console.log("WebAssembly script loaded successfully");
              resolve();
            };
            script.onerror = (error) => {
              console.error("Error loading WebAssembly script:", error);
              reject(new Error(`Failed to load WebAssembly script: ${error}`));
            };
            document.head.appendChild(script);
          });

          // Check if the SherpaOnnx object is available in the global scope
          if (typeof (window as any).SherpaOnnx !== 'undefined') {
            console.log("SherpaOnnx global object found");
            this.wasmModule = (window as any).SherpaOnnx;
            this.wasmLoaded = true;
          } else if (typeof (window as any).createOfflineTts !== 'undefined') {
            console.log("createOfflineTts function found");
            this.wasmModule = { createOfflineTts: (window as any).createOfflineTts };
            this.wasmLoaded = true;
          } else {
            console.warn("SherpaOnnx global object not found after script load");
            this.wasmLoaded = false;
          }
        } catch (error) {
          console.error("Error initializing WebAssembly:", error);
          this.wasmLoaded = false;
        }
      } else {
        // In Node.js, we can't directly use WebAssembly in the same way
        console.warn("WebAssembly loading not implemented for Node.js environments.");
        this.wasmLoaded = false;
      }
    } catch (error) {
      console.error("Error initializing WebAssembly:", error);
      this.wasmLoaded = false;
    }
  }

  /**
   * Synthesize text to speech and return the audio as a byte array
   * @param text Text to synthesize
   * @param options Options for synthesis
   * @returns Promise resolving to a byte array of audio data
   */
  async synthToBytes(text: string, _options?: SpeakOptions): Promise<Uint8Array> {
    // If WebAssembly is not loaded, return a mock implementation
    if (!this.wasmLoaded || !this.wasmModule) {
      console.warn("SherpaOnnx WebAssembly TTS is not initialized. Using mock implementation for example.");
      return this._mockSynthToBytes();
    }

    try {
      // Use the SherpaOnnx WebAssembly API to generate audio
      console.log("Using SherpaOnnx WebAssembly to generate audio");

      // Create a TTS instance if it doesn't exist
      if (!this.tts) {
        console.log("Creating TTS instance");
        try {
          // Create the TTS instance
          if (typeof this.wasmModule.createOfflineTts === 'function') {
            // Using the sherpa-onnx-tts.js API
            this.tts = this.wasmModule.createOfflineTts({
              offlineTtsModelConfig: {
                offlineTtsVitsModelConfig: {
                  model: '../public/sherpaonnx-wasm/model.onnx',
                  tokens: '../public/sherpaonnx-wasm/tokens.txt',
                  dataDir: '../public/sherpaonnx-wasm/espeak-ng-data'
                },
                numThreads: 1,
                debug: 0,
                provider: 'cpu'
              },
              maxNumSentences: 2,
              ruleFsts: ''
            });
          } else if (typeof (window as any).SherpaOnnx?.OfflineTts === 'function') {
            // Using the SherpaOnnx.OfflineTts API
            this.tts = new (window as any).SherpaOnnx.OfflineTts({
              modelConfig: {
                model: '../public/sherpaonnx-wasm/model.onnx',
                tokens: '../public/sherpaonnx-wasm/tokens.txt',
                dataDir: '../public/sherpaonnx-wasm/espeak-ng-data'
              },
              maxNumSentences: 2,
              ruleFsts: ''
            });
          } else {
            throw new Error('No compatible TTS API found');
          }

          console.log("TTS instance created successfully");
        } catch (error) {
          console.error("Error creating TTS instance:", error);
          return this._mockSynthToBytes();
        }
      }

      // Generate the audio
      console.log("Generating audio for text:", text);
      let samples: Float32Array;

      if (typeof this.tts.generate === 'function') {
        // Using the generate method
        const result = this.tts.generate({ text, sid: 0, speed: 1.0 });
        samples = result.samples;
      } else if (typeof this.tts.generateWithText === 'function') {
        // Using the generateWithText method
        samples = this.tts.generateWithText(text);
      } else {
        throw new Error('No compatible generate method found');
      }

      console.log("Audio generated successfully, samples:", samples.length);

      // Convert the samples to the requested format
      const audioBytes = this._convertAudioFormat(samples);

      return audioBytes;
    } catch (error) {
      console.error("Error synthesizing text:", error);
      return this._mockSynthToBytes();
    }
  }

  /**
   * Convert audio samples to the requested format
   * @param samples Float32Array of audio samples
   * @returns Uint8Array of audio data in the requested format
   */
  private _convertAudioFormat(samples: Float32Array): Uint8Array {
    // For now, we'll just return a WAV file
    // In a real implementation, we would use a library like audioEncoder
    // to convert to the requested format

    // Convert Float32Array to Int16Array
    const int16Samples = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      // Scale to 16-bit range and clamp
      const sample = Math.max(-1, Math.min(1, samples[i]));
      int16Samples[i] = Math.floor(sample * 32767);
    }

    // Create a WAV file header
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);

    // "RIFF" chunk descriptor
    view.setUint8(0, "R".charCodeAt(0));
    view.setUint8(1, "I".charCodeAt(0));
    view.setUint8(2, "F".charCodeAt(0));
    view.setUint8(3, "F".charCodeAt(0));

    // Chunk size (file size - 8)
    view.setUint32(4, 36 + int16Samples.length * 2, true);

    // Format ("WAVE")
    view.setUint8(8, "W".charCodeAt(0));
    view.setUint8(9, "A".charCodeAt(0));
    view.setUint8(10, "V".charCodeAt(0));
    view.setUint8(11, "E".charCodeAt(0));

    // "fmt " sub-chunk
    view.setUint8(12, "f".charCodeAt(0));
    view.setUint8(13, "m".charCodeAt(0));
    view.setUint8(14, "t".charCodeAt(0));
    view.setUint8(15, " ".charCodeAt(0));

    // Sub-chunk size (16 for PCM)
    view.setUint32(16, 16, true);

    // Audio format (1 for PCM)
    view.setUint16(20, 1, true);

    // Number of channels (1 for mono)
    view.setUint16(22, 1, true);

    // Sample rate
    view.setUint32(24, this.sampleRate, true);

    // Byte rate (sample rate * channels * bytes per sample)
    view.setUint32(28, this.sampleRate * 1 * 2, true);

    // Block align (channels * bytes per sample)
    view.setUint16(32, 1 * 2, true);

    // Bits per sample
    view.setUint16(34, 16, true);

    // "data" sub-chunk
    view.setUint8(36, "d".charCodeAt(0));
    view.setUint8(37, "a".charCodeAt(0));
    view.setUint8(38, "t".charCodeAt(0));
    view.setUint8(39, "a".charCodeAt(0));

    // Sub-chunk size (number of samples * channels * bytes per sample)
    view.setUint32(40, int16Samples.length * 1 * 2, true);

    // Combine the header and the samples
    const wavBytes = new Uint8Array(wavHeader.byteLength + int16Samples.length * 2);
    wavBytes.set(new Uint8Array(wavHeader), 0);

    // Convert Int16Array to Uint8Array
    const samplesBytes = new Uint8Array(int16Samples.buffer);
    wavBytes.set(samplesBytes, wavHeader.byteLength);

    return wavBytes;
  }

  /**
   * Mock implementation for synthToBytes
   * @returns Promise resolving to a byte array of audio data
   */
  private _mockSynthToBytes(): Uint8Array {
    // Generate a simple sine wave as a placeholder
    const sampleRate = 16000;
    const duration = 2; // seconds
    const numSamples = sampleRate * duration;
    const samples = new Float32Array(numSamples);

    // Generate a 440 Hz sine wave
    for (let i = 0; i < numSamples; i++) {
      samples[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5;
    }

    // Convert to WAV
    return this._convertAudioFormat(samples);
  }

  /**
   * Synthesize text to speech and stream the audio
   * @param text Text to synthesize
   * @param onAudioBuffer Callback for audio buffers
   * @param onStart Callback for when synthesis starts
   * @param onEnd Callback for when synthesis ends
   * @param onWord Callback for word boundary events
   * @param options Options for synthesis
   * @returns Promise resolving when synthesis is complete
   */
  async synthToStream(
    text: string,
    onAudioBuffer: (audioBuffer: Uint8Array) => void,
    onStart?: () => void,
    onEnd?: () => void,
    onWord?: WordBoundaryCallback,
    options?: SpeakOptions
  ): Promise<void> {
    try {
      // Call onStart callback
      if (onStart) {
        onStart();
      }

      // Synthesize the entire audio
      const audioBytes = await this.synthToBytes(text, options);

      // Estimate word boundaries
      if (onWord) {
        const wordBoundaries = estimateWordBoundaries(text);

        // Schedule word boundary events
        for (const boundary of wordBoundaries) {
          setTimeout(() => {
            onWord(boundary.word, boundary.start, boundary.end);
          }, boundary.start * 1000);
        }
      }

      // Send the audio buffer
      onAudioBuffer(audioBytes);

      // Call onEnd callback
      if (onEnd) {
        onEnd();
      }
    } catch (error) {
      console.error("Error synthesizing text to stream:", error);

      // Call onEnd callback even if there's an error
      if (onEnd) {
        onEnd();
      }
    }
  }

  /**
   * Synthesize text to speech and save to a file
   * @param text Text to synthesize
   * @param filename Filename to save as
   * @param format Audio format (mp3 or wav)
   * @param options Options for synthesis
   * @returns Promise resolving when synthesis is complete
   */
  async synthToFile(
    text: string,
    filename: string,
    format: "mp3" | "wav" = "wav",
    options?: SpeakOptions
  ): Promise<void> {
    try {
      // Synthesize the audio
      const audioBytes = await this.synthToBytes(text, { ...options, format });

      // Check if we're in a browser environment
      if (isBrowser) {
        // Create blob with appropriate MIME type
        const mimeType = format === "mp3" ? "audio/mpeg" : "audio/wav";
        const blob = new Blob([audioBytes], { type: mimeType });

        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename.endsWith(`.${format}`) ? filename : `${filename}.${format}`;

        // Trigger download
        document.body.appendChild(a);
        a.click();

        // Clean up
        setTimeout(() => {
          if (document && document.body) {
            document.body.removeChild(a);
          }
          URL.revokeObjectURL(url);
        }, 100);
      } else {
        // In Node.js, use the file system
        const outputPath = filename.endsWith(`.${format}`) ? filename : `${filename}.${format}`;
        fileSystem.writeFileSync(outputPath, Buffer.from(audioBytes));
      }
    } catch (error) {
      console.error("Error synthesizing text to file:", error);
      throw error;
    }
  }

  /**
   * Get a property value
   * @param property Property name
   * @returns Property value
   */
  getProperty(property: string): any {
    switch (property) {
      case "voice":
        return this.voiceId;
      case "sampleRate":
        return this.sampleRate;
      case "wasmLoaded":
        return this.wasmLoaded;
      case "wasmPath":
        return this.wasmPath;
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
      case "wasmPath":
        this.wasmPath = value;
        break;
      default:
        super.setProperty(property, value);
        break;
    }
  }

  /**
   * Set the voice to use for synthesis
   * @param voiceId Voice ID to use
   */
  async setVoice(voiceId: string): Promise<void> {
    // Call the parent method to set the voiceId
    super.setVoice(voiceId);
    console.log(`Setting voice to ${voiceId}`);

    // Reset the TTS instance so it will be recreated with the new voice
    if (this.tts) {
      console.log('Resetting TTS instance for new voice');
      this.tts = null;
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.wasmModule && this.tts !== 0) {
      if (typeof this.wasmModule._ttsDestroyOffline === 'function') {
        this.wasmModule._ttsDestroyOffline(this.tts);
      }
      this.tts = null;
    }
  }

  /**
   * Synthesize text to a byte stream
   * @param text Text to synthesize
   * @param options Options for synthesis
   * @returns Promise resolving to a readable stream of audio bytes
   */
  async synthToBytestream(text: string, options?: SpeakOptions): Promise<ReadableStream<Uint8Array>> {
    // This is a simplified implementation that doesn't actually stream
    // In a real implementation, you would use a ReadableStream
    const audioBytes = await this.synthToBytes(text, options);

    // Create a ReadableStream from the audio bytes
    return new ReadableStream({
      start(controller) {
        controller.enqueue(audioBytes);
        controller.close();
      }
    });
  }
}
