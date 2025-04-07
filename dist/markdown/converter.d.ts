/**
 * Simple converter for Speech Markdown to SSML
 * For a full implementation, consider using the speechmarkdown-js library
 */
export declare class SpeechMarkdownConverter {
    /**
     * Convert Speech Markdown to SSML
     * @param markdown Speech Markdown text
     * @returns SSML text
     */
    static toSSML(markdown: string): string;
    /**
     * Check if text is Speech Markdown
     * @param text Text to check
     * @returns True if the text contains Speech Markdown syntax
     */
    static isSpeechMarkdown(text: string): boolean;
}
