import { AbstractTTSClient } from "../core/abstract-tts";
import type { SpeakOptions, TTSCredentials, UnifiedVoice } from "../types";

// Dynamic require function - will be set up when needed in Node.js environment
let customRequire: any = null;

// Function to set up require in Node.js environment only
async function setupRequire() {
  if (customRequire) return customRequire;

  // Only set up require in Node.js environment
  if (typeof window === "undefined") {
    const { createRequire } = await import("node:module");

    // Determine the base path differently for ESM vs CJS contexts
    let base_path: string;

    // Check if __filename is defined (indicates CJS context)
    // @ts-ignore - __filename is defined in CJS module scope
    if (typeof __filename !== "undefined") {
      // CJS context
      // @ts-ignore - __filename is defined in CJS module scope
      base_path = __filename;
    }
    // Check if import.meta is defined (indicates ESM context)
    // Use 'else if' to prioritize __filename if both are somehow present
    // @ts-ignore - TS might complain about import.meta in CJS build target
    else if (typeof import.meta !== "undefined" && import.meta.url) {
      // ESM context
      // @ts-ignore - TS might complain about import.meta in CJS build target
      base_path = import.meta.url;
    } else {
      // Final fallback if neither context is easily determined
      console.warn("Could not determine module context (ESM/CJS), falling back to '.'.");
      base_path = ".";
    }

    // Create a require function using the determined base path
    customRequire = createRequire(base_path);
  } else {
    throw new Error(
      "eSpeak TTS is not supported in browser environments yet. Use eSpeak WASM build instead."
    );
  }

  return customRequire;
}

// Define the expected shape of the module returned by the factory
interface EspeakNGModule {
  FS: any; // Emscripten Filesystem API
  callMain: (args: string[]) => void; // Function to run main() with arguments
  ccall: (ident: string, returnType: string | null, argTypes: string[], args: any[]) => any;
  cwrap: (ident: string, returnType: string | null, argTypes: string[]) => (...args: any[]) => any;
  print?: (text: string) => void; // Optional print function
  printErr?: (text: string) => void; // Optional printErr function
  onRuntimeInitialized?: () => void;
  [key: string]: any; // Allow other properties
}
// Define the type of the factory function itself (exported as EspeakModule)
type EspeakNGFactory = (moduleOverrides?: Partial<EspeakNGModule>) => Promise<EspeakNGModule>;

/**
 * eSpeak TTS Client (uses custom single-file espeak-ng build)
 *
 * TODO: Implement browser-side using speak.js WASM/asm.js
 * TODO: Implement Node.js using either child_process (native espeak) or speak.js
 */
export class EspeakTTSClient extends AbstractTTSClient {
  constructor(credentials: TTSCredentials = {}) {
    super(credentials);
    // TODO: Store options, detect environment, etc.
  }

  /**
   * eSpeak does not require credentials in Node.js
   */
  async checkCredentials(): Promise<boolean> {
    return true;
  }

  /**
   * Synthesize text to audio bytes (Uint8Array)
   * @param text Text to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to audio bytes
   */
  async synthToBytes(text: string, options?: SpeakOptions): Promise<Uint8Array> {
    // Use custom-built espeak-ng WASM/JS for both Node.js and browser
    let EspeakModule: EspeakNGFactory;
    try {
      // Set up require function for Node.js environment
      const requireFn = await setupRequire();
      // Require the single-file custom build using the correct relative path from dist/
      EspeakModule = requireFn("../../../wasm/espeakng/espeakng.js");
    } catch (err) {
      console.error("Error importing custom espeakng build:", err);
      throw new Error(
        "Custom espeak-ng build not found or failed to load. Check the path and build integrity."
      );
    }

    // Instantiate the module
    console.log(">>> Calling EspeakModule factory (synthToBytes)...");
    const espeakngModule = await EspeakModule({
      onRuntimeInitialized: () => {
        console.log(">>> Runtime Initialized Callback Fired! (synthToBytes) <<<");
      },
    });
    console.log(">>> EspeakModule factory promise completed (synthToBytes). <<<");

    // Check if callMain exists (should exist in our custom build)
    if (typeof espeakngModule?.callMain !== "function") {
      throw new Error(
        "espeakngModule.callMain is not a function. Build or import might be incorrect."
      );
    }

    // Build CLI arguments for espeak-ng
    const args = [
      "-q", // quiet
      "-b=1", // output as 8-bit PCM
      ...(options?.voice ? ["-v", options.voice] : []),
      ...(options?.rate ? ["-s", String(options.rate)] : []),
      ...(options?.pitch ? ["-p", String(options.pitch)] : []),
      "output.wav", // output file
      text,
    ];

    try {
      // Call the main function of espeak-ng via callMain
      espeakngModule.callMain(args);
      // Read the output file as Uint8Array (WAV audio) from the Emscripten FS
      const buffer = espeakngModule.FS.readFile("output.wav");
      return buffer;
    } catch (err: any) {
      // Enhanced error logging
      console.error("espeak-ng synthToBytes error:", err);
      if (err && typeof err === "object") {
        for (const key of Object.keys(err)) {
          // Print all properties of the error object
          console.error(`espeak-ng error property [${key}]:`, (err as any)[key]);
        }
      }
      if (err?.message) {
        console.error("espeak-ng error message:", err.message);
      }
      throw err;
    }
  }

  /**
   * Synthesize text to a byte stream (ReadableStream)
   * @param text Text to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to an object containing the audio stream and an empty word boundaries array.
   */
  async synthToBytestream(
    text: string,
    options?: SpeakOptions
  ): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
  }> {
    const audioBytes = await this.synthToBytes(text, options);
    // "Fake" streaming by wrapping full audio in a ReadableStream
    const audioStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(audioBytes);
        controller.close();
      },
    });

    return { audioStream, wordBoundaries: [] };
  }

  // TODO: Add voice/language/rate/pitch options, browser WASM loader, etc.

  /**
   * Return at least one default voice for eSpeak
   */
  async _getVoices(): Promise<UnifiedVoice[]> {
    let EspeakModule: EspeakNGFactory;
    try {
      // Set up require function for Node.js environment
      const requireFn = await setupRequire();
      // Require the single-file custom build using the correct relative path from dist/
      EspeakModule = requireFn("../../../wasm/espeakng/espeakng.js");
    } catch (err) {
      console.error("Error importing custom espeakng build:", err);
      throw new Error(
        "Custom espeak-ng build not found or failed to load. Check the path and build integrity."
      );
    }

    let capturedOutput = "";
    // Instantiate the module
    const espeakngModule = await EspeakModule({
      print: (text: string) => {
        capturedOutput += `${text}\n`;
      },
      printErr: (text: string) => {
        console.error("espeak-ng stderr:", text);
      },
    });

    // Check if ccall exists (should exist in Emscripten modules)
    if (typeof espeakngModule?.ccall !== "function") {
      throw new Error(
        "espeakngModule.ccall is not a function. Build or import might be incorrect."
      );
    }

    try {
      // Call the ListVoices C function directly
      // Signature: void ListVoices(char *lang)
      espeakngModule.ccall(
        "ListVoices", // C function name
        null, // Return type (void -> null)
        ["string"], // Argument types (char* -> string)
        [null] // Arguments (pass null for no specific language)
      );
    } catch (e) {
      // Emscripten might throw an exit code exception
      console.error("Error running espeakngModule.ccall('ListVoices'):");
      console.error(e);
      // Depending on how errors are handled, you might want to check `e.status` or `e.code`
      // For now, return an empty list or re-throw
      return [];
    }

    // Parse the captured output
    const voices: UnifiedVoice[] = [];
    const lines = capturedOutput.trim().split("\n");
    // Skip header line (usually starts with 'Pty Language')
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      // Example line format:  2  af            Afrikaans        af
      // Adjust parsing logic based on actual output format
      const parts = line.split(/\s+/);
      if (parts.length >= 4) {
        const languageCode = parts[1]; // e.g., 'af'
        const voiceId = parts[3]; // Often same as language code or with variant, e.g., 'en-us'
        const name = parts.slice(2, -1).join(" "); // Language name, e.g., 'Afrikaans'

        voices.push({
          id: voiceId,
          name: `${name} (${voiceId})`, // Combine name and ID for uniqueness
          gender: "Unknown", // eSpeak doesn't typically provide gender
          provider: "espeak-ng",
          languageCodes: [
            {
              bcp47: languageCode, // Use the primary language code
              iso639_3: "", // Need mapping or leave empty
              display: name,
            },
          ],
        });
      }
    }

    if (voices.length === 0) {
      console.warn(
        "ListVoices produced no output or no voices were parsed. Output:\n",
        capturedOutput
      );
    }

    return voices;
  }
}
