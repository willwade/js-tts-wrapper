# SherpaOnnx WebAssembly TTS Engine

The SherpaOnnx WebAssembly TTS engine provides text-to-speech capabilities in browser environments using WebAssembly. This is particularly useful for applications that need to run entirely in the browser without server-side processing.

## Overview

Unlike the native SherpaOnnx TTS engine, which requires native modules and environment variables, the WebAssembly version can run directly in the browser. This makes it ideal for web applications that need offline TTS capabilities.

## Building the WebAssembly Version

To use the SherpaOnnx WebAssembly TTS engine, you first need to build the WebAssembly module. This requires [Emscripten](https://emscripten.org/), a toolchain for compiling C/C++ to WebAssembly.

### Prerequisites

1. Install Emscripten by following the [official instructions](https://emscripten.org/docs/getting_started/downloads.html)
2. Make sure `emcc` is in your PATH

### Building with the Script

We provide a build script that automates the process of building the WebAssembly module with a Piper English voice:

```bash
# Make the script executable
chmod +x scripts/build-sherpaonnx-wasm.sh

# Run the script
./scripts/build-sherpaonnx-wasm.sh
```

This script will:
1. Clone the sherpa-onnx repository
2. Download the Piper English voice model
3. Build the WebAssembly module
4. Copy the built files to the `public/sherpaonnx-wasm/` directory

### GitHub Actions Workflow

Alternatively, you can use the provided GitHub Actions workflow to build the WebAssembly module:

1. Go to the "Actions" tab in your GitHub repository
2. Select the "Build SherpaOnnx WebAssembly" workflow
3. Click "Run workflow"
4. Download the artifacts when the workflow completes

## Using the WebAssembly Version

### In a Browser Environment

To use the SherpaOnnx WebAssembly TTS engine in a browser environment, you need to:

1. Include the WebAssembly module in your web application
2. Initialize the module
3. Use the TTS API to generate speech

Here's a basic example:

```html
<!DOCTYPE html>
<html>
<head>
    <title>SherpaOnnx WebAssembly TTS Example</title>
</head>
<body>
    <button id="speakButton">Speak</button>
    <script type="module">
        // Import the WebAssembly module
        import Module from './sherpaonnx-wasm/tts.js';
        
        // Initialize the module
        const ttsModule = await Module();
        
        // Create the TTS configuration
        const config = {
            model: "model.onnx",
            tokens: "tokens.txt"
        };
        
        // Create the TTS instance
        const tts = ttsModule.ttsCreateOffline(JSON.stringify(config));
        
        // Generate speech when the button is clicked
        document.getElementById('speakButton').addEventListener('click', () => {
            // Generate the audio
            const text = "Hello, world!";
            ttsModule.ttsGenerateWithOffline(tts, text);
            
            // Get the audio samples
            const numSamples = ttsModule.ttsNumSamplesWithOffline(tts);
            const sampleRate = ttsModule.ttsSampleRateWithOffline(tts);
            
            const samplesPtr = ttsModule._malloc(numSamples * 4);
            ttsModule.ttsGetSamplesWithOffline(tts, samplesPtr);
            
            // Create a Float32Array view of the samples
            const samples = new Float32Array(ttsModule.HEAPF32.buffer, samplesPtr, numSamples);
            
            // Play the audio
            const audioContext = new AudioContext();
            const buffer = audioContext.createBuffer(1, samples.length, sampleRate);
            buffer.getChannelData(0).set(samples);
            
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContext.destination);
            source.start();
            
            // Free the memory
            ttsModule._free(samplesPtr);
        });
        
        // Clean up when the page is unloaded
        window.addEventListener('unload', () => {
            ttsModule.ttsDestroyOffline(tts);
        });
    </script>
</body>
</html>
```

### Using the js-tts-wrapper

The js-tts-wrapper library provides a unified API for working with multiple TTS engines, including SherpaOnnx WebAssembly:

```javascript
import { SherpaOnnxWasmTTSClient } from 'js-tts-wrapper';

// Create a SherpaOnnx WebAssembly TTS client
const tts = new SherpaOnnxWasmTTSClient({
    wasmPath: './sherpaonnx-wasm/tts.js'
});

// Initialize the WebAssembly module
await tts.initializeWasm('./sherpaonnx-wasm/tts.js');

// Get available voices
const voices = await tts.getVoices();
console.log(`Found ${voices.length} voices`);

// Set a voice
await tts.setVoice('piper_en_US');

// Synthesize speech
const text = "Hello, world!";
const audioBytes = await tts.synthToBytes(text, { format: 'wav' });

// Play the audio
const audioBlob = new Blob([audioBytes], { type: 'audio/wav' });
const audioUrl = URL.createObjectURL(audioBlob);
const audio = new Audio(audioUrl);
audio.play();
```

## Customizing Voices

The build script uses the Piper English voice by default, but you can modify it to use other voices. The SherpaOnnx project provides several pre-trained models that you can use:

- [Piper English (US) - Amy](https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-amy-medium.tar.bz2)
- [Piper English (UK) - Southern British English](https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_GB-southern_english_female-medium.tar.bz2)
- [Piper German - Thorsten](https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-de_DE-thorsten_emotional-medium.tar.bz2)
- [Piper Spanish - Mls](https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-es_ES-mls_10246-medium.tar.bz2)

To use a different voice, modify the `build-sherpaonnx-wasm.sh` script to download and use the desired model.

## Limitations

The WebAssembly version has some limitations compared to the native version:

1. **Performance**: WebAssembly is generally slower than native code, so speech synthesis may take longer.
2. **File Size**: The WebAssembly module and model files can be quite large, which may impact load times.
3. **Browser Compatibility**: WebAssembly is supported in all modern browsers, but older browsers may not support it.
4. **Memory Usage**: WebAssembly has limited memory, so very long texts may cause issues.

## Troubleshooting

### Common Issues

1. **Module Not Loading**: Make sure the WebAssembly module and model files are in the correct location and accessible to the browser.
2. **Memory Errors**: If you encounter memory errors, try synthesizing shorter texts or increasing the memory limit in the WebAssembly module.
3. **Audio Not Playing**: Some browsers require user interaction before playing audio. Make sure your code runs in response to a user action like a button click.

### Debugging

To debug WebAssembly issues, check the browser console for error messages. You can also enable verbose logging in the SherpaOnnx WebAssembly module by setting the `SHERPA_ONNX_VERBOSE` environment variable:

```javascript
// Enable verbose logging
Module.ENV.SHERPA_ONNX_VERBOSE = "1";
```

## Resources

- [SherpaOnnx GitHub Repository](https://github.com/k2-fsa/sherpa-onnx)
- [SherpaOnnx WebAssembly Documentation](https://k2-fsa.github.io/sherpa/onnx/tts/wasm/index.html)
- [Emscripten Documentation](https://emscripten.org/docs/index.html)
- [WebAssembly Documentation](https://webassembly.org/)
