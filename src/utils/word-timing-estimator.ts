/**
 * Word boundary information
 */
export interface WordBoundary {
  /**
   * The word text
   */
  word: string;

  /**
   * Start time in seconds
   */
  start: number;

  /**
   * End time in seconds
   */
  end: number;
}

/**
 * Estimate word boundaries for a given text
 *
 * This is a simple estimator that assumes a constant speaking rate.
 * It's not accurate but provides a reasonable approximation when
 * the TTS engine doesn't provide word boundary information.
 *
 * @param text Text to estimate word boundaries for
 * @param options Options for estimation
 * @returns Array of word boundary objects
 */
export function estimateWordBoundaries(
  text: string,
  options: {
    wordsPerMinute?: number;
    startTime?: number;
  } = {}
): WordBoundary[] {
  // Default options
  const wordsPerMinute = options.wordsPerMinute || 150; // Average speaking rate
  const startTime = options.startTime || 0;

  // Split text into words
  const words = text.split(/\s+/).filter((word) => word.length > 0);

  // Calculate time per word in milliseconds
  const msPerWord = (60 * 1000) / wordsPerMinute;

  // Generate word boundaries
  const wordBoundaries: WordBoundary[] = [];
  let currentTime = startTime;

  for (const word of words) {
    // Estimate duration based on word length
    // Longer words take more time to pronounce
    const lengthFactor = Math.max(0.5, Math.min(2.0, word.length / 5));
    const duration = msPerWord * lengthFactor;

    wordBoundaries.push({
      word,
      start: currentTime / 1000, // Convert to seconds
      end: (currentTime + duration) / 1000, // Convert to seconds
    });

    currentTime += duration;
  }

  return wordBoundaries;
}
