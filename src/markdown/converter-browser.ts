import { isBrowser } from "../utils/environment";
import { SpeechMarkdown as SMSpeechMarkdown } from "speechmarkdown-js";

/**
 * Browser-specific Speech Markdown converter that statically imports
 * speechmarkdown-js so it can be bundled into the browser build.
 */

// Ensure we are in a browser build context; this file should only be used
// from src/browser.ts and the rollup browser bundle.
if (!isBrowser) {
  // No-op warning; this module is meant for browser bundles only
  // eslint-disable-next-line no-console
  console.warn("converter-browser loaded outside browser; consider using converter.ts instead");
}

export class SpeechMarkdownConverter {
  private speechMarkdownInstance: any;

  constructor() {
    // Statically imported class; safe to instantiate for browser bundle
    this.speechMarkdownInstance = new SMSpeechMarkdown();
  }

  async toSSML(markdown: string, platform = "amazon-alexa"): Promise<string> {
    return this.speechMarkdownInstance.toSSML(markdown, { platform });
  }

  isSpeechMarkdown(text: string): boolean {
    return isSpeechMarkdown(text);
  }

  getAvailablePlatforms(): string[] {
    return getAvailablePlatforms();
  }
}

const defaultConverter = new SpeechMarkdownConverter();

export async function toSSML(markdown: string, platform = "amazon-alexa"): Promise<string> {
  return await defaultConverter.toSSML(markdown, platform);
}

export function isSpeechMarkdown(text: string): boolean {
  // Keep parity with the detection heuristic from converter.ts
  const patterns = [
    /\[\d+m?s\]/,
    /\[break:"[^"\]]+"\]/,
    /\+\+.*?\+\+/, 
    /\+.*?\+/, 
    /~.*?~/,
    /-.*?-/,
    /\(.*?\)\[emphasis(:"(strong|moderate|reduced|none)")?\]/,
    /\(.*?\)\[rate:"(x-slow|slow|medium|fast|x-fast)"\]/,
    /\(.*?\)\[pitch:"(x-low|low|medium|high|x-high)"\]/,
    /\(.*?\)\[volume:"(silent|x-soft|soft|medium|loud|x-loud)"\]/,
    /\(.*?\)\[voice:".*?"\]/,
    /\(.*?\)\[lang:".*?"\]/,
    /\(.*?\)\[\w+:"?.*?"?\]/,
  ];
  return patterns.some((pattern) => pattern.test(text));
}

export function getAvailablePlatforms(): string[] {
  return ["amazon-alexa", "google-assistant", "microsoft-azure"];
}

