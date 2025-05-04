# js-tts-wrapper

A JavaScript/TypeScript library that provides a unified API for working with multiple cloud-based Text-to-Speech (TTS) services. Inspired by [py3-TTS-Wrapper](https://github.com/willwade/tts-wrapper), it simplifies the use of services like Azure, Google Cloud, IBM Watson, and ElevenLabs.

## Features

- **Unified API**: Consistent interface across multiple TTS providers.
- **SSML Support**: Use Speech Synthesis Markup Language to enhance speech synthesis
- **Speech Markdown**: Optional support for easier speech markup
- **Voice Selection**: Easily browse and select from available voices
- **Streaming Synthesis**: Stream audio as it's being synthesized
- **Playback Control**: Pause, resume, and stop audio playback
- **Word Boundaries**: Get callbacks for word timing (where supported)
- **File Output**: Save synthesized speech to audio files
- **Browser Support**: Works in both Node.js (server) and browser environments (see engine support table below)

## eSpeak TTS Support (WASM)

js-tts-wrapper supports the open-source [eSpeak NG](https://github.com/espeak-ng/espeak-ng) TTS engine using a pure JavaScript + WebAssembly implementation powered by [`espeak-ng.js`](https://github.com/thenfour/espeak-ng.js/). This works in **both Node.js and browser environments**—no native dependencies or eSpeak CLI required!

*   **Platform:** Node.js and browser (cross-platform).
*   **Dependencies:** Uses `espeak-ng.js` (WASM/JS) under the hood.
*   **No Native Binaries:** No need for the eSpeak CLI or system libraries.

### Usage Example

```typescript
import { EspeakTTSClient } from 'js-tts-wrapper';

const tts = new EspeakTTSClient();
const audioBytes = await tts.synthToBytes('Hello, world!', { voice: 'en', rate: 150, pitch: 50 });
// audioBytes is a Uint8Array containing WAV audio data
```

*   Works in both Node.js and browser (when bundled with a tool like Webpack, Vite, etc.).
*   Accepts options for `voice`, `rate`, `pitch`, and more.

## SherpaOnnx Native (Offline TTS) Support

js-tts-wrapper supports the [SherpaOnnx](https://github.com/k2-fsa/sherpa-onnx) engine for fast, local/offline synthesis in Node.js via native bindings (`sherpa-onnx-node`). **This requires extra setup and is Node.js only.**

*   **Platform:** Node.js only (macOS, Linux, Windows).
*   **Dependencies:** `sherpa-onnx-node` (requires native compilation and platform-specific binaries).
*   **Features:** Fast local synthesis, no API keys required, supports multiple languages and voices.

### Installation

```bash
npm install js-tts-wrapper
```

### Optional Dependencies

The library uses a modular approach where TTS engine-specific dependencies are optional. You can install dependencies in two ways:

#### Method 1: Using Dependency Groups (npm 8.3.0+)

Install the package with specific engine dependencies using the bracket notation (similar to pip extras):

```bash
# Install with specific engine dependencies
npm install js-tts-wrapper[azure]      # Install with Azure dependencies
npm install js-tts-wrapper[google]     # Install with Google Cloud dependencies
npm install js-tts-wrapper[elevenlabs] # Install with ElevenLabs dependencies
npm install js-tts-wrapper[watson]     # Install with Watson dependencies (no extra deps needed)
npm install js-tts-wrapper[openai]     # Install with OpenAI dependencies
npm install js-tts-wrapper[playht]     # Install with PlayHT dependencies
npm install js-tts-wrapper[polly]      # Install with AWS Polly dependencies
npm install js-tts-wrapper[sherpaonnx] # Install with SherpaOnnx dependencies

# Install with multiple engine dependencies
npm install js-tts-wrapper[azure,google,openai]  # Install with multiple engines

# Install with predefined groups
npm install js-tts-wrapper[cloud]  # Install all cloud engine dependencies
npm install js-tts-wrapper[all]    # Install all dependencies
```

#### Method 2: Manual Installation

Alternatively, you can manually install the dependencies for the engines you plan to use:

```bash
# Install specific cloud engines:
npm install @azure/cognitiveservices-speechservices microsoft-cognitiveservices-speech-sdk  # For Azure
npm install @google-cloud/text-to-speech  # For Google Cloud
npm install node-fetch@2  # For ElevenLabs and PlayHT in Node.js
npm install @aws-sdk/client-polly  # For AWS Polly
npm install openai  # For OpenAI

# For IBM Watson, no additional dependencies needed (uses fetch API)

# Install local/offline engines:
npm install sherpa-onnx-node decompress decompress-bzip2 decompress-tarbz2 decompress-targz tar-stream  # For SherpaOnnx (requires native compilation)
# Note: eSpeak (WASM) has no extra dependencies.
```

#### Engine-Specific Requirements

| Engine | Required Dependencies |
| ------ | --------------------- |
| Azure | `@azure/cognitiveservices-speechservices`, `microsoft-cognitiveservices-speech-sdk` |
| Google Cloud | `@google-cloud/text-to-speech` |
| ElevenLabs | `node-fetch@2` (Node.js only) |
| IBM Watson | None (uses fetch API) |
| OpenAI | `openai` |
| PlayHT | `node-fetch@2` (Node.js only) |
| AWS Polly | `@aws-sdk/client-polly` |
| SherpaOnnx | `sherpa-onnx-node`, `decompress`, `decompress-bzip2`, `decompress-tarbz2`, `decompress-targz`, `tar-stream` |
| eSpeak NG | None (WASM included) |
| WitAI | None (uses fetch API) |

## Quick Start

```typescript
import { AzureTTSClient } from 'js-tts-wrapper';

// Initialize the client with your credentials
const tts = new AzureTTSClient({
  subscriptionKey: 'your-subscription-key',
  region: 'westeurope'
});

// List available voices
const voices = await tts.getVoices();
console.log(voices);

// Set a voice
tts.setVoice('en-US-AriaNeural');

// Speak some text
await tts.speak('Hello, world!');

// Use SSML for more control
const ssml = '<speak>Hello <break time="500ms"/> world!</speak>';
await tts.speak(ssml);
```

### Browser

```html
<!-- Using ES modules (recommended) -->
<script type="module">
  import { SherpaOnnxWasmTTSClient } from 'js-tts-wrapper/browser';

  // Create a new SherpaOnnx WebAssembly TTS client
  const ttsClient = new SherpaOnnxWasmTTSClient();

  // Initialize the WebAssembly module
  await ttsClient.initializeWasm('./sherpaonnx-wasm/sherpaonnx.js');

  // Get available voices
  const voices = await ttsClient.getVoices();
  console.log(`Found ${voices.length} voices`);

  // Set the voice
  await ttsClient.setVoice(voices[0].id);

  // Speak some text
  await ttsClient.speak('Hello, world!');
</script>
```

```html
<!-- Using UMD bundle -->
<script src="js-tts-wrapper.browser.umd.min.js"></script>
<script>
  const ttsClient = new JSTTSWrapper.SherpaOnnxWasmTTSClient();

  // Initialize the WebAssembly module
  ttsClient.initializeWasm('./sherpaonnx-wasm/sherpaonnx.js')
    .then(() => ttsClient.getVoices())
    .then(voices => {
      console.log(`Found ${voices.length} voices`);
      return ttsClient.setVoice(voices[0].id);
    })
    .then(() => ttsClient.speak('Hello, world!'))
    .catch(error => console.error('Error:', error));
</script>
```

See the [browser example](examples/browser-example.html) for a complete example of using the library in a browser environment.

## Supported Providers

| Provider          | SSML | Streaming | Word Timing | File Output | Browser | Notes & Known Issues                                         | Version/Type          |
| :---------------- | :--: | :-------: | :---------: | :---------: | :-----: | :----------------------------------------------------------- | :-------------------- |
| Azure             |  ✅  |     ✅    |      ✅     |      ✅     |    ❔   | Requires `microsoft-cognitiveservices-speech-sdk`            | Cloud API             |
| ElevenLabs        |  ✅  |     ✅    |      ✅     |      ✅     |    ✅   | Requires API key. Uses `fetch`.                            | Cloud API             |
| Google Cloud      |  ✅  |     ❌    |      ✅     |      ✅     |    ❔   | Requires `@google-cloud/text-to-speech`                    | Cloud API             |
| IBM Watson        |  ✅  |     ✅    |      ✅     |      ✅     |    ✅   | Requires API key, region, and instance ID. Uses `fetch`.   | Cloud API             |
| OpenAI            |  ❌  |     ✅    |      ✅     |      ✅     |    ✅   | Requires `openai` package. Uses `fetch`.                   | Cloud API             |
| PlayHT            |  ✅  |     ✅    |      ✅     |      ✅     |    ✅   | Requires API key. Uses `fetch`.                            | Cloud API             |
| Polly (AWS)       |  ✅  |     ✅    |      ✅     |      ✅     |    ❔   | Requires `@aws-sdk/client-polly`.                          | Cloud API             |
| eSpeak NG         |  ❌  |     ❌    |      ❌     |      ✅     |    ✅   | WASM based (`espeak-ng.js`), cross-platform.               | Local (WASM)          |
| SherpaOnnx        |  ❌  |     ✅    |      ❌     |      ✅     |    ❌   | Node.js only. Requires `sherpa-onnx-node` & Env Var setup. | Local (Native)        |

**Notes:**
- **Browser Support:** ✅ = Generally works, ❔ = May work with polyfills/bundlers, ❌ = Not supported.

## Examples

### Simple Synthesis (Azure)

```typescript
import { AzureTTSClient } from 'js-tts-wrapper';
import { writeFile } from 'fs/promises';

// Initialize the client with your credentials
const tts = new AzureTTSClient({
  subscriptionKey: 'your-subscription-key',
  region: 'westeurope'
});

// List available voices
const voices = await tts.getVoices();
console.log(voices);

// Set a voice
tts.setVoice('en-US-AriaNeural');

// Speak some text
await tts.speak('Hello, world!', { voice: 'en-US-JennyNeural' });
```

### SherpaOnnx Native Example (Node.js - requires Env Var setup)

```typescript
import { SherpaOnnxTTSClient } from 'js-tts-wrapper';

// Initialize the client
const tts = new SherpaOnnxTTSClient();

// The client will automatically download models when needed
// You can also specify a custom models directory
const tts = new SherpaOnnxTTSClient({
  modelsDir: '/path/to/models'
});

// List available voices
const voices = await tts.getVoices();
console.log(voices);

// Set a voice
await tts.setVoice('icefall-fs-ljspeech-medium');

// Speak some text
await tts.speak('Hello, world!');
```

Note: SherpaOnnx requires the `sherpa-onnx-node` package, which is a native module that requires compilation.

On native platforms (macOS, Linux, Windows), you need to set environment variables. You can do this in several ways:

1. Use the provided helper scripts which handle all platforms:

```bash
# Using the Node.js script
node scripts/run-with-sherpaonnx.js your-script.js

# Or using the shell script (Unix/macOS only)
./scripts/run-with-sherpaonnx.sh your-script.js
```

2. Set it manually before running your script:

```bash
# macOS
export DYLD_LIBRARY_PATH=/path/to/your/project/node_modules/sherpa-onnx-darwin-arm64:$DYLD_LIBRARY_PATH

# Linux
export LD_LIBRARY_PATH=/path/to/your/project/node_modules/sherpa-onnx-linux-x64:$LD_LIBRARY_PATH

# Windows (Command Prompt)
set PATH=C:\path\to\your\project\node_modules\sherpa-onnx-win32-x64;%PATH%
```

If you encounter issues installing or using sherpa-onnx-node, the wrapper will fall back to a mock implementation for testing purposes.

## Core API

```typescript
// Main methods
speak(text: string | SSML, options?: SpeakOptions): Promise<void>
speakStreamed(text: string | SSML, options?: SpeakOptions): Promise<void>
synthToBytes(text: string | SSML, options?: SpeakOptions): Promise<Uint8Array>
synthToBytestream(text: string | SSML, options?: SpeakOptions): Promise<ReadableStream<Uint8Array>>
getVoices(): Promise<UnifiedVoice[]>
setVoice(voiceId: string): void

// Playback control
pause(): void
resume(): void
stop(): void

// Events
on(event: 'start' | 'end' | 'boundary', callback: Function): void
```

## SSML and Speech Markdown

The library provides utilities for working with SSML and Speech Markdown:

```typescript
import { SSMLBuilder, SpeechMarkdownConverter } from 'js-tts-wrapper';

// Using the SSML builder
const builder = new SSMLBuilder();
const ssml = builder
  .add('Hello world')
  .addBreak('500ms')
  .addProsody('This is important', 'medium', 'high', '90')
  .toString();

// Using Speech Markdown
const markdown = 'Hello [500ms] (pitch:high world)';
const ssml = SpeechMarkdownConverter.toSSML(markdown);
```

## Advanced Usage

### Offline TTS with SherpaOnnx

The library includes support for SherpaOnnx, an offline TTS engine that doesn't require internet access:

```typescript
import { SherpaOnnxTTSClient } from 'js-tts-wrapper';

// Initialize the client
const tts = new SherpaOnnxTTSClient();

// The client will automatically download models when needed
// You can also specify a custom models directory
const tts = new SherpaOnnxTTSClient({
  modelsDir: '/path/to/models'
});

// List available voices
const voices = await tts.getVoices();
console.log(voices);

// Set a voice
await tts.setVoice('icefall-fs-ljspeech-medium');

// Speak some text
await tts.speak('Hello, world!');
```

Note: SherpaOnnx requires the `sherpa-onnx-node` package, which is a native module that requires compilation.

On native platforms (macOS, Linux, Windows), you need to set environment variables. You can do this in several ways:

1. Use the provided helper scripts which handle all platforms:

```bash
# Using the Node.js script
node scripts/run-with-sherpaonnx.js your-script.js

# Or using the shell script (Unix/macOS only)
./scripts/run-with-sherpaonnx.sh your-script.js
```

2. Set it manually before running your script:

```bash
# macOS
export DYLD_LIBRARY_PATH=/path/to/your/project/node_modules/sherpa-onnx-darwin-arm64:$DYLD_LIBRARY_PATH

# Linux
export LD_LIBRARY_PATH=/path/to/your/project/node_modules/sherpa-onnx-linux-x64:$LD_LIBRARY_PATH

# Windows (Command Prompt)
set PATH=C:\path\to\your\project\node_modules\sherpa-onnx-win32-x64;%PATH%
```

If you encounter issues installing or using sherpa-onnx-node, the wrapper will fall back to a mock implementation for testing purposes.

### OpenAI TTS

The library includes support for OpenAI's text-to-speech API:

```typescript
import { OpenAITTSClient } from 'js-tts-wrapper';

// Initialize the client
const tts = new OpenAITTSClient({
  apiKey: 'your-openai-api-key', // Optional, defaults to OPENAI_API_KEY environment variable
});

// List available voices
const voices = await tts.getVoices();
console.log(voices);

// Set a voice
tts.setVoice('alloy');

// Set the model (defaults to gpt-4o-mini-tts)
tts.setModel('gpt-4o-mini-tts');

// Set instructions for the TTS engine
tts.setInstructions('Speak in a friendly and clear tone.');

// Set the response format (mp3, opus, aac, flac, wav, pcm)
tts.setResponseFormat('mp3');

// Speak some text
await tts.speak('Hello, world!');

// Stream some text
await tts.speakStreamed('This is streaming audio from OpenAI.');
```

Note: OpenAI TTS does not support SSML, and word boundaries are estimated since OpenAI doesn't provide word timing information.

### PlayHT TTS

The library includes support for PlayHT's text-to-speech API:

```typescript
import { PlayHTTTSClient } from 'js-tts-wrapper';

// Initialize the client
const tts = new PlayHTTTSClient({
  apiKey: 'your-playht-api-key', // Optional, defaults to PLAYHT_API_KEY environment variable
  userId: 'your-playht-user-id', // Optional, defaults to PLAYHT_USER_ID environment variable
});

// List available voices
const voices = await tts.getVoices();
console.log(voices);

// Set a voice
tts.setVoice('s3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/female-cs/manifest.json');

// Set the voice engine (PlayHT1.0, PlayHT2.0, or null)
tts.setVoiceEngine('PlayHT1.0');

// Set the output format (wav, mp3)
tts.setOutputFormat('wav');

// Speak some text
await tts.speak('Hello, world!');

// Stream some text
await tts.speakStreamed('This is streaming audio from PlayHT.');
```

Note: PlayHT TTS does not support SSML, and word boundaries are estimated since PlayHT doesn't provide word timing information.

### Language Normalization

The library provides a unified language normalization system that works across all TTS engines:

```typescript
import { AzureTTSClient, LanguageNormalizer } from 'js-tts-wrapper';

// Normalize a language code
const normalized = LanguageNormalizer.normalize('en-US');
console.log(normalized);
// { bcp47: 'en-US', iso639_3: 'eng', display: 'English (United States)' }

// Get voices by language (works with both BCP-47 and ISO 639-3 codes)
const tts = new AzureTTSClient({ /* credentials */ });
const enVoices = await tts.getVoicesByLanguage('en-US'); // BCP-47
const engVoices = await tts.getVoicesByLanguage('eng');  // ISO 639-3
```

For more details, see [Language Normalization](./docs/LANGUAGE_NORMALIZATION.md).

### Word Boundary Callbacks

```typescript
import { AzureTTSClient } from 'js-tts-wrapper';

const tts = new AzureTTSClient({
  subscriptionKey: 'your-subscription-key',
  region: 'westeurope'
});

// Set up callbacks
function onWordBoundary(word, startTime, endTime) {
  console.log(`Word: ${word}, Duration: ${endTime - startTime}ms`);
}

function onStart() {
  console.log('Speech started');
}

function onEnd() {
  console.log('Speech ended');
}

// Connect callbacks
tts.connect('onStart', onStart);
tts.connect('onEnd', onEnd);

// Start playback with word boundary callbacks
await tts.startPlaybackWithCallbacks('Hello world', onWordBoundary);
```

### Saving to File

```typescript
import { AzureTTSClient } from 'js-tts-wrapper';
import { writeFile } from 'fs/promises';

const tts = new AzureTTSClient({
  subscriptionKey: 'your-subscription-key',
  region: 'westeurope'
});

// Synthesize to bytes and save to file
const audioBytes = await tts.synthToBytes('Hello world', { format: 'mp3' });
await writeFile('output.mp3', Buffer.from(audioBytes));
```

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./docs/CONTRIBUTING.md) for guidelines.

### Testing

The library includes a comprehensive test suite. For details on running tests, see [TESTING.md](./docs/TESTING.md).

```bash
# Run all tests
npm test

# Run TTS engine tests
npm run test:tts

# Run tests for specific engines
npm run test:azure
npm run test:elevenlabs
npm run test:google
npm run test:polly
npm run test:sherpaonnx
```

### Examples

Examples are available in the `examples` directory:

```bash
# Run the unified example
npm run example

# Run examples for specific engines
npm run example:azure
npm run example:elevenlabs
npm run example:google
npm run example:polly
npm run example:sherpaonnx
```

## Compatibility

This library is designed to be compatible with modern JavaScript frameworks and environments:

- **Node.js**: Compatible with Node.js 18.x and 20.x
- **React**: Compatible with React 18 and React 19
- **Next.js**: Compatible with Next.js 13 and 14
- **TypeScript**: Full TypeScript support with type definitions

The library uses a modular dependency approach that allows you to install only what you need, reducing bundle size and avoiding unnecessary dependencies.

## SherpaOnnx WebAssembly TTS

SherpaOnnx WebAssembly TTS is a browser-compatible version of SherpaOnnx TTS. It uses WebAssembly to run the TTS engine directly in the browser, without requiring native modules or environment variables.

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
const text = 'This is a test of SherpaOnnx WebAssembly Text to Speech synthesis.';
const audioBytes = await tts.synthToBytes(text, { format: 'wav' });

// Play the audio in a browser
const audioBlob = new Blob([audioBytes], { type: 'audio/wav' });
const audioUrl = URL.createObjectURL(audioBlob);
const audio = new Audio(audioUrl);
audio.play();
