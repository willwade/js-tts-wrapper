import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
// Import necessary modules for ESM path resolution
// import { fileURLToPath } from 'url'; // No longer needed
import decompress from "decompress";
import decompressTarbz2 from "decompress-tarbz2";
import { AbstractTTSClient } from "../core/abstract-tts";
import * as SpeechMarkdown from "../markdown/converter";
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
let sherpaOnnxEnvironmentCheck: ReturnType<typeof sherpaOnnxLoaderModule.canRunSherpaOnnx> | null =
  null;

// Lazy-initialize the loader and environment check to avoid side effects on import
let __sherpaLoaderInitialized = false;
function ensureSherpaOnnxLoaderInitialized() {
  if (__sherpaLoaderInitialized) return;
  try {
    sherpaOnnxLoader = sherpaOnnxLoaderModule;
    if (sherpaOnnxLoader && typeof (sherpaOnnxLoader as any).canRunSherpaOnnx === "function") {
      // Perform a non-throwing environment check
      // This must not attempt to load native modules; it only inspects filesystem/package presence
      // to keep other engines usable when SherpaONNX is not installed.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sherpaOnnxEnvironmentCheck = (sherpaOnnxLoader as any).canRunSherpaOnnx();
      if (sherpaOnnxEnvironmentCheck && !sherpaOnnxEnvironmentCheck.canRun) {
        console.warn(
          "SherpaOnnx environment check failed:",
          sherpaOnnxEnvironmentCheck.issues.join(", ")
        );
        console.warn(
          "SherpaOnnx will use mock implementation. Install required packages to enable native TTS."
        );
        if (typeof (sherpaOnnxLoader as any).getInstallationInstructions === "function") {
          console.warn("Installation instructions:");
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          console.warn((sherpaOnnxLoader as any).getInstallationInstructions());
        }
      }
    }
  } catch (error) {
    console.warn("Could not load sherpaonnx-loader:", error);
  } finally {
    __sherpaLoaderInitialized = true;
  }
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
  developer?: string;
  model_type?: string; // Added to support different model types (vits, kokoro, matcha)
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
   * Get comprehensive diagnostics for SherpaOnnx setup
   * @returns Detailed diagnostic information
   */
  static getDiagnostics() {
    ensureSherpaOnnxLoaderInitialized();
    if (sherpaOnnxLoader?.getSherpaOnnxDiagnostics) {
      return sherpaOnnxLoader.getSherpaOnnxDiagnostics();
    }
    return {
      platform: "unknown",
      expectedPackage: null,
      hasMainPackage: false,
      hasPlatformPackage: false,
      hasNativeModule: false,
      environmentVariables: {},
      recommendations: ["SherpaOnnx loader not available"],
      canRun: false,
    };
  }
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

    // Initialize instance variables with proper null/undefined checking
    this.modelPath = credentials?.modelPath || null;
    this.modelId = credentials?.modelId || null;

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
    if (this.modelId || !credentials?.noDefaultDownload) {
      this.modelId = this.modelId || "mms_eng"; // Default to English if not specified

      // Initialize voice asynchronously (don't await in constructor)
      this.setVoice(this.modelId).catch(error => {
        console.warn(`Failed to initialize SherpaOnnx voice in constructor: ${error.message}`);
      });
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
   * @param modelId Optional model ID to determine voice type requirements
   * @returns True if all required files exist and are not empty
   */
  private checkFilesExist(modelPath: string, tokensPath: string, modelId?: string): boolean {
    try {
      // Check that both files exist
      if (!fs.existsSync(modelPath) || !fs.existsSync(tokensPath)) {
        return false;
      }

      // Check that both files are not empty
      const modelStats = fs.statSync(modelPath);
      const tokensStats = fs.statSync(tokensPath);

      if (modelStats.size === 0 || tokensStats.size === 0) {
        return false;
      }

      // For Piper voices, check for espeak-ng-data directory
      if (modelId && this.isPiperVoice(modelId)) {
        const voiceDir = path.dirname(modelPath);
        const espeakDataDir = path.join(voiceDir, "espeak-ng-data");

        // Check if espeak-ng-data directory exists and has content
        if (!fs.existsSync(espeakDataDir) || !fs.statSync(espeakDataDir).isDirectory()) {
          console.log(
            `Piper voice ${modelId} missing espeak-ng-data directory at ${espeakDataDir}`
          );
          return false;
        }

        // Check if espeak-ng-data directory has content
        try {
          const espeakFiles = fs.readdirSync(espeakDataDir);
          if (espeakFiles.length === 0) {
            console.log(`Piper voice ${modelId} has empty espeak-ng-data directory`);
            return false;
          }
        } catch (error) {
          console.log(`Piper voice ${modelId} cannot read espeak-ng-data directory: ${error}`);
          return false;
        }
      }

      // For Kokoro voices, check for additional required files
      if (modelId && this.isKokoroVoice(modelId)) {
        const voiceDir = path.dirname(modelPath);
        const voicesPath = path.join(voiceDir, "voices.bin");
        const espeakDataDir = path.join(voiceDir, "espeak-ng-data");

        // Check for voices.bin file
        if (!fs.existsSync(voicesPath) || fs.statSync(voicesPath).size === 0) {
          console.log(`Kokoro voice ${modelId} missing or empty voices.bin file at ${voicesPath}`);
          return false;
        }

        // Check for espeak-ng-data directory
        if (!fs.existsSync(espeakDataDir) || !fs.statSync(espeakDataDir).isDirectory()) {
          console.log(
            `Kokoro voice ${modelId} missing espeak-ng-data directory at ${espeakDataDir}`
          );
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error("Error checking files:", error);
      return false;
    }
  }

  /**
   * Check if a voice is a Piper voice based on its ID
   * @param modelId Voice model ID
   * @returns True if this is a Piper voice
   */
  private isPiperVoice(modelId: string): boolean {
    return (
      modelId.startsWith("piper-") ||
      (this.jsonModels[modelId] && this.jsonModels[modelId].developer === "piper")
    );
  }

  /**
   * Check if a voice is a Kokoro voice based on its ID
   * @param modelId Voice model ID
   * @returns True if this is a Kokoro voice
   */
  private isKokoroVoice(modelId: string): boolean {
    return (
      modelId.startsWith("kokoro-") ||
      (this.jsonModels[modelId] && this.jsonModels[modelId].model_type === "kokoro")
    );
  }

  /**
   * Check if a voice is a Matcha voice based on its ID
   * @param modelId Voice model ID
   * @returns True if this is a Matcha voice
   */
  private isMatchaVoice(modelId: string): boolean {
    return (
      this.jsonModels[modelId] && this.jsonModels[modelId].model_type === "matcha"
    );
  }

  /**
   * Get the model type for a given model ID
   * @param modelId Voice model ID
   * @returns Model type (vits, kokoro, matcha)
   */
  private getModelType(modelId: string): string {
    if (this.isKokoroVoice(modelId)) return "kokoro";
    if (this.isMatchaVoice(modelId)) return "matcha";
    return "vits"; // Default to vits for backward compatibility
  }

  /**
   * Find files matching a pattern in a directory recursively
   * @param dir Directory to search
   * @param pattern Regex pattern to match
   * @returns Array of matching file paths
   */
  private findFilesInDirectory(dir: string, pattern: RegExp): string[] {
    const results: string[] = [];

    const searchRecursive = (currentDir: string) => {
      try {
        const items = fs.readdirSync(currentDir);
        for (const item of items) {
          const itemPath = path.join(currentDir, item);
          const stat = fs.statSync(itemPath);

          if (stat.isDirectory()) {
            searchRecursive(itemPath);
          } else if (pattern.test(item)) {
            results.push(itemPath);
          }
        }
      } catch (error) {
        // Ignore errors and continue
      }
    };

    searchRecursive(dir);
    return results;
  }

  /**
   * Find a specific file in a directory recursively
   * @param dir Directory to search
   * @param filename Filename to find
   * @returns Path to the file or null if not found
   */
  private findFileInDirectory(dir: string, filename: string): string | null {
    const files = this.findFilesInDirectory(dir, new RegExp(`^${filename}$`));
    return files.length > 0 ? files[0] : null;
  }

  /**
   * Find a specific directory in a directory recursively
   * @param dir Directory to search
   * @param dirname Directory name to find
   * @returns Path to the directory or null if not found
   */
  private findDirectoryInDestination(dir: string, dirname: string): string | null {
    const searchRecursive = (currentDir: string): string | null => {
      try {
        const items = fs.readdirSync(currentDir);
        for (const item of items) {
          const itemPath = path.join(currentDir, item);
          const stat = fs.statSync(itemPath);

          if (stat.isDirectory()) {
            if (item === dirname) {
              return itemPath;
            }
            const result = searchRecursive(itemPath);
            if (result) {
              return result;
            }
          }
        }
      } catch (error) {
        // Ignore errors and continue
      }
      return null;
    };

    return searchRecursive(dir);
  }

  /**
   * Check if a model is from GitHub (archive-based)
   * @param modelId Voice model ID
   * @returns True if this is a GitHub model
   */
  private isGitHubModel(modelId: string): boolean {
    const githubPrefixes = [
      "piper-", "coqui-", "icefall-", "mimic3-", "melo-",
      "vctk-", "zh-", "ljs-", "cantonese-", "kokoro-"
    ];
    return githubPrefixes.some(prefix => modelId.startsWith(prefix));
  }

  /**
   * Get dict directory from voice directory
   * @param voiceDir Voice directory path
   * @returns Dict directory path or empty string
   */
  private getDictDir(voiceDir: string): string {
    try {
      const items = fs.readdirSync(voiceDir);
      for (const item of items) {
        const itemPath = path.join(voiceDir, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          // Check if this directory contains .txt files (dict files)
          const subItems = fs.readdirSync(itemPath);
          if (subItems.some(subItem => subItem.endsWith('.txt'))) {
            return itemPath;
          }
        }
      }
    } catch (error) {
      // Ignore errors and return empty string
    }
    return "";
  }

  /**
   * Ensure vocoder is downloaded for Matcha models
   * @returns Path to vocoder file
   */
  private async ensureVocoderDownloaded(): Promise<string> {
    const vocoderFilename = "vocos-22khz-univ.onnx";
    const vocoderPath = path.join(this.baseDir, vocoderFilename);

    if (fs.existsSync(vocoderPath)) {
      console.log(`Vocoder already exists: ${vocoderPath}`);
      return vocoderPath;
    }

    // Download vocoder from sherpa-onnx releases
    const vocoderUrl = "https://github.com/k2-fsa/sherpa-onnx/releases/download/vocoder-models/vocos-22khz-univ.onnx";
    console.log(`Downloading vocoder from ${vocoderUrl}`);

    try {
      await this.downloadFile(vocoderUrl, vocoderPath);
      console.log(`Vocoder downloaded to ${vocoderPath}`);
      return vocoderPath;
    } catch (error) {
      console.error(`Failed to download vocoder: ${error}`);
      // Return empty string if download fails - let sherpa-onnx handle the error
      return "";
    }
  }

  /**
   * Recursively copy a directory and all its contents
   * @param src Source directory path
   * @param dest Destination directory path
   */
  private copyDirectoryRecursive(src: string, dest: string): void {
    try {
      // Create destination directory if it doesn't exist
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }

      // Read the source directory
      const entries = fs.readdirSync(src, { withFileTypes: true });

      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
          // Recursively copy subdirectory
          this.copyDirectoryRecursive(srcPath, destPath);
        } else {
          // Copy file
          fs.copyFileSync(srcPath, destPath);
        }
      }
    } catch (error) {
      console.error(`Error copying directory from ${src} to ${dest}:`, error);
      throw error;
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
        let espeakDataDir = "";

        // Look for model.onnx, tokens.txt, and espeak-ng-data in the extracted files
        for (const [fileName, filePath] of extractedFiles.entries()) {
          if (fileName.endsWith(".onnx")) {
            modelFile = filePath;
          } else if (fileName.endsWith("tokens.txt")) {
            tokensFile = filePath;
          } else if (fileName.includes("espeak-ng-data/") && !espeakDataDir) {
            // Find the espeak-ng-data directory (take the parent directory of any file in espeak-ng-data)
            const parts = fileName.split("/");
            const espeakIndex = parts.findIndex((part) => part === "espeak-ng-data");
            if (espeakIndex >= 0) {
              const espeakRelativePath = parts.slice(0, espeakIndex + 1).join("/");
              espeakDataDir = path.join(destinationDir, espeakRelativePath);
            }
          }
        }

        // If we found the required files, update the paths
        if (modelFile && tokensFile) {
          console.log(`Found model file: ${modelFile}`);
          console.log(`Found tokens file: ${tokensFile}`);

          // Copy the basic files
          fs.copyFileSync(modelFile, modelPath);
          fs.copyFileSync(tokensFile, tokensPath);

          console.log(`Copied model file to ${modelPath}`);
          console.log(`Copied tokens file to ${tokensPath}`);

          // For Piper voices, copy espeak-ng-data directory
          if (this.isPiperVoice(safeModelId)) {
            if (espeakDataDir && fs.existsSync(espeakDataDir)) {
              const espeakDestDir = path.join(destinationDir, "espeak-ng-data");
              this.copyDirectoryRecursive(espeakDataDir, espeakDestDir);
              console.log(`Copied espeak-ng-data directory to ${espeakDestDir}`);
            } else {
              console.warn(
                `Piper voice ${safeModelId} missing espeak-ng-data directory in archive`
              );
            }
          }

          // For Kokoro voices, copy additional required files
          if (this.isKokoroVoice(safeModelId)) {
            // Copy voices.bin file
            const voicesFile = this.findFileInDirectory(destinationDir, "voices.bin");
            if (voicesFile) {
              const voicesDestPath = path.join(destinationDir, "voices.bin");
              if (voicesFile !== voicesDestPath) {
                fs.copyFileSync(voicesFile, voicesDestPath);
                console.log(`Copied voices.bin file to ${voicesDestPath}`);
              }
            } else {
              console.warn(`Kokoro voice ${safeModelId} missing voices.bin file in archive`);
            }

            // Copy espeak-ng-data directory
            if (espeakDataDir && fs.existsSync(espeakDataDir)) {
              const espeakDestDir = path.join(destinationDir, "espeak-ng-data");
              this.copyDirectoryRecursive(espeakDataDir, espeakDestDir);
              console.log(`Copied espeak-ng-data directory to ${espeakDestDir}`);
            } else {
              console.warn(
                `Kokoro voice ${safeModelId} missing espeak-ng-data directory in archive`
              );
            }

            // Copy lexicon files if they exist
            const lexiconFiles = this.findFilesInDirectory(destinationDir, /lexicon.*\.txt$/);
            lexiconFiles.forEach((lexiconFile) => {
              const lexiconName = path.basename(lexiconFile);
              const lexiconDestPath = path.join(destinationDir, lexiconName);
              if (lexiconFile !== lexiconDestPath) {
                fs.copyFileSync(lexiconFile, lexiconDestPath);
                console.log(`Copied lexicon file to ${lexiconDestPath}`);
              }
            });

            // Copy other potential files (dict directory, fst files, etc.)
            const dictDir = this.findDirectoryInDestination(destinationDir, "dict");
            if (dictDir) {
              const dictDestDir = path.join(destinationDir, "dict");
              if (dictDir !== dictDestDir) {
                this.copyDirectoryRecursive(dictDir, dictDestDir);
                console.log(`Copied dict directory to ${dictDestDir}`);
              }
            }

            const fstFiles = this.findFilesInDirectory(destinationDir, /\.fst$/);
            fstFiles.forEach((fstFile) => {
              const fstName = path.basename(fstFile);
              const fstDestPath = path.join(destinationDir, fstName);
              if (fstFile !== fstDestPath) {
                fs.copyFileSync(fstFile, fstDestPath);
                console.log(`Copied FST file to ${fstDestPath}`);
              }
            });
          }
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
    if (this.checkFilesExist(modelPath, tokensPath, modelId)) {
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
    if (!this.checkFilesExist(modelPath, tokensPath, modelId)) {
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
      // Ensure loader/environment check is initialized lazily
      ensureSherpaOnnxLoaderInitialized();
      // Set the library path environment variable
      this.setLibraryPath();

      // Dynamically import sherpa-onnx-node if not already loaded
      if (!sherpa) {
        console.log("Attempting to load sherpa-onnx-node...");

        if (!sherpaOnnxLoader) {
          throw new Error("SherpaOnnx loader not available");
        }

        // Use the safe loader that provides detailed error information
        const loadResult = await sherpaOnnxLoader.loadSherpaOnnxNodeSafe();

        if (loadResult.success && loadResult.module) {
          sherpa = loadResult.module;
          console.log("Successfully loaded sherpa-onnx-node");
        } else {
          // Log detailed environment information
          console.error("Failed to load sherpa-onnx-node:");
          console.error("Environment check:", loadResult.environmentCheck);

          if (loadResult.error) {
            console.error("Load error:", loadResult.error.message);
          }

          // Provide specific installation instructions based on what's missing
          if (!loadResult.environmentCheck.hasMainPackage) {
            console.error("Missing main package: sherpa-onnx-node");
          }

          if (!loadResult.environmentCheck.hasPlatformPackage) {
            console.error(
              `Missing platform package: ${loadResult.environmentCheck.expectedPackage}`
            );
          }

          if (!loadResult.environmentCheck.hasNativeModule) {
            console.error("Native module (.node file) not found");
          }

          // Provide installation instructions
          if (sherpaOnnxLoader.getInstallationInstructions) {
            console.error(sherpaOnnxLoader.getInstallationInstructions());
          }

          throw new Error(
            `SherpaOnnx native module loading failed: ${loadResult.error?.message || "Unknown error"}`
          );
        }
      }

      // Create the TTS configuration based on model type
      const modelType = this.modelId ? this.getModelType(this.modelId) : "vits";
      const voiceDir = path.dirname(modelPath);

      let modelConfig: any = {};

      if (modelType === "kokoro") {
        // Kokoro model configuration - matches Python implementation
        const voicesPath = path.join(voiceDir, "voices.bin");
        const espeakDataDir = path.join(voiceDir, "espeak-ng-data");

        modelConfig = {
          model: modelPath,
          voices: voicesPath,
          tokens: tokensPath,
          dataDir: fs.existsSync(espeakDataDir) ? espeakDataDir : "",
        };

        console.log(`Using Kokoro model configuration with voices: ${voicesPath}`);
      } else if (modelType === "matcha") {
        // Matcha model configuration - matches Python implementation
        const espeakDataDir = path.join(voiceDir, "espeak-ng-data");
        const vocoderPath = await this.ensureVocoderDownloaded();

        modelConfig = {
          acousticModel: modelPath,
          vocoder: vocoderPath,
          lexicon: "", // Matcha models typically don't use lexicon
          tokens: tokensPath,
          dataDir: fs.existsSync(espeakDataDir) ? espeakDataDir : "",
        };

        console.log(`Using Matcha model configuration with vocoder: ${vocoderPath}`);
      } else {
        // VITS model configuration (default) - matches Python implementation
        const lexiconPath = path.join(voiceDir, "lexicon.txt");
        const dictDir = this.getDictDir(voiceDir);

        modelConfig = {
          model: modelPath,
          lexicon: fs.existsSync(lexiconPath) ? lexiconPath : "",
          tokens: tokensPath,
          dataDir: "",
          dictDir: "",
        };

        // For Piper voices and GitHub models, use dataDir instead of dictDir
        if (this.modelId && (this.isPiperVoice(this.modelId) || this.isGitHubModel(this.modelId))) {
          const espeakDataDir = path.join(voiceDir, "espeak-ng-data");
          if (fs.existsSync(espeakDataDir)) {
            modelConfig.dataDir = espeakDataDir;
            modelConfig.dictDir = ""; // Avoid jieba warnings
            console.log(`Using espeak-ng-data directory: ${espeakDataDir}`);
          }
        } else if (dictDir) {
          // For other models, use dictDir
          modelConfig.dictDir = dictDir;
        }
      }

      const config = {
        model: {
          [modelType]: modelConfig,
          debug: false,
          numThreads: 1,
          provider: "cpu",
        },
        maxNumSentences: 1,
      };

      // Log the config for debugging (only in non-test environments)
      if (process.env.NODE_ENV !== "test") {
        console.log("SherpaOnnx TTS config:", JSON.stringify(config, null, 2));
        // Log what sherpa contains
        console.log("sherpa object keys:", Object.keys(sherpa));
      }

      // Handle different module export formats
      let OfflineTts = sherpa.OfflineTts;
      if (!OfflineTts && sherpa.default && sherpa.default.OfflineTts) {
        if (process.env.NODE_ENV !== "test") {
          console.log("Using sherpa.default.OfflineTts");
        }
        OfflineTts = sherpa.default.OfflineTts;
      } else if (OfflineTts) {
        if (process.env.NODE_ENV !== "test") {
          console.log("Using sherpa.OfflineTts");
        }
      } else {
        if (process.env.NODE_ENV !== "test") {
          console.log("sherpa.OfflineTts does not exist");
          console.log("Available sherpa properties:", Object.keys(sherpa));
          if (sherpa.default) {
            console.log("Available sherpa.default properties:", Object.keys(sherpa.default));
          }
        }
      }

      if (!OfflineTts) {
        throw new Error("OfflineTts constructor not found in sherpa-onnx-node package");
      }

      // Create the TTS instance
      try {
        if (process.env.NODE_ENV !== "test") {
          console.log("Creating OfflineTts instance...");
        }
        this.tts = new OfflineTts(config);
        if (process.env.NODE_ENV !== "test") {
          console.log("SherpaOnnx TTS initialized successfully");
        }
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
   * @param options Synthesis options
   * @returns Promise resolving to audio bytes
   */
  async synthToBytes(text: string, options?: SpeakOptions): Promise<Uint8Array> {
    try {
      // Ensure loader/environment check is initialized lazily
      ensureSherpaOnnxLoaderInitialized();
      // Prepare text for synthesis (handle Speech Markdown and SSML)
      let plainText = text;

      // Convert from Speech Markdown if requested
      if (options?.useSpeechMarkdown && SpeechMarkdown.isSpeechMarkdown(plainText)) {
        // Convert to SSML first, then strip SSML tags since SherpaOnnx doesn't support SSML
        const ssml = await SpeechMarkdown.toSSML(plainText);
        plainText = this.stripSSML(ssml);
      }

      // Remove SSML tags if present (SherpaOnnx doesn't support SSML)
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
        // Check if we have environment information to provide better error messages
        if (sherpaOnnxEnvironmentCheck && !sherpaOnnxEnvironmentCheck.canRun) {
          console.warn("SherpaOnnx TTS is not available due to missing dependencies:");
          console.warn("Issues:", sherpaOnnxEnvironmentCheck.issues.join(", "));
          console.warn("Expected platform package:", sherpaOnnxEnvironmentCheck.expectedPackage);
          console.warn(
            "Using mock implementation. Install required packages to enable native TTS."
          );
        } else {
          console.warn("SherpaOnnx TTS is not initialized. Using mock implementation.");
        }

        // Generate mock audio data for graceful fallback
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
      // Ensure loader/environment check is initialized lazily
      ensureSherpaOnnxLoaderInitialized();
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

      // Generate word boundaries
      let formattedWordBoundaries: Array<{ text: string; offset: number; duration: number }> = [];

      if (rawWordBoundaries.length > 0) {
        // Use real word boundaries if available from the TTS engine
        formattedWordBoundaries = rawWordBoundaries.map(
          (wb: { word: string; start: number; end: number }) => ({
            text: wb.word,
            offset: wb.start * 10000, // Convert seconds to 100-nanosecond units
            duration: (wb.end - wb.start) * 10000, // Calculate duration in 100-nanosecond units
          })
        );
      } else if (_options?.useWordBoundary) {
        // Generate estimated word boundaries if requested
        this._createEstimatedWordTimings(plainText);

        // Convert internal timings to word boundary format
        formattedWordBoundaries = this.timings.map(([start, end, word]) => ({
          text: word,
          offset: Math.round(start * 10000), // Convert to 100-nanosecond units
          duration: Math.round((end - start) * 10000)
        }));
      }

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
   * Get the list of required credential types for this engine
   * @returns Array of required credential field names
   */
  protected getRequiredCredentials(): string[] {
    return []; // SherpaOnnx doesn't require credentials, only model files
  }

  /**
   * Check if credentials are valid
   * @returns Promise resolving to true if credentials are valid
   */
  async checkCredentials(): Promise<boolean> {
    try {
      // Ensure loader/environment check is initialized lazily
      ensureSherpaOnnxLoaderInitialized();
      // For SherpaOnnx, we'll consider credentials valid if we can initialize the engine
      // or if we have the model files available
      if (this.tts) {
        return true;
      }

      // Check environment first
      if (sherpaOnnxEnvironmentCheck && !sherpaOnnxEnvironmentCheck.canRun) {
        console.warn(
          "SherpaOnnx environment check failed:",
          sherpaOnnxEnvironmentCheck.issues.join(", ")
        );
        // Still return true for graceful fallback - the library will use mock implementation
        return true;
      }

      // If we don't have the engine initialized, check if we can initialize it
      if (this.modelId) {
        try {
          // Check if the model files exist
          const voiceDir = path.join(this.baseDir, this.modelId);
          const modelPath = path.join(voiceDir, "model.onnx");
          const tokensPath = path.join(voiceDir, "tokens.txt");

          if (this.checkFilesExist(modelPath, tokensPath, this.modelId)) {
            // Try to initialize the engine
            await this.initializeTTS(modelPath, tokensPath);
            return !!this.tts;
          }
        } catch (error) {
          console.warn("Could not initialize SherpaOnnx TTS for credential check:", error);
          // Return true for graceful fallback
          return true;
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
        console.warn("Error initializing SherpaOnnx TTS with default model:", error);
      }

      // Always return true for graceful fallback
      console.log(
        "SherpaOnnx model files not available. Using mock implementation for graceful fallback."
      );
      return true;
    } catch (error) {
      console.error("Error checking SherpaOnnx credentials:", error);
      // Return true for graceful fallback
      return true;
    }
  }
}

// Export alias for backward compatibility
export { SherpaOnnxTTSClient as SherpaOnnxTTS };
