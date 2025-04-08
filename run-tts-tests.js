console.log('Running TTS engine tests...');

// Get engine name from command line arguments
const engineName = process.argv[2]?.toLowerCase() || 'all';
const validEngines = ['azure', 'elevenlabs', 'google', 'all'];

if (!validEngines.includes(engineName)) {
  console.error(`Error: Invalid engine name. Valid options are: ${validEngines.join(', ')}`);
  process.exit(1);
}

// Run the tests
try {
  const { execSync } = require('child_process');
  
  if (engineName === 'all') {
    // Run all tests
    execSync('npx jest src/__tests__/tts-engine.test.ts', { stdio: 'inherit' });
  } else {
    // Run tests for a specific engine
    execSync(`npx jest src/__tests__/tts-engine.test.ts -t "${engineName.toUpperCase()}"`, { stdio: 'inherit' });
  }
} catch (error) {
  console.error('Error running tests:', error);
  process.exit(1);
}
