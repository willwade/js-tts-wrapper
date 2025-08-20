import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UpliftAITTSClient } from '../engines/upliftai';

// Mock fetch globally
const globalAny: any = global;
globalAny.fetch = jest.fn();

describe('UpliftAITTSClient', () => {
  let client: UpliftAITTSClient;

  beforeEach(() => {
    client = new UpliftAITTSClient({ apiKey: 'test-key' });
    (globalAny.fetch as jest.Mock).mockReset();
  });

  it('should get voices from static list', async () => {
    const voices = await client.getVoices();
    expect(Array.isArray(voices)).toBe(true);
    expect(voices.length).toBe(4);
    expect(voices[0]).toHaveProperty('id');
    expect(voices[0]).toHaveProperty('name');
  });

  it('should synthesize text to bytes', async () => {
    const mockBuffer = new Uint8Array([1,2,3]).buffer;
    (globalAny.fetch as jest.Mock).mockResolvedValueOnce(new Response(mockBuffer, { status: 200 }));

    const bytes = await client.synthToBytes('hello');
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(3);
  });

  it('should synthesize text to stream', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([4,5]));
        controller.close();
      }
    });
    (globalAny.fetch as jest.Mock).mockResolvedValueOnce(new Response(stream, { status: 200 }));

    const result = await client.synthToBytestream('hi');
    const reader = result.audioStream.getReader();
    const chunks: number[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(...value);
    }
    expect(chunks).toEqual([4,5]);
    expect(result.wordBoundaries).toEqual([]);
  });
});
