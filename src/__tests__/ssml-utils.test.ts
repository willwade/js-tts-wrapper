import { SSMLUtils } from "../core/ssml-utils";

describe("SSMLUtils", () => {
  describe("isSSML", () => {
    it("should return true for valid SSML", () => {
      expect(SSMLUtils.isSSML("<speak>Hello world</speak>")).toBe(true);
    });

    it("should return false for plain text", () => {
      expect(SSMLUtils.isSSML("Hello world")).toBe(false);
    });
  });

  describe("stripSSML", () => {
    it("should strip speak tags", () => {
      expect(SSMLUtils.stripSSML("<speak>Hello world</speak>")).toBe("Hello world");
    });

    it("should strip break tags", () => {
      expect(SSMLUtils.stripSSML('<speak>Hello<break time="500ms"/>world</speak>')).toBe(
        "Hello world"
      );
    });

    it("should strip prosody tags", () => {
      expect(SSMLUtils.stripSSML('<speak><prosody rate="slow">Hello world</prosody></speak>')).toBe(
        "Hello world"
      );
    });
  });

  describe("wrapWithSpeakTags", () => {
    it("should wrap plain text with speak tags", () => {
      expect(SSMLUtils.wrapWithSpeakTags("Hello world")).toBe("<speak>Hello world</speak>");
    });

    it("should not wrap text that already has speak tags", () => {
      const ssml = "<speak>Hello world</speak>";
      expect(SSMLUtils.wrapWithSpeakTags(ssml)).toBe(ssml);
    });
  });

  describe("createProsodyTag", () => {
    it("should create prosody tag with rate", () => {
      const result = SSMLUtils.createProsodyTag("Hello", { rate: "slow" });
      expect(result).toBe('<prosody rate="slow">Hello</prosody>');
    });

    it("should create prosody tag with pitch", () => {
      const result = SSMLUtils.createProsodyTag("Hello", { pitch: "high" });
      expect(result).toBe('<prosody pitch="high">Hello</prosody>');
    });

    it("should create prosody tag with volume", () => {
      const result = SSMLUtils.createProsodyTag("Hello", { volume: 80 });
      expect(result).toBe('<prosody volume="80%">Hello</prosody>');
    });

    it("should create prosody tag with multiple attributes", () => {
      const result = SSMLUtils.createProsodyTag("Hello", {
        rate: "slow",
        pitch: "high",
        volume: 80,
      });
      expect(result).toContain('rate="slow"');
      expect(result).toContain('pitch="high"');
      expect(result).toContain('volume="80%"');
    });

    it("should return original text if no options provided", () => {
      expect(SSMLUtils.createProsodyTag("Hello")).toBe("Hello");
    });
  });
});
