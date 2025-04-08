import { AbstractTTSClient } from "../core/abstract-tts";
import type { SpeakOptions, UnifiedVoice, WordBoundaryCallback } from "../types";
/**
 * Azure TTS Client
 */
export declare class AzureTTSClient extends AbstractTTSClient {
    private subscriptionKey;
    private region;
    /**
     * Create a new Azure TTS client
     * @param credentials Azure credentials object with subscriptionKey and region
     */
    constructor(credentials: {
        subscriptionKey: string;
        region: string;
    });
    /**
     * Get raw voices from Azure
     * @returns Promise resolving to an array of unified voice objects
     */
    protected _getVoices(): Promise<UnifiedVoice[]>;
    /**
     * Synthesize text to audio bytes
     * @param text Text or SSML to synthesize
     * @param options Synthesis options
     * @returns Promise resolving to audio bytes
     */
    synthToBytes(text: string, options?: SpeakOptions): Promise<Uint8Array>;
    /**
     * Synthesize text to a byte stream with word boundary information
     * @param text Text or SSML to synthesize
     * @param options Synthesis options
     * @returns Promise resolving to an object containing the audio stream and word boundary information
     */
    synthToBytestream(text: string, options?: SpeakOptions): Promise<{
        audioStream: ReadableStream<Uint8Array>;
        wordBoundaries: Array<{
            text: string;
            offset: number;
            duration: number;
        }>;
    }>;
    /**
     * Start playback with word boundary callbacks
     * @param text Text or SSML to speak
     * @param callback Callback function for word boundaries
     * @param options Synthesis options
     */
    startPlaybackWithCallbacks(text: string, callback: WordBoundaryCallback, options?: SpeakOptions): Promise<void>;
    /**
     * Prepare SSML for synthesis
     * @param text Text or SSML to prepare
     * @param options Synthesis options
     * @returns SSML ready for synthesis
     */
    private prepareSSML;
    /**
     * Convert BCP-47 language code to ISO 639-3
     * @param bcp47 BCP-47 language code
     * @returns ISO 639-3 language code
     */
    private bcp47ToIso639_3;
}
