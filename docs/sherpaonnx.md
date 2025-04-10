# SherpaOnnx TTS Engine

The SherpaOnnx TTS engine provides offline text-to-speech capabilities using the [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) library. This document explains how to set up and use the SherpaOnnx TTS engine.

## Installation

To use the SherpaOnnx TTS engine, you need to install the required dependencies:

```bash
npm run install:sherpaonnx
```

This will install the following packages:
- sherpa-onnx-node
- decompress
- decompress-bzip2
- decompress-tarbz2
- decompress-targz
- tar-stream

## Running with SherpaOnnx

Due to the nature of native modules, you need to set environment variables to help Node.js find the native libraries. The easiest way to do this is to use the provided helper script:

```bash
node scripts/run-with-sherpaonnx.js your-script.js
```

This script will:
1. Find the sherpa-onnx native library for your platform
2. Set the appropriate environment variable (DYLD_LIBRARY_PATH, LD_LIBRARY_PATH, or PATH)
3. Run your script with the correct environment

## Manual Environment Setup

If you prefer to set up the environment manually, you need to set the appropriate environment variable for your platform:

### macOS

```bash
export DYLD_LIBRARY_PATH=/path/to/your/project/node_modules/sherpa-onnx-darwin-arm64:$DYLD_LIBRARY_PATH
```

### Linux

```bash
export LD_LIBRARY_PATH=/path/to/your/project/node_modules/sherpa-onnx-linux-x64:$LD_LIBRARY_PATH
```

### Windows

```bash
set PATH=C:\path\to\your\project\node_modules\sherpa-onnx-win32-x64;%PATH%
```

## Troubleshooting

If you hear only a beep sound or very quiet noise in the generated audio, it means the SherpaOnnx TTS engine is using the mock implementation. This happens when:

1. The sherpa-onnx-node module is not installed
2. The environment variables are not set correctly
3. The model files are not downloaded or accessible

### Common Issues and Solutions

1. **Environment Variables Not Set**
   - Use the helper script: `node scripts/run-with-sherpaonnx.js your-script.js`
   - Or set the environment variables manually as described above

2. **Missing Dependencies**
   - Install all required dependencies: `npm run install:sherpaonnx`

3. **Model Download Issues**
   - Check the console for download errors
   - Ensure your internet connection is working
   - Try manually downloading the model files to the correct location

4. **Platform-Specific Issues**
   - macOS: Make sure you're using the correct architecture (arm64 for M1/M2 Macs, x64 for Intel Macs)
   - Linux: Some distributions may require additional libraries
   - Windows: Ensure you have the Visual C++ Redistributable installed

## Example Usage

```javascript
const { SherpaOnnxTTSClient } = require('js-tts-wrapper');

async function testSherpaOnnx() {
  // Create a SherpaOnnx TTS client
  const tts = new SherpaOnnxTTSClient({});
  
  // Check if credentials are valid
  const valid = await tts.checkCredentials();
  console.log('Credentials valid:', valid);
  
  // Get available voices
  const voices = await tts.getVoices();
  console.log(`Found ${voices.length} voices`);
  
  // Set a voice
  const voice = voices.find(v => v.id === 'mms_eng') || voices[0];
  await tts.setVoice(voice.id);
  
  // Generate audio
  const text = 'This is a test of SherpaOnnx Text to Speech synthesis.';
  const audioBytes = await tts.synthToBytes(text, { format: 'mp3' });
  
  // Save to file
  const fs = require('fs');
  fs.writeFileSync('output.mp3', Buffer.from(audioBytes));
}

testSherpaOnnx();
```

Remember to run this script with the helper:

```bash
node scripts/run-with-sherpaonnx.js your-script.js
```
