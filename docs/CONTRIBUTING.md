# Contributing to JS TTS Wrapper

Thank you for your interest in contributing to the JS TTS Wrapper project! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and considerate of others when contributing to this project.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/js-tts-wrapper.git`
3. Install dependencies: `npm install`
4. Create a branch for your changes: `git checkout -b feature/your-feature-name`

## Development Workflow

1. Make your changes
2. Run tests: `npm test`
3. Format your code: `npm run format`
4. Lint your code: `npm run lint`
5. Commit your changes: `git commit -m "Description of changes"`
6. Push to your fork: `git push origin feature/your-feature-name`
7. Create a pull request

## Pull Request Process

1. Ensure your code passes all tests
2. Update documentation if necessary
3. Add yourself to the contributors list if you're not already there
4. Submit your pull request

## Adding a New TTS Engine

To add a new TTS engine:

1. Create a new file in `src/engines/` for your engine
2. Implement the `AbstractTTSClient` interface
3. Add the engine to the factory functions in:
   - `src/__tests__/tts-engine.test.ts`
   - `examples/tts-example.js`
4. Add tests for your engine
5. Update documentation

See [TESTING.md](./TESTING.md) for more details on testing new engines.

## Environment Variables

For testing TTS engines, you'll need to set up environment variables with your API credentials. Create a `.env` file in the root directory with the following variables (as needed):

```
# Azure TTS
MICROSOFT_TOKEN=your-azure-subscription-key
MICROSOFT_REGION=your-azure-region

# ElevenLabs TTS
ELEVENLABS_API_KEY=your-elevenlabs-api-key

# Google TTS
GOOGLE_APPLICATION_CREDENTIALS=path/to/google-credentials.json
# or
GOOGLE_SA_PATH=path/to/google-credentials.json
```

## Code Style

This project uses Biome for code formatting and linting. Please follow the existing code style.

## Testing

See [TESTING.md](./TESTING.md) for details on testing.

## Releasing

See [RELEASING.md](./RELEASING.md) for details on the release process.
