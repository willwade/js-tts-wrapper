import { EspeakTTSClient } from '../../src/engines/espeak';

describe('EspeakTTSClient', () => {
  it('should instantiate without errors', () => {
    expect(() => new EspeakTTSClient()).not.toThrow();
  });

  it('should synthesize to bytes and return a WAV buffer', async () => {
    const client = new EspeakTTSClient();
    const bytes = await client.synthToBytes('Hello world!');
    expect(bytes).toBeInstanceOf(Uint8Array);
    // Check for "RIFF" and "WAVE" headers
    const str = Buffer.from(bytes).toString('ascii', 0, 12);
    expect(str.startsWith('RIFF')).toBe(true);
    expect(str.includes('WAVE')).toBe(true);
  });

  it('should synthesize to bytestream and return a ReadableStream of WAV bytes', async () => {
    const client = new EspeakTTSClient();
    const stream = await client.synthToBytestream('Hello world!');
    expect(typeof stream.getReader === 'function').toBe(true);
    // Read a chunk and check for WAV header
    const reader = stream.getReader();
    const { value, done } = await reader.read();
    expect(done).toBe(false);
    expect(value).toBeInstanceOf(Uint8Array);
    const str = Buffer.from(value).toString('ascii', 0, 12);
    expect(str.startsWith('RIFF')).toBe(true);
    expect(str.includes('WAVE')).toBe(true);
  });

  it('should write output to a file and verify WAV header', async () => {
    const fs = await import('fs');
    const path = require('path');
    const client = new EspeakTTSClient();
    const bytes = await client.synthToBytes('Test file output');
    const outPath = path.join(__dirname, 'test-espeak.wav');
    fs.writeFileSync(outPath, Buffer.from(bytes));
    const fileBuf = fs.readFileSync(outPath);
    expect(fileBuf.slice(0, 4).toString('ascii')).toBe('RIFF');
    expect(fileBuf.slice(8, 12).toString('ascii')).toBe('WAVE');
    fs.unlinkSync(outPath);
  });
});
