import type { SpeakOptions } from "../types";

/**
 * Check if text is SSML
 * @param text Text to check
 * @returns True if the text is SSML
 */
export function isSSML(text: string): boolean {
  return text.trim().startsWith("<speak") && text.trim().endsWith("</speak>");
}

/**
 * Strip SSML tags from text
 * @param ssml SSML text
 * @returns Plain text without SSML tags
 */
export function stripSSML(ssml: string): string {
  // Simple implementation - for production, consider using a proper XML parser
  return ssml
    .replace(/<speak.*?>/g, "")
    .replace(/<\/speak>/g, "")
    .replace(/<break.*?\/>/g, " ")
    .replace(/<emphasis.*?>(.*?)<\/emphasis>/g, "$1")
    .replace(/<prosody.*?>(.*?)<\/prosody>/g, "$1")
    .replace(/<voice.*?>(.*?)<\/voice>/g, "$1")
    .replace(/<say-as.*?>(.*?)<\/say-as>/g, "$1")
    .replace(/<phoneme.*?>(.*?)<\/phoneme>/g, "$1")
    .replace(/<sub.*?>(.*?)<\/sub>/g, "$1")
    .replace(/<p>(.*?)<\/p>/g, "$1 ")
    .replace(/<s>(.*?)<\/s>/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Create a prosody tag with the given properties
 * @param text Text to wrap with prosody
 * @param options Speak options
 * @returns SSML with prosody tag
 */
export function createProsodyTag(text: string, options?: SpeakOptions): string {
  if (!options) return text;

  const attrs: string[] = [];

  if (options.rate) attrs.push(`rate="${options.rate}"`);
  if (options.pitch) attrs.push(`pitch="${options.pitch}"`);
  if (options.volume !== undefined) attrs.push(`volume="${options.volume}%"`);

  if (attrs.length === 0) return text;

  return `<prosody ${attrs.join(" ")}>${text}</prosody>`;
}

/**
 * Wrap text with speak tags if not already present
 * @param text Text to wrap
 * @returns SSML with speak tags
 */
export function wrapWithSpeakTags(text: string): string {
  if (isSSML(text)) return text;
  return `<speak>${text}</speak>`;
}
