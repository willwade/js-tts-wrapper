#!/bin/bash

# Build script for SherpaOnnx WebAssembly with Piper English voice
# This script builds the WebAssembly version of SherpaOnnx with a Piper English voice

set -e

# Check if emscripten is installed
if ! command -v emcc &> /dev/null; then
    echo "Error: emscripten is not installed or not in PATH"
ho "Please install emscripten first: https://emscripten.org/docs/getting_started/downloads.html"
    exit 1
fi

# Create build directory
BUILD_DIR="build-wasm"
mkdir -p $BUILD_DIR

# Clone sherpa-onnx repository if it doesn't exist
if [ ! -d "sherpa-onnx" ]; then
    echo "Cloning sherpa-onnx repository..."
    git clone https://github.com/k2-fsa/sherpa-onnx.git
    cd sherpa-onnx
else
    echo "Using existing sherpa-onnx repository..."
    cd sherpa-onnx
    git pull
fi

# Create assets directory
mkdir -p wasm/tts/assets

# Download Piper English voice model
echo "Downloading Piper English voice model..."
cd wasm/tts/assets
wget -q https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-amy-medium.tar.bz2
tar xf vits-piper-en_US-amy-medium.tar.bz2
rm vits-piper-en_US-amy-medium.tar.bz2

# Move files to the correct location
mv -v vits-piper-en_US-amy-medium/en_US-amy-medium.onnx ./model.onnx
mv -v vits-piper-en_US-amy-medium/tokens.txt ./
mv -v vits-piper-en_US-amy-medium/espeak-ng-data ./

# Remove the extracted directory
rm -rf vits-piper-en_US-amy-medium

# Go back to the sherpa-onnx root directory
cd ../../..

# Build sherpa-onnx for WebAssembly
echo "Building sherpa-onnx for WebAssembly..."
./build-wasm-simd-tts.sh

# Get the version
SHERPA_ONNX_VERSION=$(grep "SHERPA_ONNX_VERSION" ./CMakeLists.txt | cut -d " " -f 2 | cut -d '"' -f 2)
echo "SherpaOnnx version: $SHERPA_ONNX_VERSION"

# Create output directory
OUTPUT_DIR="sherpa-onnx-wasm-simd-v${SHERPA_ONNX_VERSION}-en-tts"
mkdir -p $OUTPUT_DIR

# Copy the built files
cp -v build-wasm-simd-tts/install/bin/wasm/tts/* $OUTPUT_DIR/

# Create a tarball
tar cjfv $OUTPUT_DIR.tar.bz2 ./$OUTPUT_DIR

# Go back to the original directory
cd ..

# Copy the built files to the js-tts-wrapper directory
echo "Copying built files to js-tts-wrapper..."
mkdir -p public/sherpaonnx-wasm
cp -v sherpa-onnx/$OUTPUT_DIR/* public/sherpaonnx-wasm/

echo "Build complete!"
echo "WebAssembly files are available in public/sherpaonnx-wasm/"
echo "Tarball is available at sherpa-onnx/$OUTPUT_DIR.tar.bz2"
