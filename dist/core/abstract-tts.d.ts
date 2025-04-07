import type { SpeakOptions, UnifiedVoice, TTSCredentials, TTSEventType, WordBoundaryCallback, SimpleCallback, PropertyType } from "../types";
import { SSMLBuilder } from "../ssml/builder";
/**
 * Abstract base class for all TTS clients
 * This provides a unified interface for all TTS providers
 */
export declare abstract class AbstractTTSClient {
    protected credentials: TTSCredentials;
    /**
     * Currently selected voice ID
     */
    protected voiceId: string | null;
    /**
     * Currently selected language
     */
    protected lang: string;
    /**
     * Event callbacks
     */
    protected callbacks: Record<string, Function[]>;
    /**
     * SSML builder instance
     */
    ssml: SSMLBuilder;
    /**
     * Audio playback properties
     */
    protected audio: {
        isPlaying: boolean;
        isPaused: boolean;
        audioElement: HTMLAudioElement | null;
        position: number;
        duration: number;
    };
    /**
     * TTS properties (rate, pitch, volume)
     */
    protected properties: Record<string, PropertyType>;
    /**
     * Word timings for the current audio
     */
    protected timings: Array<[number, number, string]>;
    /**
     * Audio sample rate
     */
    protected audioRate: number;
    /**
     * Creates a new TTS client
     * @param credentials Provider-specific credentials
     */
    constructor(credentials: TTSCredentials);
    /**
     * Get raw voices from the provider
     * This is an internal method that should be implemented by each engine
     * @returns Promise resolving to an array of raw voice objects
     */
    protected abstract _getVoices(): Promise<UnifiedVoice[]>;
    /**
     * Synthesize text to audio bytes
     * @param text Text or SSML to synthesize
     * @param options Synthesis options
     * @returns Promise resolving to audio bytes
     */
    abstract synthToBytes(text: string, options?: SpeakOptions): Promise<Uint8Array>;
    /**
     * Synthesize text to a byte stream
     * @param text Text or SSML to synthesize
     * @param options Synthesis options
     * @returns Promise resolving to a readable stream of audio bytes
     */
    abstract synthToBytestream(text: string, options?: SpeakOptions): Promise<ReadableStream<Uint8Array>>;
    /**
     * Get available voices from the provider with normalized language codes
     * @returns Promise resolving to an array of unified voice objects
     */
    getVoices(): Promise<UnifiedVoice[]>;
    /**
     * Speak text using the default audio output
     * @param text Text or SSML to speak
     * @param options Synthesis options
     * @returns Promise resolving when audio playback starts
     */
    speak(text: string, options?: SpeakOptions): Promise<void>;
    /**
     * Speak text using streaming synthesis
     * @param text Text or SSML to speak
     * @param options Synthesis options
     * @returns Promise resolving when audio playback starts
     */
    speakStreamed(text: string, options?: SpeakOptions): Promise<void>;
    /**
     * Synthesize text to audio and save it to a file (browser download)
     * @param text Text or SSML to synthesize
     * @param filename Filename to save as
     * @param format Audio format (mp3 or wav)
     * @param options Synthesis options
     */
    synthToFile(text: string, filename: string, format?: 'mp3' | 'wav', options?: SpeakOptions): Promise<void>;
    /**
     * Set the voice to use for synthesis
     * @param voiceId Voice ID to use
     * @param lang Language code (optional)
     */
    setVoice(voiceId: string, lang?: string): void;
    /**
     * Pause audio playback
     */
    pause(): void;
    /**
     * Resume audio playback
     */
    resume(): void;
    /**
     * Stop audio playback
     */
    stop(): void;
    /**
     * Create estimated word timings for non-streaming engines
     * @param text Text to create timings for
     */
    protected _createEstimatedWordTimings(text: string): void;
    /**
     * Check if text is SSML
     * @param text Text to check
     * @returns True if text is SSML
     */
    protected _isSSML(text: string): boolean;
    /**
     * Strip SSML tags from text
     * @param ssml SSML text
     * @returns Plain text without SSML tags
     */
    protected _stripSSML(ssml: string): string;
    /**
     * Register a callback for an event
     * @param event Event type
     * @param fn Callback function
     */
    on(event: TTSEventType, fn: Function): void;
    /**
     * Emit an event to all registered callbacks
     * @param event Event type
     * @param args Event arguments
     */
    protected emit(event: string, ...args: any[]): void;
    /**
     * Start playback with word boundary callbacks
     * @param text Text or SSML to speak
     * @param callback Callback function for word boundaries
     * @param options Synthesis options
     */
    startPlaybackWithCallbacks(text: string, callback: WordBoundaryCallback, options?: SpeakOptions): Promise<void>;
    /**
     * Connect a callback to an event
     * @param event Event name
     * @param callback Callback function
     */
    connect(event: 'onStart' | 'onEnd', callback: SimpleCallback): void;
    /**
     * Get the value of a property
     * @param propertyName Property name
     * @returns Property value
     */
    getProperty(propertyName: string): PropertyType;
    /**
     * Set a property value
     * @param propertyName Property name
     * @param value Property value
     */
    setProperty(propertyName: string, value: PropertyType): void;
    /**
     * Create a prosody tag with the current properties
     * @param text Text to wrap with prosody
     * @returns Text with prosody tag
     */
    constructProsodyTag(text: string): string;
    /**
     * Check if credentials are valid
     * @returns Promise resolving to true if credentials are valid
     */
    checkCredentials(): Promise<boolean>;
}
