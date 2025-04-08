import { AzureTTSClient } from '../engines/azure';
import * as fs from 'fs';
import * as path from 'path';

// Skip these tests in CI environments or when credentials are not available
const runTests = process.env.MICROSOFT_TOKEN && process.env.MICROSOFT_REGION;

// Only run these tests if credentials are available
(runTests ? describe : describe.skip)('AzureTTSClient', () => {
  let client: AzureTTSClient;

  beforeAll(() => {
    // Create a client with the credentials from environment variables
    client = new AzureTTSClient({
      subscriptionKey: process.env.MICROSOFT_TOKEN || '',
      region: process.env.MICROSOFT_REGION || '',
    });
  });

  afterAll(() => {
    // No cleanup needed
  });

  it('should list available voices', async () => {
    const voices = await client.getVoices();
    expect(voices).toBeDefined();
    expect(Array.isArray(voices)).toBe(true);
    expect(voices.length).toBeGreaterThan(0);

    // Check that the voices have the expected properties
    const voice = voices[0];
    expect(voice).toHaveProperty('id');
    expect(voice).toHaveProperty('name');
    expect(voice).toHaveProperty('gender');
    expect(voice).toHaveProperty('languageCodes');
  });

  it('should get voices by language', async () => {
    const voices = await client.getVoicesByLanguage('en-US');
    expect(voices).toBeDefined();
    expect(Array.isArray(voices)).toBe(true);
    expect(voices.length).toBeGreaterThan(0);

    // Check that all voices are for the requested language
    for (const voice of voices) {
      expect(voice.languageCodes.some(lang => lang.bcp47 === 'en-US')).toBe(true);
    }
  });

  it('should prepare SSML correctly', () => {
    // Access the private prepareSSML method using type assertion
    const prepareSSML = (client as any).prepareSSML.bind(client);

    // Test with plain text
    const text = 'Hello, this is a test.';
    const ssml = prepareSSML(text, { voice: 'en-US-JennyNeural' });

    // Check that the SSML is formatted correctly
    expect(ssml).toContain('<speak');
    expect(ssml).toContain('</speak>');
    expect(ssml).toContain('Hello, this is a test.');
  });

  it('should convert Speech Markdown to SSML', () => {
    // Access the private prepareSSML method using type assertion
    const prepareSSML = (client as any).prepareSSML.bind(client);

    // Test with Speech Markdown
    const markdown = 'Hello [500ms] this is a test of Speech Markdown.';
    const ssml = prepareSSML(markdown, {
      voice: 'en-US-JennyNeural',
      useSpeechMarkdown: true
    });

    // Check that the SSML is formatted correctly
    expect(ssml).toContain('<speak');
    expect(ssml).toContain('</speak>');
    expect(ssml).toContain('<break');
  });

  it('should set and get properties', async () => {
    // Set properties
    client.setProperty('rate', 1.5);
    client.setProperty('pitch', 1.2);
    client.setProperty('volume', 2.0);

    // Get properties
    expect(client.getProperty('rate')).toBe(1.5);
    expect(client.getProperty('pitch')).toBe(1.2);
    expect(client.getProperty('volume')).toBe(2.0);

    // Reset properties
    client.setProperty('rate', 1.0);
    client.setProperty('pitch', 1.0);
    client.setProperty('volume', 1.0);
  });
});
