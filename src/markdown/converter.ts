import { isNode } from "../utils/environment";

/**
 * Runtime configuration for Speech Markdown conversion.
 */
export interface SpeechMarkdownRuntimeConfig {
  /**
   * Enable or disable the speechmarkdown-js powered converter.
   * When disabled, the lightweight fallback converter is used.
   */
  enabled?: boolean;
}

const runtimeConfig: SpeechMarkdownRuntimeConfig = {};

const TRUE_PATTERN = /^(1|true|yes|on)$/i;
const FALSE_PATTERN = /^(0|false|no|off)$/i;

function parseBooleanFlag(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  if (!text) return undefined;
  if (TRUE_PATTERN.test(text)) return true;
  if (FALSE_PATTERN.test(text)) return false;
  return undefined;
}

function getEnvEnabledOverride(): boolean | undefined {
  if (!isNode) return undefined;

  try {
    const env = (process as any)?.env ?? {};
    const disableFlag = parseBooleanFlag(env.SPEECHMARKDOWN_DISABLE);
    if (disableFlag === true) {
      return false;
    }
    if (disableFlag === false) {
      return true;
    }

    const enableFlag = parseBooleanFlag(env.SPEECHMARKDOWN_ENABLE);
    if (enableFlag !== undefined) {
      return enableFlag;
    }
  } catch {
    // Ignore env parsing errors and fall back to defaults
  }

  return undefined;
}

function isSpeechMarkdownEnabled(): boolean {
  if (typeof runtimeConfig.enabled === "boolean") {
    return runtimeConfig.enabled;
  }

  const envOverride = getEnvEnabledOverride();
  if (typeof envOverride === "boolean") {
    return envOverride;
  }

  // Default: enabled everywhere (Node + browser)
  return true;
}

export function configureSpeechMarkdown(options: SpeechMarkdownRuntimeConfig = {}): void {
  if (typeof options.enabled === "boolean") {
    runtimeConfig.enabled = options.enabled;
  }
}

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
    if (!isSpeechMarkdownEnabled()) {
      console.warn(
        "speechmarkdown-js disabled (set SPEECHMARKDOWN_DISABLE=false or configureSpeechMarkdown({ enabled: true }) to re-enable). Using built-in fallback."
      );
      return null;
    }

    // Attempt dynamic import in both Node and browser without triggering bundlers to hard-require it
    const dynamicImport: any = new Function('m', 'return import(m)');
    const module = await dynamicImport("speechmarkdown-js");
    // Prefer named export, but tolerate default exports
    SpeechMarkdown = module?.SpeechMarkdown ?? module?.default?.SpeechMarkdown ?? module?.default;
    if (!SpeechMarkdown) {
      throw new Error("speechmarkdown-js module did not expose SpeechMarkdown class");
    }
    speechMarkdownLoaded = true;
    return SpeechMarkdown;
  } catch (_error) {
    console.warn(
      "speechmarkdown-js not available. Using built-in fallback. To enable full Speech Markdown in browsers, add 'speechmarkdown-js' to your app and it will be loaded at runtime."
    );
    return null;
  }
}

// Lightweight fallback converter for a minimal subset used in tests
function convertSpeechMarkdownFallback(markdown: string): string {
  let out = markdown;
  // [break:"500ms"] -> <break time="500ms"/>
  out = out.replace(/\[break:\"([^\"]+)\"\]/g, '<break time="$1"/>');
  // [500ms] or [500s] -> <break time="500ms"/>
  out = out.replace(/\[(\d+)m?s\]/g, '<break time="$1ms"/>');
  return out;
}


/**
 * SpeechMarkdownConverter class for converting Speech Markdown to SSML
 */
export class SpeechMarkdownConverter {
  private speechMarkdownInstance: any = null;

  private async ensureInitialized() {
    if (!isSpeechMarkdownEnabled()) {
      this.speechMarkdownInstance = null;
      return null;
    }

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
    if (!isSpeechMarkdownEnabled()) {
      this.speechMarkdownInstance = null;
      const converted = convertSpeechMarkdownFallback(markdown);
      return `<speak>${converted}</speak>`;
    }

    // Attempt to initialize the full converter (no-op if disabled/unavailable)
    await this.ensureInitialized();
    if (this.speechMarkdownInstance) {
      return this.speechMarkdownInstance.toSSML(markdown, { platform });
    }
    // Fallback: minimal conversion
    const converted = convertSpeechMarkdownFallback(markdown);
    return `<speak>${converted}</speak>`;
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
 * - Emphasis: ++emphasized++ or +emphasized+
 * - Rate, pitch, volume: (text)[rate:"slow"], (text)[pitch:"high"], (text)[volume:"loud"]
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
 * - Emphasis: ++text++ or +text+
 * - Rate, pitch, volume: (text)[rate:"slow"], (text)[pitch:"high"], (text)[volume:"loud"]
 *
 * @param text Text to check
 * @returns True if the text contains Speech Markdown syntax
 */
export function isSpeechMarkdown(text: string): boolean {
  // Use a simple heuristic to check for common Speech Markdown patterns
  // This is a simplified version as the library doesn't provide a direct way to check
  const patterns = [
    /\[\d+m?s\]/, // Breaks: [500ms]
    /\[break:"[^"\]]+"\]/, // Breaks with quotes: [break:"weak"] or [break:"500ms"]
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
