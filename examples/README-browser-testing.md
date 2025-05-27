# Browser Testing for JS TTS Wrapper

This directory contains comprehensive browser testing tools for the js-tts-wrapper library, enabling you to test TTS engines in both server-side (Node.js) and client-side (browser) environments.

## 🎯 Overview

We've cleaned up and organized the browser testing infrastructure to provide:

1. **Simple Mock Testing** - Quick verification that audio playback works
2. **Real Engine Testing** - Test actual cloud TTS services in the browser
3. **Unified Testing** - Comprehensive test runner for all engines
4. **Server-side Testing** - Node.js unified test runner for comparison

## 📁 Files

### Browser Test Files

- **`browser-test.html`** - Simple demo with mock TTS engine
  - No credentials required
  - Generates beep sound to test audio playback
  - Good for verifying browser audio functionality

- **`browser-real-engine-test.html`** - Real TTS engine testing
  - Tests ElevenLabs and OpenAI TTS engines
  - Requires valid API keys
  - Demonstrates actual speech synthesis in browser

- **`browser-unified-test.html`** - Comprehensive test runner
  - Tests all browser-compatible engines
  - Unified interface similar to server-side testing
  - Supports credentials for multiple engines

### Server-side Test Files

- **`unified-test-runner.js`** - Server-side unified test runner
  - Tests all engines including server-only ones (SherpaOnnx)
  - Multiple test modes (basic, playback, features, etc.)
  - Command-line interface

### Utility Files

- **`test-browser-imports.mjs`** - Import verification script
  - Tests that browser builds work correctly
  - Verifies engine instantiation
  - Useful for debugging build issues

## 🚀 Getting Started

### 1. Start HTTP Server

The browser tests need to be served over HTTP (not file://) to work properly:

```bash
# From the project root
python3 -m http.server 8080
# or
npx serve .
```

### 2. Open Browser Tests

Navigate to:
- http://localhost:8080/examples/browser-test.html (Simple mock test)
- http://localhost:8080/examples/browser-real-engine-test.html (Real engines)
- http://localhost:8080/examples/browser-unified-test.html (All engines)

### 3. Test Server-side

```bash
# Test all engines
node examples/unified-test-runner.js

# Test specific engine
node examples/unified-test-runner.js mock --mode=basic
node examples/unified-test-runner.js azure --mode=features

# Test with audio playback
PLAY_AUDIO=true node examples/unified-test-runner.js mock --mode=audio
```

## 🔧 Browser-Compatible Engines

The following engines work in browser environments:

### ✅ Fully Supported
- **Mock TTS** - No credentials required, generates test audio
- **ElevenLabs** - Requires API key, excellent voice quality
- **OpenAI TTS** - Requires API key, natural voices
- **Azure TTS** - Requires subscription key + region
- **Google Cloud TTS** - Requires service account JSON
- **AWS Polly** - Requires access key + secret + region
- **Wit.ai TTS** - Requires API token
- **Watson TTS** - Requires API key + URL

### ⚠️ Browser Limitations
- **SherpaOnnx** - Server-only (Node.js native modules)
- **SherpaOnnx WASM** - Browser-compatible but requires WASM files
- **eSpeak NG** - Browser-compatible with included WASM

## 🔐 Security Considerations

### API Key Safety
- **Never expose production API keys** in client-side code
- Use test/development keys only for browser testing
- Consider implementing a server-side proxy for production

### CORS Issues
Some TTS APIs may have CORS restrictions. Solutions:
- Use a CORS proxy service
- Implement server-side API proxy
- Use browser extensions to disable CORS (development only)

### Rate Limiting
- Be mindful of API rate limits during testing
- Implement delays between requests if needed
- Use test accounts with appropriate limits

## 🎵 Audio Playback

### Browser Audio Context
- Modern browsers require user interaction before playing audio
- Tests handle auto-play restrictions gracefully
- Audio controls are provided for manual playback

### Supported Formats
- **WAV** - Uncompressed, works everywhere
- **MP3** - Compressed, smaller files
- **OGG** - Open format, good compression

## 🐛 Troubleshooting

### Import Errors
If you see module import errors:
```bash
# Rebuild the project
npm run build

# Test imports
node examples/test-browser-imports.mjs
```

### CORS Errors
If APIs fail with CORS errors:
- Check if the API supports browser requests
- Consider using a CORS proxy
- Implement server-side proxy

### Audio Issues
If audio doesn't play:
- Check browser console for errors
- Ensure user has interacted with page
- Try different audio formats
- Check browser audio permissions

## 📊 Test Results

### Expected Behavior
- **Mock Engine**: Always works, generates beep sound
- **Cloud Engines**: Require valid credentials, produce speech
- **Audio Playback**: Should work in all modern browsers
- **Error Handling**: Graceful fallbacks and clear error messages

### Performance Notes
- First synthesis may be slower (engine initialization)
- Subsequent requests should be faster
- Network latency affects cloud engines
- Local engines (WASM) have consistent performance

## 🔄 Development Workflow

1. **Make Changes** to TTS engine code
2. **Rebuild** with `npm run build`
3. **Test Server-side** with unified test runner
4. **Test Browser** with browser test files
5. **Verify** both environments work correctly

This dual-environment testing ensures your TTS wrapper works reliably across all deployment scenarios.

## 🧹 Cleanup Completed

As part of implementing browser compatibility, we've cleaned up redundant files:

### Removed Files:
- `examples/test-engines.js` & `examples/test-engines.cjs` - Replaced by unified test runner
- `examples/check-credentials.js` - Functionality integrated into unified test runner
- `examples/cli-highlight-all-engines.mjs` - Redundant with unified test runner
- `examples/test-browser-imports.mjs` - Development utility no longer needed
- `public/sherpaonnx-wasm/` - Standalone demo replaced by unified browser tests
- `sherpa-onnx/`, `wasm/`, `emsdk/` - Source directories not needed (using npm packages)
- `espeak-ng-standalone-test.mjs`, `espeakng-inspect.mjs` - Development debugging files
- `scripts/package.js` - Replaced by more comprehensive `scripts/package.cjs`
- `scripts/run-with-sherpaonnx.js` - Duplicate of `.cjs` version

### Consolidated Structure:
- **Single unified test runner** for server-side testing
- **Comprehensive browser test suite** with multiple test files
- **Clean examples directory** with focused, non-redundant files
- **Streamlined scripts directory** with no duplicates

The codebase is now much cleaner and easier to maintain! 🎉
