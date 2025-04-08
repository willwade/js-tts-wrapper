#!/bin/bash

# Helper script to run a Node.js script with the correct DYLD_LIBRARY_PATH for SherpaOnnx
#
# Usage: ./scripts/run-with-sherpaonnx.sh your-script.js [args...]

# Get the script to run
SCRIPT_TO_RUN=$1

if [ -z "$SCRIPT_TO_RUN" ]; then
  echo "Please provide a script to run"
  echo "Usage: ./scripts/run-with-sherpaonnx.sh your-script.js [args...]"
  exit 1
fi

# Determine platform-specific library paths and environment variables
LIB_PATH_ENV_VAR=""
POSSIBLE_PATHS=()
PATH_SEPARATOR=":"

case "$OSTYPE" in
  darwin*)
    # macOS uses DYLD_LIBRARY_PATH
    LIB_PATH_ENV_VAR="DYLD_LIBRARY_PATH"
    POSSIBLE_PATHS=(
      "./node_modules/sherpa-onnx-darwin-arm64"
      "./node_modules/sherpa-onnx-darwin-x64"
      "../node_modules/sherpa-onnx-darwin-arm64"
      "../node_modules/sherpa-onnx-darwin-x64"
    )
    ;;
  linux*)
    # Linux uses LD_LIBRARY_PATH
    LIB_PATH_ENV_VAR="LD_LIBRARY_PATH"
    POSSIBLE_PATHS=(
      "./node_modules/sherpa-onnx-linux-arm64"
      "./node_modules/sherpa-onnx-linux-x64"
      "../node_modules/sherpa-onnx-linux-arm64"
      "../node_modules/sherpa-onnx-linux-x64"
    )
    ;;
  msys*|cygwin*|mingw*)
    # Windows uses PATH
    LIB_PATH_ENV_VAR="PATH"
    PATH_SEPARATOR=";"
    POSSIBLE_PATHS=(
      "./node_modules/sherpa-onnx-win32-x64"
      "../node_modules/sherpa-onnx-win32-x64"
    )
    ;;
  *)
    echo "Unsupported platform: $OSTYPE"
    ;;
esac

# Find the sherpa-onnx library directory
if [ -n "$LIB_PATH_ENV_VAR" ]; then
  SHERPA_ONNX_PATH=""
  for LIB_PATH in "${POSSIBLE_PATHS[@]}"; do
    if [ -d "$LIB_PATH" ]; then
      echo "Found sherpa-onnx library at $LIB_PATH"
      SHERPA_ONNX_PATH=$LIB_PATH
      break
    fi
  done

  if [ -n "$SHERPA_ONNX_PATH" ]; then
    # Set the environment variable
    CURRENT_PATH=${!LIB_PATH_ENV_VAR:-}
    if [[ ":$CURRENT_PATH:" != *":$SHERPA_ONNX_PATH:"* ]]; then
      export $LIB_PATH_ENV_VAR="$SHERPA_ONNX_PATH${CURRENT_PATH:+$PATH_SEPARATOR$CURRENT_PATH}"
      echo "Set $LIB_PATH_ENV_VAR to ${!LIB_PATH_ENV_VAR}"
    fi
  else
    echo "Could not find sherpa-onnx library directory for $OSTYPE. SherpaOnnx TTS may not work correctly."
  fi
fi

# Run the script
shift
node "$SCRIPT_TO_RUN" "$@"
