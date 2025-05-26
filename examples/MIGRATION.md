# Examples Directory Migration Guide

This guide explains how the examples directory has been reorganized to reduce duplication.

## Removed Files and Their Replacements

The following files have been removed and replaced by the unified test runner:

- `test-audio-playback.cjs` → Use `unified-test-runner.js` with appropriate mode
- `test-audio-playback.js` → Use `unified-test-runner.js` with appropriate mode
- `test-direct-audio.js` → Use `unified-test-runner.js` with appropriate mode
- `test-elevenlabs.js` → Use `unified-test-runner.js` with appropriate mode
- `test-espeak.js` → Use `unified-test-runner.js` with appropriate mode
- `test-mock.js` → Use `unified-test-runner.js` with appropriate mode
- `test-node-audio-esm.js` → Use `unified-test-runner.js` with appropriate mode
- `test-node-audio-playback.js` → Use `unified-test-runner.js` with appropriate mode
- `test-node-audio-util.js` → Use `unified-test-runner.js` with appropriate mode
- `test-node-audio.cjs` → Use `unified-test-runner.js` with appropriate mode
- `test-node-audio.js` → Use `unified-test-runner.js` with appropriate mode
- `test-playback-control-engines.cjs` → Use `unified-test-runner.js` with appropriate mode
- `test-playback-control-engines.js` → Use `unified-test-runner.js` with appropriate mode
- `test-playback-control.cjs` → Use `unified-test-runner.js` with appropriate mode
- `test-playback-control.js` → Use `unified-test-runner.js` with appropriate mode
- `test-sherpaonnx-download.js` → Use `unified-test-runner.js` with appropriate mode
- `test-sherpaonnx-fixed.cjs` → Use `unified-test-runner.js` with appropriate mode
- `test-sherpaonnx.js` → Use `unified-test-runner.js` with appropriate mode
- `test-sound-play.js` → Use `unified-test-runner.js` with appropriate mode
- `test-tts-factory.js` → Use `unified-test-runner.js` with appropriate mode

## New Unified Test Runner

The new `unified-test-runner.js` replaces most individual test files:

### Basic Usage
```bash
# Test all engines (basic mode)
node examples/unified-test-runner.js

# Test specific engine
node examples/unified-test-runner.js azure

# Test with different modes
node examples/unified-test-runner.js --mode=playback
node examples/unified-test-runner.js --mode=features
PLAY_AUDIO=true node examples/unified-test-runner.js --mode=audio
```

### Migration Examples

| Old Command | New Command |
|-------------|-------------|
| `node examples/test-mock.js` | `node examples/unified-test-runner.js mock` |
| `node examples/test-elevenlabs.js` | `node examples/unified-test-runner.js elevenlabs` |
| `node examples/test-playback-control.js` | `node examples/unified-test-runner.js --mode=playback` |
| `node examples/test-node-audio.js` | `node examples/unified-test-runner.js --mode=audio` |

## Shared Modules

New shared modules provide common functionality:

- `shared/engine-configs.js` - Centralized engine configuration
- `shared/test-utils.js` - Common test utilities

## Remaining Files

These files are kept for specific functionality:

- `test-engines.js` - Main comprehensive test suite (ESM)
- `test-engines.cjs` - Main comprehensive test suite (CommonJS)
- `test-sherpaonnx-features.js` - Detailed SherpaOnnx feature analysis
- `browser-test.html` - Browser-based testing interface
- `check-credentials.js` - Credential validation utility
- `cli-highlight-all-engines.mjs` - CLI highlighting demonstration
- `debug-sherpaonnx.cjs` - SherpaOnnx debugging utility
- `playht-stream-test.mjs` - PlayHT streaming test
- `tts-example.js` - Basic usage example
- `README.md` - Documentation
