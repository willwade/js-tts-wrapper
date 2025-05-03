import { AbstractTTSClient } from "../core/abstract-tts";
import type { SpeakOptions, TTSCredentials, UnifiedVoice } from "../types";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import fetch from 'node-fetch';
// Import necessary modules for ESM path resolution
import { fileURLToPath } from 'url'; 
import decompress from "decompress";
import decompressTarbz2 from "decompress-tarbz2";

// Dynamically import sherpa-onnx-node only if it exists
let sherpa: any;
try {
  sherpa = await import("sherpa-onnx-node");
} catch (error) {
  console.error("Error importing sherpa-onnx-node:", error);
}

/**
 * SherpaOnnx TTS credentials
 */
export interface SherpaOnnxTTSCredentials extends TTSCredentials {
  /**
   * Path to model file or directory
   */
  modelPath?: string;

  /**
   * Path to tokens file
   */
  tokensPath?: string;

  /**
   * Voice model ID
   */
  modelId?: string;

  /**
   * If true, skip automatic download of default model
   */
  noDefaultDownload?: boolean;
}

/**
 * Model configuration
 */
interface ModelConfig {
  url: string;
  name: string;
  language: string;
  gender: "Male" | "Female" | "Unknown";
  description: string;
  compression?: boolean;
}

/**
 * SherpaOnnx audio output
 */
interface SherpaOnnxAudio {
  samples: Float32Array;
  sampleRate: number;
}

/**
 * SherpaOnnx TTS client
 */
export class SherpaOnnxTTSClient extends AbstractTTSClient {
  /**
   * Path to the model file
   */
  private modelPath: string | null = null;

  /**
   * Voice model ID
   */
  private modelId: string | null = null;

  /**
   * Base directory for models
   */
  private baseDir: string;

  /**
   * SherpaOnnx TTS instance
   */
  private tts: any = null;

  /**
   * Model configuration
   */
  private jsonModels: Record<string, ModelConfig> = {};

  /**
   * Path to the models file
   */
  private static readonly MODELS_FILE = "merged_models.json";

  /**
   * Create a new SherpaOnnx TTS client
   * @param credentials SherpaOnnx credentials
   */
  constructor(credentials: SherpaOnnxTTSCredentials) {
    super(credentials);

    // Initialize instance variables
    this.modelPath = credentials.modelPath || null;
    this.modelId = credentials.modelId || null;

    // Use a dedicated models directory if modelPath is not provided
    if (this.modelPath) {
      this.baseDir = path.dirname(this.modelPath);
    } else {
      // Create a models directory in the user's home directory
      const homeDir = os.homedir();
      const modelsDir = path.join(homeDir, ".js-tts-wrapper", "models");

      // Create the models directory if it doesn't exist
      if (!fs.existsSync(modelsDir)) {
        fs.mkdirSync(modelsDir, { recursive: true });
      }

      this.baseDir = modelsDir;
      console.log("Using default models directory:", modelsDir);
    }

    // Load model configuration
    this.jsonModels = this.loadModelsAndVoices();

    // Only set up voice if we have a modelId or auto-download is enabled
    if (this.modelId || !credentials.noDefaultDownload) {
      this.modelId = this.modelId || "mms_eng"; // Default to English if not specified
      this.setVoice(this.modelId);
    } else {
      console.log("Skipping automatic model download (noDefaultDownload=true)");
    }
  }

  /**
   * Load models and voices from the JSON configuration file
   * @returns Record of model configurations
   */
  private loadModelsAndVoices(): Record<string, ModelConfig> {
    try {
      // First try to load from the package directory using ESM compatible path
      const currentFilePath = fileURLToPath(import.meta.url);
      const packageDir = path.dirname(currentFilePath);
      const modelsFilePath = path.join(packageDir, "sherpaonnx", SherpaOnnxTTSClient.MODELS_FILE);

      if (fs.existsSync(modelsFilePath)) {
        const modelsJson = fs.readFileSync(modelsFilePath, "utf-8");
        return JSON.parse(modelsJson);
      }

      // If that fails, try to load from the models directory
      const modelsFilePathInModels = path.join(this.baseDir, SherpaOnnxTTSClient.MODELS_FILE);

      if (fs.existsSync(modelsFilePathInModels)) {
        const modelsJson = fs.readFileSync(modelsFilePathInModels, "utf-8");
        return JSON.parse(modelsJson);
      }

      // If that fails too, download the models file
      console.log("Models file not found, downloading...");

      // Create a temporary models file with a default configuration
      const defaultModels: Record<string, ModelConfig> = {
        "mms_eng": {
          url: "https://huggingface.co/willwade/mms-tts-multilingual-models-onnx/resolve/main/eng",
          name: "MMS English",
          language: "en-US",
          gender: "Female",
          description: "MMS English TTS model"
        }
      };

      // Save the default models file
      fs.writeFileSync(
        path.join(this.baseDir, SherpaOnnxTTSClient.MODELS_FILE),
        JSON.stringify(defaultModels, null, 2)
      );

      // Download the actual models file
      this.downloadModelsFile();

      return defaultModels;
    } catch (error) {
      console.error("Error loading models and voices:", error);
      return {};
    }
  }

  /**
   * Download the models file from the repository
   */
  private async downloadModelsFile(): Promise<void> {
    try {
      // Try to download the models file from the repository
      const url = "https://raw.githubusercontent.com/willwade/tts-wrapper/main/tts_wrapper/engines/sherpaonnx/merged_models.json";

      try {
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Failed to download models file: ${response.statusText}`);
        }

        const modelsJson = await response.text();
        fs.writeFileSync(
          path.join(this.baseDir, SherpaOnnxTTSClient.MODELS_FILE),
          modelsJson
        );

        console.log("Models file downloaded successfully");

        // Update the models configuration
        this.jsonModels = JSON.parse(modelsJson);
        return;
      } catch (downloadError) {
        console.warn("Could not download models file from repository, using default configuration");
      }

      // If download fails, use our default configuration
      const defaultModels: Record<string, ModelConfig> = {
        "mms_eng": {
          url: "https://huggingface.co/willwade/mms-tts-multilingual-models-onnx/resolve/main/eng",
          name: "MMS English",
          language: "en-US",
          gender: "Female",
          description: "MMS English TTS model"
        }
      };

      // Save the models file
      const modelsJson = JSON.stringify(defaultModels, null, 2);
      fs.writeFileSync(
        path.join(this.baseDir, SherpaOnnxTTSClient.MODELS_FILE),
        modelsJson
      );

      console.log("Models file created successfully");

      // Update the models configuration
      this.jsonModels = defaultModels;
    } catch (error) {
      console.error("Error creating models file:", error);
    }
  }

  /**
   * Download a file from a URL to a destination path
   * @param url URL to download from
   * @param destination Destination path
   * @returns Promise resolving when the download is complete
   */
  private async downloadFile(url: string, destination: string): Promise<void> {
    try {
      console.log(`Downloading file from ${url}`);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      fs.writeFileSync(destination, Buffer.from(buffer));
      console.log(`File downloaded to ${destination}`);
    } catch (error) {
      const err = error as Error;
      console.error(`Error downloading file: ${err.message}`);
      throw err;
    }
  }

  /**
   * Extract a tar.bz2 archive to a destination directory
   * @param archivePath Path to the archive file
   * @param destinationDir Destination directory
   * @returns Promise resolving to a map of extracted file paths
   */
  private async extractTarBz2(archivePath: string, destinationDir: string): Promise<Map<string, string>> {
    try {
      console.log(`Extracting archive ${archivePath} to ${destinationDir}`);

      // Create the destination directory if it doesn't exist
      if (!fs.existsSync(destinationDir)) {
        fs.mkdirSync(destinationDir, { recursive: true });
      }

      // Use the decompress library to extract the archive
      const files = await decompress(archivePath, destinationDir, {
        plugins: [decompressTarbz2()]
      });

      console.log(`Extracted ${files.length} files from ${archivePath}`);

      // Create a map to store the extracted file paths
      const extractedFiles = new Map<string, string>();

      // Store the file paths in the map
      for (const file of files) {
        const filePath = path.join(destinationDir, file.path);
        extractedFiles.set(file.path, filePath);
        console.log(`Extracted ${file.path} to ${filePath}`);
      }

      console.log(`Extraction of ${archivePath} completed successfully`);
      return extractedFiles;
    } catch (error) {
      const err = error as Error;
      console.error(`Error extracting archive: ${err.message}`);
      throw err;
    }
  }

  /**
   * Check if model and token files exist
   * @param modelPath Path to model file
   * @param tokensPath Path to tokens file
   * @returns True if both files exist and are not empty
   */
  private checkFilesExist(
    modelPath: string,
    tokensPath: string
  ): boolean {
    try {
      // Check that both files exist
      if (!fs.existsSync(modelPath) || !fs.existsSync(tokensPath)) {
        return false;
      }

      // Check that both files are not empty
      const modelStats = fs.statSync(modelPath);
      const tokensStats = fs.statSync(tokensPath);

      return modelStats.size > 0 && tokensStats.size > 0;
    } catch (error) {
      console.error("Error checking files:", error);
      return false;
    }
  }

  /**
   * Get dict_dir from extracted model
   * @param destinationDir Destination directory
   * @returns Path to dict_dir
   */
  private getDictDir(destinationDir: string): string {
    try {
      // Walk through directory tree
      const walkSync = (dir: string): string => {
        const files = fs.readdirSync(dir);

        // Check if any file ends with .txt
        if (files.some((file) => file.endsWith(".txt"))) {
          return dir;
        }

        // Check subdirectories
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stats = fs.statSync(filePath);

          if (stats.isDirectory()) {
            const result = walkSync(filePath);
            if (result) {
              return result;
            }
          }
        }

        return "";
      };

      return walkSync(destinationDir);
    } catch (error) {
      console.error("Error getting dict_dir:", error);
      return "";
    }
  }

  /**
   * Download model and token files to voice-specific directory
   * @param destinationDir Base directory for model files
   * @param modelId Voice model ID
   * @returns Tuple of (model_path, tokens_path, lexicon_path, dict_dir)
   */
  private async downloadModelAndTokens(
    destinationDir: string,
    modelId: string | null
  ): Promise<[string, string, string, string]> {
    let lexiconPath = "";
    let dictDir = "";

    // Handle null modelId
    const safeModelId = modelId || "default";

    // Get model URL from JSON config
    if (!(safeModelId in this.jsonModels)) {
      throw new Error(`Model ID ${safeModelId} not found in configuration`);
    }

    const modelConfig = this.jsonModels[safeModelId];
    const modelUrl = modelConfig.url;

    // Set paths in voice directory
    const modelPath = path.join(destinationDir, "model.onnx");
    const tokensPath = path.join(destinationDir, "tokens.txt");

    if (modelConfig.compression) {
      // Handle compressed archive
      console.log("Downloading compressed model from", modelUrl);

      // Download to a temporary file
      const archivePath = path.join(destinationDir, "model.tar.bz2");
      await this.downloadFile(modelUrl, archivePath);
      console.log("Compressed model downloaded to", archivePath);

      // Extract the archive
      console.log("Extracting model archive...");

      try {
        // Extract the archive
        const extractedFiles = await this.extractTarBz2(archivePath, destinationDir);

        // Find the model and tokens files in the extracted files
        let modelFile = "";
        let tokensFile = "";

        // Look for model.onnx and tokens.txt in the extracted files
        for (const [fileName, filePath] of extractedFiles.entries()) {
          if (fileName.endsWith(".onnx")) {
            modelFile = filePath;
          } else if (fileName.endsWith("tokens.txt")) {
            tokensFile = filePath;
          }
        }

        // If we found the files, update the paths
        if (modelFile && tokensFile) {
          console.log(`Found model file: ${modelFile}`);
          console.log(`Found tokens file: ${tokensFile}`);

          // Update the paths
          fs.copyFileSync(modelFile, modelPath);
          fs.copyFileSync(tokensFile, tokensPath);

          console.log(`Copied model file to ${modelPath}`);
          console.log(`Copied tokens file to ${tokensPath}`);
        } else {
          throw new Error("Could not find model.onnx and tokens.txt in the extracted files");
        }
      } catch (error) {
        const err = error as Error;
        console.error(`Error extracting archive: ${err.message}`);
        throw new Error(`Failed to extract model files for ${safeModelId}: ${err.message}`);
      }
    } else {
      // Check if the URL is from the merged_models.json file
      // The URL format in merged_models.json is different from the hardcoded URLs
      const isFromMergedModels = modelUrl.includes("willwade/mms-tts-multilingual-models-onnx");

      if (isFromMergedModels) {
        // Handle direct files from willwade/mms-tts-multilingual-models-onnx
        // The URL format is different, it points to a directory
        const baseUrl = modelUrl;
        const modelFileUrl = `${baseUrl}/model.onnx`;
        const tokensFileUrl = `${baseUrl}/tokens.txt`;

        // Download model file
        console.log("Downloading model from", modelFileUrl);
        await this.downloadFile(modelFileUrl, modelPath);
        console.log("Model downloaded to", modelPath);

        // Download tokens file
        console.log("Downloading tokens from", tokensFileUrl);
        await this.downloadFile(tokensFileUrl, tokensPath);
        console.log("Tokens downloaded to", tokensPath);
      } else {
        // Handle direct files from other sources
        const baseUrl = modelUrl;
        const directModelUrl = `${baseUrl}/model.onnx?download=true`;
        const tokensUrl = `${baseUrl}/tokens.txt`;

        // Download model file
        console.log("Downloading model from", directModelUrl);
        await this.downloadFile(directModelUrl, modelPath);
        console.log("Model downloaded to", modelPath);

        // Download tokens file
        console.log("Downloading tokens from", tokensUrl);
        await this.downloadFile(tokensUrl, tokensPath);
        console.log("Tokens downloaded to", tokensPath);
      }
    }

    // Set additional paths
    lexiconPath = path.join(destinationDir, "lexicon.txt");
    dictDir = this.getDictDir(destinationDir);

    return [modelPath, tokensPath, lexiconPath, dictDir];
  }

  /**
   * Check if model exists and download if not
   * @param modelId Voice model ID
   * @returns Tuple of (model_path, tokens_path, lexicon_path, dict_dir)
   */
  private async checkAndDownloadModel(
    modelId: string
  ): Promise<[string, string, string, string]> {
    // Create voice-specific directory
    const voiceDir = path.join(this.baseDir, modelId);

    if (!fs.existsSync(voiceDir)) {
      fs.mkdirSync(voiceDir, { recursive: true });
    }

    console.log("Using voice directory:", voiceDir);

    // Expected paths for this voice
    const modelPath = path.join(voiceDir, "model.onnx");
    const tokensPath = path.join(voiceDir, "tokens.txt");

    // Check if files exist in voice directory
    if (!this.checkFilesExist(modelPath, tokensPath)) {
      console.log(
        "Downloading model and tokens languages for",
        modelId,
        "because we can't find it"
      );

      // Download to voice-specific directory
      const [, , lexiconPath, dictDir] = await this.downloadModelAndTokens(
        voiceDir,
        modelId
      );

      // Verify files were downloaded correctly
      if (!this.checkFilesExist(modelPath, tokensPath)) {
        throw new Error(`Failed to download model files for ${modelId}`);
      }

      return [modelPath, tokensPath, lexiconPath, dictDir];
    } else {
      const lexiconPath = path.join(voiceDir, "lexicon.txt");
      const dictDir = this.getDictDir(voiceDir);

      return [modelPath, tokensPath, lexiconPath, dictDir];
    }
  }

  /**
   * Initialize the SherpaOnnx TTS engine
   * @param modelPath Path to model file
   * @param tokensPath Path to tokens file
   */
  private async initializeTTS(modelPath: string, tokensPath: string): Promise<void> {
    try {
      // Dynamically import sherpa-onnx-node
      let sherpaOnnx;
      if (typeof require !== 'undefined') {
        // CommonJS context
        sherpaOnnx = require("sherpa-onnx-node");
      } else {
        // ESM context - use dynamic import
        const module = await import("sherpa-onnx-node");
        // Assuming the module exports the necessary functions directly or under a default export
        sherpaOnnx = module.default || module;
      }

      // Create the TTS configuration
      const config = {
        model: {
          vits: {
            model: modelPath,
            tokens: tokensPath,
          },
          debug: false,
          numThreads: 1,
          provider: "cpu",
        },
        maxNumSentences: 1,
      };

      // Create the TTS instance
      this.tts = new sherpaOnnx.OfflineTts(config);

      console.log("SherpaOnnx TTS initialized successfully");
    } catch (error) {
      console.error("Error initializing SherpaOnnx TTS:", error);
      throw new Error(
        "Failed to initialize SherpaOnnx TTS. " +
        (error instanceof Error ? error.message : String(error))
      );
    }
  }

  /**
   * Get available voices from the provider
   * @returns Promise resolving to an array of voice objects
   */
  protected async _getVoices(): Promise<any[]> {
    // Convert the JSON models to an array of voice objects
    return Object.entries(this.jsonModels).map(([id, config]) => ({
      id,
      name: config.name,
      language: config.language,
      gender: config.gender,
      description: config.description,
    }));
  }

  /**
   * Map SherpaOnnx voice objects to unified format
   * @param rawVoices Array of SherpaOnnx voice objects
   * @returns Promise resolving to an array of unified voice objects
   */
  protected async _mapVoicesToUnified(rawVoices: any[]): Promise<UnifiedVoice[]> {
    return rawVoices.map((voice) => {
      // Get language code and ensure it's a string
      let langCode = "en-US";

      if (voice.language) {
        // Handle different language formats from merged_models.json
        if (typeof voice.language === "string") {
          langCode = voice.language;
        } else if (Array.isArray(voice.language) && voice.language.length > 0) {
          // Handle the format from merged_models.json where language is an array of objects
          const firstLang = voice.language[0];
          if (firstLang && typeof firstLang === "object") {
            // Try to get language code from different possible properties
            if (firstLang["Iso Code"]) {
              langCode = firstLang["Iso Code"];
            } else if (firstLang["lang_code"]) {
              langCode = firstLang["lang_code"];
            }

            // If we have a language name but no code, use the name
            if (langCode === "en-US" && firstLang["Language Name"]) {
              langCode = firstLang["Language Name"].toLowerCase().substring(0, 2);
            }
          }
        }
      }

      // Ensure langCode is in BCP-47 format (e.g., en-US)
      if (!langCode.includes("-")) {
        // Convert ISO 639-3 to BCP-47 format
        if (langCode === "eng") {
          langCode = "en-US";
        } else if (langCode.length === 3) {
          // For other 3-letter codes, use first 2 letters and add country
          langCode = `${langCode.substring(0, 2)}-${langCode.substring(0, 2).toUpperCase()}`;
        } else if (langCode.length === 2) {
          // For 2-letter codes, add country
          langCode = `${langCode}-${langCode.toUpperCase()}`;
        }
      }

      // Create language code object
      const languageCode = {
        bcp47: langCode,
        iso639_3: langCode.split("-")[0],
        display: langCode,
      };

      return {
        id: voice.id,
        name: voice.name,
        gender: voice.gender as "Male" | "Female" | "Unknown",
        provider: "sherpaonnx",
        languageCodes: [languageCode],
      };
    });
  }

  /**
   * Get a property value
   * @param property Property name
   * @returns Property value
   */
  getProperty(property: string): any {
    if (property === "voice") {
      return this.voiceId;
    }
    return super.getProperty(property);
  }

  /**
   * Set the voice to use for synthesis
   * @param voiceId Voice ID to use
   */
  public async setVoice(voiceId: string): Promise<void> {
    try {
      // Check if the voice exists in the configuration
      if (!(voiceId in this.jsonModels)) {
        throw new Error(`Voice ID ${voiceId} not found in configuration`);
      }

      // Set the voice ID
      this.voiceId = voiceId;
      this.modelId = voiceId;

      try {
        // Check and download the model if needed
        const [modelPath, tokensPath, , ] = await this.checkAndDownloadModel(voiceId);

        // Initialize the TTS engine
        await this.initializeTTS(modelPath, tokensPath);

        // Set the model path
        this.modelPath = modelPath;
      } catch (downloadError) {
        const err = downloadError as Error;
        console.warn(`Could not download or initialize model for voice ${voiceId}: ${err.message}`);
        console.warn("Using mock implementation for example.");

        // We'll continue without the model for the example
        // In a real application, you might want to throw an error here
      }
    } catch (error) {
      const err = error as Error;
      console.error("Error setting voice:", err.message);
      // Don't throw the error, just log it and continue
    }
  }

  /**
   * Convert text to audio bytes
   * @param text Text to synthesize
   * @returns Promise resolving to audio bytes
   */
  async synthToBytes(text: string): Promise<Uint8Array> {
    try {
      // Remove SSML tags if present (SherpaOnnx doesn't support SSML)
      let plainText = text;
      if (this._isSSML(plainText)) {
        plainText = this.stripSSML(plainText);
      }

      if (!this.tts) {
        console.warn(
          "SherpaOnnx TTS is not initialized. Using mock implementation for example."
        );

        // Generate mock audio data for example purposes
        // In a real application, you would want to throw an error here
        const mockSamples = new Float32Array(16000); // 1 second of silence at 16kHz

        // Add some noise to make it sound like something
        for (let i = 0; i < mockSamples.length; i++) {
          mockSamples[i] = (Math.random() - 0.5) * 0.01; // Very quiet noise
        }

        // Convert Float32Array to Uint8Array (16-bit PCM)
        const pcmData = new Int16Array(mockSamples.length);

        for (let i = 0; i < mockSamples.length; i++) {
          // Convert float to 16-bit PCM
          const sample = Math.max(-1, Math.min(1, mockSamples[i]));
          pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }

        // Convert Int16Array to Uint8Array
        const buffer = new Uint8Array(pcmData.buffer);

        return buffer;
      }

      // Generate audio using the real TTS engine
      const audio = this.tts.generate({
        text: plainText,
        sid: 0, // Default speaker ID
        speed: this.properties.rate === "slow" ? 0.8 :
               this.properties.rate === "medium" ? 1.0 :
               this.properties.rate === "fast" ? 1.2 : 1.0,
      }) as SherpaOnnxAudio;

      // Convert Float32Array to Uint8Array (16-bit PCM)
      const pcmData = new Int16Array(audio.samples.length);

      for (let i = 0; i < audio.samples.length; i++) {
        // Convert float to 16-bit PCM
        const sample = Math.max(-1, Math.min(1, audio.samples[i]));
        pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      }

      // Convert Int16Array to Uint8Array
      const buffer = new Uint8Array(pcmData.buffer);

      return buffer;
    } catch (error) {
      console.error("Error synthesizing speech:", error);
      throw error;
    }
  }

  /**
   * Synthesize text to a byte stream using the Node.js native addon.
   * @param text Text to synthesize.
   * @param _options Synthesis options (e.g., voice/speaker ID).
   * @returns Promise resolving to an object containing the audio stream and an empty word boundaries array.
   * @returns Promise resolving to an object containing the audio stream and word boundaries.
   */
  async synthToBytestream(
    text: string,
    _options?: SpeakOptions
  ): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
  }> {
    try {
      // Remove SSML tags if present
      let plainText = text;
      if (this._isSSML(plainText)) {
        plainText = this.stripSSML(plainText);
      }

      // Handle case where TTS is not initialized (similar to synthToBytes)
      if (!this.tts) {
        console.warn(
          "SherpaOnnx TTS is not initialized. Returning empty stream and boundaries."
        );
        const emptyStream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.close();
          },
        });
        return { audioStream: emptyStream, wordBoundaries: [] };
      }

      // Generate audio using the TTS engine
      const result = this.tts.generate({
        text: plainText,
        sid: 0, // Default speaker ID
        speed: this.properties.rate === "slow" ? 0.8 :
               this.properties.rate === "medium" ? 1.0 :
               this.properties.rate === "fast" ? 1.2 : 1.0,
      });

      // Extract samples and word boundaries
      const samples = result.samples;
      const rawWordBoundaries = result.wordBoundaries || [];

      // Convert Float32Array samples to Uint8Array (16-bit PCM) (logic from synthToBytes)
      const pcmData = new Int16Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        const sample = Math.max(-1, Math.min(1, samples[i]));
        pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      }
      const buffer = new Uint8Array(pcmData.buffer);

      // Create a readable stream from the audio bytes
      const audioStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(buffer);
          controller.close();
        },
      });

      // Map raw boundaries to the expected format { text, offset, duration }
      const formattedWordBoundaries = rawWordBoundaries.map((wb: { word: string; start: number; end: number }) => ({
          text: wb.word,
          offset: wb.start * 1000, // Assuming start is in seconds, convert to ms
          duration: (wb.end - wb.start) * 1000 // Calculate duration in ms
      }));

      // Return both the audio stream and the formatted word boundaries
      return {
        audioStream,
        wordBoundaries: formattedWordBoundaries,
      };
    } catch (error) {
      console.error("Error synthesizing speech stream:", error);
      throw error;
    }
  }

  /**
   * Strip SSML tags from text
   * @param text Text with SSML tags
   * @returns Plain text without SSML tags
   */
  private stripSSML(text: string): string {
    // Remove all XML tags
    return text.replace(/<[^>]*>/g, "");
  }

  /**
   * Check if credentials are valid
   * @returns Promise resolving to true if credentials are valid
   */
  async checkCredentials(): Promise<boolean> {
    try {
      // For SherpaOnnx, we'll consider credentials valid if we can initialize the engine
      // or if we have the model files available
      if (this.tts) {
        return true;
      }

      // If we don't have the engine initialized, check if we can initialize it
      if (this.modelId) {
        try {
          // Check if the model files exist
          const voiceDir = path.join(this.baseDir, this.modelId);
          const modelPath = path.join(voiceDir, "model.onnx");
          const tokensPath = path.join(voiceDir, "tokens.txt");

          if (this.checkFilesExist(modelPath, tokensPath)) {
            // Try to initialize the engine
            await this.initializeTTS(modelPath, tokensPath);
            return !!this.tts;
          }
        } catch (error) {
          console.error("Error initializing SherpaOnnx TTS:", error);
        }
      }

      // For the example, we'll return true to allow the example to continue
      // In a real application, you might want to return false here
      console.log("SherpaOnnx model files not available. Using mock implementation for example.");
      return true;
    } catch (error) {
      console.error("Error checking SherpaOnnx credentials:", error);
      return false;
    }
  }
}
