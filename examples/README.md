# js-tts-wrapper Browser Examples

This directory contains examples of using the js-tts-wrapper library in a browser environment.

## SherpaOnnx WebAssembly Examples

These examples demonstrate how to use the SherpaOnnx WebAssembly TTS engine in a browser environment.

### Prerequisites

Before running the examples, you need to build the SherpaOnnx WebAssembly module:

1. Make sure you have Emscripten installed: https://emscripten.org/docs/getting_started/downloads.html
2. Run the build script:
   ```bash
   ./scripts/build-sherpaonnx-wasm.sh
   ```
   This will build the WebAssembly module and place it in the `public/sherpaonnx-wasm` directory.

### Running the Examples

1. Start the example server:
   ```bash
   cd examples
   node serve.js
   ```

2. Open one of the following URLs in your browser:
   - http://localhost:3000/sherpaonnx-wasm-demo.html - Full-featured demo
   - http://localhost:3000/sherpaonnx-wasm-simple.html - Simple example

## Examples

### 1. SherpaOnnx WebAssembly Demo (sherpaonnx-wasm-demo.html)

A full-featured demo of the SherpaOnnx WebAssembly TTS engine with the following features:
- Voice selection
- Text input
- Rate, pitch, and volume controls
- Speak, stop, and download buttons
- Status and log display

### 2. SherpaOnnx WebAssembly Simple (sherpaonnx-wasm-simple.html)

A simple example of the SherpaOnnx WebAssembly TTS engine with the following features:
- Text input
- Speak and stop buttons
- Log display

## How It Works

The examples use the browser-compatible version of the js-tts-wrapper library, which is built using Rollup and TypeScript. The library provides a unified API for working with multiple TTS engines, including the SherpaOnnx WebAssembly engine.

The SherpaOnnx WebAssembly engine runs entirely in the browser, without sending any data to external servers. It uses the WebAssembly version of the SherpaOnnx library, which is built using Emscripten.

## Troubleshooting

If you encounter issues with the examples, check the following:

1. Make sure you have built the SherpaOnnx WebAssembly module using the build script.
2. Check the browser console for errors.
3. Make sure the path to the WebAssembly module is correct in the examples.
4. If you're using a different voice model, make sure it's compatible with the SherpaOnnx WebAssembly engine.
