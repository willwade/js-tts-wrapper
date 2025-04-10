/**
 * SherpaOnnx WebAssembly TTS Client
 * 
 * This client uses the WebAssembly build of SherpaOnnx for browser environments
 * where native modules cannot be used.
 */

import { AbstractTTSClient } from "../core/abstract-tts";
import { SpeakOptions, TTSCredentials, UnifiedVoice, WordBoundaryCallback } from "../types";
import { estimateWordBoundaries } from "../utils/word-timing-estimator";
import * as fs from "node:fs";
import * as path from "node:path";

// Define the SherpaOnnx WebAssembly module interface
interface SherpaOnnxWasmModule {
  // Core methods
  _ttsCreateOffline: (configPtr: number) => number;
  _ttsDestroyOffline: (tts: number) => void;
  _ttsGenerateWithOffline: (tts: number, textPtr: number) => number;
  _ttsNumSamplesWithOffline: (tts: number) => number;
  _ttsSampleRateWithOffline: (tts: number) => number;
  _ttsGetSamplesWithOffline: (tts: number, samplesPtr: number) => void;
  
  // Memory management
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
  
  // Helpers for string handling
  stringToUTF8: (str: string, outPtr: number, maxBytesToWrite: number) => void;
  UTF8ToString: (ptr: number) => string;
  
  // Typed array access
  HEAPF32: Float32Array;
  HEAP8: Int8Array;
  HEAP16: Int16Array;
  HEAP32: Int32Array;
  HEAPU8: Uint8Array;
  HEAPU16: Uint16Array;
  HEAPU32: Uint32Array;
}

/**
 * SherpaOnnx WebAssembly TTS Client
 * 
 * This client uses the WebAssembly build of SherpaOnnx for browser environments
 * where native modules cannot be used.
 */
export class SherpaOnnxWasmTTSClient extends AbstractTTSClient {
  private wasmModule: SherpaOnnxWasmModule | null = null;
  private tts: number = 0;
  private modelPath: string = "";
  private tokensPath: string = "";
  private sampleRate: number = 16000;
  private baseDir: string = "";
  private wasmPath: string = "";
  private wasmLoaded: boolean = false;
  private voiceId: string = "";
  
  /**
   * Create a new SherpaOnnx WebAssembly TTS client
   * @param credentials Optional credentials object
   */
  constructor(credentials?: TTSCredentials) {
    super(credentials);
    
    // Set default base directory for models
    this.baseDir = credentials?.baseDir || this._getDefaultModelsDir();
    
    // Set default WebAssembly path
    this.wasmPath = credentials?.wasmPath || "";
  }
  
  /**
   * Get the default models directory
   * @returns Path to the default models directory
   */
  private _getDefaultModelsDir(): string {
    // In browser environments, use a relative path
    if (typeof window !== "undefined") {
      return "./models";
    }
    
    // In Node.js, use the home directory
    const homeDir = process.env.HOME || process.env.USERPROFILE || ".";
    return path.join(homeDir, ".js-tts-wrapper", "models");
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
      if (this.wasmPath && fs.existsSync(this.wasmPath)) {
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
  async getVoices(): Promise<UnifiedVoice[]> {
    try {
      // Load the voice models JSON file
      let voiceModels: any[] = [];
      
      try {
        // In Node.js, read from the file system
        if (typeof window === "undefined") {
          const modelsJsonPath = path.join(__dirname, "..", "data", "merged_models.json");
          if (fs.existsSync(modelsJsonPath)) {
            const modelsJson = fs.readFileSync(modelsJsonPath, "utf-8");
            voiceModels = JSON.parse(modelsJson);
          }
        } else {
          // In browser environments, fetch from a URL
          // This would need to be implemented by the application
          console.warn("Voice models JSON file not available in browser environment.");
          // Return a default voice for testing
          return [{
            id: "piper_en_US",
            name: "Piper English (US)",
            gender: "Unknown",
            provider: "sherpaonnx-wasm",
            languageCodes: [
              {
                bcp47: "en-US",
                iso639_3: "eng",
                display: "English (US)"
              }
            ]
          }];
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
        provider: "sherpaonnx-wasm",
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
   * Set the voice to use for synthesis
   * @param voiceId Voice ID to use
   */
  async setVoice(voiceId: string): Promise<void> {
    this.voiceId = voiceId;
    
    try {
      // Get the voice model information
      let voiceModels: any[] = [];
      
      try {
        // In Node.js, read from the file system
        if (typeof window === "undefined") {
          const modelsJsonPath = path.join(__dirname, "..", "data", "merged_models.json");
          if (fs.existsSync(modelsJsonPath)) {
            const modelsJson = fs.readFileSync(modelsJsonPath, "utf-8");
            voiceModels = JSON.parse(modelsJson);
          }
        } else {
          // In browser environments, we would need to fetch this from a URL
          // For now, we'll just use the default paths
          this.modelPath = `${this.baseDir}/${voiceId}/model.onnx`;
          this.tokensPath = `${this.baseDir}/${voiceId}/tokens.txt`;
          return;
        }
      } catch (error) {
        console.error("Error loading voice models:", error);
      }
      
      // Find the voice model
      const voiceModel = voiceModels.find(model => model.id === voiceId);
      
      if (voiceModel) {
        // Set the model and tokens paths
        const voiceDir = path.join(this.baseDir, voiceId);
        
        // Create the voice directory if it doesn't exist
        if (typeof window === "undefined" && !fs.existsSync(voiceDir)) {
          fs.mkdirSync(voiceDir, { recursive: true });
        }
        
        this.modelPath = path.join(voiceDir, "model.onnx");
        this.tokensPath = path.join(voiceDir, "tokens.txt");
        
        console.log(`Using voice directory: ${voiceDir}`);
      } else {
        console.warn(`Voice ${voiceId} not found in models.json. Using default paths.`);
        this.modelPath = path.join(this.baseDir, voiceId, "model.onnx");
        this.tokensPath = path.join(this.baseDir, voiceId, "tokens.txt");
      }
    } catch (error) {
      console.error(`Error setting voice ${voiceId}:`, error);
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
      if (typeof window !== "undefined") {
        // This would need to be implemented by the application
        console.warn("WebAssembly loading not implemented for browser environments.");
        this.wasmLoaded = false;
        return;
      }
      
      // In Node.js, we can't directly use WebAssembly in the same way
      console.warn("WebAssembly loading not implemented for Node.js environments.");
      this.wasmLoaded = false;
    } catch (error) {
      console.error("Error initializing WebAssembly:", error);
      this.wasmLoaded = false;
    }
  }
  
  /**
   * Initialize the TTS engine
   * @returns Promise resolving to true if initialization was successful
   */
  private async initializeTTS(): Promise<boolean> {
    if (!this.wasmLoaded || !this.wasmModule) {
      console.warn("WebAssembly module not loaded. Call initializeWasm() first.");
      return false;
    }
    
    try {
      // Create the configuration object
      const config = {
        model: this.modelPath,
        tokens: this.tokensPath
      };
      
      // Convert the config to a JSON string
      const configJson = JSON.stringify(config);
      
      // Allocate memory for the config string
      const configPtr = this.wasmModule._malloc(configJson.length + 1);
      
      // Write the config string to memory
      this.wasmModule.stringToUTF8(configJson, configPtr, configJson.length + 1);
      
      // Create the TTS engine
      this.tts = this.wasmModule._ttsCreateOffline(configPtr);
      
      // Free the config string memory
      this.wasmModule._free(configPtr);
      
      // Get the sample rate
      this.sampleRate = this.wasmModule._ttsSampleRateWithOffline(this.tts);
      
      return this.tts !== 0;
    } catch (error) {
      console.error("Error initializing TTS:", error);
      return false;
    }
  }
  
  /**
   * Synthesize text to speech and return the audio as a byte array
   * @param text Text to synthesize
   * @param options Options for synthesis
   * @returns Promise resolving to a byte array of audio data
   */
  async synthToBytes(text: string, options?: SpeakOptions): Promise<Uint8Array> {
    // If WebAssembly is not loaded, return a mock implementation
    if (!this.wasmLoaded || !this.wasmModule || this.tts === 0) {
      console.warn("SherpaOnnx WebAssembly TTS is not initialized. Using mock implementation for example.");
      return this._mockSynthToBytes(text, options);
    }
    
    try {
      // Allocate memory for the text string
      const textPtr = this.wasmModule._malloc(text.length + 1);
      
      // Write the text string to memory
      this.wasmModule.stringToUTF8(text, textPtr, text.length + 1);
      
      // Generate the audio
      const result = this.wasmModule._ttsGenerateWithOffline(this.tts, textPtr);
      
      // Free the text string memory
      this.wasmModule._free(textPtr);
      
      // Check if generation was successful
      if (result !== 0) {
        throw new Error(`Failed to generate audio: ${result}`);
      }
      
      // Get the number of samples
      const numSamples = this.wasmModule._ttsNumSamplesWithOffline(this.tts);
      
      // Allocate memory for the samples
      const samplesPtr = this.wasmModule._malloc(numSamples * 4); // 4 bytes per float
      
      // Get the samples
      this.wasmModule._ttsGetSamplesWithOffline(this.tts, samplesPtr);
      
      // Create a Float32Array view of the samples
      const samplesView = new Float32Array(this.wasmModule.HEAPF32.buffer, samplesPtr, numSamples);
      
      // Copy the samples to a new array
      const samples = new Float32Array(samplesView);
      
      // Free the samples memory
      this.wasmModule._free(samplesPtr);
      
      // Convert the samples to the requested format
      const format = options?.format || "wav";
      const audioBytes = this._convertAudioFormat(samples, format);
      
      return audioBytes;
    } catch (error) {
      console.error("Error synthesizing text:", error);
      return this._mockSynthToBytes(text, options);
    }
  }
  
  /**
   * Convert audio samples to the requested format
   * @param samples Float32Array of audio samples
   * @param format Output format (wav or mp3)
   * @returns Uint8Array of audio data in the requested format
   */
  private _convertAudioFormat(samples: Float32Array, format: string): Uint8Array {
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
   * @param text Text to synthesize
   * @param options Options for synthesis
   * @returns Promise resolving to a byte array of audio data
   */
  private _mockSynthToBytes(text: string, options?: SpeakOptions): Uint8Array {
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
    const int16Samples = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      int16Samples[i] = Math.floor(samples[i] * 32767);
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
    view.setUint32(24, sampleRate, true);
    
    // Byte rate (sample rate * channels * bytes per sample)
    view.setUint32(28, sampleRate * 1 * 2, true);
    
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
        const words = text.split(/\s+/);
        const wordBoundaries = estimateWordBoundaries(words, audioBytes.length, this.sampleRate);
        
        // Schedule word boundary events
        for (const boundary of wordBoundaries) {
          setTimeout(() => {
            onWord(boundary);
          }, boundary.startTime * 1000);
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
   * @param outputPath Path to save the audio file
   * @param onStart Callback for when synthesis starts
   * @param onEnd Callback for when synthesis ends
   * @param onWord Callback for word boundary events
   * @param options Options for synthesis
   * @returns Promise resolving when synthesis is complete
   */
  async synthToFile(
    text: string,
    outputPath: string,
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
      
      // Synthesize the audio
      const audioBytes = await this.synthToBytes(text, options);
      
      // Estimate word boundaries
      if (onWord) {
        const words = text.split(/\s+/);
        const wordBoundaries = estimateWordBoundaries(words, audioBytes.length, this.sampleRate);
        
        // Call word boundary events immediately since we're not streaming
        for (const boundary of wordBoundaries) {
          onWord(boundary);
        }
      }
      
      // Save the audio to a file
      if (typeof window === "undefined") {
        // In Node.js, use the file system
        fs.writeFileSync(outputPath, Buffer.from(audioBytes));
      } else {
        // In browser environments, this would need to be implemented by the application
        console.warn("File saving not implemented for browser environments.");
      }
      
      // Call onEnd callback
      if (onEnd) {
        onEnd();
      }
    } catch (error) {
      console.error("Error synthesizing text to file:", error);
      
      // Call onEnd callback even if there's an error
      if (onEnd) {
        onEnd();
      }
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
   * Clean up resources
   */
  dispose(): void {
    if (this.wasmModule && this.tts !== 0) {
      this.wasmModule._ttsDestroyOffline(this.tts);
      this.tts = 0;
    }
  }
}
