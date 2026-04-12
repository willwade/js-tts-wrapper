/**
 * Tests for AbstractTTSClient.getVoicesByGender() (issue #44)
 */

import type { UnifiedVoice } from "../src/types";

// Minimal stub so we can instantiate a concrete subclass
jest.mock("../src/core/abstract-tts", () => {
  const actual = jest.requireActual("../src/core/abstract-tts");
  return actual;
});

// Build a concrete subclass with a fixed voice list
async function makeClient(voices: UnifiedVoice[]) {
  const { AbstractTTSClient } = await import("../src/core/abstract-tts");

  class TestTTSClient extends AbstractTTSClient {
    constructor() {
      super({ lang: "en-US" } as any);
    }
    protected async _getVoices(): Promise<UnifiedVoice[]> {
      return voices;
    }
    async synthToBytes(_text: string): Promise<Uint8Array> {
      return new Uint8Array();
    }
    async synthToBytestream(_text: string): Promise<ReadableStream<Uint8Array>> {
      return new ReadableStream();
    }
    checkCredentials(): boolean {
      return true;
    }
  }

  return new TestTTSClient();
}

const VOICES: UnifiedVoice[] = [
  {
    id: "voice-female-1",
    name: "Alice",
    gender: "Female",
    languageCodes: [{ bcp47: "en-US", iso639_3: "eng", display: "English (US)" }],
    provider: "azure",
  },
  {
    id: "voice-female-2",
    name: "Beth",
    gender: "Female",
    languageCodes: [{ bcp47: "en-GB", iso639_3: "eng", display: "English (UK)" }],
    provider: "azure",
  },
  {
    id: "voice-male-1",
    name: "Charles",
    gender: "Male",
    languageCodes: [{ bcp47: "en-US", iso639_3: "eng", display: "English (US)" }],
    provider: "azure",
  },
  {
    id: "voice-unknown-1",
    name: "Robot",
    gender: "Unknown",
    languageCodes: [{ bcp47: "en-US", iso639_3: "eng", display: "English (US)" }],
    provider: "azure",
  },
];

describe("AbstractTTSClient.getVoicesByGender()", () => {
  it("returns only Female voices when asked for Female", async () => {
    const client = await makeClient(VOICES);
    const result = await (client as any).getVoicesByGender("Female");
    expect(result).toHaveLength(2);
    expect(result.every((v: UnifiedVoice) => v.gender === "Female")).toBe(true);
  });

  it("returns only Male voices when asked for Male", async () => {
    const client = await makeClient(VOICES);
    const result = await (client as any).getVoicesByGender("Male");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("voice-male-1");
  });

  it("returns only Unknown voices when asked for Unknown", async () => {
    const client = await makeClient(VOICES);
    const result = await (client as any).getVoicesByGender("Unknown");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("voice-unknown-1");
  });

  it("returns an empty array when no voices match the gender", async () => {
    const client = await makeClient([VOICES[0]]); // only Female
    const result = await (client as any).getVoicesByGender("Male");
    expect(result).toHaveLength(0);
  });
});
