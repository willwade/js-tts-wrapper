import * as SpeechMarkdown from "../markdown/converter";

describe("SpeechMarkdown", () => {
  describe("toSSML", () => {
    it("should convert breaks", async () => {
      const markdown = "Hello [500ms] world";
      // The exact output format depends on the speechmarkdown-js library
      // We're just checking that it converts to valid SSML
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
