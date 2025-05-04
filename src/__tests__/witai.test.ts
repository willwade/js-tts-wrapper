import { describe, it, expect, jest, beforeAll } from '@jest/globals';
import { WitAITTSClient } from '../engines/witai';

// Mock fetch for testing
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('WitAITTSClient', () => {
  let client: WitAITTSClient;

  beforeAll(() => {
    // Create a client with mock credentials
    client = new WitAITTSClient({
      token: 'test-token'
    });

    // Mock the API responses
    (global.fetch as jest.MockedFunction<typeof fetch>).mockImplementation((input: RequestInfo | URL, options?: RequestInit) => {
      const url = input.toString();
      if (url.includes('/voices')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              "en_US": [
                {
                  "name": "witai$Alex",
                  "gender": "male",
                  "styles": ["calm", "cheerful"]
                },
                {
                  "name": "witai$Samantha",
                  "gender": "female",
                  "styles": ["calm", "cheerful"]
                }
              ],
              "fr_FR": [
                {
                  "name": "witai$Jean",
                  "gender": "male",
                  "styles": ["calm"]
                }
              ]
            }),
            { 
              status: 200, 
              headers: new Headers({ 'Content-Type': 'application/json' }) 
            }
          )
        );
      } else if (url.includes('/synthesize')) {
        const mockArrayBuffer = new ArrayBuffer(1024);
        const mockStream = new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(1024));
            controller.close();
          }
        });
        return Promise.resolve(
          new Response(
            mockStream, 
            { 
              status: 200, 
              headers: new Headers({ 'Content-Type': 'audio/raw' }) 
            }
          )
        );
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });
  });

  it('should initialize with credentials', () => {
    expect(client).toBeDefined();
    expect(client).toBeInstanceOf(WitAITTSClient);
  });

  it('should throw an error if no token is provided', () => {
    expect(() => {
      new WitAITTSClient({
        token: ''
      });
    }).toThrow('An API token for Wit.ai must be provided');
  });

  it('should get voices', async () => {
    const voices = await client.getVoices();
    expect(voices).toBeDefined();
    expect(Array.isArray(voices)).toBe(true);
    expect(voices.length).toBe(3);
    
    // Check voice structure
    const voice = voices[0];
    expect(voice).toHaveProperty('id');
    expect(voice).toHaveProperty('name');
    expect(voice).toHaveProperty('gender');
    expect(voice).toHaveProperty('provider', 'witai');
    expect(voice).toHaveProperty('languageCodes');
    expect(voice.languageCodes[0]).toHaveProperty('bcp47');
  });

  it('should get voices by language', async () => {
    const voices = await client.getVoicesByLanguage('en-US');
    expect(voices).toBeDefined();
    expect(Array.isArray(voices)).toBe(true);
    expect(voices.length).toBe(2);
    
    // Check that all voices are for the requested language
    for (const voice of voices) {
      expect(voice.languageCodes.some(lang => lang.bcp47 === 'en-US')).toBe(true);
    }
  });

  it('should set voice', () => {
    client.setVoice('witai$Alex');
    // This is testing an internal property, but it's the simplest way to verify
    // @ts-ignore - Accessing private property for testing
    expect(client.voiceId).toBe('witai$Alex');
  });

  it('should synthesize text to bytes', async () => {
    const result = await client.synthToBytes('Hello world');
    expect(result).toBeDefined();
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(1024);
  });

  it('should synthesize text to bytestream', async () => {
    const result = await client.synthToBytestream('Hello world');
    expect(result).toBeDefined();
    expect(result).toHaveProperty('audioStream');
    expect(result).toHaveProperty('wordBoundaries');
    expect(Array.isArray(result.wordBoundaries)).toBe(true);
    expect(result.wordBoundaries.length).toBe(2); // "Hello" and "world"
  });

  it('should handle invalid credentials', async () => {
    // Mock fetch to simulate invalid credentials
    const originalFetch = global.fetch;
    (global.fetch as jest.MockedFunction<typeof fetch>).mockImplementationOnce((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes('/voices')) {
        return Promise.resolve(
          new Response(
            null, 
            { 
              status: 401, 
              statusText: 'Unauthorized',
              headers: new Headers({ 'Content-Type': 'application/json' }) 
            }
          )
        );
      }
      return originalFetch(url);
    });

    // Create a new client with invalid credentials
    const invalidClient = new WitAITTSClient({
      token: 'invalid-token'
    });

    try {
      await invalidClient.getVoices();
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});
