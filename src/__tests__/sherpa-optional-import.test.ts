import { describe, it, expect } from '@jest/globals';

// This test ensures that importing the package entry does not eagerly require
// optional native dependencies like `sherpa-onnx-node`. The original bug report
// indicated that simply requiring the package failed across all engines because
// sherpa-onnx was pulled in at import-time.

describe('package import (no sherpa installed)', () => {
  it('does not throw when importing the root entry', async () => {
    // Use isolateModules to ensure a fresh module load for this test
    await expect(
      (async () => {
        // Import the library entry. This must not attempt to load sherpa-onnx-node.
        const mod = await import('..');
        // Basic sanity check: a known export should exist
        expect(mod).toHaveProperty('AzureTTSClient');
      })()
    ).resolves.not.toThrow();
  });
});

