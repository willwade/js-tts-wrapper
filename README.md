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

*Engines that don't support SSML will automatically strip SSML tags and process the plain text.

### Coming Soon

| Provider      | Status                  |
|---------------|-------------------------|
| AWS Polly     | Planned                 |
| IBM Watson    | Planned                 |
| OpenAI        | Planned                 |

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
```

## License

MIT
