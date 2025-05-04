import { describe, it, expect, jest, beforeAll } from '@jest/globals';
import { WatsonTTSClient } from '../engines/watson';

// Mock fetch for testing
global.fetch = jest.fn();

describe('WatsonTTSClient', () => {
  let client: WatsonTTSClient;

  beforeAll(() => {
    // Create a client with mock credentials
    client = new WatsonTTSClient({
      apiKey: 'test-api-key',
      region: 'us-south',
      instanceId: 'test-instance-id'
    });

    // Mock the IAM token refresh
    (global.fetch as jest.Mock).mockImplementation((url: string, options: RequestInit) => {
      if (url.includes('iam.cloud.ibm.com/identity/token')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ access_token: 'mock-token' })
        });
      } else if (url.includes('voices')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            voices: [
              {
                name: 'en-US_AllisonV3Voice',
                language: 'en-US',
                gender: 'female',
                description: 'Allison: American English female voice'
              },
              {
                name: 'en-US_MichaelV3Voice',
                language: 'en-US',
                gender: 'male',
                description: 'Michael: American English male voice'
              }
            ]
          })
        });
      } else if (url.includes('synthesize')) {
        return Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(1024));
              controller.close();
            }
          })
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });
  });

  it('should initialize with credentials', () => {
    expect(client).toBeDefined();
    expect(client).toBeInstanceOf(WatsonTTSClient);
  });

  it('should get voices', async () => {
    const voices = await client.getVoices();
    expect(voices).toBeDefined();
    expect(Array.isArray(voices)).toBe(true);
    expect(voices.length).toBe(2);
    
    // Check voice structure
    const voice = voices[0];
    expect(voice).toHaveProperty('id', 'en-US_AllisonV3Voice');
    expect(voice).toHaveProperty('name', 'Allison');
    expect(voice).toHaveProperty('gender', 'Female');
    expect(voice).toHaveProperty('provider', 'ibm');
    expect(voice).toHaveProperty('languageCodes');
    expect(voice.languageCodes[0]).toHaveProperty('bcp47', 'en-US');
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
    client.setVoice('en-US_AllisonV3Voice');
    // This is testing an internal property, but it's the simplest way to verify
    // @ts-ignore - Accessing private property for testing
    expect(client.voiceId).toBe('en-US_AllisonV3Voice');
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
  });

  it('should check credentials', async () => {
    const result = await client.checkCredentials();
    expect(result).toBe(true);
  });

  it('should handle invalid credentials', async () => {
    // Mock fetch to simulate invalid credentials
    const originalFetch = global.fetch;
    (global.fetch as jest.Mock).mockImplementationOnce((url: string) => {
      if (url.includes('voices')) {
        return Promise.resolve({
          ok: false,
          statusText: 'Unauthorized'
        });
      }
      return originalFetch(url);
    });

    // Create a new client with invalid credentials
    const invalidClient = new WatsonTTSClient({
      apiKey: 'invalid-key',
      region: 'us-south',
      instanceId: 'invalid-instance'
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
