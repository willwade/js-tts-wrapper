/**
 * Utility class for audio playback
 */
export class AudioPlayback {
  private audioElement: HTMLAudioElement | null = null;

  /**
   * Play audio from a URL
   * @param url URL of the audio to play
   * @param onStart Callback when playback starts
   * @param onEnd Callback when playback ends
   * @returns Promise that resolves when playback starts
   */
  play(url: string, onStart?: () => void, onEnd?: () => void): Promise<void> {
    return new Promise((resolve) => {
      this.stop();

      this.audioElement = new Audio(url);

      this.audioElement.onplay = () => {
        if (onStart) onStart();
        resolve();
      };

      this.audioElement.onended = () => {
        if (onEnd) onEnd();
      };

      this.audioElement.play();
    });
  }

  /**
   * Play audio from a Blob
   * @param blob Audio blob
   * @param onStart Callback when playback starts
   * @param onEnd Callback when playback ends
   * @returns Promise that resolves when playback starts
   */
  playFromBlob(blob: Blob, onStart?: () => void, onEnd?: () => void): Promise<void> {
    const url = URL.createObjectURL(blob);
    return this.play(url, onStart, onEnd).then(() => {
      // Clean up the URL when playback ends
      if (this.audioElement) {
        this.audioElement.onended = () => {
          if (onEnd) onEnd();
          URL.revokeObjectURL(url);
        };
      }
    });
  }

  /**
   * Pause audio playback
   */
  pause(): void {
    if (this.audioElement) {
      this.audioElement.pause();
    }
  }

  /**
   * Resume audio playback
   */
  resume(): void {
    if (this.audioElement) {
      this.audioElement.play();
    }
  }

  /**
   * Stop audio playback
   */
  stop(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      this.audioElement = null;
    }
  }
}
