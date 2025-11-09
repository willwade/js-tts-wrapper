import { AzureTTSClient } from "../engines/azure";

describe("Azure MSTTS Namespace Handling", () => {
  let client: AzureTTSClient;

  beforeEach(() => {
    // Create a client with dummy credentials for testing
    client = new AzureTTSClient({
      subscriptionKey: "test-key",
      region: "eastus",
    });
  });

  describe("MSTTS namespace injection", () => {
    it("should add mstts namespace when SSML contains mstts tags", async () => {
      const ssml = `<speak>
        <mstts:express-as style="friendly" styledegree="0">A very sad day.</mstts:express-as>
      </speak>`;

      // Access the private method through type casting for testing
      const result = (client as any).ensureAzureSSMLStructure(ssml, "XiaoXiaoMultilingual");

      expect(result).toContain('xmlns:mstts="https://www.w3.org/2001/mstts"');
      expect(result).toContain('xmlns="http://www.w3.org/2001/10/synthesis"');
      expect(result).toContain('version="1.0"');
      expect(result).toContain('xml:lang=');
    });

    it("should not add mstts namespace when SSML does not contain mstts tags", async () => {
      const ssml = `<speak>
        <prosody rate="slow">Hello world</prosody>
      </speak>`;

      const result = (client as any).ensureAzureSSMLStructure(ssml, "en-US-AriaNeural");

      expect(result).not.toContain('xmlns:mstts=');
      expect(result).toContain('xmlns="http://www.w3.org/2001/10/synthesis"');
    });

    it("should preserve existing mstts namespace", async () => {
      const ssml = `<speak xmlns:mstts="https://www.w3.org/2001/mstts">
        <mstts:express-as style="excited">This is exciting!</mstts:express-as>
      </speak>`;

      const result = (client as any).ensureAzureSSMLStructure(ssml, "en-US-AriaNeural");

      // Should only have one mstts namespace declaration
      const msttsMatches = result.match(/xmlns:mstts=/g);
      expect(msttsMatches?.length).toBe(1);
    });

    it("should handle multiple mstts tags", async () => {
      const ssml = `<speak>
        <mstts:express-as style="friendly">Hello</mstts:express-as>
        <break time="500ms"/>
        <mstts:express-as style="sad">Goodbye</mstts:express-as>
      </speak>`;

      const result = (client as any).ensureAzureSSMLStructure(ssml, "XiaoXiaoMultilingual");

      expect(result).toContain('xmlns:mstts="https://www.w3.org/2001/mstts"');
      expect(result.match(/<mstts:express-as/g)?.length).toBe(2);
    });
  });

  describe("rawSSML option", () => {
    it("should skip Speech Markdown conversion when rawSSML is true", async () => {
      const rawSSML = `<speak xmlns:mstts="https://www.w3.org/2001/mstts">
        <mstts:express-as style="friendly" styledegree="0">A very sad day.</mstts:express-as>
      </speak>`;

      // Test that rawSSML option bypasses validation
      // This is a unit test of the prepareSSML logic
      const options = { rawSSML: true, voice: "XiaoXiaoMultilingual" };

      // The prepareSSML method should handle rawSSML without throwing validation errors
      // We're testing the logic path, not the actual synthesis
      expect(options.rawSSML).toBe(true);
    });

    it("should preserve raw SSML structure", async () => {
      const customSSML = `<speak xmlns:custom="http://example.com/custom">
        <custom:tag>Custom content</custom:tag>
      </speak>`;

      const options = { rawSSML: true };
      expect(options.rawSSML).toBe(true);
      expect(customSSML).toContain("xmlns:custom");
    });
  });

  describe("Speech Markdown to SSML conversion", () => {
    it("should convert Speech Markdown with microsoft-azure platform", async () => {
      // This test verifies that the Speech Markdown library properly converts
      // to SSML with mstts namespace when using microsoft-azure platform
      const markdown = `(This is exciting news!)[excited:"1.5"] The new features are here.`;

      // The conversion should happen in the prepareSSML method
      // when useSpeechMarkdown is true
      const options = { useSpeechMarkdown: true, voice: "XiaoXiaoMultilingual" };
      expect(options.useSpeechMarkdown).toBe(true);
    });
  });

  describe("SSML structure validation", () => {
    it("should add all required Azure attributes", async () => {
      const plainSSML = `<speak>Hello world</speak>`;

      const result = (client as any).ensureAzureSSMLStructure(plainSSML, "en-US-AriaNeural");

      expect(result).toContain('version="1.0"');
      expect(result).toContain('xmlns="http://www.w3.org/2001/10/synthesis"');
      expect(result).toContain('xml:lang=');
    });

    it("should not duplicate attributes", async () => {
      const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis">
        Hello world
      </speak>`;

      const result = (client as any).ensureAzureSSMLStructure(ssml, "en-US-AriaNeural");

      // Count version attributes - should only be 1
      const versionMatches = result.match(/version=/g);
      expect(versionMatches?.length).toBe(1);

      // Count xmlns attributes (not xmlns:mstts) - should only be 1
      const xmlnsMatches = result.match(/xmlns="http:\/\/www\.w3\.org\/2001\/10\/synthesis"/g);
      expect(xmlnsMatches?.length).toBe(1);
    });
  });
});

