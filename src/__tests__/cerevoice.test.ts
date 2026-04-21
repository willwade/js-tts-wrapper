import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { CereVoiceTTSClient } from "../engines/cerevoice";
import { createBrowserTTSClient } from "../factory-browser";
import { createTTSClient } from "../factory";

const originalFetch = globalThis.fetch;

function arrayBufferFromBytes(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function response(
  body: any,
  init: {
    ok?: boolean;
    status?: number;
    statusText?: string;
    headers?: Headers;
    streamBody?: ReadableStream<Uint8Array> | null;
    bytes?: Uint8Array;
  } = {}
) {
  const bytes = init.bytes || new Uint8Array([1, 2, 3, 4]);
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? "OK",
    headers: init.headers || new Headers(),
    body: init.streamBody ?? null,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    arrayBuffer: async () => arrayBufferFromBytes(bytes),
  };
}

function authResponse(accessToken = "access-token", refreshToken = "refresh-token") {
  return response({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
}

function voicesResponse() {
  return response({
    voices: [
      {
        name: "Heather",
        sample_rate: [16000],
        language_iso: "en",
        country_iso: "GB",
        accent_code: "sc",
        gender: "female",
        language_ms: "809",
        country: "Great Britain",
        region: "Scotland",
        accent: "Scottish",
        language: "English",
      },
    ],
  });
}

describe("CereVoiceTTSClient", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("initializes with defaults and required credentials", () => {
    const client = new CereVoiceTTSClient({ email: "user@example.com", password: "secret" });

    expect(client.getProperty("voice")).toBe("Heather");
    expect(client.getProperty("audioFormat")).toBe("wav");
    expect(client.capabilities.browserSupported).toBe(true);
    expect(client.capabilities.nodeSupported).toBe(true);
    expect((client as any).getRequiredCredentials()).toEqual(["email", "password"]);
    expect(client.getModels()[0].features).toContain("word-boundary-events");
  });

  it("applies properties from credentials", () => {
    const client = new CereVoiceTTSClient({
      email: "user@example.com",
      password: "secret",
      properties: {
        voice: "Sarah",
        audioFormat: "mp3",
        sampleRate: 16000,
        language: "en",
        accent: "rp",
        metadata: true,
      },
    });

    expect(client.getProperty("voice")).toBe("Sarah");
    expect(client.getProperty("audioFormat")).toBe("mp3");
    expect(client.getProperty("sampleRate")).toBe(16000);
    expect(client.getProperty("language")).toBe("en");
    expect(client.getProperty("accent")).toBe("rp");
    expect(client.getProperty("metadata")).toBe(true);
  });

  it("applies JSON properties from credentials", () => {
    const client = new CereVoiceTTSClient({
      email: "user@example.com",
      password: "secret",
      propertiesJson: JSON.stringify({ voice: "William", audioFormat: "ogg" }),
    });

    expect(client.getProperty("voice")).toBe("William");
    expect(client.getProperty("audioFormat")).toBe("ogg");
  });

  it("creates via node and browser factories", () => {
    expect(createTTSClient("cerevoice", { email: "u", password: "p" })).toBeInstanceOf(
      CereVoiceTTSClient
    );
    expect(createBrowserTTSClient("cerevoice", { email: "u", password: "p" })).toBeInstanceOf(
      CereVoiceTTSClient
    );
  });

  it("returns false for checkCredentials without credentials", async () => {
    await expect(new CereVoiceTTSClient({}).checkCredentials()).resolves.toBe(false);
  });

  it("authenticates and maps voices", async () => {
    const fetchMock = jest.fn(async (url: string, options: any) => {
      if (url.endsWith("/auth")) {
        expect(options.headers.Authorization).toBe(
          `Basic ${Buffer.from("user@example.com:secret").toString("base64")}`
        );
        return authResponse();
      }

      if (url.endsWith("/voices")) {
        expect(options.headers.Authorization).toBe("Bearer access-token");
        return voicesResponse();
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    globalThis.fetch = fetchMock as any;

    const client = new CereVoiceTTSClient({ email: "user@example.com", password: "secret" });
    const voices = await client.getVoices();

    expect(voices).toHaveLength(1);
    expect(voices[0].id).toBe("Heather");
    expect(voices[0].provider).toBe("cerevoice");
    expect(voices[0].gender).toBe("Female");
    expect(voices[0].languageCodes[0].bcp47).toBe("en-GB");
    expect(voices[0].metadata?.accent_code).toBe("sc");
  });

  it("synthesizes plain text with selected query params", async () => {
    const audioBytes = new Uint8Array([9, 8, 7, 6]);
    const fetchMock = jest.fn(async (url: string, options: any) => {
      if (url.endsWith("/auth")) {
        return authResponse();
      }

      if (url.includes("/speak")) {
        const requestUrl = new URL(url);
        expect(requestUrl.searchParams.get("voice")).toBe("Sarah");
        expect(requestUrl.searchParams.get("audio_format")).toBe("mp3");
        expect(requestUrl.searchParams.get("sample_rate")).toBe("16000");
        expect(requestUrl.searchParams.get("metadata")).toBe("false");
        expect(options.headers.Authorization).toBe("Bearer access-token");
        expect(options.headers["Content-Type"]).toBe("text/plain");
        expect(options.headers.Accept).toBe("audio/mpeg");
        expect(options.body).toBe("Hello world");
        return response({}, { bytes: audioBytes });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    globalThis.fetch = fetchMock as any;

    const client = new CereVoiceTTSClient({ email: "user@example.com", password: "secret" });
    const bytes = await client.synthToBytes("Hello world", {
      voice: "Sarah",
      format: "mp3",
      sampleRate: 16000,
    });

    expect(Array.from(bytes)).toEqual([9, 8, 7, 6]);
  });

  it("preserves SSML and sends XML content", async () => {
    const fetchMock = jest.fn(async (url: string, options: any) => {
      if (url.endsWith("/auth")) {
        return authResponse();
      }

      if (url.includes("/speak")) {
        expect(options.headers["Content-Type"]).toBe("text/xml");
        expect(options.body).toBe("<speak>Hello <break time=\"500ms\"/> world</speak>");
        return response({});
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    globalThis.fetch = fetchMock as any;

    const client = new CereVoiceTTSClient({ email: "user@example.com", password: "secret" });
    await client.synthToBytes("<speak>Hello <break time=\"500ms\"/> world</speak>");
  });

  it("fetches CereVoice metadata and converts it to wrapper word boundaries", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      },
    });
    const metadataHeaders = new Headers({
      "X-CereVoice-Metadata": "https://metadata.example.test/trans.xml",
    });
    const fetchMock = jest.fn(async (url: string, options: any) => {
      if (url.endsWith("/auth")) {
        return authResponse();
      }

      if (url.includes("/speak")) {
        expect(new URL(url).searchParams.get("metadata")).toBe("true");
        return response({}, { headers: metadataHeaders, streamBody: stream });
      }

      if (url === "https://metadata.example.test/trans.xml") {
        expect(options.headers.Authorization).toBeUndefined();
        return response(
          '<trans><word name="hello" start="0.100" end="0.300"/><word name="world" start="0.300" end="0.650"/></trans>'
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    globalThis.fetch = fetchMock as any;

    const client = new CereVoiceTTSClient({ email: "user@example.com", password: "secret" });
    const result = await client.synthToBytestream("Hello world", { useWordBoundary: true });

    expect(result.wordBoundaries).toEqual([
      { text: "hello", offset: 1000, duration: 2000 },
      { text: "world", offset: 3000, duration: 3500 },
    ]);
    expect(result.audioStream).toBe(stream);
  });

  it("returns empty boundaries when metadata is malformed", async () => {
    const fetchMock = jest.fn(async (url: string) => {
      if (url.endsWith("/auth")) {
        return authResponse();
      }

      if (url.includes("/speak")) {
        return response(
          {},
          {
            headers: new Headers({
              "X-CereVoice-Metadata": "https://metadata.example.test/bad.xml",
            }),
          }
        );
      }

      if (url === "https://metadata.example.test/bad.xml") {
        return response('<trans><word name="hello" start="bad"/></trans>');
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    globalThis.fetch = fetchMock as any;

    const client = new CereVoiceTTSClient({ email: "user@example.com", password: "secret" });
    const result = await client.synthToBytestream("Hello world", { useWordBoundary: true });

    expect(result.wordBoundaries).toEqual([]);
  });

  it("fills zero-duration CereVoice word metadata from the next word offset", async () => {
    const fetchMock = jest.fn(async (url: string) => {
      if (url.endsWith("/auth")) {
        return authResponse();
      }

      if (url.includes("/speak")) {
        return response(
          {},
          {
            headers: new Headers({
              "X-CereVoice-Metadata": "https://metadata.example.test/zero-duration.xml",
            }),
          }
        );
      }

      if (url === "https://metadata.example.test/zero-duration.xml") {
        return response(
          '<trans><word name="hello" start="0.030" end="0.030"/><word name="world" start="0.420" end="0.420"/></trans>'
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    globalThis.fetch = fetchMock as any;

    const client = new CereVoiceTTSClient({ email: "user@example.com", password: "secret" });
    const result = await client.synthToBytestream("Hello world", { useWordBoundary: true });

    expect(result.wordBoundaries).toEqual([
      { text: "hello", offset: 300, duration: 3900 },
      { text: "world", offset: 4200, duration: 5000 },
    ]);
  });

  it("refreshes and retries once after a 401", async () => {
    const fetchMock = jest.fn(async (url: string, options: any) => {
      if (url.includes("/speak") && options.headers.Authorization === "Bearer stale-token") {
        return response("expired", { ok: false, status: 401, statusText: "Unauthorized" });
      }

      if (url.includes("/auth/refresh")) {
        expect(new URL(url).searchParams.get("refresh_token")).toBe("refresh-token");
        return response({ access_token: "new-token" });
      }

      if (url.includes("/speak") && options.headers.Authorization === "Bearer new-token") {
        return response({}, { bytes: new Uint8Array([5, 5]) });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    globalThis.fetch = fetchMock as any;

    const client = new CereVoiceTTSClient({
      accessToken: "stale-token",
      refreshToken: "refresh-token",
    });
    const bytes = await client.synthToBytes("Hello");

    expect(Array.from(bytes)).toEqual([5, 5]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
