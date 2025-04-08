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
  
  afterAll(async () => {
    // Clean up any resources
    if (client) {
      await client.close();
    }
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
  
  it('should convert text to speech', async () => {
    const text = 'Hello, this is a test of the Azure Text to Speech service.';
    const outputPath = path.join(__dirname, 'azure-test-output.mp3');
    
    // Convert text to speech and save to file
    await client.speak(text, {
      outputPath,
      voice: 'en-US-JennyNeural',
    });
    
    // Check that the file exists and has content
    expect(fs.existsSync(outputPath)).toBe(true);
    const stats = fs.statSync(outputPath);
    expect(stats.size).toBeGreaterThan(0);
    
    // Clean up the file
    fs.unlinkSync(outputPath);
  });
  
  it('should convert SSML to speech', async () => {
    const ssml = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="en-US">
        <voice name="en-US-JennyNeural">
          <prosody rate="slow" pitch="+10%">
            This is a test of SSML with Azure Text to Speech.
          </prosody>
        </voice>
      </speak>
    `;
    const outputPath = path.join(__dirname, 'azure-ssml-test-output.mp3');
    
    // Convert SSML to speech and save to file
    await client.speak(ssml, {
      outputPath,
    });
    
    // Check that the file exists and has content
    expect(fs.existsSync(outputPath)).toBe(true);
    const stats = fs.statSync(outputPath);
    expect(stats.size).toBeGreaterThan(0);
    
    // Clean up the file
    fs.unlinkSync(outputPath);
  });
  
  it('should convert Speech Markdown to speech', async () => {
    const markdown = 'Hello [500ms] this is a test with (pitch:high) Speech Markdown.';
    const outputPath = path.join(__dirname, 'azure-markdown-test-output.mp3');
    
    // Convert Speech Markdown to speech and save to file
    await client.speak(markdown, {
      outputPath,
      voice: 'en-US-JennyNeural',
      useSpeechMarkdown: true,
    });
    
    // Check that the file exists and has content
    expect(fs.existsSync(outputPath)).toBe(true);
    const stats = fs.statSync(outputPath);
    expect(stats.size).toBeGreaterThan(0);
    
    // Clean up the file
    fs.unlinkSync(outputPath);
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
