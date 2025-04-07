import { SpeakOptions } from '../types';
/**
 * Utility functions for working with SSML
 */
export declare class SSMLUtils {
    /**
     * Check if text is SSML
     * @param text Text to check
     * @returns True if the text is SSML
     */
    static isSSML(text: string): boolean;
    /**
     * Strip SSML tags from text
     * @param ssml SSML text
     * @returns Plain text without SSML tags
     */
    static stripSSML(ssml: string): string;
    /**
     * Create a prosody tag with the given properties
     * @param text Text to wrap with prosody
     * @param options Speak options
     * @returns SSML with prosody tag
     */
    static createProsodyTag(text: string, options?: SpeakOptions): string;
    /**
     * Wrap text with speak tags if not already present
     * @param text Text to wrap
     * @returns SSML with speak tags
     */
    static wrapWithSpeakTags(text: string): string;
}
