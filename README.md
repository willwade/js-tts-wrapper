# js-tts-wrapper

A JavaScript/TypeScript library that provides a unified API for working with multiple cloud-based Text-to-Speech (TTS) services. Inspired by [py3-TTS-Wrapper](https://github.com/willwade/tts-wrapper), it simplifies the use of services like Azure, Google Cloud, IBM Watson, and ElevenLabs.

## Table of Contents

- [Features](#features)
- [Supported TTS Engines](#supported-tts-engines)
- [Installation](#installation)
  - [Installation](#installation-1)
  - [Using npm scripts](#using-npm-scripts)
- [Quick Start](#quick-start)
- [Core Functionality](#core-functionality)
  - [Voice Management](#voice-management)
  - [Text Synthesis](#text-synthesis)
  - [Audio Playback](#audio-playback)
  - [File Output](#file-output)
  - [Event Handling](#event-handling)
- [SSML Support](#ssml-support)
- [Speech Markdown Support](#speech-markdown-support)
- [Engine-Specific Examples](#engine-specific-examples)
- [Browser Support](#browser-support)
- [API Reference](#api-reference)
- [Contributing](#contributing)
- [License](#license)

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

## Supported TTS Engines

| Engine | Provider | Dependencies |
|--------|----------|-------------|
| Azure | Microsoft Azure Cognitive Services | `@azure/cognitiveservices-speechservices`, `microsoft-cognitiveservices-speech-sdk` |
| Google Cloud | Google Cloud Text-to-Speech | `@google-cloud/text-to-speech` |
| ElevenLabs | ElevenLabs | `node-fetch@2` (Node.js only) |
| IBM Watson | IBM Watson | None (uses fetch API) |
| OpenAI | OpenAI | `openai` |
| PlayHT | PlayHT | `node-fetch@2` (Node.js only) |
| AWS Polly | Amazon Web Services | `@aws-sdk/client-polly` |
| SherpaOnnx | k2-fsa/sherpa-onnx | `sherpa-onnx-node`, `decompress`, `decompress-bzip2`, `decompress-tarbz2`, `decompress-targz`, `tar-stream` (Node.js only) |
| SherpaOnnx-WASM | k2-fsa/sherpa-onnx | None (WASM included, browser only) |
| eSpeak NG | eSpeak NG | `text2wav` (Node.js only) |
| eSpeak NG-WASM | eSpeak NG | `mespeak` (Node.js) or meSpeak.js (browser) |
| WitAI | Wit.ai | None (uses fetch API) |

## Installation

The library uses a modular approach where TTS engine-specific dependencies are optional. You can install the package and its dependencies as follows:

### npm install (longer route but more explicit)

```bash
# Install the base package
npm install js-tts-wrapper

# Install dependencies for specific engines
npm install @azure/cognitiveservices-speechservices microsoft-cognitiveservices-speech-sdk  # For Azure
npm install @google-cloud/text-to-speech  # For Google Cloud
npm install @aws-sdk/client-polly  # For AWS Polly
npm install node-fetch@2  # For ElevenLabs and PlayHT
npm install openai  # For OpenAI
npm install sherpa-onnx-node decompress decompress-bzip2 decompress-tarbz2 decompress-targz tar-stream  # For SherpaOnnx
npm install text2wav  # For eSpeak NG (Node.js)
npm install mespeak  # For eSpeak NG-WASM (Node.js)
npm install sound-play pcm-convert  # For Node.js audio playback
```

### Using npm scripts

After installing the base package, you can use the npm scripts provided by the package to install specific engine dependencies:

```bash
# Navigate to your project directory where js-tts-wrapper is installed
cd your-project

# Install Azure dependencies
npx js-tts-wrapper@latest run install:azure

# Install SherpaOnnx dependencies
npx js-tts-wrapper@latest run install:sherpaonnx

# Install eSpeak NG dependencies (Node.js)
npx js-tts-wrapper@latest run install:espeak

# Install eSpeak NG-WASM dependencies (Node.js)
npx js-tts-wrapper@latest run install:espeak-wasm

# Install Node.js audio playback dependencies
npx js-tts-wrapper@latest run install:node-audio

# Install all development dependencies
npx js-tts-wrapper@latest run install:all-dev
```

## Quick Start

### Direct Instantiation

#### ESM (ECMAScript Modules)

```javascript
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

#### CommonJS

```javascript
const { AzureTTSClient } = require('js-tts-wrapper');

// Initialize the client with your credentials
const tts = new AzureTTSClient({
  subscriptionKey: 'your-subscription-key',
  region: 'westeurope'
});

// Use async/await within an async function
async function runExample() {
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
}

runExample().catch(console.error);
```

### Using the Factory Pattern

The library provides a factory function to create TTS clients dynamically based on the engine name:

#### ESM (ECMAScript Modules)

```javascript
import { createTTSClient } from 'js-tts-wrapper';

// Create a TTS client using the factory function
const tts = createTTSClient('azure', {
  subscriptionKey: 'your-subscription-key',
  region: 'westeurope'
});

// Use the client as normal
await tts.speak('Hello from the factory pattern!');
```

#### CommonJS

```javascript
const { createTTSClient } = require('js-tts-wrapper');

// Create a TTS client using the factory function
const tts = createTTSClient('azure', {
  subscriptionKey: 'your-subscription-key',
  region: 'westeurope'
});

async function runExample() {
  // Use the client as normal
  await tts.speak('Hello from the factory pattern!');
}

runExample().catch(console.error);
```

The factory supports all engines: `'azure'`, `'google'`, `'polly'`, `'elevenlabs'`, `'openai'`, `'playht'`, `'watson'`, `'witai'`, `'sherpaonnx'`, `'sherpaonnx-wasm'`, `'espeak'`, `'espeak-wasm'`, etc.

## Core Functionality

All TTS engines in js-tts-wrapper implement a common set of methods and features through the AbstractTTSClient class. This ensures consistent behavior across different providers.

### Voice Management

```typescript
// Get all available voices
const voices = await tts.getVoices();

// Get voices for a specific language
const englishVoices = await tts.getVoicesByLanguage('en-US');

// Set the voice to use
tts.setVoice('en-US-AriaNeural');
```

The library includes a robust [Language Normalization](docs/LANGUAGE_NORMALIZATION.md) system that standardizes language codes across different TTS engines. This allows you to:

- Use BCP-47 codes (e.g., 'en-US') or ISO 639-3 codes (e.g., 'eng') interchangeably
- Get consistent language information regardless of the TTS engine
- Filter voices by language using any standard format

### Text Synthesis

```typescript
// Convert text to audio bytes (Uint8Array)
const audioBytes = await tts.synthToBytes('Hello, world!');

// Stream synthesis with word boundary information
const { audioStream, wordBoundaries } = await tts.synthToBytestream('Hello, world!');
```

### Audio Playback

```typescript
// Synthesize and play audio
await tts.speak('Hello, world!');

// Playback control
tts.pause();  // Pause playback
tts.resume(); // Resume playback
tts.stop();   // Stop playback

// Stream synthesis and play with word boundary callbacks
await tts.startPlaybackWithCallbacks('Hello world', (word, start, end) => {
  console.log(`Word: ${word}, Start: ${start}s, End: ${end}s`);
});
```

> **Note**: Audio playback with `speak()` and `speakStreamed()` methods is supported in both browser environments and Node.js environments with the optional `sound-play` package installed. To enable Node.js audio playback, install the required packages with `npm install sound-play pcm-convert` or use the npm script `npx js-tts-wrapper@latest run install:node-audio`.

### File Output

```typescript
// Save synthesized speech to a file
await tts.synthToFile('Hello, world!', 'output', 'mp3');
```

### Event Handling

```typescript
// Register event handlers
tts.on('start', () => console.log('Speech started'));
tts.on('end', () => console.log('Speech ended'));
tts.on('boundary', (word, start, end) => {
  console.log(`Word: ${word}, Start: ${start}s, End: ${end}s`);
});

// Alternative event connection
tts.connect('onStart', () => console.log('Speech started'));
tts.connect('onEnd', () => console.log('Speech ended'));
```

## SSML Support

All engines support SSML (Speech Synthesis Markup Language) for advanced control over speech synthesis:

```typescript
// Use SSML directly
const ssml = `
<speak>
  <prosody rate="slow" pitch="low">
    This text will be spoken slowly with a low pitch.
  </prosody>
  <break time="500ms"/>
  <emphasis level="strong">This text is emphasized.</emphasis>
</speak>
`;
await tts.speak(ssml);

// Or use the SSML builder
const ssmlText = tts.ssml
  .prosody({ rate: 'slow', pitch: 'low' }, 'This text will be spoken slowly with a low pitch.')
  .break(500)
  .emphasis('strong', 'This text is emphasized.')
  .toString();

await tts.speak(ssmlText);
```

## Speech Markdown Support

The library supports Speech Markdown for easier speech formatting:

```typescript
// Use Speech Markdown
const markdown = "Hello (pause:500ms) world! This is (emphasis:strong) important.";
await tts.speak(markdown, { useSpeechMarkdown: true });
```

## Engine-Specific Examples

Each TTS engine has its own specific setup. Here are examples for each supported engine in both ESM and CommonJS formats:

### Azure

#### ESM
```javascript
import { AzureTTSClient } from 'js-tts-wrapper';

const tts = new AzureTTSClient({
  subscriptionKey: 'your-subscription-key',
  region: 'westeurope'
});

await tts.speak('Hello from Azure!');
```

#### CommonJS
```javascript
const { AzureTTSClient } = require('js-tts-wrapper');

const tts = new AzureTTSClient({
  subscriptionKey: 'your-subscription-key',
  region: 'westeurope'
});

// Inside an async function
await tts.speak('Hello from Azure!');
```

### Google Cloud

#### ESM
```javascript
import { GoogleTTSClient } from 'js-tts-wrapper';

const tts = new GoogleTTSClient({
  keyFilename: '/path/to/service-account-key.json'
});

await tts.speak('Hello from Google Cloud!');
```

#### CommonJS
```javascript
const { GoogleTTSClient } = require('js-tts-wrapper');

const tts = new GoogleTTSClient({
  keyFilename: '/path/to/service-account-key.json'
});

// Inside an async function
await tts.speak('Hello from Google Cloud!');
```

### AWS Polly

#### ESM
```javascript
import { PollyTTSClient } from 'js-tts-wrapper';

const tts = new PollyTTSClient({
  region: 'us-east-1',
  accessKeyId: 'your-access-key-id',
  secretAccessKey: 'your-secret-access-key'
});

await tts.speak('Hello from AWS Polly!');
```

#### CommonJS
```javascript
const { PollyTTSClient } = require('js-tts-wrapper');

const tts = new PollyTTSClient({
  region: 'us-east-1',
  accessKeyId: 'your-access-key-id',
  secretAccessKey: 'your-secret-access-key'
});

// Inside an async function
await tts.speak('Hello from AWS Polly!');
```

### ElevenLabs

#### ESM
```javascript
import { ElevenLabsTTSClient } from 'js-tts-wrapper';

const tts = new ElevenLabsTTSClient({
  apiKey: 'your-api-key'
});

await tts.speak('Hello from ElevenLabs!');
```

#### CommonJS
```javascript
const { ElevenLabsTTSClient } = require('js-tts-wrapper');

const tts = new ElevenLabsTTSClient({
  apiKey: 'your-api-key'
});

// Inside an async function
await tts.speak('Hello from ElevenLabs!');
```

### OpenAI

#### ESM
```javascript
import { OpenAITTSClient } from 'js-tts-wrapper';

const tts = new OpenAITTSClient({
  apiKey: 'your-api-key'
});

await tts.speak('Hello from OpenAI!');
```

#### CommonJS
```javascript
const { OpenAITTSClient } = require('js-tts-wrapper');

const tts = new OpenAITTSClient({
  apiKey: 'your-api-key'
});

// Inside an async function
await tts.speak('Hello from OpenAI!');
```

### PlayHT

#### ESM
```javascript
import { PlayHTTTSClient } from 'js-tts-wrapper';

const tts = new PlayHTTTSClient({
  apiKey: 'your-api-key',
  userId: 'your-user-id'
});

await tts.speak('Hello from PlayHT!');
```

#### CommonJS
```javascript
const { PlayHTTTSClient } = require('js-tts-wrapper');

const tts = new PlayHTTTSClient({
  apiKey: 'your-api-key',
  userId: 'your-user-id'
});

// Inside an async function
await tts.speak('Hello from PlayHT!');
```

### IBM Watson

#### ESM
```javascript
import { WatsonTTSClient } from 'js-tts-wrapper';

const tts = new WatsonTTSClient({
  apiKey: 'your-api-key',
  region: 'us-south',
  instanceId: 'your-instance-id'
});

await tts.speak('Hello from IBM Watson!');
```

#### CommonJS
```javascript
const { WatsonTTSClient } = require('js-tts-wrapper');

const tts = new WatsonTTSClient({
  apiKey: 'your-api-key',
  region: 'us-south',
  instanceId: 'your-instance-id'
});

// Inside an async function
await tts.speak('Hello from IBM Watson!');
```

### Wit.ai

#### ESM
```javascript
import { WitAITTSClient } from 'js-tts-wrapper';

const tts = new WitAITTSClient({
  token: 'your-wit-ai-token'
});

await tts.speak('Hello from Wit.ai!');
```

#### CommonJS
```javascript
const { WitAITTSClient } = require('js-tts-wrapper');

const tts = new WitAITTSClient({
  token: 'your-wit-ai-token'
});

// Inside an async function
await tts.speak('Hello from Wit.ai!');
```

### SherpaOnnx (Offline TTS)

#### ESM
```javascript
import { SherpaOnnxTTSClient } from 'js-tts-wrapper';

const tts = new SherpaOnnxTTSClient();
// The client will automatically download models when needed

await tts.speak('Hello from SherpaOnnx!');
```

#### CommonJS
```javascript
const { SherpaOnnxTTSClient } = require('js-tts-wrapper');

const tts = new SherpaOnnxTTSClient();
// The client will automatically download models when needed

// Inside an async function
await tts.speak('Hello from SherpaOnnx!');
```

> **Note**: SherpaOnnx is a server-side only engine and requires specific environment setup. See the [SherpaOnnx documentation](docs/sherpaonnx.md) for details on setup and configuration. For browser environments, use [SherpaOnnx-WASM](docs/sherpaonnx-wasm.md) instead.

### eSpeak NG (Node.js)

#### ESM
```javascript
import { EspeakTTSClient } from 'js-tts-wrapper';

const tts = new EspeakTTSClient();

await tts.speak('Hello from eSpeak NG!');
```

#### CommonJS
```javascript
const { EspeakTTSClient } = require('js-tts-wrapper');

const tts = new EspeakTTSClient();

// Inside an async function
await tts.speak('Hello from eSpeak NG!');
```

> **Note**: This engine uses the `text2wav` package and is designed for Node.js environments only. For browser environments, use the eSpeak NG-WASM engine instead.

### eSpeak NG-WASM (Cross-platform)

#### ESM
```javascript
import { EspeakWasmTTSClient } from 'js-tts-wrapper';

const tts = new EspeakWasmTTSClient();

await tts.speak('Hello from eSpeak NG WASM!');
```

#### CommonJS
```javascript
const { EspeakWasmTTSClient } = require('js-tts-wrapper');

const tts = new EspeakWasmTTSClient();

// Inside an async function
await tts.speak('Hello from eSpeak NG WASM!');
```

> **Note**: This engine works in both Node.js (using the `mespeak` package) and browser environments (using meSpeak.js). For browser use, include meSpeak.js in your HTML before using this engine.

## API Reference

### Factory Function

| Function | Description | Return Type |
|--------|-------------|-------------|
| `createTTSClient(engine, credentials)` | Create a TTS client for the specified engine | `AbstractTTSClient` |

### Common Methods (All Engines)

| Method | Description | Return Type |
|--------|-------------|-------------|
| `getVoices()` | Get all available voices | `Promise<UnifiedVoice[]>` |
| `getVoicesByLanguage(language)` | Get voices for a specific language | `Promise<UnifiedVoice[]>` |
| `setVoice(voiceId, lang?)` | Set the voice to use | `void` |
| `synthToBytes(text, options?)` | Convert text to audio bytes | `Promise<Uint8Array>` |
| `synthToBytestream(text, options?)` | Stream synthesis with word boundaries | `Promise<{audioStream, wordBoundaries}>` |
| `speak(text, options?)` | Synthesize and play audio | `Promise<void>` |
| `speakStreamed(text, options?)` | Stream synthesis and play | `Promise<void>` |
| `synthToFile(text, filename, format?, options?)` | Save synthesized speech to a file | `Promise<void>` |
| `startPlaybackWithCallbacks(text, callback, options?)` | Play with word boundary callbacks | `Promise<void>` |
| `pause()` | Pause audio playback | `void` |
| `resume()` | Resume audio playback | `void` |
| `stop()` | Stop audio playback | `void` |
| `on(event, callback)` | Register event handler | `void` |
| `connect(event, callback)` | Connect to event | `void` |
| `checkCredentials()` | Check if credentials are valid | `Promise<boolean>` |
| `checkCredentialsDetailed()` | Check if credentials are valid with detailed response | `Promise<CredentialsCheckResult>` |
| `getProperty(propertyName)` | Get a property value | `PropertyType` |
| `setProperty(propertyName, value)` | Set a property value | `void` |

The `checkCredentialsDetailed()` method returns a `CredentialsCheckResult` object with the following properties:
```typescript
{
  success: boolean;    // Whether the credentials are valid
  error?: string;      // Error message if credentials are invalid
  voiceCount?: number; // Number of voices available if credentials are valid
}
```

### SSML Builder Methods

The `ssml` property provides a builder for creating SSML:

| Method | Description |
|--------|-------------|
| `prosody(attrs, text)` | Add prosody element |
| `break(time)` | Add break element |
| `emphasis(level, text)` | Add emphasis element |
| `sayAs(interpretAs, text)` | Add say-as element |
| `phoneme(alphabet, ph, text)` | Add phoneme element |
| `sub(alias, text)` | Add substitution element |
| `toString()` | Convert to SSML string |

## Browser Support

The library works in both Node.js and browser environments. In browsers, use the ESM or UMD bundle:

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

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Optional Dependencies

The library uses a peer dependencies approach to minimize the installation footprint. You can install only the dependencies you need for the engines you plan to use.

```bash
# Install the base package
npm install js-tts-wrapper

# Install dependencies for specific engines
npm install @azure/cognitiveservices-speechservices microsoft-cognitiveservices-speech-sdk  # For Azure TTS
npm install @google-cloud/text-to-speech  # For Google TTS
npm install @aws-sdk/client-polly  # For AWS Polly
npm install openai  # For OpenAI TTS
npm install sherpa-onnx-node decompress decompress-bzip2 decompress-tarbz2 decompress-targz tar-stream  # For SherpaOnnx TTS
npm install text2wav  # For eSpeak NG (Node.js)
npm install mespeak  # For eSpeak NG-WASM (Node.js)

# Install dependencies for Node.js audio playback
npm install sound-play speaker pcm-convert  # For audio playback in Node.js
```

You can also use the npm scripts provided by the package to install specific engine dependencies:

```bash
# Navigate to your project directory where js-tts-wrapper is installed
cd your-project

# Install specific engine dependencies
npx js-tts-wrapper@latest run install:azure
npx js-tts-wrapper@latest run install:google
npx js-tts-wrapper@latest run install:polly
npx js-tts-wrapper@latest run install:openai
npx js-tts-wrapper@latest run install:sherpaonnx
npx js-tts-wrapper@latest run install:espeak
npx js-tts-wrapper@latest run install:espeak-wasm

# Install Node.js audio playback dependencies
npx js-tts-wrapper@latest run install:node-audio

# Install all development dependencies
npx js-tts-wrapper@latest run install:all-dev
```

## Node.js Audio Playback

The library supports audio playback in Node.js environments with the optional `sound-play` package. This allows you to use the `speak()` and `speakStreamed()` methods in Node.js applications, just like in browser environments.

To enable Node.js audio playback:

1. Install the required dependencies:
   ```bash
   npm install sound-play pcm-convert
   ```

   Or use the npm script:
   ```bash
   npx js-tts-wrapper@latest run install:node-audio
   ```

2. Use the TTS client as usual:
   ```typescript
   import { TTSFactory } from 'js-tts-wrapper';

   const tts = TTSFactory.createTTSClient('mock');

   // Play audio in Node.js
   await tts.speak('Hello, world!');
   ```

If the `sound-play` package is not installed, the library will fall back to providing informative messages and suggest installing the package.

## Testing and Troubleshooting

### Testing Audio Playback

To test audio playback with any TTS engine, use the `PLAY_AUDIO` environment variable:

```bash
# Test a specific engine with audio playback
PLAY_AUDIO=true node examples/test-engines.js [engine-name]

# Examples:
PLAY_AUDIO=true node examples/test-engines.js witai
PLAY_AUDIO=true node examples/test-engines.js azure
PLAY_AUDIO=true node examples/test-engines.js polly
```

### SherpaOnnx Specific Testing

SherpaOnnx requires special environment setup. Use the helper script:

```bash
# Test SherpaOnnx with audio playback
PLAY_AUDIO=true node scripts/run-with-sherpaonnx.cjs examples/test-engines.js sherpaonnx
```

### Common Issues

1. **No Audio in Node.js**: Install audio dependencies with `npm install sound-play speaker pcm-convert`
2. **SherpaOnnx Not Working**: Use the helper script and ensure environment variables are set correctly
3. **WitAI Audio Issues**: The library automatically handles WitAI's raw PCM format conversion
4. **Sample Rate Issues**: Different engines use different sample rates (WitAI: 24kHz, Polly: 16kHz) - this is handled automatically

For detailed troubleshooting, see the [docs/](docs/) directory, especially:
- [SherpaOnnx Documentation](docs/sherpaonnx.md)
- [SherpaOnnx Troubleshooting](docs/sherpaonnx-troubleshooting.md)

## License

This project is licensed under the MIT License - see the LICENSE file for details.
