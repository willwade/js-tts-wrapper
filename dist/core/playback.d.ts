/**
 * Utility class for audio playback
 */
export declare class AudioPlayback {
    private audioElement;
    /**
     * Play audio from a URL
     * @param url URL of the audio to play
     * @param onStart Callback when playback starts
     * @param onEnd Callback when playback ends
     * @returns Promise that resolves when playback starts
     */
    play(url: string, onStart?: () => void, onEnd?: () => void): Promise<void>;
    /**
     * Play audio from a Blob
     * @param blob Audio blob
     * @param onStart Callback when playback starts
     * @param onEnd Callback when playback ends
     * @returns Promise that resolves when playback starts
     */
    playFromBlob(blob: Blob, onStart?: () => void, onEnd?: () => void): Promise<void>;
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
}
