/**
 * Options for speech synthesis
 */
export interface SpeakOptions {
  /**
   * Speech rate
   */
  rate?: "x-slow" | "slow" | "medium" | "fast" | "x-fast";

  /**
   * Speech pitch
   */
  pitch?: "x-low" | "low" | "medium" | "high" | "x-high";

  /**
   * Speech volume (0-100)
   */
  volume?: number;

  /**
   * Whether to convert input from SpeechMarkdown to SSML before processing
   */
  useSpeechMarkdown?: boolean;

  /**
   * Whether to use word boundary information for streaming synthesis
   */
  useWordBoundary?: boolean;

  /**
   * Path to save the audio output
   */
  outputPath?: string;

  /**
   * Voice ID to use for synthesis
   */
  voice?: string;
}

/**
 * Unified voice format across all providers
 */
export type UnifiedVoice = {
  /**
   * Unique identifier for the voice
   */
  id: string;

  /**
   * Display name of the voice
   */
  name: string;

  /**
   * Gender of the voice
   */
  gender?: "Male" | "Female" | "Unknown";

  /**
   * TTS provider
   */
  provider:
    | "azure"
    | "google"
    | "ibm"
    | "elevenlabs"
    | "polly"
    | "witai"
    | "playht"
    | "openai"
    | "sherpa"
    | "sherpaonnx"
    | "sherpaonnx-wasm"
    | "espeak-ng";

  /**
   * Language codes supported by this voice
   */
  languageCodes: {
    /**
     * BCP-47 language code (e.g., 'en-US')
     */
    bcp47: string;

    /**
     * ISO 639-3 language code (e.g., 'eng')
     */
    iso639_3: string;

    /**
     * Human-readable language name (e.g., 'English (United States)')
     */
    display: string;
  }[];
};

/**
 * Credentials for TTS providers
 * @remarks This is intentionally kept as a generic object type to allow different credential formats for different providers
 */
export type TTSCredentials = Record<string, unknown>;

/**
 * Event types for TTS callbacks
 */
export type TTSEventType = "start" | "end" | "boundary";

/**
 * Callback function for word boundary events
 */
export type WordBoundaryCallback = (word: string, startTime: number, endTime: number) => void;

/**
 * Simple callback function with no parameters
 */
export type SimpleCallback = () => void;

/**
 * Property type for TTS properties
 */
export type PropertyType = string | number | boolean;

/**
 * Word Boundary interface for speech marks
 */
export type WordBoundary = {
  /**
   * The actual word text
   */
  text: string;
  /**
   * Time offset from the beginning of the audio stream, in milliseconds.
   */
  offset: number;
  /**
   * Duration of the word being spoken, in milliseconds.
   */
  duration: number;
}
