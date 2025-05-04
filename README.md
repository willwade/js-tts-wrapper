# js-tts-wrapper

A JavaScript/TypeScript library that provides a unified API for working with multiple cloud-based Text-to-Speech (TTS) services. Inspired by [py3-TTS-Wrapper](https://github.com/willwade/tts-wrapper), it simplifies the use of services like Azure, Google Cloud, IBM Watson, and ElevenLabs.

## Table of Contents

- [Features](#features)
- [Supported TTS Engines](#supported-tts-engines)
- [Installation](#installation)
  - [Using Dependency Groups](#using-dependency-groups)
  - [Manual Installation](#manual-installation)
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
| SherpaOnnx | k2-fsa/sherpa-onnx | `sherpa-onnx-node`, `decompress`, `decompress-bzip2`, `decompress-tarbz2`, `decompress-targz`, `tar-stream` |
| eSpeak NG | eSpeak NG | None (WASM included) |
| WitAI | Wit.ai | None (uses fetch API) |

## Installation

The library uses a modular approach where TTS engine-specific dependencies are optional. You can install dependencies in two ways:

### Using Dependency Groups (npm 8.3.0+)

Install the package with specific engine dependencies using the bracket notation (similar to pip extras):

```bash
# Install with specific engine dependencies
npm install js-tts-wrapper[azure]      # Install with Azure dependencies
npm install js-tts-wrapper[google]     # Install with Google Cloud dependencies
npm install js-tts-wrapper[polly]      # Install with AWS Polly dependencies
npm install js-tts-wrapper[elevenlabs] # Install with ElevenLabs dependencies
npm install js-tts-wrapper[openai]     # Install with OpenAI dependencies
npm install js-tts-wrapper[playht]     # Install with PlayHT dependencies
npm install js-tts-wrapper[watson]     # Install with IBM Watson dependencies
npm install js-tts-wrapper[witai]      # Install with Wit.ai dependencies
npm install js-tts-wrapper[sherpaonnx] # Install with SherpaOnnx dependencies

# Install with multiple engine dependencies
npm install js-tts-wrapper[azure,google,polly]

# Install with all cloud-based engines
npm install js-tts-wrapper[cloud]

# Install with all engines
npm install js-tts-wrapper[all]
```

### Manual Installation

Alternatively, you can install the package and its dependencies manually:

```bash
# Install the base package
npm install js-tts-wrapper

# Install dependencies for specific engines
npm install @azure/cognitiveservices-speechservices microsoft-cognitiveservices-speech-sdk  # For Azure
npm install @google-cloud/text-to-speech  # For Google Cloud
npm install @aws-sdk/client-polly  # For AWS Polly
npm install node-fetch@2  # For ElevenLabs and PlayHT
npm install openai  # For OpenAI
```

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

Each TTS engine has its own specific setup. Here are examples for each supported engine:

### Azure

```typescript
import { AzureTTSClient } from 'js-tts-wrapper';

const tts = new AzureTTSClient({
  subscriptionKey: 'your-subscription-key',
  region: 'westeurope'
});

await tts.speak('Hello from Azure!');
```

### Google Cloud

```typescript
import { GoogleTTSClient } from 'js-tts-wrapper';

const tts = new GoogleTTSClient({
  keyFilename: '/path/to/service-account-key.json'
});

await tts.speak('Hello from Google Cloud!');
```

### AWS Polly

```typescript
import { PollyTTSClient } from 'js-tts-wrapper';

const tts = new PollyTTSClient({
  region: 'us-east-1',
  accessKeyId: 'your-access-key-id',
  secretAccessKey: 'your-secret-access-key'
});

await tts.speak('Hello from AWS Polly!');
```

### ElevenLabs

```typescript
import { ElevenLabsTTSClient } from 'js-tts-wrapper';

const tts = new ElevenLabsTTSClient({
  apiKey: 'your-api-key'
});

await tts.speak('Hello from ElevenLabs!');
```

### OpenAI

```typescript
import { OpenAITTSClient } from 'js-tts-wrapper';

const tts = new OpenAITTSClient({
  apiKey: 'your-api-key'
});

await tts.speak('Hello from OpenAI!');
```

### PlayHT

```typescript
import { PlayHTTTSClient } from 'js-tts-wrapper';

const tts = new PlayHTTTSClient({
  apiKey: 'your-api-key',
  userId: 'your-user-id'
});

await tts.speak('Hello from PlayHT!');
```

### IBM Watson

```typescript
import { WatsonTTSClient } from 'js-tts-wrapper';

const tts = new WatsonTTSClient({
  apiKey: 'your-api-key',
  region: 'us-south',
  instanceId: 'your-instance-id'
});

await tts.speak('Hello from IBM Watson!');
```

### Wit.ai

```typescript
import { WitAITTSClient } from 'js-tts-wrapper';

const tts = new WitAITTSClient({
  token: 'your-wit-ai-token'
});

await tts.speak('Hello from Wit.ai!');
```

### SherpaOnnx (Offline TTS)

```typescript
import { SherpaOnnxTTSClient } from 'js-tts-wrapper';

const tts = new SherpaOnnxTTSClient();
// The client will automatically download models when needed

await tts.speak('Hello from SherpaOnnx!');
```

### eSpeak NG (WASM)

```typescript
import { EspeakTTSClient } from 'js-tts-wrapper';

const tts = new EspeakTTSClient();

await tts.speak('Hello from eSpeak NG!');
```

## API Reference

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
| `getProperty(propertyName)` | Get a property value | `PropertyType` |
| `setProperty(propertyName, value)` | Set a property value | `void` |

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

## License

This project is licensed under the MIT License - see the LICENSE file for details.
