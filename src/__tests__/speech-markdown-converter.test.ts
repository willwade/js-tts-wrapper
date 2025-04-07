import { SpeechMarkdownConverter } from "../markdown/converter";

describe("SpeechMarkdownConverter", () => {
  describe("toSSML", () => {
    it("should convert breaks", () => {
      const markdown = "Hello [500ms] world";
      const expected = '<speak>Hello <break time="500ms"/> world</speak>';
      expect(SpeechMarkdownConverter.toSSML(markdown)).toBe(expected);
    });

    it("should convert emphasis", () => {
      const markdown = "Hello *world*";
      const expected = "<speak>Hello <emphasis>world</emphasis></speak>";
      expect(SpeechMarkdownConverter.toSSML(markdown)).toBe(expected);
    });

    it("should convert rate", () => {
      const markdown = "Hello (rate:slow world)";
      const expected = '<speak>Hello <prosody rate="slow">world</prosody></speak>';
      expect(SpeechMarkdownConverter.toSSML(markdown)).toBe(expected);
    });

    it("should convert pitch", () => {
      const markdown = "Hello (pitch:high world)";
      const expected = '<speak>Hello <prosody pitch="high">world</prosody></speak>';
      expect(SpeechMarkdownConverter.toSSML(markdown)).toBe(expected);
    });

    it("should convert volume", () => {
      const markdown = "Hello (volume:loud world)";
      const expected = '<speak>Hello <prosody volume="loud">world</prosody></speak>';
      expect(SpeechMarkdownConverter.toSSML(markdown)).toBe(expected);
    });

    it("should handle multiple conversions", () => {
      const markdown = "Hello [500ms] (pitch:high *world*)";
      const expected =
        '<speak>Hello <break time="500ms"/> <prosody pitch="high"><emphasis>world</emphasis></prosody></speak>';
      expect(SpeechMarkdownConverter.toSSML(markdown)).toBe(expected);
    });
  });

  describe("isSpeechMarkdown", () => {
    it("should detect breaks", () => {
      expect(SpeechMarkdownConverter.isSpeechMarkdown("Hello [500ms] world")).toBe(true);
    });

    it("should detect emphasis", () => {
      expect(SpeechMarkdownConverter.isSpeechMarkdown("Hello *world*")).toBe(true);
    });

    it("should detect rate", () => {
      expect(SpeechMarkdownConverter.isSpeechMarkdown("Hello (rate:slow world)")).toBe(true);
    });

    it("should detect pitch", () => {
      expect(SpeechMarkdownConverter.isSpeechMarkdown("Hello (pitch:high world)")).toBe(true);
    });

    it("should detect volume", () => {
      expect(SpeechMarkdownConverter.isSpeechMarkdown("Hello (volume:loud world)")).toBe(true);
    });

    it("should return false for plain text", () => {
      expect(SpeechMarkdownConverter.isSpeechMarkdown("Hello world")).toBe(false);
    });
  });
});
