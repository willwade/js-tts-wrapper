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
- [Examples and Demos](#examples-and-demos)


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

| Factory Name | Class Name | Environment | Provider | Dependencies |
|--------------|------------|-------------|----------|-------------|
| `azure` | `AzureTTSClient` | Both | Microsoft Azure Cognitive Services | `@azure/cognitiveservices-speechservices`, `microsoft-cognitiveservices-speech-sdk` |
| `google` | `GoogleTTSClient` | Both | Google Cloud Text-to-Speech | `@google-cloud/text-to-speech` |
| `elevenlabs` | `ElevenLabsTTSClient` | Both | ElevenLabs | `node-fetch@2` (Node.js only) |
| `watson` | `WatsonTTSClient` | Both | IBM Watson | None (uses fetch API) |
| `openai` | `OpenAITTSClient` | Both | OpenAI | `openai` |
| `upliftai` | `UpliftAITTSClient` | Both | UpLiftAI | None (uses fetch API) |
| `playht` | `PlayHTTTSClient` | Both | PlayHT | `node-fetch@2` (Node.js only) |
| `polly` | `PollyTTSClient` | Both | Amazon Web Services | `@aws-sdk/client-polly` |
| `sherpaonnx` | `SherpaOnnxTTSClient` | Node.js | k2-fsa/sherpa-onnx | `sherpa-onnx-node`, `decompress`, `decompress-bzip2`, `decompress-tarbz2`, `decompress-targz`, `tar-stream` |
| `sherpaonnx-wasm` | `SherpaOnnxWasmTTSClient` | Browser | k2-fsa/sherpa-onnx | None (WASM included) |
| `espeak` | `EspeakNodeTTSClient` | Node.js | eSpeak NG | `text2wav` |
| `espeak-wasm` | `EspeakBrowserTTSClient` | Both | eSpeak NG | `mespeak` (Node.js) or meSpeak.js (browser) |
| `sapi` | `SAPITTSClient` | Node.js | Windows Speech API (SAPI) | None (uses PowerShell) |
| `witai` | `WitAITTSClient` | Both | Wit.ai | None (uses fetch API) |

**Factory Name**: Use with `createTTSClient('factory-name', credentials)`
**Class Name**: Use with direct import `import { ClassName } from 'js-tts-wrapper'`
**Environment**: Node.js = server-side only, Browser = browser-compatible, Both = works in both environments


### Important: SherpaONNX is optional and does not affect other engines

- Importing `js-tts-wrapper` does NOT load `sherpa-onnx-node`.
- Cloud engines (Azure, Google, Polly, OpenAI, etc.) work without any SherpaONNX packages installed.
- Only when you instantiate `SherpaOnnxTTSClient` (Node-only) will the library look for `sherpa-onnx-node` and its platform package. If SherpaONNX is not installed, the Sherpa engine will gracefully warn/fallback, and other engines remain unaffected.
- See the Installation section below for how to install SherpaONNX dependencies only if you plan to use that engine.

### Timing and Audio Format Capabilities

#### Word Boundary and Timing Support

| Engine | Word Boundaries | Timing Source | Character-Level | Accuracy |
|--------|----------------|---------------|-----------------|----------|
| **ElevenLabs** | ✅ | **Real API data** | ✅ **NEW!** | **High** |
| **Azure** | ✅ | **Real API data** | ❌ | **High** |
| **Google** | ✅ | Estimated | ❌ | Low |
| **Watson** | ✅ | Estimated | ❌ | Low |
| **UpLiftAI** | ✅ | Estimated | ❌ | Low |
| **OpenAI** | ✅ | Estimated | ❌ | Low |
| **WitAI** | ✅ | Estimated | ❌ | Low |
| **PlayHT** | ✅ | Estimated | ❌ | Low |
| **Polly** | ✅ | Estimated | ❌ | Low |
| **eSpeak** | ✅ | Estimated | ❌ | Low |
| **eSpeak-WASM** | ✅ | Estimated | ❌ | Low |
| **SherpaOnnx** | ✅ | Estimated | ❌ | Low |
| **SherpaOnnx-WASM** | ✅ | Estimated | ❌ | Low |
| **SAPI** | ✅ | Estimated | ❌ | Low |

**Character-Level Timing**: Only ElevenLabs provides precise character-level timing data via the `/with-timestamps` endpoint, enabling the most accurate word highlighting and speech synchronization.

#### Audio Format Conversion Support

| Engine | Native Format | WAV Support | MP3 Conversion | Conversion Method |
|--------|---------------|-------------|----------------|-------------------|
| **All Engines** | Varies | ✅ | ✅ | Pure JavaScript (lamejs) |

**Format Conversion**: All engines support WAV and MP3 output through automatic format conversion. The wrapper uses pure JavaScript conversion (lamejs) when FFmpeg is not available, ensuring cross-platform compatibility without external dependencies.

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
npm install say  # For System TTS (Node.js)
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

# Install System TTS dependencies (Node.js)
npx js-tts-wrapper@latest run install:system

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

The factory supports all engines: `'azure'`, `'google'`, `'polly'`, `'elevenlabs'`, `'openai'`, `'playht'`, `'watson'`, `'witai'`, `'sherpaonnx'`, `'sherpaonnx-wasm'`, `'espeak'`, `'espeak-wasm'`, `'sapi'`, etc.

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

### Credential Validation

All TTS engines support standardized credential validation to help you verify your setup before making requests:

```typescript
// Basic validation - returns boolean
const isValid = await tts.checkCredentials();
if (!isValid) {
  console.error('Invalid credentials!');
}

// Detailed validation - returns comprehensive status
const status = await tts.getCredentialStatus();
console.log(status);
/*
{
  valid: true,
  engine: 'openai',
  environment: 'node',
  requiresCredentials: true,
  credentialTypes: ['apiKey'],
  message: 'openai credentials are valid and 10 voices are available'
}
*/
```

**Engine Requirements:**
- **Cloud engines** (OpenAI, Azure, Google, etc.): Require API keys/credentials
- **Local engines** (eSpeak, SAPI, SherpaOnnx): No credentials needed
- **Environment-specific**: Some engines work only in Node.js or browser

See the [Credential Validation Guide](docs/CREDENTIAL_VALIDATION.md) for detailed requirements and troubleshooting.

### Text Synthesis

```typescript
// Convert text to audio bytes (Uint8Array)
const audioBytes = await tts.synthToBytes('Hello, world!');

// Stream synthesis with word boundary information
const { audioStream, wordBoundaries } = await tts.synthToBytestream('Hello, world!');
```

### Audio Playback

```typescript
// Traditional text synthesis and playback
await tts.speak('Hello, world!');

// NEW: Play audio from different sources without re-synthesizing
// Play from file
await tts.speak({ filename: 'path/to/audio.mp3' });

// Play from audio bytes
const audioBytes = await tts.synthToBytes('Hello, world!');
await tts.speak({ audioBytes: audioBytes });

// Play from audio stream
const { audioStream } = await tts.synthToBytestream('Hello, world!');
await tts.speak({ audioStream: audioStream });

// All input types work with speakStreamed too
await tts.speakStreamed({ filename: 'path/to/audio.mp3' });

// Playback control
tts.pause();  // Pause playback
tts.resume(); // Resume playback
tts.stop();   // Stop playback

// Stream synthesis and play with word boundary callbacks
await tts.startPlaybackWithCallbacks('Hello world', (word, start, end) => {
  console.log(`Word: ${word}, Start: ${start}s, End: ${end}s`);
});
```

#### Benefits of Multi-Source Audio Playback

- **Avoid Double Synthesis**: Use `synthToFile()` to save audio, then play the same file with `speak({ filename })` without re-synthesizing
- **Platform Independent**: Works consistently across browser and Node.js environments
- **Efficient Reuse**: Play the same audio bytes or stream multiple times without regenerating
- **Flexible Input**: Choose the most convenient input source for your use case

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

### Word Boundary Events and Timing

Word boundary events provide precise timing information for speech synchronization, word highlighting, and interactive applications.

#### Basic Word Boundary Usage

```typescript
// Enable word boundary events
tts.on('boundary', (word, startTime, endTime) => {
  console.log(`"${word}" spoken from ${startTime}s to ${endTime}s`);
});

await tts.speak('Hello world, this is a test.');
// Output:
// "Hello" spoken from 0.000s to 0.300s
// "world," spoken from 0.300s to 0.600s
// "this" spoken from 0.600s to 0.900s
// ...
```

#### Advanced Timing with Character-Level Precision (ElevenLabs)

```typescript
// ElevenLabs: Enable character-level timing for maximum accuracy
const tts = createTTSClient('elevenlabs');

// Method 1: Using synthToBytestream with timestamps
const result = await tts.synthToBytestream('Hello world', {
  useTimestamps: true
});

console.log(`Generated ${result.wordBoundaries.length} word boundaries:`);
result.wordBoundaries.forEach(wb => {
  const startSec = wb.offset / 10000;
  const durationSec = wb.duration / 10000;
  console.log(`"${wb.text}": ${startSec}s - ${startSec + durationSec}s`);
});

// Method 2: Using enhanced callback support
await tts.startPlaybackWithCallbacks('Hello world', (word, start, end) => {
  console.log(`Precise timing: "${word}" from ${start}s to ${end}s`);
});
```

#### Real-Time Word Highlighting Example

```typescript
// Example: Real-time word highlighting for accessibility
const textElement = document.getElementById('text');
const words = 'Hello world, this is a test.'.split(' ');
let wordIndex = 0;

tts.on('boundary', (word, startTime, endTime) => {
  // Highlight current word
  if (wordIndex < words.length) {
    textElement.innerHTML = words.map((w, i) =>
      i === wordIndex ? `<mark>${w}</mark>` : w
    ).join(' ');
    wordIndex++;
  }
});

await tts.speak('Hello world, this is a test.', { useWordBoundary: true });
```

## SSML Support

The library provides comprehensive SSML (Speech Synthesis Markup Language) support with engine-specific capabilities:

### SSML-Supported Engines

The following engines **support SSML**:
- **Google Cloud TTS** - Full SSML support with all elements
- **Microsoft Azure** - Full SSML support with voice-specific features
- **Amazon Polly** - Dynamic SSML support based on voice engine type (standard/long-form: full, neural/generative: limited)
- **WitAI** - Full SSML support
- **SAPI (Windows)** - Full SSML support
- **eSpeak/eSpeak-WASM** - SSML support with subset of elements

### Non-SSML Engines

The following engines **automatically strip SSML tags** and convert to plain text:
- **ElevenLabs** - SSML tags are removed, plain text is synthesized
- **OpenAI** - SSML tags are removed, plain text is synthesized
- **PlayHT** - SSML tags are removed, plain text is synthesized
- **SherpaOnnx/SherpaOnnx-WASM** - SSML tags are removed, plain text is synthesized

### Usage Examples

```typescript
// Use SSML directly (works with supported engines)
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

### Engine-Specific SSML Notes

- **Amazon Polly**: SSML support varies by voice engine type:
  - **Standard voices**: Full SSML support including all tags
  - **Long-form voices**: Full SSML support including all tags
  - **Neural voices**: Limited SSML support (no emphasis, limited prosody)
  - **Generative voices**: Limited SSML support (partial tag support)
  - The library automatically detects voice engine types and handles SSML appropriately
- **Microsoft Azure**: Supports voice-specific SSML elements and custom voice tags
  - Supports MS-specific tags like `<mstts:express-as>` for emotional styles
  - The library automatically injects the required `xmlns:mstts` namespace when needed
- **Google Cloud**: Supports the most comprehensive set of SSML elements
- **WitAI**: Full SSML support according to W3C specification
- **SAPI**: Windows-native SSML support with system voice capabilities
- **eSpeak**: Supports SSML subset including prosody, breaks, and emphasis elements

### Raw SSML Pass-Through

For advanced use cases where you need to use provider-specific SSML features not supported by the library's SSML processing, you can use the `rawSSML` option to bypass Speech Markdown conversion and SSML validation:

```typescript
// Use raw SSML with provider-specific features
const azureSSML = `<speak xmlns:mstts="https://www.w3.org/2001/mstts">
  <mstts:express-as style="friendly" styledegree="0">
    A very sad day.
  </mstts:express-as>
</speak>`;

await tts.speak(azureSSML, { rawSSML: true });

// The library will:
// 1. Skip Speech Markdown conversion
// 2. Skip SSML validation and processing
// 3. Pass the SSML directly to the provider
// 4. Still ensure basic SSML structure requirements are met
```

**Note**: When using `rawSSML: true`, you are responsible for ensuring the SSML is valid for your provider. The library will still add required namespaces and attributes where necessary.

### Extending Speech Markdown Support

The library uses the **speechmarkdown-js** library for Speech Markdown conversion. If you need Speech Markdown features that aren't yet supported by the wrapper:

1. **Check speechmarkdown-js documentation** - The library supports many platforms including Azure, Google, Polly, WitAI, and more
2. **Use `rawSSML` option** - Convert your Speech Markdown to SSML using speechmarkdown-js directly, then pass it with `rawSSML: true`:

```typescript
import { SpeechMarkdown } from 'speechmarkdown-js';

// Convert Speech Markdown to SSML using speechmarkdown-js directly
const markdown = "(This is exciting!)[excited:\"1.5\"] with intensity control";
const ssml = await SpeechMarkdown.toSSML(markdown, "microsoft-azure");

// Pass the generated SSML directly to the provider
await tts.speak(ssml, { rawSSML: true });
```

3. **Contribute to speechmarkdown-js** - If you find a feature that should be supported, consider contributing to the [speechmarkdown-js repository](https://github.com/speechmarkdown/speechmarkdown-js)

This approach gives you access to all Speech Markdown features supported by the underlying library while maintaining compatibility with the TTS wrapper.

## Speech Markdown Support

The library supports Speech Markdown for easier speech formatting across **all engines**. Speech Markdown is powered by the **[speechmarkdown-js](https://github.com/speechmarkdown/speechmarkdown-js)** library, which provides comprehensive platform-specific support.

### How Speech Markdown Works

- **SSML-supported engines**: Speech Markdown is converted to SSML (with platform-specific optimizations), then processed natively
- **Non-SSML engines**: Speech Markdown is converted to SSML, then SSML tags are stripped to plain text

### Platform-Specific Features

The speechmarkdown-js library supports platform-specific Speech Markdown features:

- **Microsoft Azure**: 33 express-as styles with intensity control, language switching, HD voices
- **Amazon Polly**: Emotional styles, voice effects, language support
- **Google Cloud**: Style tags, language support
- **WitAI**: Full SSML support
- **And more**: Each platform has optimized Speech Markdown support

### Usage

```typescript
// Use Speech Markdown with any engine
const markdown =
  "Hello [500ms] world! ++This text is emphasized++ (slowly)[rate:\"slow\"] (high)[pitch:\"high\"] (loudly)[volume:\"loud\"]";
await tts.speak(markdown, { useSpeechMarkdown: true });

// Platform-specific Speech Markdown features
// Azure: Emotional styles with intensity
const azureMarkdown = "(This is exciting!)[excited:\"1.5\"]";
await azureTts.speak(azureMarkdown, { useSpeechMarkdown: true });

// Speech Markdown works with all engines
const ttsGoogle = new TTSClient('google');
const ttsElevenLabs = new TTSClient('elevenlabs');

// Both will handle Speech Markdown appropriately
await ttsGoogle.speak(markdown, { useSpeechMarkdown: true });     // Converts to SSML
await ttsElevenLabs.speak(markdown, { useSpeechMarkdown: true }); // Converts to plain text
```

### Supported Speech Markdown Elements

- `[500ms]` or `[break:"500ms"]` - Pauses/breaks
- `++text++` or `+text+` - Text emphasis
- `(text)[rate:"slow"]` - Speech rate control
- `(text)[pitch:"high"]` - Pitch control
- `(text)[volume:"loud"]` - Volume control
- **Platform-specific**: See [speechmarkdown-js documentation](https://github.com/speechmarkdown/speechmarkdown-js) for platform-specific features like Azure's express-as styles


### Node & CI: Configuring the Speech Markdown Converter

The full **speechmarkdown-js** converter now loads by default in both Node and browser environments. If you need to opt out (for very small lambda bundles or for deterministic tests), you can:

```bash
# Disable globally
SPEECHMARKDOWN_DISABLE=true npm test

# Or force-enable/disable explicitly
SPEECHMARKDOWN_ENABLE=false npm test
SPEECHMARKDOWN_ENABLE=true npm test
```

Or disable/enable programmatically:

```ts
import { SpeechMarkdown } from "js-tts-wrapper";

SpeechMarkdown.configureSpeechMarkdown({ enabled: false }); // fallback-only
SpeechMarkdown.configureSpeechMarkdown({ enabled: true });  // ensure full parser
```

When disabled, js-tts-wrapper falls back to the lightweight built-in converter (suitable for basic `[break]` patterns). Re-enable it to regain advanced tags (Azure express-as, Polly styles, google:style, etc.).

### Engine Compatibility

| Engine | Speech Markdown Support | Processing Method |
|--------|------------------------|-------------------|
| Google Cloud TTS | ✅ Full | → SSML → Native processing |
| Microsoft Azure | ✅ Full | → SSML → Native processing |
| Amazon Polly | ✅ Full | → SSML → Dynamic processing (engine-dependent) |
| WitAI | ✅ Full | → SSML → Native processing |
| SAPI | ✅ Full | → SSML → Native processing |
| eSpeak | ✅ Full | → SSML → Native processing |
| ElevenLabs | ✅ Converted | → SSML → Plain text |
| OpenAI | ✅ Converted | → SSML → Plain text |
| PlayHT | ✅ Converted | → SSML → Plain text |
| SherpaOnnx | ✅ Converted | → SSML → Plain text |

### Speech Markdown vs Raw SSML: When to Use Each

The library provides two complementary approaches for controlling speech synthesis:

| Approach | Use Case | Example |
|----------|----------|---------|
| **Speech Markdown** | Easy, readable syntax for common features | `(Hello!)[excited:"1.5"]` |
| **Raw SSML** | Direct control, advanced features, provider-specific tags | `<mstts:express-as style="friendly">Hello!</mstts:express-as>` |

**Speech Markdown Flow:**
```
Speech Markdown → speechmarkdown-js → Platform-specific SSML → Provider
```

**Raw SSML Flow:**
```
Raw SSML → Minimal processing → Provider
```

**When to use Speech Markdown:**
- You want readable, maintainable code
- You're using common features (breaks, emphasis, rate, pitch, volume)
- You want platform-specific optimizations automatically applied
- You want the same code to work across multiple TTS engines

**When to use Raw SSML with `rawSSML: true`:**
- You need advanced provider-specific features (e.g., Azure's mstts:dialog for multi-speaker)
- You're working with SSML generated by other tools
- You need fine-grained control over SSML structure
- You want to bypass validation for experimental features

**Combining both approaches:**
```typescript
// Use speechmarkdown-js directly for advanced features
import { SpeechMarkdown } from 'speechmarkdown-js';

const markdown = "(This is exciting!)[excited:\"1.5\"] with (multi-speaker)[mstts:dialog]";
const ssml = await SpeechMarkdown.toSSML(markdown, "microsoft-azure");

// Pass the result with rawSSML to bypass wrapper validation
await tts.speak(ssml, { rawSSML: true });
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

Note: Google Cloud TTS supports both authentication methods — Service Account (Node SDK) and API key (REST, browser‑safe).


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

#### API key mode (Node or Browser)

Google Cloud Text-to-Speech also supports an API key over the REST API. This is browser-safe and requires no service account file. Restrict the key in Google Cloud Console (enable only Text-to-Speech API and restrict by HTTP referrer for browser use).

ESM (Node or Browser):
```javascript
import { GoogleTTSClient } from 'js-tts-wrapper';

const tts = new GoogleTTSClient({
  apiKey: process.env.GOOGLECLOUDTTS_API_KEY || 'your-api-key',
  // optional defaults
  voiceId: 'en-US-Wavenet-D',
  lang: 'en-US'
});

await tts.speak('Hello from Google TTS with API key!');
```

CommonJS (Node):
```javascript
const { GoogleTTSClient } = require('js-tts-wrapper');

const tts = new GoogleTTSClient({
  apiKey: process.env.GOOGLECLOUDTTS_API_KEY || 'your-api-key'
});

(async () => {
  await tts.speak('Hello from Google TTS with API key!');
})();
```

Notes:
- REST v1 does not return word timepoints; the wrapper provides estimated timings for boundary events.
- For true timings, use service account credentials (Node) where the beta client can be used.
- Environment variable supported by examples/tests: `GOOGLECLOUDTTS_API_KEY`.


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
import { EspeakNodeTTSClient } from 'js-tts-wrapper';

const tts = new EspeakNodeTTSClient();

await tts.speak('Hello from eSpeak NG!');
```

#### CommonJS
```javascript
const { EspeakNodeTTSClient } = require('js-tts-wrapper');

const tts = new EspeakNodeTTSClient();

// Inside an async function
await tts.speak('Hello from eSpeak NG!');
```

> **Note**: This engine uses the `text2wav` package and is designed for Node.js environments only. For browser environments, use the eSpeak NG Browser engine instead.

### eSpeak NG (Browser)

#### ESM
```javascript
import { EspeakBrowserTTSClient } from 'js-tts-wrapper';

const tts = new EspeakBrowserTTSClient();

await tts.speak('Hello from eSpeak NG Browser!');
```

#### CommonJS
```javascript
const { EspeakBrowserTTSClient } = require('js-tts-wrapper');

const tts = new EspeakBrowserTTSClient();

// Inside an async function
await tts.speak('Hello from eSpeak NG Browser!');
```

> **Note**: This engine works in both Node.js (using the `mespeak` package) and browser environments (using meSpeak.js). For browser use, include meSpeak.js in your HTML before using this engine.

#### Backward Compatibility

For backward compatibility, the old class names are still available:
- `EspeakTTSClient` (alias for `EspeakNodeTTSClient`)
- `EspeakWasmTTSClient` (alias for `EspeakBrowserTTSClient`)

However, we recommend using the new, clearer names in new code.

### Windows SAPI (Windows-only)

#### ESM
```javascript
import { SAPITTSClient } from 'js-tts-wrapper';

const tts = new SAPITTSClient();

await tts.speak('Hello from Windows SAPI!');
```

#### CommonJS
```javascript
const { SAPITTSClient } = require('js-tts-wrapper');

const tts = new SAPITTSClient();

// Inside an async function
await tts.speak('Hello from Windows SAPI!');
```

> **Note**: This engine is **Windows-only**

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

### SherpaOnnx-WASM (Browser) – options and capabilities

- Auto-load WASM: pass either `wasmBaseUrl` (directory with sherpaonnx.js + .wasm) or `wasmPath` (full glue JS URL). The runtime loads the glue and points Module.locateFile to fetch the .wasm.
- Models index: set `mergedModelsUrl` to your hosted merged_models.json (defaults to ./data/merged_models.json when available).
- Capabilities: each client exposes `client.capabilities` to help UIs filter engines.

```html
<script type="module">
  import { SherpaOnnxWasmTTSClient } from 'js-tts-wrapper/browser';
  const tts = new SherpaOnnxWasmTTSClient({
    wasmBaseUrl: '/assets/sherpaonnx',            // or: wasmPath: '/assets/sherpaonnx/sherpaonnx.js'
    mergedModelsUrl: '/assets/data/merged_models.json',
  });
  console.log(tts.capabilities); // { browserSupported: true, nodeSupported: false, needsWasm: true }
  await tts.speak('Hello from SherpaONNX WASM');
</script>
```

#### Hosted WASM assets (optional)

For convenience, we publish prebuilt SherpaONNX TTS WebAssembly files to a separate assets repository. You can use these as a quick-start base URL, or self-host them for production.

- Default CDN base (via jsDelivr):
  - https://cdn.jsdelivr.net/gh/willwade/js-tts-wrapper-assets@main/sherpaonnx/tts/vocoder-models
  - Files included (loader-only build: no .data file):
    - sherpa-onnx-tts.js (glue; sometimes named sherpa-onnx.js depending on upstream tag)
    - sherpa-onnx-wasm-main-tts.wasm (or sherpa-onnx-wasm-main.wasm)
    - sherpa-onnx-wasm-main-tts.js (or sherpa-onnx-wasm-main.js)


- Models index (merged_models.json):
  - Canonical latest: https://cdn.jsdelivr.net/gh/willwade/js-tts-wrapper-assets@main/sherpaonnx/models/merged_models.json
  - Snapshot for this WASM tag: https://cdn.jsdelivr.net/gh/willwade/js-tts-wrapper-assets@main/sherpaonnx/tts/<sherpa_tag>/merged_models.json

- Example (using hosted artifacts):

```html
<script type="module">
  import { SherpaOnnxWasmTTSClient } from 'js-tts-wrapper/browser';

  const base = 'https://cdn.jsdelivr.net/gh/willwade/js-tts-wrapper-assets@main/sherpaonnx/tts/<sherpa_tag>';

  const tts = new SherpaOnnxWasmTTSClient({
    // Prefer explicit glue filename from upstream
    wasmPath: `${base}/sherpa-onnx-tts.js`,
    // Use canonical models index (or the per-tag snapshot URL)
    mergedModelsUrl: 'https://cdn.jsdelivr.net/gh/willwade/js-tts-wrapper-assets@main/sherpaonnx/models/merged_models.json',
  });

  await tts.speak('Hello from SherpaONNX WASM');
</script>
```

Notes:

#### Hosting on Hugging Face (avoids jsDelivr 50 MB cap)

You can self-host the loader-only WASM on Hugging Face (recommended for large artifacts):

- Create a Dataset or Model repo, e.g. datasets/willwade/js-tts-wrapper-wasm
- Upload these files into a folder like sherpaonnx/tts/vocoder-models:
  - sherpa-onnx-tts.js
  - sherpa-onnx-wasm-main-tts.wasm
  - (optionally) sherpa-onnx-wasm-main-tts.js
- Optional: also upload merged_models.json to sherpaonnx/models/merged_models.json
- Use the Hugging Face raw URLs with the “resolve” path:
  - wasmPath: https://huggingface.co/datasets/your-user/your-repo/resolve/main/sherpaonnx/tts/vocoder-models/sherpa-onnx-tts.js
  - mergedModelsUrl: https://huggingface.co/datasets/your-user/your-repo/resolve/main/sherpaonnx/models/merged_models.json

Example:

```html
<script type="module">
  import { SherpaOnnxWasmTTSClient } from 'js-tts-wrapper/browser';
  const tts = new SherpaOnnxWasmTTSClient({
    wasmPath: 'https://huggingface.co/datasets/your-user/your-repo/resolve/main/sherpaonnx/tts/vocoder-models/sherpa-onnx-tts.js',
    mergedModelsUrl: 'https://huggingface.co/datasets/your-user/your-repo/resolve/main/sherpaonnx/models/merged_models.json'
  });
  await tts.speak('Hello from SherpaONNX WASM hosted on HF');
</script>
```

Notes:
- Hugging Face supports large files via Git LFS and serves them over a global CDN with proper CORS.
- The glue JS will fetch the .wasm next to it automatically; ensure correct MIME types are served (HF does this by default).
- For best performance, keep models separate and load them at runtime via their original URLs (or mirror selected ones to HF if needed).

- For production, we recommend self-hosting to ensure stable availability and correct MIME types (application/wasm for .wasm, text/javascript for .js). If your server uses different filenames, just point `wasmPath` at your glue JS file; the runtime will find the .wasm next to it.
- Our engine also accepts `wasmBaseUrl` if you host with filenames matching your environment; when using the upstream build outputs shown above, `wasmPath` is the safest choice.

## Examples and Demos

- Vue.js Browser Demo (recommended for browsers)
  - Path: examples/vue-browser-demo/
  - Run locally:
    - cd examples/vue-browser-demo
    - npm install
    - npm run dev
  - Notes: The Vite config aliases js-tts-wrapper/browser to the workspace source for local development. For production, you can import from the published package directly.

- Browser Unified Test Page (quick, no build)
  - Path: examples/browser-unified-test.html
  - Open this file directly in a modern browser. It exercises multiple engines and shows real-time word highlighting.

- Node.js CLI Demo
  - Path: examples/node-demo/
  - Run: node demo.mjs [--engine <name>] [--text "Hello"]
  - Shows boundary callbacks and file/bytes synthesis from Node. Engines requiring credentials read them from environment variables.

SherpaONNX notes
- Browser (WASM): The demos accept wasmPath/mergedModelsUrl. You can use the hosted assets shown in the Browser Support section (jsDelivr or Hugging Face resolve URLs).
- Node (native): If SHERPAONNX_MODEL_PATH is not set, the wrapper now defaults to a Kokoro English model (kokoro-en-en-19) and will auto-download on first use.



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
npx js-tts-wrapper@latest run install:system

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

### Unified Test Runner

The library includes a comprehensive unified test runner that supports multiple testing modes and engines:

```bash
# Basic usage - test all engines
node examples/unified-test-runner.js

# Test a specific engine
node examples/unified-test-runner.js [engine-name]

# Test with different modes
node examples/unified-test-runner.js [engine-name] --mode=[MODE]
```

### Available Test Modes

| Mode | Description | Usage |
|------|-------------|-------|
| `basic` | Basic synthesis tests (default) | `node examples/unified-test-runner.js azure` |
| `audio` | Audio-only tests with playback | `PLAY_AUDIO=true node examples/unified-test-runner.js azure --mode=audio` |
| `playback` | Playback control tests (pause/resume/stop) | `node examples/unified-test-runner.js azure --mode=playback` |
| `features` | Comprehensive feature tests | `node examples/unified-test-runner.js azure --mode=features` |
| `example` | Full examples with SSML, streaming, word boundaries | `node examples/unified-test-runner.js azure --mode=example` |
| `debug` | Debug mode for troubleshooting | `node examples/unified-test-runner.js sherpaonnx --mode=debug` |
| `stream` | Streaming tests with real-time playback | `PLAY_AUDIO=true node examples/unified-test-runner.js playht --mode=stream` |

### Testing Audio Playback

To test audio playback with any TTS engine, use the `PLAY_AUDIO` environment variable:

```bash
# Test a specific engine with audio playback
PLAY_AUDIO=true node examples/unified-test-runner.js [engine-name] --mode=audio

# Examples:
PLAY_AUDIO=true node examples/unified-test-runner.js witai --mode=audio
PLAY_AUDIO=true node examples/unified-test-runner.js azure --mode=audio
PLAY_AUDIO=true node examples/unified-test-runner.js polly --mode=audio
PLAY_AUDIO=true node examples/unified-test-runner.js system --mode=audio
```

### SherpaOnnx Specific Testing

SherpaOnnx requires special environment setup. Use the helper script:

```bash
# Test SherpaOnnx with audio playback
PLAY_AUDIO=true node scripts/run-with-sherpaonnx.cjs examples/unified-test-runner.js sherpaonnx --mode=audio

# Debug SherpaOnnx issues
node scripts/run-with-sherpaonnx.cjs examples/unified-test-runner.js sherpaonnx --mode=debug

# Use npm scripts (recommended)
npm run example:sherpaonnx:mac
PLAY_AUDIO=true npm run example:sherpaonnx:mac
```

### Using npm Scripts

The package provides convenient npm scripts for testing specific engines:

```bash
# Test specific engines using npm scripts
npm run example:azure
npm run example:google
npm run example:polly
npm run example:openai
npm run example:elevenlabs
npm run example:playht
npm run example:system
npm run example:sherpaonnx:mac  # For SherpaOnnx with environment setup

# With audio playback
PLAY_AUDIO=true npm run example:azure
PLAY_AUDIO=true npm run example:system
PLAY_AUDIO=true npm run example:sherpaonnx:mac
```

### Getting Help

For detailed help and available options:

```bash
# Show help and available engines
node examples/unified-test-runner.js --help

# Show available test modes
node examples/unified-test-runner.js --mode=help
```

### Audio Format Conversion

The library includes **automatic format conversion** for engines that don't natively support the requested format:

```javascript
// Request MP3, get MP3 if supported, WAV with warning if not
const audioBytes = await client.synthToBytes("Hello world", { format: "mp3" });
await client.synthToFile("Hello world", "output", "mp3");
await client.speak("Hello world", { format: "mp3" });
```

**Supported Formats**: WAV, MP3, OGG

**Engine Behavior**:
- **Native Support**: Azure, Polly, PlayHT support multiple formats natively
- **Automatic Conversion**: SAPI, SherpaOnnx convert from WAV when possible
- **Graceful Fallback**: Returns native format with helpful warnings when conversion isn't available

**Environment Support**:
- **Node.js**: Full format conversion support (install `ffmpeg` for advanced conversions)
- **Browser**: Engines return their native format (no conversion)

### Common Issues

1. **No Audio in Node.js**: Install audio dependencies with `npm install sound-play speaker pcm-convert`
2. **SherpaOnnx Not Working**: Use the helper script and ensure environment variables are set correctly
3. **WitAI Audio Issues**: The library automatically handles WitAI's raw PCM format conversion
4. **Sample Rate Issues**: Different engines use different sample rates (WitAI: 24kHz, Polly: 16kHz) - this is handled automatically
5. **Format Conversion**: Install `ffmpeg` for advanced audio format conversion in Node.js

For detailed troubleshooting, see the [docs/](docs/) directory, especially:
- [SherpaOnnx Documentation](docs/sherpaonnx.md)
- [SherpaOnnx Troubleshooting](docs/sherpaonnx-troubleshooting.md)

## License

This project is licensed under the MIT License - see the LICENSE file for details.
