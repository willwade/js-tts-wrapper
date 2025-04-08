const { SpeechMarkdown } = require('speechmarkdown-js');

const speech = new SpeechMarkdown();

// Test different Speech Markdown syntax
const tests = [
  { name: 'Break', markdown: 'Hello [3s] world' },
  { name: 'Break with quotes', markdown: 'Hello [break:"3s"] world' },
  { name: 'Emphasis', markdown: 'Hello *world*' },
  { name: 'Emphasis with format', markdown: 'Hello (emphasis:strong) world' },
  { name: 'Rate', markdown: 'Hello (rate:slow) world' },
  { name: 'Pitch', markdown: 'Hello (pitch:high) world' },
  { name: 'Volume', markdown: 'Hello (volume:loud) world' },
  { name: 'Multiple', markdown: 'Hello [3s] (pitch:high) (emphasis:strong) world' }
];

// Test with different platforms
const platforms = ['amazon-alexa', 'google-assistant', 'microsoft-azure'];

// Run tests
for (const test of tests) {
  console.log(`\n=== ${test.name} ===`);
  console.log(`Markdown: ${test.markdown}`);
  
  for (const platform of platforms) {
    const ssml = speech.toSSML(test.markdown, { platform });
    console.log(`\n${platform}:\n${ssml}`);
  }
}
