declare module 'sound-play' {
  /**
   * Play a sound file
   * @param file Path to the sound file
   * @param volume Volume (0-1)
   * @returns Promise that resolves when the sound has finished playing
   */
  export function play(file: string, volume?: number): Promise<void>;
}
