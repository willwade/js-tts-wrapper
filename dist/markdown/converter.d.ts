/**
 * Convert Speech Markdown to SSML
 *
 * This function uses the speechmarkdown-js library to convert Speech Markdown syntax to SSML.
 * The library supports various Speech Markdown features including:
 * - Breaks: [500ms] or [break:"500ms"]
 * - Emphasis: *emphasized text*
 * - Rate, pitch, volume: (rate:slow), (pitch:high), (volume:loud)
 * - And many more (see the speechmarkdown-js documentation)
 *
 * @param markdown Speech Markdown text
 * @param platform Target platform (amazon-alexa, google-assistant, microsoft-azure, etc.)
 * @returns SSML text
 */
export declare function toSSML(markdown: string, platform?: string): string;
/**
 * Check if text is Speech Markdown
 *
 * This function checks if the text contains Speech Markdown syntax patterns.
 * It uses regular expressions to detect common Speech Markdown patterns such as:
 * - Breaks: [500ms] or [break:"500ms"]
 * - Emphasis: *emphasized text*
 * - Rate, pitch, volume: (rate:slow), (pitch:high), (volume:loud)
 *
 * @param text Text to check
 * @returns True if the text contains Speech Markdown syntax
 */
export declare function isSpeechMarkdown(text: string): boolean;
/**
 * Get the available platforms supported by the Speech Markdown library
 *
 * This function returns the list of platforms supported by the speechmarkdown-js library.
 * These platforms have different SSML dialects, and the library will generate
 * SSML appropriate for the specified platform.
 *
 * @returns Array of platform names (amazon-alexa, google-assistant, microsoft-azure)
 */
export declare function getAvailablePlatforms(): string[];
