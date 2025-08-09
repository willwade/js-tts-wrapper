#!/usr/bin/env node

/**
 * Word Boundary Events Demo
 * 
 * This example demonstrates the word boundary event system that enables
 * real-time word highlighting during speech synthesis - perfect for
 * applications like Grid3 that need precise speech synchronization.
 */

import { createTTSClient } from '../dist/cjs/factory.js';

async function demonstrateWordBoundaryEvents() {
  console.log('🎯 Word Boundary Events Demo');
  console.log('============================\n');
  console.log('This demo shows how to use word boundary events for real-time');
  console.log('word highlighting during speech synthesis.\n');
  
  const testText = "Hello world! This demonstrates precise timing events.";
  
  // Test with credential-free engines first
  const engines = [
    { name: 'eSpeak', id: 'espeak', description: 'Open-source TTS with estimated timing' },
    { name: 'SherpaOnnx', id: 'sherpaonnx', description: 'Neural TTS with estimated timing' },
    { name: 'SAPI', id: 'sapi', description: 'Windows Speech API with estimated timing' }
  ];
  
  for (const engine of engines) {
    console.log(`=== ${engine.name} Demo ===`);
    console.log(`${engine.description}\n`);
    
    try {
      const tts = createTTSClient(engine.id, {});
      
      // Set up word highlighting simulation
      const words = testText.split(/\s+/);
      let currentWordIndex = 0;
      
      console.log('📝 Text to speak:');
      console.log(`   "${testText}"\n`);
      
      console.log('🎵 Starting speech synthesis with word boundary events...\n');
      
      // Set up event listeners for real-time word highlighting
      tts.on('start', () => {
        console.log('🎵 Speech started - ready for word highlighting');
      });
      
      tts.on('boundary', (event) => {
        // Simulate word highlighting in a UI
        const highlightedText = words.map((word, index) => {
          if (word.toLowerCase().includes(event.text.toLowerCase())) {
            return `[${word}]`; // Highlight current word
          }
          return word;
        }).join(' ');
        
        console.log(`📍 Word: "${event.text}" | Time: ${(event.offset/10000).toFixed(3)}s | Duration: ${(event.duration/10000).toFixed(3)}s`);
        console.log(`   Highlighted: ${highlightedText}`);
      });
      
      tts.on('end', () => {
        console.log('🏁 Speech completed - word highlighting finished\n');
      });
      
      // Synthesize speech with word boundary events
      await tts.speak(testText, { 
        useWordBoundary: true,
        format: 'wav'
      });
      
      // Wait for all events to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.log(`❌ ${engine.name} failed: ${error.message}\n`);
    }
  }
  
  // Demonstrate ElevenLabs character-level timing (if credentials available)
  console.log('=== ElevenLabs Character-Level Timing Demo ===');
  console.log('Advanced character-level timing for maximum precision\n');
  
  try {
    const tts = createTTSClient('elevenlabs', {});
    const credentialsValid = await tts.checkCredentials();
    
    if (credentialsValid) {
      console.log('🎵 Testing ElevenLabs character-level timing...\n');
      
      tts.on('boundary', (event) => {
        console.log(`📍 Character-level: "${event.text}" | ${(event.offset/10000).toFixed(3)}s | ${(event.duration/10000).toFixed(3)}s`);
      });
      
      await tts.speak("Hello world", { 
        useTimestamps: true, // ElevenLabs character-level timing
        format: 'mp3'
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } else {
      console.log('⚠️  ElevenLabs credentials not available');
      console.log('   Set ELEVENLABS_API_KEY to test character-level timing\n');
    }
  } catch (error) {
    console.log(`⚠️  ElevenLabs test skipped: ${error.message}\n`);
  }
  
  // Usage instructions
  console.log('💡 Usage in Your Application');
  console.log('============================\n');
  console.log('```javascript');
  console.log('import { createTTSClient } from "js-tts-wrapper";');
  console.log('');
  console.log('const tts = createTTSClient("espeak");');
  console.log('');
  console.log('// Set up real-time word highlighting');
  console.log('tts.on("boundary", (event) => {');
  console.log('  highlightWord(event.text, event.offset, event.duration);');
  console.log('});');
  console.log('');
  console.log('// Start speech with word boundary events');
  console.log('await tts.speak("Your text here", { useWordBoundary: true });');
  console.log('```\n');
  
  console.log('🎯 Perfect for Grid3 and other applications requiring');
  console.log('   precise speech synchronization and word highlighting!');
}

demonstrateWordBoundaryEvents().catch(console.error);
