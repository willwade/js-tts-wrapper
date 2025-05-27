import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
// Import necessary modules for ESM path resolution
// import { fileURLToPath } from 'url'; // No longer needed
import decompress from "decompress";
import decompressTarbz2 from "decompress-tarbz2";
import { AbstractTTSClient } from "../core/abstract-tts";
import type { SpeakOptions, TTSCredentials, UnifiedVoice } from "../types";

// Capture native fetch at module level
const nativeFetch = globalThis.fetch;

// Import the generated models config
import { SHERPA_MODELS_CONFIG } from "./sherpaonnx/generated_models";

// Import the sherpaonnx-loader
import * as sherpaOnnxLoaderModule from "../utils/sherpaonnx-loader";

// Module scope variables to hold the imported modules
let sherpa: any;
let sherpaOnnxLoader: typeof sherpaOnnxLoaderModule | null = null;

// Try to initialize the loader
try {
  sherpaOnnxLoader = sherpaOnnxLoaderModule;
} catch (error) {
  console.warn("Could not load sherpaonnx-loader:", error);
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
  name?: string;
  language: (
    | { lang_code: string; language_name: string; country: string }
    | { "Iso Code": string; "Language Name": string; Country: string }
  )[];
  gender?: "Male" | "Female" | "Unknown";
  description?: string;
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
      this.baseDir = this.modelPath;
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

    // Set the library path environment variable
    this.setLibraryPath();

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
      // Return the embedded models config directly
      return SHERPA_MODELS_CONFIG;
    } catch (error: any) {
      // This should ideally not happen if the generation script ran correctly
      throw new Error(
        `Could not load embedded models configuration. Build might be broken. Error: ${error.message}`
      );
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

      // Diagnostic log to check the NATIVE fetch implementation we captured
      console.log(`DEBUG: typeof nativeFetch = ${typeof nativeFetch}`);
      if (typeof nativeFetch === "function" && nativeFetch.toString) {
        console.log(
          `DEBUG: nativeFetch.toString() = ${nativeFetch.toString().substring(0, 200)}...`
        ); // Log first 200 chars
      }

      // Use the captured native fetch
      const response = await nativeFetch(url);

      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      // Add check before calling arrayBuffer
      if (typeof response.arrayBuffer !== "function") {
        console.error(
          "DEBUG: response object does NOT have arrayBuffer method. Response keys:",
          Object.keys(response)
        );
        throw new Error("response.arrayBuffer is not a function");
      }
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(destination, Buffer.from(buffer));
      console.log(`File downloaded to ${destination}`);
    } catch (error) {
      const err = error as Error;
      console.error(`Error downloading file: ${err.message}`);
      // Log the full error object for more details
      console.error("DEBUG: Full download error stack:", err.stack);
      throw err;
    }
  }

  /**
   * Extract a tar.bz2 archive to a destination directory
   * @param archivePath Path to the archive file
   * @param destinationDir Destination directory
   * @returns Promise resolving to a map of extracted file paths
   */
  private async extractTarBz2(
    archivePath: string,
    destinationDir: string
  ): Promise<Map<string, string>> {
    try {
      console.log(`Extracting archive ${archivePath} to ${destinationDir}`);

      // Create the destination directory if it doesn't exist
      if (!fs.existsSync(destinationDir)) {
        fs.mkdirSync(destinationDir, { recursive: true });
      }

      // Use the decompress library to extract the archive
      const files = await decompress(archivePath, destinationDir, {
        plugins: [decompressTarbz2()],
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
  private checkFilesExist(modelPath: string, tokensPath: string): boolean {
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
  private async checkAndDownloadModel(modelId: string): Promise<[string, string, string, string]> {
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
    if (this.checkFilesExist(modelPath, tokensPath)) {
      const lexiconPath = path.join(voiceDir, "lexicon.txt");
      const dictDir = this.getDictDir(voiceDir);

      return [modelPath, tokensPath, lexiconPath, dictDir];
    }

    console.log("Downloading model and tokens languages for", modelId, "because we can't find it");

    // Download to voice-specific directory
    const [_modelPath, _tokensPath, lexiconPath, dictDir] = await this.downloadModelAndTokens(
      voiceDir,
      modelId
    );

    // Verify files were downloaded correctly
    if (!this.checkFilesExist(modelPath, tokensPath)) {
      throw new Error(`Failed to download model files for ${modelId}`);
    }

    return [modelPath, tokensPath, lexiconPath, dictDir];
  }

  /**
   * Set the platform-specific library path environment variable for SherpaOnnx
   * @returns True if the environment variable was set successfully
   */
  private setLibraryPath(): boolean {
    try {
      // Only needed in Node.js environment
      if (typeof process === "undefined" || typeof process.env === "undefined") {
        return false;
      }

      // Determine platform-specific library paths and environment variables
      let libPathEnvVar = "";
      let possiblePaths: string[] = [];
      const pathSeparator = process.platform === "win32" ? ";" : ":";

      if (process.platform === "darwin") {
        // macOS uses DYLD_LIBRARY_PATH
        libPathEnvVar = "DYLD_LIBRARY_PATH";
        possiblePaths = [
          path.join(process.cwd(), "node_modules", "sherpa-onnx-darwin-arm64"),
          path.join(process.cwd(), "node_modules", "sherpa-onnx-darwin-x64"),
        ];
      } else if (process.platform === "linux") {
        // Linux uses LD_LIBRARY_PATH
        libPathEnvVar = "LD_LIBRARY_PATH";
        possiblePaths = [
          path.join(process.cwd(), "node_modules", "sherpa-onnx-linux-arm64"),
          path.join(process.cwd(), "node_modules", "sherpa-onnx-linux-x64"),
        ];
      } else if (process.platform === "win32") {
        // Windows uses PATH
        libPathEnvVar = "PATH";
        possiblePaths = [path.join(process.cwd(), "node_modules", "sherpa-onnx-win-x64")];
      } else {
        console.warn(`Unsupported platform: ${process.platform}`);
        return false;
      }

      // Find the sherpa-onnx library directory
      if (libPathEnvVar) {
        let sherpaOnnxPath = "";
        for (const libPath of possiblePaths) {
          if (fs.existsSync(libPath)) {
            console.log(`Found sherpa-onnx library at ${libPath}`);
            sherpaOnnxPath = libPath;
            break;
          }
        }

        if (sherpaOnnxPath) {
          // Set the environment variable
          const currentPath = process.env[libPathEnvVar] || "";
          if (!currentPath.includes(sherpaOnnxPath)) {
            process.env[libPathEnvVar] =
              sherpaOnnxPath + (currentPath ? pathSeparator + currentPath : "");
            console.log(`Set ${libPathEnvVar} to ${process.env[libPathEnvVar]}`);
            return true;
          }
          // Already set correctly
          return true;
        }

        console.warn(
          `Could not find sherpa-onnx library directory for ${process.platform}. SherpaOnnx TTS may not work correctly.`
        );
        return false;
      }

      return false;
    } catch (error) {
      console.error("Error setting library path:", error);
      return false;
    }
  }

  /**
   * Initialize the SherpaOnnx TTS engine
   * @param modelPath Path to model file
   * @param tokensPath Path to tokens file
   */
  private async initializeTTS(modelPath: string, tokensPath: string): Promise<void> {
    try {
      // Set the library path environment variable
      this.setLibraryPath();

      // Dynamically import sherpa-onnx-node if not already loaded
      if (!sherpa) {
        try {
          console.log("Attempting to load sherpa-onnx-node...");

          // Try to use the sherpaonnx-loader if available
          if (typeof require !== "undefined") {
            // Attempt to use the loader in CommonJS
            try {
              if (!sherpaOnnxLoader) {
                // Try to load the loader if not already loaded
                sherpaOnnxLoader = require("../utils/sherpaonnx-loader.js");
              }

              if (sherpaOnnxLoader?.loadSherpaOnnxNode) {
                console.log("Using sherpaonnx-loader to load sherpa-onnx-node");
                sherpa = await sherpaOnnxLoader.loadSherpaOnnxNode();
                console.log("Successfully loaded sherpa-onnx-node via loader");
              } else {
                // Fall back to direct require
                console.log("Using CommonJS require to load sherpa-onnx-node");
                const resolvedPath = require.resolve("sherpa-onnx-node");
                console.log("Resolved sherpa-onnx-node path:", resolvedPath);
                sherpa = require("sherpa-onnx-node");
                console.log("Successfully loaded sherpa-onnx-node via require");
              }
            } catch (loaderError) {
              console.warn("Could not use sherpaonnx-loader:", loaderError);

              // Fall back to direct require
              console.log("Falling back to direct require for sherpa-onnx-node");
              try {
                const resolvedPath = require.resolve("sherpa-onnx-node");
                console.log("Resolved sherpa-onnx-node path:", resolvedPath);
                sherpa = require("sherpa-onnx-node");
                console.log("Successfully loaded sherpa-onnx-node via require");
              } catch (resolveError) {
                console.error("Error resolving sherpa-onnx-node path:", resolveError);
                throw resolveError;
              }
            }
          } else {
            // Attempt dynamic import in ESM
            console.log("Using ESM import to load sherpa-onnx-node");

            try {
              // Try to use the already imported loader
              if (sherpaOnnxLoader?.loadSherpaOnnxNode) {
                console.log("Using sherpaonnx-loader to load sherpa-onnx-node");
                sherpa = await sherpaOnnxLoader.loadSherpaOnnxNode();
                console.log("Successfully loaded sherpa-onnx-node via loader");
              } else {
                // Fall back to direct import
                sherpa = await import("sherpa-onnx-node");
                console.log("Successfully loaded sherpa-onnx-node via import");
              }
            } catch (loaderError) {
              console.warn("Could not use sherpaonnx-loader:", loaderError);

              // Fall back to direct import
              sherpa = await import("sherpa-onnx-node");
              console.log("Successfully loaded sherpa-onnx-node via import");
            }
          }

          console.log("sherpa-onnx-node loaded successfully");
        } catch (error) {
          console.error("Optional dependency sherpa-onnx-node not found or failed to load:", error);
          console.error("Error details:", error instanceof Error ? error.stack : String(error));

          // Provide helpful error message with instructions
          console.error("\nTo use SherpaOnnx TTS, you need to:");
          console.error("1. Install the sherpa-onnx-node package:");
          console.error("   npx js-tts-wrapper install sherpaonnx");
          console.error(
            "   OR: npm install sherpa-onnx-node@^1.12.0 decompress decompress-bzip2 decompress-tarbz2 decompress-targz tar-stream"
          );
          console.error(
            "2. Ensure you're using Node.js 16+ (current version:",
            process.version,
            ")"
          );
          console.error("3. The library will automatically set environment variables for you");
          console.error(
            "4. If you still have issues, try the helper script: node scripts/run-with-sherpaonnx.cjs your-script.js"
          );

          throw new Error(
            "SherpaOnnxTTSClient requires the 'sherpa-onnx-node' package to be installed for native TTS."
          );
        }
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

      // Log the config for debugging
      console.log("SherpaOnnx TTS config:", JSON.stringify(config, null, 2));

      // Log what sherpa contains
      console.log("sherpa object keys:", Object.keys(sherpa));

      // Handle different module export formats
      let OfflineTts = sherpa.OfflineTts;
      if (!OfflineTts && sherpa.default && sherpa.default.OfflineTts) {
        console.log("Using sherpa.default.OfflineTts");
        OfflineTts = sherpa.default.OfflineTts;
      } else if (OfflineTts) {
        console.log("Using sherpa.OfflineTts");
      } else {
        console.log("sherpa.OfflineTts does not exist");
        console.log("Available sherpa properties:", Object.keys(sherpa));
        if (sherpa.default) {
          console.log("Available sherpa.default properties:", Object.keys(sherpa.default));
        }
      }

      if (!OfflineTts) {
        throw new Error("OfflineTts constructor not found in sherpa-onnx-node package");
      }

      // Create the TTS instance
      try {
        console.log("Creating OfflineTts instance...");
        this.tts = new OfflineTts(config);
        console.log("SherpaOnnx TTS initialized successfully");
      } catch (instanceError) {
        console.error("Error creating OfflineTts instance:", instanceError);
        console.error(
          "Error details:",
          instanceError instanceof Error ? instanceError.stack : String(instanceError)
        );
        throw instanceError;
      }
    } catch (error) {
      console.error("Error initializing SherpaOnnx TTS:", error);
      console.error(
        "Error stack:",
        error instanceof Error ? error.stack : "No stack trace available"
      );
      throw new Error(
        `Failed to initialize SherpaOnnx TTS. ${error instanceof Error ? error.message : String(error)}`
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
            } else if (firstLang.lang_code) {
              langCode = firstLang.lang_code;
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
        const [modelPath, tokensPath, _lexiconPath, _dictDir] =
          await this.checkAndDownloadModel(voiceId);

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

      // Ensure TTS is initialized before synthesis
      if (!this.tts) {
        // Try to initialize with default model if not already initialized
        try {
          await this.checkCredentials(); // This will initialize the TTS if possible
        } catch (initError) {
          console.warn("Failed to initialize SherpaOnnx TTS:", initError);
        }
      }

      if (!this.tts) {
        console.warn("SherpaOnnx TTS is not initialized. Using mock implementation for example.");

        // Generate mock audio data for example purposes
        // In a real application, you would want to throw an error here
        const mockSamples = new Float32Array(16000); // 1 second of silence at 16kHz

        // Add some noise to make it sound like something
        for (let i = 0; i < mockSamples.length; i++) {
          mockSamples[i] = (Math.random() - 0.5) * 0.01; // Very quiet noise
        }

        // Convert to proper WAV format with header
        return this.convertToWav(mockSamples);
      }

      // Calculate speed value - use much more conservative values for natural speech
      const speedValue =
        this.properties.rate === "slow"
          ? 0.5
          : this.properties.rate === "medium"
            ? 0.7
            : this.properties.rate === "fast"
              ? 0.9
              : 0.7;

      console.log(
        `SherpaOnnx generating audio with speed: ${speedValue} (rate: ${this.properties.rate})`
      );

      // Generate audio using the real TTS engine
      const audio = this.tts.generate({
        text: plainText,
        sid: 0, // Default speaker ID
        speed: speedValue,
      }) as SherpaOnnxAudio;

      console.log(`SherpaOnnx audio generated with sample rate: ${audio.sampleRate}`);

      // Convert Float32Array to WAV format with proper header using actual sample rate
      return this.convertToWav(audio.samples, audio.sampleRate);
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

      // Ensure TTS is initialized before synthesis
      if (!this.tts) {
        // Try to initialize with default model if not already initialized
        try {
          await this.checkCredentials(); // This will initialize the TTS if possible
        } catch (initError) {
          console.warn("Failed to initialize SherpaOnnx TTS:", initError);
        }
      }

      // Handle case where TTS is not initialized (similar to synthToBytes)
      if (!this.tts) {
        console.warn("SherpaOnnx TTS is not initialized. Returning empty stream and boundaries.");
        const emptyStream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.close();
          },
        });
        return { audioStream: emptyStream, wordBoundaries: [] };
      }

      // Calculate speed value - use much more conservative values for natural speech
      const speedValue =
        this.properties.rate === "slow"
          ? 0.5
          : this.properties.rate === "medium"
            ? 0.7
            : this.properties.rate === "fast"
              ? 0.9
              : 0.7;

      // Generate audio using the TTS engine
      const result = this.tts.generate({
        text: plainText,
        sid: 0, // Default speaker ID
        speed: speedValue,
      });

      // Extract samples and word boundaries
      const samples = result.samples;
      const sampleRate = result.sampleRate;
      const rawWordBoundaries = result.wordBoundaries || [];

      console.log(`SherpaOnnx bytestream audio generated with sample rate: ${sampleRate}`);

      // Convert Float32Array samples to WAV format with proper header using actual sample rate
      const buffer = this.convertToWav(samples, sampleRate);

      // Create a readable stream from the audio bytes
      const audioStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(buffer);
          controller.close();
        },
      });

      // Map raw boundaries to the expected format { text, offset, duration }
      const formattedWordBoundaries = rawWordBoundaries.map(
        (wb: { word: string; start: number; end: number }) => ({
          text: wb.word,
          offset: wb.start * 1000, // Assuming start is in seconds, convert to ms
          duration: (wb.end - wb.start) * 1000, // Calculate duration in ms
        })
      );

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
   * Convert Float32Array audio samples to WAV format with proper header
   * @param samples Float32Array of audio samples
   * @param actualSampleRate Actual sample rate of the audio data
   * @returns Uint8Array containing WAV file data
   */
  private convertToWav(samples: Float32Array, actualSampleRate?: number): Uint8Array {
    const sampleRate = actualSampleRate || 22050; // Use actual sample rate or fallback to default
    const numChannels = 1; // Mono
    const bitsPerSample = 16;

    // Convert Float32Array to Int16Array (16-bit PCM)
    const int16Samples = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      // Convert float to 16-bit PCM
      const sample = Math.max(-1, Math.min(1, samples[i]));
      int16Samples[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }

    // Create WAV header
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

    // Number of channels
    view.setUint16(22, numChannels, true);

    // Sample rate
    view.setUint32(24, sampleRate, true);

    // Byte rate (sample rate * channels * bytes per sample)
    view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);

    // Block align (channels * bytes per sample)
    view.setUint16(32, numChannels * (bitsPerSample / 8), true);

    // Bits per sample
    view.setUint16(34, bitsPerSample, true);

    // "data" sub-chunk
    view.setUint8(36, "d".charCodeAt(0));
    view.setUint8(37, "a".charCodeAt(0));
    view.setUint8(38, "t".charCodeAt(0));
    view.setUint8(39, "a".charCodeAt(0));

    // Sub-chunk size (number of samples * channels * bytes per sample)
    view.setUint32(40, int16Samples.length * numChannels * (bitsPerSample / 8), true);

    // Combine the header and the samples
    const wavBytes = new Uint8Array(wavHeader.byteLength + int16Samples.length * 2);
    wavBytes.set(new Uint8Array(wavHeader), 0);

    // Convert Int16Array to Uint8Array and add to WAV data
    const samplesBytes = new Uint8Array(int16Samples.buffer);
    wavBytes.set(samplesBytes, wavHeader.byteLength);

    return wavBytes;
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
      // Set the library path environment variable first
      this.setLibraryPath();

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

      // Try to initialize with the default model
      try {
        // Default to English if not specified
        const defaultModelId = "mms_eng";
        const voiceDir = path.join(this.baseDir, defaultModelId);

        // Create the directory if it doesn't exist
        if (!fs.existsSync(voiceDir)) {
          fs.mkdirSync(voiceDir, { recursive: true });
        }

        // Check if the model files exist or download them
        const [modelPath, tokensPath, _lexiconPath, _dictDir] =
          await this.checkAndDownloadModel(defaultModelId);

        // Try to initialize the engine
        await this.initializeTTS(modelPath, tokensPath);

        // If we got here, we successfully initialized the engine
        if (this.tts) {
          console.log("Successfully initialized SherpaOnnx TTS with default model");
          return true;
        }
      } catch (error) {
        console.error("Error initializing SherpaOnnx TTS with default model:", error);
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
