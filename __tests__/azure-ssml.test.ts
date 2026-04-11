/**
 * Tests for Azure SSML generation correctness (issue #42)
 */

import * as SSMLUtils from "../src/core/ssml-utils";

// Minimal stub so we can import AzureTTSClient without real credentials
jest.mock("../src/core/abstract-tts", () => {
  return {
    AbstractTTSClient: class {
      voiceId = "en-US-AriaNeural";
      lang = "en-US";
      properties: Record<string, unknown> = { rate: "medium", pitch: "medium", volume: 100 };
      timings: unknown[] = [];
      on() {}
      emit() {}
    },
  };
});

// We test the SSML utilities directly — no network calls needed.

describe("createProsodyTag — volume format", () => {
  it("emits an absolute volume value without a % suffix", () => {
    const result = SSMLUtils.createProsodyTag("hello", { volume: 75 });
    // volume="75" is the absolute format (0-100 scale).
    // volume="75%" would be a relative +75% change — wrong.
    expect(result).toContain('volume="75"');
    expect(result).not.toContain('volume="75%"');
  });

  it("emits volume=100 without % when at full volume", () => {
    const result = SSMLUtils.createProsodyTag("hello", { volume: 100 });
    expect(result).toContain('volume="100"');
    expect(result).not.toContain('volume="100%"');
  });

  it("emits volume=0 without % when muted", () => {
    const result = SSMLUtils.createProsodyTag("hello", { volume: 0 });
    expect(result).toContain('volume="0"');
    expect(result).not.toContain('volume="0%"');
  });
});

describe("Azure prepareSSML — no spurious xmlns/version warnings", () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("does not warn about missing xmlns or version when synthesising plain text", async () => {
    // Import lazily so mock is in place
    const { AzureTTSClient } = await import("../src/engines/azure");
    const client = new AzureTTSClient({ subscriptionKey: "key", region: "eastus" });

    // Access the private method via type cast
    const ssml = await (client as any).prepareSSML("Hello world");

    const xmnsWarning = warnSpy.mock.calls.some((args) =>
      args.some(
        (a: unknown) =>
          typeof a === "string" && a.includes("xmlns") ||
          (Array.isArray(a) && a.some((s: unknown) => typeof s === "string" && s.includes("xmlns")))
      )
    );
    const versionWarning = warnSpy.mock.calls.some((args) =>
      args.some(
        (a: unknown) =>
          typeof a === "string" && a.includes("version") ||
          (Array.isArray(a) && a.some((s: unknown) => typeof s === "string" && s.includes("version")))
      )
    );

    expect(xmnsWarning).toBe(false);
    expect(versionWarning).toBe(false);

    // Sanity: output should actually have the attributes
    expect(ssml).toContain('xmlns="http://www.w3.org/2001/10/synthesis"');
    expect(ssml).toContain('version="1.0"');
  });
});
