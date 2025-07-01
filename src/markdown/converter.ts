import { isNode } from "../utils/environment";

/**
 * Speech Markdown converter using the official speechmarkdown-js library
 *
 * This module provides functions to convert Speech Markdown to SSML
 * using the speechmarkdown-js library (https://github.com/speechmarkdown/speechmarkdown-js)
 */

// Dynamic import for speechmarkdown-js
let SpeechMarkdown: any = null;
let speechMarkdownLoaded = false;

async function loadSpeechMarkdown() {
  if (speechMarkdownLoaded) return SpeechMarkdown;

  try {
    if (isNode) {
      // In Node.js, try to import speechmarkdown-js
      const module = await import("speechmarkdown-js");
      SpeechMarkdown = module.SpeechMarkdown;
      speechMarkdownLoaded = true;
      return SpeechMarkdown;
    }
    // In browser, speechmarkdown-js is not available
    console.warn(
      "speechmarkdown-js is not available in browser environments. Speech Markdown features will be limited."
    );
    return null;
  } catch (_error) {
    console.warn(
      "speechmarkdown-js not found. Speech Markdown features will be limited. Install with: npm install speechmarkdown-js"
    );
    return null;
  }
}

/**
 * SpeechMarkdownConverter class for converting Speech Markdown to SSML
 */
export class SpeechMarkdownConverter {
  private speechMarkdownInstance: any = null;

  private async ensureInitialized() {
    if (!this.speechMarkdownInstance) {
      const SpeechMarkdownClass = await loadSpeechMarkdown();
      if (SpeechMarkdownClass) {
        this.speechMarkdownInstance = new SpeechMarkdownClass();
      }
    }
    return this.speechMarkdownInstance;
  }

  /**
   * Convert Speech Markdown to SSML
   *
   * @param markdown Speech Markdown text
   * @param platform Target platform (amazon-alexa, google-assistant, microsoft-azure, etc.)
   * @returns SSML text
   */
  async toSSML(markdown: string, platform = "amazon-alexa"): Promise<string> {
    const instance = await this.ensureInitialized();
    if (!instance) {
      // Fallback: return the text wrapped in basic SSML
      return `<speak>${markdown}</speak>`;
    }
    return instance.toSSML(markdown, { platform });
  }

  /**
   * Check if text is Speech Markdown
   *
   * @param text Text to check
   * @returns True if the text contains Speech Markdown syntax
   */
  isSpeechMarkdown(text: string): boolean {
    return isSpeechMarkdown(text);
  }

  /**
   * Get the available platforms supported by the Speech Markdown library
   *
   * @returns Array of platform names
   */
  getAvailablePlatforms(): string[] {
    return getAvailablePlatforms();
  }
}

// Create a default converter instance
const defaultConverter = new SpeechMarkdownConverter();

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
export async function toSSML(markdown: string, platform = "amazon-alexa"): Promise<string> {
  return await defaultConverter.toSSML(markdown, platform);
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
    /\[\d+m?s\]/, // Breaks: [500ms]
    /\[break:"\w+"\]/, // Breaks with quotes: [break:"weak"]
    /\+\+.*?\+\+/, // Strong emphasis: ++text++
    /\+.*?\+/, // Moderate emphasis: +text+
    /~.*?~/, // No emphasis: ~text~
    /-.*?-/, // Reduced emphasis: -text-
    /\(.*?\)\[emphasis(:"(strong|moderate|reduced|none)")?\]/, // Standard emphasis: (text)[emphasis:"strong"]
    /\(.*?\)\[rate:"(x-slow|slow|medium|fast|x-fast)"\]/, // Rate: (text)[rate:"slow"]
    /\(.*?\)\[pitch:"(x-low|low|medium|high|x-high)"\]/, // Pitch: (text)[pitch:"high"]
    /\(.*?\)\[volume:"(silent|x-soft|soft|medium|loud|x-loud)"\]/, // Volume: (text)[volume:"loud"]
    /\(.*?\)\[voice:".*?"\]/, // Voice: (text)[voice:"Brian"]
    /\(.*?\)\[lang:".*?"\]/, // Language: (text)[lang:"en-US"]
    /\(.*?\)\[\w+:"?.*?"?\]/, // Any other Speech Markdown modifier: (text)[modifier:"value"]
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
  return ["amazon-alexa", "google-assistant", "microsoft-azure"];
}
