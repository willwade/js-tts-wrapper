# Testing and Examples

This document explains how to test the TTS wrapper and run examples for different TTS engines.

## Prerequisites

Before running tests or examples, make sure you have set up the necessary environment variables for the TTS engines you want to test:

### Azure TTS
```
MICROSOFT_TOKEN=your_azure_subscription_key
MICROSOFT_REGION=your_azure_region
```

### ElevenLabs TTS
```
ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

### Google TTS
```
GOOGLE_APPLICATION_CREDENTIALS=path_to_your_google_credentials_json
# or
GOOGLE_SA_PATH=path_to_your_google_service_account_json
```

You can set these environment variables in a `.env` file in the root of the project.

## Running Tests

The project includes a unified test framework that can test all TTS engines or specific engines.

### Credential Validation

Before running tests, the framework automatically validates your credentials for each TTS engine using the `checkCredentials()` method. This ensures that only engines with valid credentials are tested.

### Testing All Engines

To test all available TTS engines:

```bash
npm run test:tts
```

This will run tests for all engines for which you have provided valid credentials.

### Testing Specific Engines

To test a specific TTS engine:

```bash
# Test Azure TTS
npm run test:azure

# Test ElevenLabs TTS
npm run test:elevenlabs

# Test Google TTS
npm run test:google
```

If your credentials for the specified engine are invalid, the tests will be skipped with a clear message.

## Running Examples

The project includes a unified example framework that can demonstrate all TTS engines or specific engines.

### Credential Validation

Before running examples, the framework automatically validates your credentials for each TTS engine using the `checkCredentials()` method. This ensures that only engines with valid credentials are demonstrated.

### Running Examples for All Engines

To run examples for all available TTS engines:

```bash
npm run example
```

This will run examples for all engines for which you have provided valid credentials.

### Running Examples for Specific Engines

To run an example for a specific TTS engine:

```bash
# Run Azure TTS example
npm run example:azure

# Run ElevenLabs TTS example
npm run example:elevenlabs

# Run Google TTS example
npm run example:google
```

If your credentials for the specified engine are invalid, the example will be skipped with a clear message.

## Adding a New TTS Engine

To add a new TTS engine to the unified test and example framework:

1. Create a new engine implementation in `src/engines/`
2. Implement the `_getVoices()` method to retrieve voices from the provider
3. Implement the `_mapVoicesToUnified()` method to map the raw voice data to a unified format
4. Implement the `checkCredentials()` method to validate credentials (or use the default implementation)
5. Update the factory function in `src/__tests__/tts-engine.test.ts` to include your new engine
6. Update the factory function in `examples/tts-example.js` to include your new engine
7. Add the new engine to the `validEngines` array in `run-tts-tests.js`
8. Add new npm scripts in `package.json` for testing and running examples with your engine

## Test Coverage

The tests cover the following functionality for each TTS engine:

- Listing available voices
- Getting voices by language
- Setting and getting properties
- Synthesizing text using non-streaming approach
- Synthesizing SSML to speech (for engines that support SSML)
- Synthesizing text using streaming approach
- Handling word boundary events

## Example Functionality

The examples demonstrate the following functionality for each TTS engine:

- Listing available voices
- Getting voices by language
- Setting a voice
- Converting text to speech
- Converting SSML to speech (for engines that support SSML)
- Converting text to speech using streaming
- Handling word boundary events
