/**
 * SherpaOnnx WebAssembly TTS Client
 *
 * Enhanced version with multi-model support for browser environments.
 * Supports dynamic loading of Kokoro, Matcha, and VITS models.
 *
 * BACKWARD COMPATIBILITY: Maintains full compatibility with existing API.
 * New multi-model features are opt-in via constructor options.
 */

import { AbstractTTSClient } from "../core/abstract-tts";
import * as SpeechMarkdown from "../markdown/converter";
import * as SSMLUtils from "../core/ssml-utils";
import type { SpeakOptions, TTSCredentials, UnifiedVoice, WordBoundaryCallback } from "../types";
import { fileSystem, isBrowser, isNode, pathUtils } from "../utils/environment";
import { estimateWordBoundaries } from "../utils/word-timing-estimator";

// Enhanced model type definitions for multi-model support
export type ModelType = "kokoro" | "matcha" | "vits" | "mms";

export interface ModelConfig {
  id: string;
  type: ModelType;
  name: string;
  language: string;
  gender: string;
  sampleRate: number;
  url?: string; // Source archive URL (usually .tar.bz2)
  compressed?: boolean; // Whether the URL points to a compressed archive
  files: {
    model: string;
    tokens: string;
    voices?: string; // For Kokoro models
    vocoder?: string; // For Matcha models
    dataDir?: string; // For eSpeak data
  };
  size: number; // Model size in bytes
}

export interface ModelFiles {
  model: ArrayBuffer;
  tokens: ArrayBuffer;
  voices?: ArrayBuffer;
  vocoder?: ArrayBuffer;
  dataDir?: ArrayBuffer;
}

export interface LoadedModel {
  config: ModelConfig;
  handle: number;
  loaded: boolean;
  lastUsed: number;
}

// Enhanced WASM options for multi-model support
export interface EnhancedWasmOptions {
  enableMultiModel?: boolean; // Enable multi-model features (default: false for backward compatibility)
  maxCachedModels?: number; // Maximum models to keep in memory (default: 3)
  modelsMirrorBaseUrl?: string; // Optional mirror base for model archives (CORS-friendly)
}

// Add SherpaOnnx to the Window interface
declare global {
  interface Window {
    SherpaOnnx?: any;
  }
}

// Enhanced SherpaOnnx WebAssembly module interface with multi-model support
interface SherpaOnnxWasmModule {
  // Legacy methods (for backward compatibility)
  _ttsCreateOffline?: (configPtr: number) => number;
  _ttsDestroyOffline?: (tts: number) => void;
  _ttsGenerateWithOffline?: (tts: number, textPtr: number) => number;
  _ttsNumSamplesWithOffline?: (tts: number) => number;
  _ttsSampleRateWithOffline?: (tts: number) => number;
  _ttsGetSamplesWithOffline?: (tts: number, samplesPtr: number) => void;

  // Enhanced multi-model methods
  _LoadKokoroModel?: (
    modelPtr: number,
    modelSize: number,
    tokensPtr: number,
    tokensSize: number,
    voicesPtr: number,
    voicesSize: number
  ) => number;
  _LoadMatchaModel?: (
    modelPtr: number,
    modelSize: number,
    tokensPtr: number,
    tokensSize: number,
    vocoderPtr: number,
    vocoderSize: number
  ) => number;
  _LoadVitsModel?: (
    modelPtr: number,
    modelSize: number,
    tokensPtr: number,
    tokensSize: number
  ) => number;
  _SwitchToModel?: (modelId: number) => number;
  _UnloadModel?: (modelId: number) => void;
  _GenerateAudio?: (text: string, speakerId: number, speed: number) => any;
  _GetCurrentModelInfo?: () => any;

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
 * Extended options for SherpaOnnxWasm TTS
 */
export interface SherpaOnnxWasmTTSOptions extends SpeakOptions {
  format?: "wav"; // Define formats supported by this client (only WAV)
}

/**
 * Enhanced SherpaOnnx WebAssembly TTS Client
 *
 * Supports both legacy single-model mode and new multi-model mode.
 * Maintains full backward compatibility with existing API.
 */
export class SherpaOnnxWasmTTSClient extends AbstractTTSClient {
  private wasmModule: SherpaOnnxWasmModule | null = null;
  private tts: any = null;
  private wasmPath = "";
  private wasmLoaded = false;
  private wasmBaseUrl?: string;
  private mergedModelsUrl?: string;
  private modelsMirrorUrl?: string;

  // Enhanced multi-model support
  private enhancedOptions: EnhancedWasmOptions;
  private modelRepository?: ModelRepository;
  private modelManager?: WasmModelManager;
  private currentVoiceId?: string;

  /**
   * Create a new SherpaOnnx WebAssembly TTS client
   * @param credentials Optional credentials object
   * @param enhancedOptions Optional enhanced options for multi-model support
   */
  constructor(credentials: TTSCredentials = {}, enhancedOptions: EnhancedWasmOptions = {}) {
    super(credentials);

    // Capabilities: Browser-only engine, requires WASM runtime
    this.capabilities = { browserSupported: true, nodeSupported: false, needsWasm: true };

    // Set default sample rate for the Piper model
    this.sampleRate = 22050;

    // Optional configuration from credentials
    this.wasmPath = (credentials as any).wasmPath || ""; // JS glue path (if provided)
    this.wasmBaseUrl = (credentials as any).wasmBaseUrl || undefined; // Base URL for glue+wasm
    this.mergedModelsUrl =
      (credentials as any).mergedModelsUrl || (credentials as any).modelsUrl || undefined;
    this.modelsMirrorUrl =
      (credentials as any).modelsMirrorUrl || enhancedOptions?.modelsMirrorBaseUrl || undefined;

    // Enhanced options with defaults for backward compatibility
    this.enhancedOptions = {
      enableMultiModel: false, // Disabled by default for backward compatibility
      maxCachedModels: 3,
      modelsMirrorBaseUrl: this.modelsMirrorUrl,
      ...enhancedOptions,
    };

    // Initialize multi-model components if enabled
    if (this.enhancedOptions.enableMultiModel) {
      this.modelRepository = new ModelRepository(this.mergedModelsUrl);
    }
  }

  /**
   * Get the list of required credential types for this engine
   * @returns Array of required credential field names
   */
  protected getRequiredCredentials(): string[] {
    return []; // SherpaOnnx WASM doesn't require credentials, only WASM files
  }

  /**
   * Check if the credentials are valid
   * @returns Promise resolving to true if credentials are valid
   */
  async checkCredentials(): Promise<boolean> {
    try {
      // First check if SherpaOnnx is properly initialized
      const status = this.getInitializationStatus();
      if (status.isInitialized) {
        return true;
      }

      // In a browser environment, we can't check if the WASM file exists
      // so we'll check if it's likely to be loaded later
      if (typeof window !== "undefined") {
        if (status.issues.length > 0) {
          console.warn("SherpaOnnx not yet initialized:", status.issues.join(", "));
        }
        return true; // Assume it will be loaded later in browser
      }

      // In Node.js, check if the WASM file exists
      if (isNode && this.wasmPath && fileSystem.existsSync(this.wasmPath)) {
        if (status.issues.length > 0) {
          console.warn(
            "SherpaOnnx WASM file exists but not initialized:",
            status.issues.join(", ")
          );
        }
        return true;
      }

      // If no WASM path is provided, assume it will be loaded later
      if (!this.wasmPath) {
        console.warn(
          "No WASM path provided. SherpaOnnx WebAssembly TTS will need to be initialized manually."
        );
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
      // Enhanced multi-model support
      if (this.enhancedOptions.enableMultiModel && this.modelRepository) {
        console.log("Using enhanced multi-model voice repository");

        try {
          const models = this.modelRepository.getAvailableModels();

          return models.map((model) => ({
            id: model.id,
            name: model.name,
            gender: model.gender as any,
            provider: "sherpaonnx-wasm" as const,
            languageCodes: [
              {
                bcp47: model.language,
                iso639_3: model.language.split("-")[0],
                display: model.language,
              },
            ],
          }));
        } catch (error) {
          console.error("Error getting voices from enhanced repository:", error);
          // Fall through to legacy mode
        }
      }

      // Legacy voice loading (backward compatibility)
      console.log("Using legacy voice loading mode");

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
            const response = await fetch(this.mergedModelsUrl || "./data/merged_models.json");
            if (response.ok) {
              const modelsJson = await response.text();
              voiceModels = JSON.parse(modelsJson);
            } else {
              console.warn("Voice models JSON file not available in browser environment.");
              // Return a default voice for testing
              return [
                {
                  id: "piper_en_US",
                  name: "Piper English (US)",
                  gender: "Unknown",
                  provider: "sherpaonnx-wasm" as const,
                  languageCodes: [
                    {
                      bcp47: "en-US",
                      iso639_3: "eng",
                      display: "English (US)",
                    },
                  ],
                },
              ];
            }
          } catch (fetchError) {
            console.warn("Failed to fetch voice models JSON file:", fetchError);
            // Return a default voice for testing
            return [
              {
                id: "piper_en_US",
                name: "Piper English (US)",
                gender: "Unknown",
                provider: "sherpaonnx-wasm" as const,
                languageCodes: [
                  {
                    bcp47: "en-US",
                    iso639_3: "eng",
                    display: "English (US)",
                  },
                ],
              },
            ];
          }
        }
      } catch (error) {
        console.error("Error loading voice models:", error);
      }

      // Normalize merged_models.json which may be an object map (id -> model)
      const entries: any[] = Array.isArray(voiceModels)
        ? voiceModels
        : voiceModels && typeof voiceModels === "object"
          ? Object.values(voiceModels)
          : [];

      console.log("Loaded SherpaOnnx model entries:", entries?.length || 0);

      const voices = entries.map((model: any) => {
        const langCode =
          model?.language?.[0]?.lang_code ||
          (typeof model?.language === "string" ? model.language : model?.language_code || "en");
        const bcp47 = langCode || "en";
        const iso = bcp47.split("-")[0] || "en";
        const id = model?.id || model?.model_id || model?.name || "sherpa-model";
        const name = model?.name || id;
        return {
          id,
          name,
          gender: (model?.gender || "Unknown") as any,
          provider: "sherpaonnx-wasm" as const,
          languageCodes: [
            {
              bcp47,
              iso639_3: iso,
              display: model?.language_display || bcp47,
            },
          ],
        };
      });

      // If no voices found, return a default voice for backward compatibility
      if (voices.length === 0) {
        return [
          {
            id: "sherpa_en",
            name: "Sherpa English",
            gender: "Unknown",
            provider: "sherpaonnx-wasm" as const,
            languageCodes: [
              {
                bcp47: "en-US",
                iso639_3: "eng",
                display: "English (US)",
              },
            ],
          },
        ];
      }

      return voices;
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
        console.log(
          `Current state: wasmLoaded=${this.wasmLoaded}, wasmModule=${!!this.wasmModule}`
        );

        try {
          // Store the URL for later use
          this.wasmPath = wasmUrl;
          console.log("Setting wasmPath to:", this.wasmPath);

          // Auto-load JS glue and WASM if not present
          const w = window as any;
          let baseUrl: string | undefined = this.wasmBaseUrl;
          let scriptUrl: string | undefined;
          const provided = wasmUrl || this.wasmPath || "";
          if (provided) {
            if (/\.js($|\?)/.test(provided)) {
              scriptUrl = provided;
              if (!baseUrl) {
                const idx = provided.lastIndexOf("/");
                if (idx > -1) baseUrl = provided.slice(0, idx);
              }
            } else {
              baseUrl = provided;
            }
          }
          if (!scriptUrl && baseUrl) {
            const b = baseUrl.replace(/\/$/, "");
            // Default glue filename (can be overridden by passing full wasmPath)
            scriptUrl = `${b}/sherpaonnx.js`;
          }
          if (!scriptUrl) {
            console.warn("No WASM script URL provided; attempting default ./sherpaonnx.js");
          }

          const resolvedScriptUrl = scriptUrl ?? "./sherpaonnx.js";

          // Persist the resolved script URL
          this.wasmPath = resolvedScriptUrl;
          console.log("Resolved wasmPath to:", this.wasmPath);

          // Ensure Module.locateFile points to the base for .wasm
          w.Module = w.Module || {};
          if (baseUrl) {
            const b = baseUrl.replace(/\/$/, "");
            w.Module.locateFile = (p: string) => `${b}/${p}`;
          }

          const deriveBaseFromScript = () => {
            const lastSlash = resolvedScriptUrl.lastIndexOf("/");
            return lastSlash >= 0 ? resolvedScriptUrl.slice(0, lastSlash) : ".";
          };
          const normalizedBase = (baseUrl ?? deriveBaseFromScript()).replace(/\/$/, "");

          // Determine if we're using the wrapper glue (sherpa-onnx-tts.js)
          const isWrapper = /sherpa-onnx-tts\.js($|\?)/.test(resolvedScriptUrl);
          const mainGlueUrl = `${normalizedBase}/sherpa-onnx-wasm-main-tts.js`;

          // If a compatible module is already present, don't inject again
          const moduleReady = () => {
            const hasModule = typeof w.Module !== "undefined";
            const hasCreate = typeof w.createOfflineTts === "function";
            const hasOffline = !!(
              hasModule &&
              w.Module &&
              (w.Module.OfflineTts || w.Module.calledRun)
            );
            const hasUtf8 = !!(hasModule && typeof w.Module.lengthBytesUTF8 === "function");
            const hasMalloc = !!(hasModule && typeof w.Module._malloc === "function");
            const hasRun = !!(hasModule && w.Module && w.Module.calledRun === true);
            // Wrapper requires full runtime ready: createOfflineTts + lengthBytesUTF8 + _malloc + calledRun
            return (
              hasModule &&
              (isWrapper
                ? hasCreate && hasUtf8 && hasMalloc && hasRun
                : hasCreate || hasOffline || hasMalloc)
            );
          };

          if (!moduleReady()) {
            if (isWrapper) {
              // Ensure main Emscripten glue is loaded first
              const existingMain = document.querySelector(
                'script[data-sherpa-main-glue="true"]'
              ) as HTMLScriptElement | null;
              if (!existingMain) {
                await new Promise<void>((resolve, reject) => {
                  const sMain = document.createElement("script");
                  sMain.setAttribute("data-sherpa-main-glue", "true");
                  sMain.src = mainGlueUrl;
                  sMain.async = true;
                  sMain.onload = () => resolve();
                  sMain.onerror = () =>
                    reject(new Error(`Failed to load SherpaONNX main glue: ${mainGlueUrl}`));
                  document.head.appendChild(sMain);
                });
              }
              // Then load the wrapper glue that exposes createOfflineTts
              const existingWrapper = document.querySelector(
                'script[data-sherpa-wrapper-glue="true"]'
              ) as HTMLScriptElement | null;
              if (!existingWrapper) {
                await new Promise<void>((resolve, reject) => {
                  const sWrap = document.createElement("script");
                  sWrap.setAttribute("data-sherpa-wrapper-glue", "true");
                  sWrap.src = resolvedScriptUrl;
                  sWrap.async = true;
                  sWrap.onload = () => resolve();
                  sWrap.onerror = () =>
                    reject(
                      new Error(`Failed to load SherpaONNX wrapper glue: ${resolvedScriptUrl}`)
                    );
                  document.head.appendChild(sWrap);
                });
              }
            } else {
              // Single-file glue path
              const existing = document.querySelector(
                'script[data-sherpa-glue="true"]'
              ) as HTMLScriptElement | null;
              if (!existing) {
                await new Promise<void>((resolve, reject) => {
                  const s = document.createElement("script");
                  s.setAttribute("data-sherpa-glue", "true");
                  s.src = resolvedScriptUrl;
                  s.async = true;
                  s.onload = () => resolve();
                  s.onerror = () =>
                    reject(new Error(`Failed to load SherpaONNX glue: ${resolvedScriptUrl}`));
                  document.head.appendChild(s);
                });
              }
            }
          }

          // Wait for glue + Module to be ready. For wrapper, require createOfflineTts and Module.lengthBytesUTF8
          await new Promise<void>((resolve, reject) => {
            const giveUpAt = Date.now() + 25000; // 25s
            const checkReady = () => {
              const hasModule = typeof w.Module !== "undefined";
              const hasCreate = typeof w.createOfflineTts === "function";
              const hasOffline = !!(
                hasModule &&
                w.Module &&
                (w.Module.OfflineTts || w.Module.calledRun)
              );
              const hasUtf8 = !!(hasModule && typeof w.Module.lengthBytesUTF8 === "function");
              const hasMalloc = !!(hasModule && typeof w.Module._malloc === "function");
              const hasRun = !!(hasModule && w.Module && w.Module.calledRun === true);
              const ready =
                hasModule &&
                (isWrapper
                  ? hasCreate && hasUtf8 && hasMalloc && hasRun
                  : hasCreate || hasOffline || hasMalloc);
              if (ready) {
                resolve();
                return;
              }
              if (Date.now() > giveUpAt) {
                reject(new Error("Timed out waiting for SherpaONNX WASM to initialize"));
              } else {
                setTimeout(checkReady, 200);
              }
            };
            checkReady();
          });

          // Now that we know Module is available, store it
          console.log("Storing Module (and createOfflineTts if present)");
          this.wasmModule = (window as any).Module;
          this.wasmLoaded = true;

          // Store the createOfflineTts function reference for convenience if present
          if (
            this.wasmModule &&
            !this.wasmModule.createOfflineTts &&
            typeof (window as any).createOfflineTts === "function"
          ) {
            this.wasmModule.createOfflineTts = (window as any).createOfflineTts;
          }

          // Initialize multi-model support if enabled
          if (this.enhancedOptions.enableMultiModel && this.modelRepository) {
            console.log("Initializing enhanced multi-model support...");

            try {
              // Load models index
              await this.modelRepository.loadModelsIndex();

              // Initialize model manager
              if (this.wasmModule) {
                const maxCached = this.enhancedOptions.maxCachedModels ?? 3;
                this.modelManager = new WasmModelManager(this.wasmModule, maxCached);
              }

              console.log("Enhanced multi-model support initialized successfully");
            } catch (error) {
              console.error("Error initializing multi-model support:", error);
              console.log("Falling back to legacy single-model mode");
              this.enhancedOptions.enableMultiModel = false;
            }
          }

          console.log("WebAssembly module initialized successfully");
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

    console.log(
      "End of initializeWasm method. wasmLoaded:",
      this.wasmLoaded,
      "wasmModule:",
      !!this.wasmModule
    );
    console.log(
      "createOfflineTts available at end of initializeWasm:",
      typeof (window as any).createOfflineTts === "function"
    );
    console.log(
      "window.Module available at end of initializeWasm:",
      typeof (window as any).Module !== "undefined"
    );
    if (typeof (window as any).Module !== "undefined") {
      console.log(
        "window.Module.calledRun at end of initializeWasm:",
        (window as any).Module.calledRun
      );
    }
  }

  /**
   * Synthesize text to speech and return the audio as a byte array
   * @param text Text to synthesize
   * @param options Options for synthesis
   * @returns Promise resolving to a byte array of audio data
   */
  async synthToBytes(text: string, _options?: SpeakOptions): Promise<Uint8Array> {
    // Prepare text for synthesis (handle Speech Markdown and SSML)
    let processedText = text;

    // Convert from Speech Markdown if requested
    if (_options?.useSpeechMarkdown && SpeechMarkdown.isSpeechMarkdown(processedText)) {
      // Convert to SSML first, then strip SSML tags since SherpaOnnx doesn't support SSML
      const ssml = await SpeechMarkdown.toSSML(processedText);
      processedText = SSMLUtils.stripSSML(ssml);
    }

    // If text is SSML, strip the tags as SherpaOnnx doesn't support SSML
    if (SSMLUtils.isSSML(processedText)) {
      processedText = SSMLUtils.stripSSML(processedText);
    }

    console.log("synthToBytes called with text:", processedText);

    // Ensure runtime is initialized before attempting synthesis
    if (isBrowser) {
      const status = this.getInitializationStatus();
      if (!status.isInitialized) {
        await this.initializeWasm(this.wasmPath || this.wasmBaseUrl || "");
      }
    }

    // If multi-model is enabled, ensure the selected model files are mounted before synthesis
    if (this.enhancedOptions.enableMultiModel && this.wasmModule) {
      try {
        const FS = (this.wasmModule as any).FS;
        const needModel = (() => {
          try {
            return !FS.lookupPath("/model.onnx", { follow: true });
          } catch {
            return true;
          }
        })();
        const needTokens = (() => {
          try {
            return !FS.lookupPath("/tokens.txt", { follow: true });
          } catch {
            return true;
          }
        })();
        if (needModel || needTokens) {
          // Decide which voice to mount
          let targetVoice = this.currentVoiceId || this.voiceId;
          if (!targetVoice && this.modelRepository) {
            const models = this.modelRepository.getAvailableModels();
            // Prefer MMS English to avoid CORS issues (then any MMS, then any English, else first)
            const isEn = (x: any) => (x.language || "").toLowerCase().startsWith("en");
            const preferred =
              models.find((m) => m.type === "mms" && isEn(m)) ||
              models.find((m) => m.type === "mms") ||
              models.find((m) => isEn(m)) ||
              models[0];
            targetVoice = preferred?.id;
          }
          if (!targetVoice) {
            throw new Error("No voice selected and no models available to mount");
          }
          console.log("Model files not present; mounting for voice", targetVoice);
          await this.setVoice(targetVoice);
        }
      } catch (e) {
        console.warn("Could not verify/mount model files before synthesis:", e);
      }
    }

    // Enhanced multi-model synthesis path (if the enhanced WASM exports are available)
    if (this.enhancedOptions.enableMultiModel && this.wasmModule && this.currentVoiceId) {
      console.log(`Using enhanced multi-model synthesis for voice ${this.currentVoiceId}`);

      try {
        if (!this.wasmModule._GenerateAudio) {
          throw new Error("Enhanced WASM module not loaded - _GenerateAudio not available");
        }

        // Generate audio using the enhanced WASM interface
        const result = this.wasmModule._GenerateAudio(processedText, 0, 1.0); // text, speaker_id, speed

        if (!result || !result.samples) {
          throw new Error("Failed to generate audio with enhanced interface");
        }

        console.log(
          `Enhanced synthesis generated ${result.samples.length} samples at ${result.sampleRate}Hz`
        );

        // Update sample rate if provided
        if (result.sampleRate) {
          this.sampleRate = result.sampleRate;
        }

        // Convert to WAV format
        return this._convertAudioFormat(result.samples);
      } catch (error) {
        console.error("Error with enhanced multi-model synthesis:", error);
        console.log("Falling back to legacy synthesis mode");
        // Fall through to legacy mode
      }
    }

    // Legacy synthesis mode (backward compatibility)
    console.log("Using legacy synthesis mode");

    // IMPORTANT: We need to access the global window object directly
    // This is because our code is bundled and the window object might not be accessible in the same way
    const globalWindow =
      typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {};
    console.log("Global window type:", typeof globalWindow);

    // Check if we're in a browser environment
    if (typeof globalWindow !== "undefined" && typeof document !== "undefined") {
      console.log("Browser environment detected");

      // Check if createOfflineTts is available in the global scope
      const createOfflineTtsFn = (globalWindow as any).createOfflineTts;
      // Prefer the stored module instance captured during readiness
      const moduleObj = (this.wasmModule || (globalWindow as any).Module) as any;

      console.log(
        "createOfflineTts available in global scope:",
        typeof createOfflineTtsFn === "function"
      );
      console.log("Module available (stored or global):", !!moduleObj);
      console.log("Module._malloc exists:", typeof moduleObj?._malloc === "function");

      // Try to use the createOfflineTts function directly when we have a real module instance
      if (
        typeof createOfflineTtsFn === "function" &&
        moduleObj &&
        typeof moduleObj._malloc === "function"
      ) {
        console.log("Using global createOfflineTts function directly");

        try {
          // Ensure model files are mounted for legacy path too
          if (this.enhancedOptions.enableMultiModel && this.currentVoiceId) {
            try {
              const FS = (this.wasmModule as any).FS;
              const needModel = (() => {
                try {
                  return !FS.lookupPath("/model.onnx", { follow: true });
                } catch {
                  return true;
                }
              })();
              const needTokens = (() => {
                try {
                  return !FS.lookupPath("/tokens.txt", { follow: true });
                } catch {
                  return true;
                }
              })();
              if (needModel || needTokens) {
                console.log("Legacy path: mounting model files for voice", this.currentVoiceId);
                await this.setVoice(this.currentVoiceId);
              }
            } catch {}
          }

          // Create a new TTS instance directly
          console.log("About to call createOfflineTts...");
          const directTts = createOfflineTtsFn(moduleObj);
          console.log("createOfflineTts call successful, tts object:", directTts);
          console.log("TTS initialized with default configuration");
          console.log(`Sample rate: ${directTts?.sampleRate}`);
          console.log(`Number of speakers: ${directTts?.numSpeakers}`);

          // Update the sample rate from the TTS engine
          if (directTts && typeof directTts.sampleRate === "number") {
            this.sampleRate = directTts.sampleRate;
            console.log(`Updated sample rate to ${this.sampleRate}`);
          } else {
            console.warn("Could not update sample rate, using default");
          }

          // Generate audio
          console.log("Generating audio directly...");
          const result = directTts.generate({ text: processedText, sid: 0, speed: 1.0 });
          console.log("Audio generated directly:", result);
          console.log(`Generated ${result?.samples?.length} samples at ${result?.sampleRate}Hz`);

          // Convert to WAV
          const audioBytes = this._convertAudioFormat(result.samples);
          console.log("Converted audio to WAV format, returning bytes");

          return audioBytes;
        } catch (directError) {
          console.error("Error using direct approach:", directError);
          console.log("Falling back to standard approach");
        }
      } else {
        console.log("Direct approach not available, reason:");
        if (typeof createOfflineTtsFn !== "function")
          console.log("- createOfflineTts is not a function");
        if (typeof moduleObj === "undefined") console.log("- Module is undefined");
        if (moduleObj && !moduleObj.calledRun) console.log("- Module.calledRun is false");
      }
    } else {
      console.log("Not in a browser environment, skipping direct approach");
    }

    // If direct approach failed or not available, try the standard approach
    console.log("Using standard approach");
    console.log("Current state - wasmLoaded:", this.wasmLoaded, "wasmModule:", !!this.wasmModule);
    console.log(
      "createOfflineTts available:",
      typeof (globalWindow as any).createOfflineTts === "function"
    );

    // Check if SherpaOnnx is properly initialized
    const status = this.getInitializationStatus();
    if (!status.isInitialized) {
      const errorMessage = this.getInitializationErrorMessage();
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    try {
      // Use the SherpaOnnx WebAssembly API to generate audio
      console.log("Using SherpaOnnx WebAssembly to generate audio");

      // Create a TTS instance if it doesn't exist
      if (!this.tts) {
        console.log("Creating TTS instance");
        try {
          // Create the TTS instance
          if (typeof (window as any).createOfflineTts === "function") {
            // Using the sherpa-onnx-tts.js API
            console.log("Using createOfflineTts API from global scope");
            console.log("createOfflineTts:", (window as any).createOfflineTts);
            console.log("Module:", (window as any).Module);

            try {
              // For MMS models, pass a custom config disabling eSpeak dataDir
              const cfg = this.modelRepository?.getModelConfig(
                this.currentVoiceId || this.voiceId || ""
              );
              const isMms = !!(
                cfg &&
                ((cfg as any).type === "mms" || /^mms_/i.test((cfg as any).id || ""))
              );
              let passedConfig: any = undefined;
              if (isMms) {
                passedConfig = {
                  offlineTtsModelConfig: {
                    vits: {
                      model: "./model.onnx",
                      lexicon: "",
                      tokens: "./tokens.txt",
                      dataDir: "", // disable eSpeak requirement for MMS
                      dictDir: "",
                      noiseScale: 0.667,
                      noiseScaleW: 0.8,
                      lengthScale: 1.0,
                    },
                    numThreads: 1,
                    debug: true,
                    provider: "cpu",
                  },
                  ruleFsts: "",
                  ruleFars: "",
                  maxNumSentences: 1,
                };
              }

              console.log(
                "About to call createOfflineTts...",
                passedConfig ? "(with custom MMS config)" : "(with default config)"
              );
              this.tts = (window as any).createOfflineTts((window as any).Module, passedConfig);
              console.log("createOfflineTts call successful, tts object:", this.tts);
              console.log("TTS initialized");
              console.log(`Sample rate: ${this.tts?.sampleRate}`);
              console.log(`Number of speakers: ${this.tts?.numSpeakers}`);

              // Update the sample rate from the TTS engine
              if (this.tts && typeof this.tts.sampleRate === "number") {
                this.sampleRate = this.tts.sampleRate;
                console.log(`Updated sample rate to ${this.sampleRate}`);
              } else {
                console.warn("Could not update sample rate, using default");
              }
            } catch (error) {
              console.error("Error creating TTS instance with createOfflineTts:", error);
              throw error;
            }
          } else if (this.wasmModule?.OfflineTts) {
            // Using the Module.OfflineTts API
            console.log("Using Module.OfflineTts API");
            this.tts = new this.wasmModule.OfflineTts();
          } else {
            throw new Error("No compatible TTS API found");
          }

          console.log("TTS instance created successfully");
        } catch (error) {
          console.error("Error creating TTS instance:", error);
          throw new Error(
            `Failed to create SherpaOnnx TTS instance: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      // Generate the audio
      console.log("Generating audio for text:", text);
      let samples: Float32Array;

      if (typeof this.tts.generate === "function") {
        // Using the generate method from sherpa-onnx-tts.js
        console.log("Using generate method");
        console.log("this.tts.generate:", this.tts.generate);
        try {
          console.log("Calling generate with:", { text: processedText, sid: 0, speed: 1.0 });
          const result = this.tts.generate({ text: processedText, sid: 0, speed: 1.0 });
          console.log("Generate call successful, result:", result);
          samples = result.samples;
          console.log(
            `Generated audio with sample rate: ${result.sampleRate} and samples: ${samples.length}`
          );
        } catch (error) {
          console.error("Error calling generate:", error);
          throw error;
        }
      } else if (typeof this.tts.generateWithText === "function") {
        // Using the generateWithText method
        console.log("Using generateWithText method");
        console.log("this.tts.generateWithText:", this.tts.generateWithText);
        try {
          console.log("Calling generateWithText with:", processedText);
          samples = this.tts.generateWithText(processedText);
          console.log(`Generated audio with samples: ${samples.length}`);
        } catch (error) {
          console.error("Error calling generateWithText:", error);
          throw error;
        }
      } else {
        console.error("No compatible generate method found");
        console.log(
          "Available methods on this.tts:",
          Object.keys(this.tts).filter((key) => typeof this.tts[key] === "function")
        );
        throw new Error("No compatible generate method found");
      }

      console.log("Audio generated successfully, samples:", samples.length);

      // Convert the samples to the requested format
      const audioBytes = this._convertAudioFormat(samples);

      return audioBytes;
    } catch (error) {
      console.error("Error synthesizing text:", error);
      throw new Error(
        `SherpaOnnx synthesis failed: ${error instanceof Error ? error.message : String(error)}`
      );
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
   * Check if SherpaOnnx is properly initialized
   * @returns Object with initialization status and details
   */
  public getInitializationStatus(): {
    isInitialized: boolean;
    wasmLoaded: boolean;
    wasmModule: boolean;
    createOfflineTts: boolean;
    issues: string[];
  } {
    const globalWindow = (typeof window !== "undefined" ? window : global) as any;
    const issues: string[] = [];

    const hasModule = !!this.wasmModule;
    const winMod = (globalWindow && (globalWindow as any).Module) || null;
    const hasGlobalModule = !!winMod;
    const hasCreate = typeof globalWindow.createOfflineTts === "function";
    const hasOffline = !!(winMod && (winMod.OfflineTts || winMod.calledRun));

    if (!this.wasmLoaded) {
      issues.push("WebAssembly module not loaded");
    }

    if (!hasModule && !hasGlobalModule) {
      issues.push("WebAssembly module is null");
    }

    if (!hasCreate && !hasOffline) {
      issues.push("No SherpaONNX TTS API found (neither createOfflineTts nor Module.OfflineTts)");
    }

    const ready = this.wasmLoaded && (hasModule || hasGlobalModule) && (hasCreate || hasOffline);

    return {
      isInitialized: ready && issues.length === 0 ? true : ready, // consider ready if runtime is present
      wasmLoaded: this.wasmLoaded,
      wasmModule: !!(hasModule || hasGlobalModule),
      createOfflineTts: hasCreate,
      issues,
    };
  }

  /**
   * Get detailed error message for initialization issues
   * @returns Detailed error message with troubleshooting steps
   */
  private getInitializationErrorMessage(): string {
    const status = this.getInitializationStatus();

    let message = "SherpaOnnx WebAssembly TTS is not properly initialized.\n\n";
    message += "Issues found:\n";
    for (const issue of status.issues) {
      message += `- ${issue}\n`;
    }

    message += "\nTroubleshooting steps:\n";
    message += "1. Ensure the SherpaOnnx WebAssembly files are properly loaded\n";
    message += "2. Check that the WebAssembly module initialization completed successfully\n";
    message += "3. Verify that createOfflineTts function is available in the global scope\n";
    message += "4. Check browser console for WebAssembly loading errors\n";
    message +=
      "5. Ensure you're running in a supported environment (browser with WebAssembly support)\n";

    return message;
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

      // Re-throw the error so it can be caught by the caller
      throw error;
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
    format: "wav" = "wav", // Override base class to only allow 'wav'
    options?: SherpaOnnxWasmTTSOptions // Use specific options type
  ): Promise<void> {
    try {
      let outputFormat = format;

      // Sherpa-ONNX only supports WAV output
      if (outputFormat !== "wav") {
        console.warn(
          "SherpaOnnx WebAssembly TTS only supports WAV output. Using WAV instead of",
          outputFormat
        );
        outputFormat = "wav";
      }

      // Use the base class's file saving logic (which detects Node/Browser)
      await super.synthToFile(text, filename, outputFormat, options);
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
        return this.currentVoiceId || this.voiceId || undefined;
      case "sampleRate":
        return this.sampleRate;
      case "wasmLoaded":
        return this.wasmLoaded;
      case "wasmPath":
        return this.wasmPath;
      case "wasmBaseUrl":
        return this.wasmBaseUrl;
      case "mergedModelsUrl":
        return this.mergedModelsUrl;
      case "multiModelEnabled":
        return this.enhancedOptions.enableMultiModel;
      case "maxCachedModels":
        return this.enhancedOptions.maxCachedModels;
      case "loadedModels":
        return this.modelManager?.getLoadedModelIds() ?? [];
      case "currentModel":
        return this.modelManager?.getCurrentModel();
      case "availableModels":
        return this.modelRepository?.getAvailableModels() || [];
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
      case "wasmBaseUrl":
        this.wasmBaseUrl = value;
        break;
      case "mergedModelsUrl":
        this.mergedModelsUrl = value;
        if (this.modelRepository) {
          // Recreate repository with new URL on the fly
          this.modelRepository = new ModelRepository(this.mergedModelsUrl);
        }
        break;
      default:
        super.setProperty(property, value);
        break;
    }
  }

  /**
   * Set the voice to use for synthesis
   * Enhanced with multi-model support while maintaining backward compatibility
   * @param voiceId Voice ID to use
   */
  async setVoice(voiceId: string): Promise<void> {
    // Call the parent method to set the voiceId
    super.setVoice(voiceId);
    console.log(`Setting voice to ${voiceId}`);

    // Enhanced multi-model support (loader-only runtime: fetch, extract, mount into /assets)
    if (this.enhancedOptions.enableMultiModel && this.modelRepository) {
      console.log(`Using enhanced multi-model mode for voice ${voiceId}`);

      // Ensure WASM is initialized to access FS
      if (!this.wasmLoaded) {
        await this.initializeWasm(this.wasmPath || this.wasmBaseUrl || "");
      }
      if (!this.wasmModule) {
        throw new Error("WASM module not initialized");
      }

      // Resolve model config and URL
      const cfg = this.modelRepository.getModelConfig(voiceId);
      if (!cfg || !cfg.url) {
        throw new Error(`No URL found for model ${voiceId}`);
      }

      // Build URL and determine if source is an archive (mirror only for archives)
      const originalUrl = cfg.url;
      const urlIsArchive = /\.(tar|tar\.bz2)$/i.test(originalUrl);
      const filename = originalUrl.split("/").pop() || "";
      const mirrorBase = (
        this.modelsMirrorUrl ||
        this.enhancedOptions.modelsMirrorBaseUrl ||
        ""
      ).replace(/\/$/, "");
      const modelUrl = urlIsArchive && mirrorBase ? `${mirrorBase}/${filename}` : originalUrl;
      const isArchive = urlIsArchive;
      if (urlIsArchive && mirrorBase) {
        console.log(`Using mirror for archive: ${modelUrl}`);
      } else if (!urlIsArchive && mirrorBase) {
        console.log(`Mirror configured but ignored for non-archive URL: ${originalUrl}`);
      }

      const M: any =
        (this.wasmModule as any) ||
        ((typeof window !== "undefined" ? (window as any) : {}) as any).Module ||
        {};
      const FS = M.FS;

      // Helper to create directories recursively (fallback to FS_createPath)
      const mkdirp = (dir: string) => {
        if (!dir || dir === "/") return;
        if (FS?.mkdirTree) {
          try {
            FS.mkdirTree(dir);
            return;
          } catch {}
        }
        if (FS?.mkdir) {
          const parts = dir.split("/").filter(Boolean);
          let cur = "";
          for (const p of parts) {
            cur += `/${p}`;
            try {
              FS.mkdir(cur);
            } catch {}
          }
          return;
        }
        if (typeof M.FS_createPath === "function") {
          try {
            M.FS_createPath("/", dir.replace(/^\//, ""), true, true);
          } catch {}
        }
      };

      const writeFile = (outPath: string, data: Uint8Array) => {
        if (FS && typeof FS.writeFile === "function") {
          FS.writeFile(outPath, data);
          return;
        }
        if (typeof M.FS_createDataFile === "function") {
          const dir = outPath.substring(0, outPath.lastIndexOf("/")) || "/";
          mkdirp(dir);
          try {
            M.FS_createDataFile("/", outPath.replace(/^\//, ""), data, true, true, true);
            return;
          } catch {}
        }
        throw new Error("No Emscripten FS write mechanism available");
      };

      const pathExists = (p: string): boolean => {
        try {
          return !!FS?.lookupPath?.(p, { follow: true });
        } catch {
          return false;
        }
      };

      if (isArchive) {
        // Fetch archive
        console.log(`Fetching model archive: ${modelUrl}`);
        const res = await fetch(modelUrl);
        if (!res.ok) throw new Error(`Failed to fetch model: ${res.status} ${res.statusText}`);
        const archiveBuf = await res.arrayBuffer();

        // Decompress .bz2 if needed
        let tarBuffer: ArrayBuffer = archiveBuf;
        if (/\.bz2$/i.test(modelUrl) || cfg.compressed) {
          const compressjsMod: any = await import("compressjs");
          const Bzip2 = compressjsMod.Bzip2 || compressjsMod.BZ2;
          if (!Bzip2 || typeof Bzip2.decompressFile !== "function") {
            throw new Error("Bzip2 decompressor not available");
          }
          const outArr: number[] = Bzip2.decompressFile(new Uint8Array(archiveBuf));
          tarBuffer = new Uint8Array(outArr).buffer;
        }

        // Extract tar
        const untarMod: any = await import("js-untar");
        const untar = untarMod.default || untarMod;
        const entries: Array<any> = await untar(tarBuffer);
        console.log(`Extracted ${entries.length} entries from TAR`);

        // Ensure required directories exist (root-level expected by wrapper)
        mkdirp("/espeak-ng-data");

        // Map archive files to expected root-level paths
        for (const e of entries) {
          if (!e || !e.name) continue;
          const name: string = String(e.name).replace(/^\.\//, "");
          const lower = name.toLowerCase();

          // Only write file entries (js-untar uses `buffer` for file data)
          if (!e.buffer) continue;

          let outPath: string | null = null;
          if (lower.endsWith("/model.onnx") || lower === "model.onnx") {
            outPath = "/model.onnx";
          } else if (lower.endsWith("/tokens.txt") || lower === "tokens.txt") {
            outPath = "/tokens.txt";
          } else if (lower.includes("/espeak-ng-data/") || lower.startsWith("espeak-ng-data/")) {
            const suffix = name.substring(name.toLowerCase().indexOf("espeak-ng-data/"));
            outPath = `/${suffix}`;
          } else if (
            lower.endsWith("voices.bin") ||
            (lower.includes("voices") && lower.endsWith(".bin"))
          ) {
            outPath = "/voices.bin";
          } else if (lower.includes("vocoder") && lower.endsWith(".onnx")) {
            outPath = "/vocoder.onnx";
          }

          if (outPath) {
            const dir = outPath.substring(0, outPath.lastIndexOf("/"));
            mkdirp(dir);
            writeFile(outPath, new Uint8Array(e.buffer));
          }
        }
      } else {
        // Direct-file layout (e.g., MMS on Hugging Face): fetch files individually
        const base = modelUrl.replace(/\/$/, "");
        console.log(`Fetching model from directory: ${base}`);

        // Try candidate token paths
        const tokenCandidates = [`${base}/tokens.txt`, `${base}/tokens`, `${base}/vocab.txt`];
        let tokensBuf: ArrayBuffer | null = null;
        for (const u of tokenCandidates) {
          try {
            const r = await fetch(u);
            if (r.ok) {
              tokensBuf = await r.arrayBuffer();
              console.log(`Fetched tokens from ${u}`);
              break;
            }
          } catch {}
        }
        if (!tokensBuf) throw new Error("Could not locate tokens file in model directory");

        // Try candidate model paths
        const id = cfg.id || "";
        const lang = cfg.language || "";
        const name = (cfg.name || "").toLowerCase();
        const modelCandidates = [
          `${base}/model.onnx`,
          `${base}/${id}.onnx`,
          `${base}/${lang}.onnx`,
          `${base}/${name}.onnx`,
        ];
        let modelBuf: ArrayBuffer | null = null;
        for (const u of modelCandidates) {
          try {
            const r = await fetch(u);
            if (r.ok) {
              modelBuf = await r.arrayBuffer();
              console.log(`Fetched model from ${u}`);
              break;
            }
          } catch {}
        }
        if (!modelBuf) throw new Error("Could not locate model.onnx in model directory");

        // Write to FS
        mkdirp("/");
        writeFile("/tokens.txt", new Uint8Array(tokensBuf));
        writeFile("/model.onnx", new Uint8Array(modelBuf));
      }

      // Also ensure espeak-ng-data is present; if not, try to fetch from mirror
      const espeakExists = pathExists("/espeak-ng-data");
      if (!espeakExists) {
        const mirrorBase2 = (
          this.modelsMirrorUrl ||
          this.enhancedOptions.modelsMirrorBaseUrl ||
          ""
        ).replace(/\/$/, "");
        if (mirrorBase2) {
          const espeakUrl = `${mirrorBase2}/espeak-ng-data.tar.bz2`;
          try {
            console.log(`Fetching espeak-ng-data archive: ${espeakUrl}`);
            const r2 = await fetch(espeakUrl);
            if (r2.ok) {
              const buf2 = await r2.arrayBuffer();
              const compressjsMod2: any = await import("compressjs");
              const Bzip22 = compressjsMod2.Bzip2 || compressjsMod2.BZ2;
              const outArr2: number[] = Bzip22.decompressFile(new Uint8Array(buf2));
              const tarBuf2 = new Uint8Array(outArr2).buffer;
              const untarMod2: any = await import("js-untar");
              const untar2 = untarMod2.default || untarMod2;
              const entries2: Array<any> = await untar2(tarBuf2);
              console.log(`Extracted ${entries2.length} espeak entries from TAR`);
              for (const e of entries2) {
                if (!e || !e.name || !e.buffer) continue;
                const name: string = String(e.name).replace(/^\.\//, "");
                const lower = name.toLowerCase();
                let outPath: string | null = null;
                if (lower.includes("/espeak-ng-data/") || lower.startsWith("espeak-ng-data/")) {
                  const suffix = name.substring(name.toLowerCase().indexOf("espeak-ng-data/"));
                  outPath = `/${suffix}`;
                }
                if (outPath) {
                  const dir = outPath.substring(0, outPath.lastIndexOf("/"));
                  mkdirp(dir);
                  writeFile(outPath, new Uint8Array(e.buffer));
                }
              }
            } else {
              console.warn("Failed to fetch espeak-ng-data:", r2.status, r2.statusText);
            }
          } catch (err) {
            console.warn("Error fetching espeak-ng-data:", err);
          }
        }
      }

      // Reset TTS so next synthesis uses the new assets
      if (this.tts) {
        try {
          if (typeof this.wasmModule._ttsDestroyOffline === "function")
            this.wasmModule._ttsDestroyOffline(this.tts);
        } catch {}
        this.tts = null;
      }

      this.currentVoiceId = voiceId;
      console.log(`Prepared /assets for voice ${voiceId}`);
      return;
    }

    // Legacy single-model mode (backward compatibility)
    console.log(`Using legacy single-model mode for voice ${voiceId}`);

    // Reset the TTS instance so it will be recreated with the new voice
    if (this.tts) {
      console.log("Resetting TTS instance for new voice");
      this.tts = null;
    }
  }

  /**
   * Clean up resources
   * Enhanced to handle multi-model cleanup
   */
  dispose(): void {
    // Clean up multi-model resources
    if (this.modelManager) {
      console.log("Disposing multi-model resources");
      this.modelManager.dispose();
      this.modelManager = undefined;
    }

    // Clean up legacy TTS instance
    if (this.wasmModule && this.tts !== 0) {
      if (typeof this.wasmModule._ttsDestroyOffline === "function") {
        this.wasmModule._ttsDestroyOffline(this.tts);
      }
      this.tts = null;
    }

    // Reset state
    this.currentVoiceId = undefined;
    this.wasmLoaded = false;
    this.wasmModule = null;
  }

  /**
   * Synthesize text to a byte stream
   * @param text Text to synthesize
   * @param options Options for synthesis
   * @returns Promise resolving to an object containing the audio stream and an empty word boundaries array
   */
  async synthToBytestream(
    text: string,
    options?: SpeakOptions
  ): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
  }> {
    // This is a simplified implementation that doesn't actually stream
    // In a real implementation, you would use a ReadableStream
    const audioBytes = await this.synthToBytes(text, options);

    // Generate word boundaries if requested
    let wordBoundaries: Array<{ text: string; offset: number; duration: number }> = [];

    if (options?.useWordBoundary) {
      // Create estimated word timings and store them
      this._createEstimatedWordTimings(text);

      // Convert internal timings to word boundary format
      wordBoundaries = this.timings.map(([start, end, word]) => ({
        text: word,
        offset: Math.round(start * 10000), // Convert to 100-nanosecond units
        duration: Math.round((end - start) * 10000),
      }));
    }

    // Create a ReadableStream from the audio bytes
    return {
      audioStream: new ReadableStream({
        start(controller) {
          controller.enqueue(audioBytes);
          controller.close();
        },
      }),
      wordBoundaries,
    };
  }
}

/**
 * Model Repository Manager
 * Uses existing merged_models.json infrastructure for multi-model support
 */
class ModelRepository {
  private modelsIndex: ModelConfig[] = [];
  private modelsUrl?: string;

  constructor(modelsUrl?: string) {
    this.modelsUrl = modelsUrl;
  }

  async loadModelsIndex(): Promise<void> {
    try {
      // Use the existing merged_models.json loading logic from _getVoices
      let voiceModels: any[] = [];

      if (isNode) {
        const modelsJsonPath = pathUtils.join(
          __dirname,
          "..",
          "engines",
          "sherpaonnx",
          "merged_models.json"
        );
        if (fileSystem.existsSync(modelsJsonPath)) {
          const modelsJson = fileSystem.readFileSync(modelsJsonPath);
          const modelsData = JSON.parse(modelsJson);
          voiceModels = Object.values(modelsData);
        }
      } else {
        // In browser, try to fetch from the existing location
        try {
          const response = await fetch(this.modelsUrl || "./data/merged_models.json");
          if (response.ok) {
            const modelsData = await response.json();
            voiceModels = Object.values(modelsData);
          }
        } catch (fetchError) {
          console.warn("Failed to fetch merged_models.json:", fetchError);
        }
      }

      // Convert to our ModelConfig format
      this.modelsIndex = voiceModels
        .map((model) => {
          // Derive type when missing (MMS entries often have no model_type)
          let derivedType: ModelType | undefined = undefined;
          const id: string = model.id || model.model_id || model.name || "";
          const url: string = model.url || "";
          const mt: string | undefined = model.model_type;
          if (mt && ["kokoro", "matcha", "vits", "mms"].includes(mt)) {
            derivedType = mt as ModelType;
          } else if (/^mms_/i.test(id) || /mms-tts-multilingual-models-onnx/.test(url)) {
            derivedType = "mms";
          } else if (/kokoro/i.test(url) || /voices\.bin$/i.test(url)) {
            derivedType = "kokoro";
          } else if (/matcha/i.test(url) || /vocoder\.onnx$/i.test(url)) {
            derivedType = "matcha";
          } else if (url) {
            derivedType = "vits";
          }

          if (!derivedType) return null;

          // Robust language code extraction
          const langArr = Array.isArray(model.language) ? model.language : [];
          const firstLang = langArr.length > 0 ? langArr[0] : {};
          const langRecord = firstLang as Record<string, string | undefined>;
          const modelRecord = model as Record<string, string | undefined>;
          const langCode =
            langRecord.lang_code ?? langRecord["Iso Code"] ?? modelRecord.language_code ?? "en";

          return {
            id,
            type: derivedType,
            name: model.name || id,
            language: langCode,
            gender: "unknown", // Not specified in merged_models.json
            sampleRate: model.sample_rate || 22050,
            url,
            compressed: !!model.compression,
            files: {
              model: "model.onnx",
              tokens: "tokens.txt",
              voices: derivedType === "kokoro" ? "voices.bin" : undefined,
              vocoder: derivedType === "matcha" ? "vocoder.onnx" : undefined,
            },
            size: Math.round((model.filesize_mb || 64) * 1024 * 1024),
          } as ModelConfig;
        })
        .filter(Boolean) as ModelConfig[];

      console.log(`Loaded ${this.modelsIndex.length} compatible models from merged_models.json`);

      console.log(`Loaded ${this.modelsIndex.length} compatible models from merged_models.json`);
    } catch (error) {
      console.error("Error loading models index:", error);
      // Fallback to default models for backward compatibility
      this.modelsIndex = this.getDefaultModels();
    }
  }

  getAvailableModels(): ModelConfig[] {
    return this.modelsIndex;
  }

  getModelConfig(modelId: string): ModelConfig | undefined {
    return this.modelsIndex.find((model) => model.id === modelId);
  }

  async downloadModelFiles(modelId: string): Promise<ModelFiles> {
    const config = this.getModelConfig(modelId);
    if (!config) {
      throw new Error(`Model ${modelId} not found in repository`);
    }

    console.log(`Downloading model files for ${modelId}...`);

    // For now, return mock files since we don't have the actual WASM build yet
    // In the real implementation, this would download from the model's URL
    console.warn(`Mock implementation: returning placeholder files for ${modelId}`);

    const mockModelData = new ArrayBuffer(1000);
    const mockTokensData = new ArrayBuffer(500);

    const files: ModelFiles = {
      model: mockModelData,
      tokens: mockTokensData,
    };

    if (config.type === "kokoro") {
      files.voices = new ArrayBuffer(200);
    } else if (config.type === "matcha") {
      files.vocoder = new ArrayBuffer(800);
    }

    console.log(`Mock download completed for ${modelId}`);
    return files;
  }

  private getDefaultModels(): ModelConfig[] {
    return [
      {
        id: "piper-en-amy-medium",
        type: "vits",
        name: "Piper Amy (Medium)",
        language: "en-US",
        gender: "female",
        sampleRate: 22050,
        files: {
          model: "model.onnx",
          tokens: "tokens.txt",
        },
        size: 15000000, // ~15MB
      },
    ];
  }
}

/**
 * WASM Model Manager
 * Handles loading models into WebAssembly memory for multi-model support
 */
class WasmModelManager {
  private wasmModule: SherpaOnnxWasmModule;
  private loadedModels: Map<string, LoadedModel> = new Map();
  private currentModel?: string;
  private maxCachedModels: number;

  constructor(wasmModule: SherpaOnnxWasmModule, maxCachedModels = 3) {
    this.wasmModule = wasmModule;
    this.maxCachedModels = maxCachedModels;
  }

  async loadModel(modelId: string, files: ModelFiles, config: ModelConfig): Promise<number> {
    const existingModel = this.loadedModels.get(modelId);
    if (existingModel) {
      existingModel.lastUsed = Date.now();
      return existingModel.handle;
    }

    // Free memory if needed
    await this.ensureMemoryAvailable();

    console.log(`Loading ${config.type} model ${modelId} into WASM...`);

    const malloc = this.wasmModule._malloc;
    const free = this.wasmModule._free;
    const heap = this.wasmModule.HEAPU8;

    if (!malloc || !free || !heap) {
      throw new Error("WASM memory helpers not available");
    }

    const allocate = (size: number): number => {
      const ptr = malloc(size);
      if (!ptr) {
        throw new Error(`Failed to allocate ${size} bytes of WASM memory`);
      }
      return ptr;
    };

    const modelPtr = allocate(files.model.byteLength);
    const tokensPtr = allocate(files.tokens.byteLength);

    let voicesPtr = 0;
    let vocoderPtr = 0;

    try {
      heap.set(new Uint8Array(files.model), modelPtr);
      heap.set(new Uint8Array(files.tokens), tokensPtr);

      if (files.voices && config.type === "kokoro") {
        voicesPtr = allocate(files.voices.byteLength);
        heap.set(new Uint8Array(files.voices), voicesPtr);
      }

      if (files.vocoder && config.type === "matcha") {
        vocoderPtr = allocate(files.vocoder.byteLength);
        heap.set(new Uint8Array(files.vocoder), vocoderPtr);
      }

      let modelHandle: number;

      switch (config.type) {
        case "kokoro":
          if (!this.wasmModule._LoadKokoroModel) {
            throw new Error("Kokoro model loading not supported in this WASM build");
          }
          modelHandle = this.wasmModule._LoadKokoroModel(
            modelPtr,
            files.model.byteLength,
            tokensPtr,
            files.tokens.byteLength,
            voicesPtr,
            files.voices?.byteLength || 0
          );
          break;

        case "matcha":
          if (!this.wasmModule._LoadMatchaModel) {
            throw new Error("Matcha model loading not supported in this WASM build");
          }
          modelHandle = this.wasmModule._LoadMatchaModel(
            modelPtr,
            files.model.byteLength,
            tokensPtr,
            files.tokens.byteLength,
            vocoderPtr,
            files.vocoder?.byteLength || 0
          );
          break;

        default:
          if (!this.wasmModule._LoadVitsModel) {
            throw new Error("VITS model loading not supported in this WASM build");
          }
          modelHandle = this.wasmModule._LoadVitsModel(
            modelPtr,
            files.model.byteLength,
            tokensPtr,
            files.tokens.byteLength
          );
          break;
      }

      if (modelHandle <= 0) {
        throw new Error(`Failed to load ${config.type} model: ${modelHandle}`);
      }

      this.loadedModels.set(modelId, {
        config,
        handle: modelHandle,
        loaded: true,
        lastUsed: Date.now(),
      });

      console.log(`Successfully loaded ${config.type} model ${modelId} with handle ${modelHandle}`);
      return modelHandle;
    } finally {
      free(modelPtr);
      free(tokensPtr);
      if (voicesPtr) {
        free(voicesPtr);
      }
      if (vocoderPtr) {
        free(vocoderPtr);
      }
    }
  }

  async switchToModel(modelId: string): Promise<void> {
    const model = this.loadedModels.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} is not loaded`);
    }

    if (!this.wasmModule._SwitchToModel) {
      throw new Error("Model switching not supported in this WASM build");
    }

    console.log(`Switching to model ${modelId} (handle: ${model.handle})`);
    const result = this.wasmModule._SwitchToModel(model.handle);

    if (result !== 0) {
      throw new Error(`Failed to switch to model ${modelId}: ${result}`);
    }

    this.currentModel = modelId;
    model.lastUsed = Date.now();
  }

  getCurrentModel(): string | undefined {
    return this.currentModel;
  }

  getLoadedModelIds(): string[] {
    return Array.from(this.loadedModels.keys());
  }

  isModelLoaded(modelId: string): boolean {
    return this.loadedModels.has(modelId);
  }

  private async ensureMemoryAvailable(): Promise<void> {
    if (this.loadedModels.size < this.maxCachedModels) {
      return;
    }

    // Find least recently used model
    let oldestModel: string | undefined;
    let oldestTime = Date.now();

    for (const [modelId, model] of this.loadedModels) {
      if (model.lastUsed < oldestTime && modelId !== this.currentModel) {
        oldestTime = model.lastUsed;
        oldestModel = modelId;
      }
    }

    if (oldestModel) {
      console.log(`Unloading least recently used model: ${oldestModel}`);
      await this.unloadModel(oldestModel);
    }
  }

  private async unloadModel(modelId: string): Promise<void> {
    const model = this.loadedModels.get(modelId);
    if (!model) return;

    console.log(`Unloading model ${modelId} (handle: ${model.handle})`);
    if (this.wasmModule._UnloadModel) {
      this.wasmModule._UnloadModel(model.handle);
    }
    this.loadedModels.delete(modelId);

    if (this.currentModel === modelId) {
      this.currentModel = undefined;
    }
  }

  dispose(): void {
    for (const [modelId] of this.loadedModels) {
      this.unloadModel(modelId);
    }
    this.loadedModels.clear();
  }
}
