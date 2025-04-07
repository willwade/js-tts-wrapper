/**
 * Simple converter for Speech Markdown to SSML
 * For a full implementation, consider using the speechmarkdown-js library
 */
export class SpeechMarkdownConverter {
  /**
   * Convert Speech Markdown to SSML
   * @param markdown Speech Markdown text
   * @returns SSML text
   */
  static toSSML(markdown: string): string {
    let ssml = markdown;

    // Convert basic Speech Markdown syntax to SSML

    // Breaks
    // [500ms] -> <break time="500ms"/>
    ssml = ssml.replace(/\[(\d+ms)\]/g, '<break time="$1"/>');

    // Emphasis
    // *emphasized* -> <emphasis>emphasized</emphasis>
    ssml = ssml.replace(/\*(.*?)\*/g, "<emphasis>$1</emphasis>");

    // Rate
    // (rate:slow text) -> <prosody rate="slow">text</prosody>
    ssml = ssml.replace(
      /\(rate:(x-slow|slow|medium|fast|x-fast) (.*?)\)/g,
      '<prosody rate="$1">$2</prosody>'
    );

    // Pitch
    // (pitch:high text) -> <prosody pitch="high">text</prosody>
    ssml = ssml.replace(
      /\(pitch:(x-low|low|medium|high|x-high) (.*?)\)/g,
      '<prosody pitch="$1">$2</prosody>'
    );

    // Volume
    // (volume:loud text) -> <prosody volume="loud">text</prosody>
    ssml = ssml.replace(
      /\(volume:(silent|x-soft|soft|medium|loud|x-loud) (.*?)\)/g,
      '<prosody volume="$1">$2</prosody>'
    );

    // Wrap with speak tags if not already present
    if (!ssml.trim().startsWith("<speak")) {
      ssml = `<speak>${ssml}</speak>`;
    }

    return ssml;
  }

  /**
   * Check if text is Speech Markdown
   * @param text Text to check
   * @returns True if the text contains Speech Markdown syntax
   */
  static isSpeechMarkdown(text: string): boolean {
    // Check for common Speech Markdown patterns
    const patterns = [
      /\[\d+ms\]/, // Breaks
      /\*.*?\*/, // Emphasis
      /\(rate:(x-slow|slow|medium|fast|x-fast) .*?\)/, // Rate
      /\(pitch:(x-low|low|medium|high|x-high) .*?\)/, // Pitch
      /\(volume:(silent|x-soft|soft|medium|loud|x-loud) .*?\)/, // Volume
    ];

    return patterns.some((pattern) => pattern.test(text));
  }
}
