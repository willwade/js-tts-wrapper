/**
 * Integration tests for SherpaOnnx WebAssembly TTS client
 */

import { SherpaOnnxWasmTTSClient } from '../../src';
import { expect, describe, it } from '@jest/globals';
import * as sinon from 'sinon';

describe('SherpaOnnx WebAssembly TTS Integration', () => {
  it('should be exported from the main library', () => {
    expect(typeof SherpaOnnxWasmTTSClient).toBe('function');
  });

  it('should create a new instance with default options', () => {
    const client = new SherpaOnnxWasmTTSClient({});
    expect(client).toBeInstanceOf(SherpaOnnxWasmTTSClient);
  });

  it('should implement the AbstractTTSClient interface', async () => {
    const client = new SherpaOnnxWasmTTSClient({});

    // Check that all required methods are implemented
    expect(typeof client.checkCredentials).toBe('function');
    expect(typeof client.getVoices).toBe('function');
    expect(typeof client.setVoice).toBe('function');
    expect(typeof client.synthToBytes).toBe('function');
    expect(typeof client.synthToStream).toBe('function');
    expect(typeof client.synthToFile).toBe('function');
    expect(typeof client.getProperty).toBe('function');
    expect(typeof client.setProperty).toBe('function');
    expect(typeof client.dispose).toBe('function');

    // Check that the methods return the expected types
    const credentialsValid = await client.checkCredentials();
    expect(typeof credentialsValid).toBe('boolean');

    const voices = await client.getVoices();
    expect(Array.isArray(voices)).toBe(true);
    if (voices.length > 0) {
      expect(voices[0]).toHaveProperty('id');
      expect(voices[0]).toHaveProperty('name');
      expect(voices[0]).toHaveProperty('provider', 'sherpaonnx-wasm');
    }

    // Test synthToBytes with mock implementation
    const audioBytes = await client.synthToBytes('Hello world');
    expect(audioBytes).toBeInstanceOf(Uint8Array);
    expect(audioBytes.length).toBeGreaterThan(0);
  });

  it('should handle WebAssembly initialization', async () => {
    const client = new SherpaOnnxWasmTTSClient({});

    // Mock the initializeWasm method
    const initializeWasmStub = sinon.stub(client, 'initializeWasm').resolves();

    // Call initializeWasm
    await client.initializeWasm('path/to/wasm');

    expect(initializeWasmStub.calledOnce).toBe(true);
    expect(initializeWasmStub.calledWith('path/to/wasm')).toBe(true);
  });

  it('should handle errors gracefully', async () => {
    const client = new SherpaOnnxWasmTTSClient({});

    // Mock the synthToBytes method to throw an error
    const synthToBytesStub = sinon.stub(client, 'synthToBytes').rejects(new Error('Test error'));

    // Mock console.error to prevent error messages in test output
    const consoleErrorStub = sinon.stub(console, 'error');

    // Create spies for callbacks
    const onAudioBuffer = sinon.spy();
    const onStart = sinon.spy();
    const onEnd = sinon.spy();

    // Call synthToStream which should handle the error
    await client.synthToStream('Hello world', onAudioBuffer, onStart, onEnd);

    expect(synthToBytesStub.calledOnce).toBe(true);
    expect(onStart.calledOnce).toBe(true);
    expect(onEnd.calledOnce).toBe(true);
    expect(onAudioBuffer.called).toBe(false);
    expect(consoleErrorStub.calledOnce).toBe(true);

    // Restore console.error
    consoleErrorStub.restore();
  });
});
