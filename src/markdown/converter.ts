import { SpeechMarkdown } from 'speechmarkdown-js';

/**
 * Speech Markdown converter using the official speechmarkdown-js library
 *
 * This module provides functions to convert Speech Markdown to SSML
 * using the speechmarkdown-js library (https://github.com/speechmarkdown/speechmarkdown-js)
 */

// Create a SpeechMarkdown instance with default options
const speechMarkdownInstance = new SpeechMarkdown();

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
export function toSSML(markdown: string, platform: string = 'amazon-alexa'): string {
  return speechMarkdownInstance.toSSML(markdown, { platform });
}

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
export function isSpeechMarkdown(text: string): boolean {
  // Use a simple heuristic to check for common Speech Markdown patterns
  // This is a simplified version as the library doesn't provide a direct way to check
  const patterns = [
    /\[\d+m?s\]/, // Breaks
    /\[break:"\d+m?s"\]/, // Breaks with quotes
    /\*.*?\*/, // Emphasis (short format)
    /\(emphasis:(strong|moderate|reduced|none)\)/, // Emphasis
    /\(rate:(x-slow|slow|medium|fast|x-fast)\)/, // Rate
    /\(pitch:(x-low|low|medium|high|x-high)\)/, // Pitch
    /\(volume:(silent|x-soft|soft|medium|loud|x-loud)\)/, // Volume
    /\(voice:(\w+)\)/, // Voice
    /\(lang:(\w+(-\w+)?)\)/, // Language
    /\(\w+:.*?\)/, // Any other Speech Markdown directive
  ];

  return patterns.some((pattern) => pattern.test(text));
}

/**
 * Get the available platforms supported by the Speech Markdown library
 *
 * This function returns the list of platforms supported by the speechmarkdown-js library.
 * These platforms have different SSML dialects, and the library will generate
 * SSML appropriate for the specified platform.
 *
 * @returns Array of platform names (amazon-alexa, google-assistant, microsoft-azure)
 */
export function getAvailablePlatforms(): string[] {
  // The library doesn't expose a direct way to get platforms, so we hardcode them
  // These are the platforms supported by speechmarkdown-js as of version 1.x
  return ['amazon-alexa', 'google-assistant', 'microsoft-azure'];
}
