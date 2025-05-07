# SherpaOnnx TTS Engine

The SherpaOnnx TTS engine provides offline text-to-speech capabilities using the [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) library. This document explains how to set up and use the SherpaOnnx TTS engine.

> **IMPORTANT**: SherpaOnnx TTS is **server-side only** and will not work in browser environments. For browser-compatible TTS, use SherpaOnnx-WASM instead.

## Installation

To use the SherpaOnnx TTS engine, you need to install the required dependencies:

```bash
npm install sherpa-onnx-node decompress decompress-bzip2 decompress-tarbz2 decompress-targz tar-stream
```

Or if you're developing the js-tts-wrapper itself:

```bash
npm run install:sherpaonnx
```

## Running with SherpaOnnx

Due to the nature of native modules, you need to set environment variables to help Node.js find the native libraries. The most reliable approach is to set the environment variable directly:

### 1. Find the sherpa-onnx library path

First, you need to find the path to the sherpa-onnx library for your platform. If you've installed js-tts-wrapper, you can use the included script:

```bash
# If you've installed js-tts-wrapper globally
npx js-tts-wrapper sherpaonnx:find-path

# If you're developing js-tts-wrapper
npm run sherpaonnx:find-path
```

This script will:
1. Find the sherpa-onnx library for your platform
2. Show you the exact command to run your script with the correct environment variable
3. Show you how to add it to your shell profile for permanent use

If you're using the library in your own project, you can copy the `find-sherpaonnx-path.js` script from the js-tts-wrapper repository and run it directly:

```bash
node find-sherpaonnx-path.js
```

### 2. Set the environment variable and run your script

Once you have the path, set the appropriate environment variable for your platform:

```bash
# macOS
DYLD_LIBRARY_PATH=/path/to/node_modules/sherpa-onnx-darwin-arm64 node your-script.js

# Linux
LD_LIBRARY_PATH=/path/to/node_modules/sherpa-onnx-linux-x64 node your-script.js

# Windows (PowerShell)
$env:PATH = "C:\path\to\node_modules\sherpa-onnx-win-x64;$env:PATH"
node your-script.js
```

## Persistent Environment Setup

If you want to set the environment variables persistently, you can add them to your shell profile:

### macOS

Add to your `~/.zshrc` or `~/.bash_profile`:

```bash
export DYLD_LIBRARY_PATH=/path/to/node_modules/sherpa-onnx-darwin-arm64:$DYLD_LIBRARY_PATH
```

### Linux

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
export LD_LIBRARY_PATH=/path/to/node_modules/sherpa-onnx-linux-x64:$LD_LIBRARY_PATH
```

### Windows

Add to your system environment variables or in PowerShell profile:

```powershell
$env:PATH = "C:\path\to\node_modules\sherpa-onnx-win-x64;$env:PATH"
```

## Troubleshooting

If you hear only a beep sound or very quiet noise in the generated audio, it means the SherpaOnnx TTS engine is using the mock implementation. This happens when:

1. The sherpa-onnx-node module is not installed
2. The environment variables are not set correctly
3. The model files are not downloaded or accessible

### Common Issues and Solutions

1. **Environment Variables Not Set**
   - Make sure you've set the correct environment variable for your platform as described above
   - Verify the path to the sherpa-onnx library is correct
   - For more detailed troubleshooting, see the [sherpaonnx-troubleshooting.md](./sherpaonnx-troubleshooting.md) file

2. **Missing Dependencies**
   - Install all required dependencies: `npm install sherpa-onnx-node decompress decompress-bzip2 decompress-tarbz2 decompress-targz tar-stream`

3. **Model Download Issues**
   - Check the console for download errors
   - Ensure your internet connection is working
   - Try manually downloading the model files to the correct location

4. **Platform-Specific Issues**
   - macOS: Make sure you're using the correct architecture (arm64 for M1/M2 Macs, x64 for Intel Macs)
   - Linux: Some distributions may require additional libraries
   - Windows: Ensure you have the Visual C++ Redistributable installed

## Example Usage

Here's a complete example showing how to use the SherpaOnnx TTS engine:

```javascript
// sherpaonnx-example.js
const { SherpaOnnxTTSClient } = require('js-tts-wrapper');
const path = require('path');
const fs = require('fs');

// Find the sherpa-onnx library path
function findSherpaOnnxLibraryPath() {
  let possiblePaths = [];
  if (process.platform === 'darwin') {
    possiblePaths = [
      path.join(process.cwd(), 'node_modules', 'sherpa-onnx-darwin-arm64'),
      path.join(process.cwd(), 'node_modules', 'sherpa-onnx-darwin-x64')
    ];
  } else if (process.platform === 'linux') {
    possiblePaths = [
      path.join(process.cwd(), 'node_modules', 'sherpa-onnx-linux-arm64'),
      path.join(process.cwd(), 'node_modules', 'sherpa-onnx-linux-x64')
    ];
  } else if (process.platform === 'win32') {
    possiblePaths = [
      path.join(process.cwd(), 'node_modules', 'sherpa-onnx-win-x64')
    ];
  }

  for (const libPath of possiblePaths) {
    if (fs.existsSync(libPath)) {
      return libPath;
    }
  }
  return null;
}

async function main() {
  // Log the library path for debugging
  const libraryPath = findSherpaOnnxLibraryPath();
  console.log(`Using sherpa-onnx library at: ${libraryPath}`);

  // Create a SherpaOnnx TTS client
  const tts = new SherpaOnnxTTSClient({
    // Enable automatic model download
    noDefaultDownload: false,

    // Specify a model ID (default is "mms_eng")
    modelId: "mms_eng"
  });

  // Check if credentials are valid
  const credentialsValid = await tts.checkCredentials();
  console.log(`Credentials valid: ${credentialsValid}`);

  // Get available voices
  const voices = await tts.getVoices();
  console.log(`Found ${voices.length} voices`);

  // Set voice
  await tts.setVoice("mms_eng");

  // Synthesize text to a file
  const text = 'This is a test of SherpaOnnx Text to Speech synthesis.';
  await tts.synthToFile(text, "output.wav", "wav");
  console.log("Generated output.wav");

  // Synthesize text and play it (if in Node.js environment)
  if (typeof window === 'undefined') {
    console.log("Playing audio...");
    await tts.speak(text);
    console.log("Playback complete");
  }
}

main().catch(error => {
  console.error("Error:", error);
});
```

To run this example, use the following command:

```bash
# macOS
DYLD_LIBRARY_PATH=/path/to/node_modules/sherpa-onnx-darwin-arm64 node sherpaonnx-example.js

# Linux
LD_LIBRARY_PATH=/path/to/node_modules/sherpa-onnx-linux-x64 node sherpaonnx-example.js

# Windows (PowerShell)
$env:PATH = "C:\path\to\node_modules\sherpa-onnx-win-x64;$env:PATH"
node sherpaonnx-example.js
```

Replace `/path/to/node_modules/sherpa-onnx-darwin-arm64` with the actual path found using the `find-sherpaonnx-path.js` script mentioned earlier.
