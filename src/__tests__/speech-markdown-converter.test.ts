import * as SpeechMarkdown from "../markdown/converter";

describe("SpeechMarkdown", () => {
  describe("toSSML", () => {
    it("should convert breaks", async () => {
      const markdown = "Hello [500ms] world";
      const result = await SpeechMarkdown.toSSML(markdown, "amazon-alexa");
      expect(result).toContain("<break");
      expect(result).toContain('time="500ms"');
    });

    it("should convert breaks with quotes", async () => {
      const markdown = 'Hello [break:"500ms"] world';
      const result = await SpeechMarkdown.toSSML(markdown, "amazon-alexa");
      expect(result).toContain("<break");
      expect(result).toContain('time="500ms"');
    });

    it("should wrap text in speak tags", async () => {
      const markdown = "Hello world";
      const result = await SpeechMarkdown.toSSML(markdown, "amazon-alexa");
      expect(result).toContain("<speak>");
      expect(result).toContain("</speak>");
    });

    it("should convert emphasis syntax ++text++ to SSML", async () => {
      const markdown = "I can make text ++important++ or use emphasis";
      const result = await SpeechMarkdown.toSSML(markdown, "microsoft-azure");

      expect(result).toContain("<emphasis");
      expect(result).not.toContain("++important++");
    });

    it("should convert rate modifier (text)[rate:'slow'] to SSML", async () => {
      const markdown = "(I can speak text slow)[rate:'x-slow'] and (I can speak text fast)[rate:'x-fast']";
      const result = await SpeechMarkdown.toSSML(markdown, "microsoft-azure");

      expect(result).toContain('<prosody rate="x-slow"');
      expect(result).toContain('<prosody rate="x-fast"');
      expect(result).not.toContain("[rate:'x-slow']");
      expect(result).not.toContain("[rate:'x-fast']");
    });

    it("should convert pitch modifier (text)[pitch:'high'] to SSML", async () => {
      const markdown = "(I can speak text high)[pitch:'high'] and (I can speak text low)[pitch:'low']";
      const result = await SpeechMarkdown.toSSML(markdown, "microsoft-azure");

      expect(result).toContain('<prosody pitch="high"');
      expect(result).toContain('<prosody pitch="low"');
      expect(result).not.toContain("[pitch:'high']");
      expect(result).not.toContain("[pitch:'low']");
    });

    it("should convert volume modifier (text)[volume:'loud'] to SSML", async () => {
      const markdown = "(I can speak text loud)[volume:'loud'] and (I can speak text soft)[volume:'soft']";
      const result = await SpeechMarkdown.toSSML(markdown, "microsoft-azure");

      expect(result).toContain('<prosody volume="loud"');
      expect(result).toContain('<prosody volume="soft"');
      expect(result).not.toContain("[volume:'loud']");
      expect(result).not.toContain("[volume:'soft']");
    });

    it("should handle complex Speech Markdown with multiple modifiers", async () => {
      const markdown = `Test content
There is a short pause [500ms], before I continue.
I can make text ++important++ or use very emphasised and slightly emphasised.
(I can speak text slow)[rate:'x-slow'] and (I can speak text fast)[rate:'x-fast'].
(I can speak text high)[pitch:'high'] and (I can speak text low)[pitch:'low'].
(I can speak text loud)[volume:'loud'] and (I can speak text soft)[volume:'soft'].`;

      const result = await SpeechMarkdown.toSSML(markdown, "microsoft-azure");

      // All these Speech Markdown constructs should be converted
      expect(result).toContain('<break time="500ms"');
      expect(result).toContain("<emphasis");
      expect(result).toContain('<prosody rate="x-slow"');
      expect(result).toContain('<prosody rate="x-fast"');
      expect(result).toContain('<prosody pitch="high"');
      expect(result).toContain('<prosody pitch="low"');
      expect(result).toContain('<prosody volume="loud"');
      expect(result).toContain('<prosody volume="soft"');

      // Raw Speech Markdown syntax should NOT be present in output
      expect(result).not.toContain("[500ms]");
      expect(result).not.toContain("++important++");
      expect(result).not.toContain("[rate:'");
      expect(result).not.toContain("[pitch:'");
      expect(result).not.toContain("[volume:'");
    });

    it("should support different platforms", async () => {
      const markdown = "Hello [500ms] world";
      const amazonResult = await SpeechMarkdown.toSSML(markdown, "amazon-alexa");
      const googleResult = await SpeechMarkdown.toSSML(markdown, "google-assistant");
      const microsoftResult = await SpeechMarkdown.toSSML(markdown, "microsoft-azure");

      expect(amazonResult).toContain("<break");
      expect(googleResult).toContain("<break");
      expect(microsoftResult).toContain("<break");
    });
  });

  describe("isSpeechMarkdown", () => {
    it("should detect breaks", () => {
      expect(SpeechMarkdown.isSpeechMarkdown("Hello [500ms] world")).toBe(true);
    });

    it("should detect breaks with quotes", () => {
      expect(SpeechMarkdown.isSpeechMarkdown('Hello [break:"500ms"] world')).toBe(true);
    });

    it("should detect emphasis", () => {
      expect(SpeechMarkdown.isSpeechMarkdown("Hello ++emphasized++ world")).toBe(true);
    });

    it("should detect rate", () => {
      expect(SpeechMarkdown.isSpeechMarkdown("Hello (slowly)[rate:\"slow\"] world")).toBe(true);
    });

    it("should detect pitch", () => {
      expect(SpeechMarkdown.isSpeechMarkdown("Hello (high)[pitch:\"high\"] world")).toBe(true);
    });

    it("should detect volume", () => {
      expect(SpeechMarkdown.isSpeechMarkdown("Hello (loud)[volume:\"loud\"] world")).toBe(true);
    });

    it("should return false for plain text", () => {
      expect(SpeechMarkdown.isSpeechMarkdown("Hello world")).toBe(false);
    });
  });

  describe("getAvailablePlatforms", () => {
    it("should return an array of supported platforms", () => {
      const platforms = SpeechMarkdown.getAvailablePlatforms();
      expect(Array.isArray(platforms)).toBe(true);
      expect(platforms.length).toBeGreaterThan(0);
      expect(platforms).toContain("amazon-alexa");
      expect(platforms).toContain("google-assistant");
      expect(platforms).toContain("microsoft-azure");
    });
  });
});
