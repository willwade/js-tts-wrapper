# js-tts-wrapper

A JavaScript/TypeScript library that provides a unified API for working with multiple cloud-based Text-to-Speech (TTS) services. Inspired by [py3-TTS-Wrapper](https://github.com/willwade/tts-wrapper), it simplifies the use of services like Azure, Google Cloud, IBM Watson, and ElevenLabs.

## Features

- **Unified API**: Consistent interface across multiple TTS providers
- **SSML Support**: Use Speech Synthesis Markup Language to enhance speech synthesis
- **Speech Markdown**: Optional support for easier speech markup
- **Voice Selection**: Easily browse and select from available voices
- **Streaming Synthesis**: Stream audio as it's being synthesized
- **Playback Control**: Pause, resume, and stop audio playback
- **Word Boundaries**: Get callbacks for word timing (where supported)
- **File Output**: Save synthesized speech to audio files

## Installation

```bash
npm install js-tts-wrapper
```

### Optional Dependencies

The library uses a modular approach where TTS engine-specific dependencies are optional. Install only what you need:

```bash
# For Azure TTS
npm install @azure/cognitiveservices-speechservices

# For Google Cloud TTS
npm install @google-cloud/text-to-speech

# For ElevenLabs TTS
npm install node-fetch

# For AWS Polly TTS
npm install @aws-sdk/client-polly

# For OpenAI TTS
npm install openai

# For PlayHT TTS
npm install node-fetch

# For SherpaOnnx TTS (offline TTS)
# Note: This is a native module that requires compilation
npm install sherpa-onnx-node

# For native platforms (macOS, Linux, Windows), you need to set environment variables
# You can use the provided helper scripts which handle all platforms:
node scripts/run-with-sherpaonnx.js your-script.js
# Or set manually:
# - macOS: export DYLD_LIBRARY_PATH=/path/to/your/project/node_modules/sherpa-onnx-darwin-arm64:$DYLD_LIBRARY_PATH
# - Linux: export LD_LIBRARY_PATH=/path/to/your/project/node_modules/sherpa-onnx-linux-x64:$LD_LIBRARY_PATH
# - Windows: set PATH=C:\path\to\your\project\node_modules\sherpa-onnx-win32-x64;%PATH%

# If you encounter issues installing or using sherpa-onnx-node, you can still use the wrapper
# with a mock implementation for testing purposes

# Or install all supported engines
npm install js-tts-wrapper @azure/cognitiveservices-speechservices @google-cloud/text-to-speech node-fetch @aws-sdk/client-polly openai sherpa-onnx-node
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

## Supported Providers

| Provider      | SSML | Streaming | Word Timing | File Output | Notes                     |
|---------------|------|-----------|-------------|-------------|---------------------------|
| Azure         | Yes  | Yes       | Yes         | Yes         | Full SSML support         |
| Google Cloud  | Yes  | Yes       | Yes         | Yes         | Full SSML + markup        |
| ElevenLabs    | No*  | Yes       | Partial     | Yes         | Strip SSML automatically  |
| OpenAI        | No*  | Yes       | Estimated** | Yes         | Multiple voices available |
| PlayHT        | No*  | Yes       | Estimated** | Yes         | Multiple voice engines    |
| AWS Polly     | Yes  | Yes       | Yes         | Yes         | Full SSML support         |
| SherpaOnnx    | No*  | Yes       | Estimated** | Yes         | Offline TTS, no internet  |

*Engines that don't support SSML will automatically strip SSML tags and process the plain text.

**Word timings are estimated based on the total audio duration and word count.

### Coming Soon

| Provider      | Status                  |
|---------------|-------------------------|
| IBM Watson    | Planned                 |

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

## License

MIT
