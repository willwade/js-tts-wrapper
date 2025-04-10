/**
 * Debug script for SherpaOnnx TTS
 */

const fs = require('fs');
const path = require('path');
const { SherpaOnnxTTSClient } = require('../dist');

// Create a SherpaOnnx client
const sherpaonnx = new SherpaOnnxTTSClient({});

// Function to check if a file is a valid audio file
function isValidAudio(filePath) {
  try {
    const stats = fs.statSync(filePath);
    // Check if file size is reasonable (more than 1KB)
    return stats.size > 1024;
  } catch (error) {
    return false;
  }
}

// Function to debug SherpaOnnx TTS
async function debugSherpaOnnx() {
  try {
    console.log('Debugging SherpaOnnx TTS...');
    
    // Check if credentials are valid
    console.log('Checking credentials...');
    const credentialsValid = await sherpaonnx.checkCredentials();
    if (!credentialsValid) {
      console.error('SherpaOnnx credentials are invalid or service is unavailable');
      return;
    }
    console.log('SherpaOnnx credentials are valid');
    
    // Get available voices
    console.log('Fetching available voices...');
    const voices = await sherpaonnx.getVoices();
    console.log(`Found ${voices.length} voices`);
    
    // Print the first few voices
    console.log('First few voices:');
    voices.slice(0, 5).forEach((voice, index) => {
      console.log(`${index + 1}. ${voice.name} (${voice.id})`);
    });
    
    // Find a voice to use
    const defaultVoice = voices.find(v => v.id === 'mms_eng') || voices[0];
    console.log(`\nUsing voice: ${defaultVoice.name} (${defaultVoice.id})`);
    
    // Set the voice
    await sherpaonnx.setVoice(defaultVoice.id);
    
    // Check if TTS is initialized
    console.log(`\nTTS initialized: ${sherpaonnx.tts ? 'Yes' : 'No'}`);
    if (!sherpaonnx.tts) {
      console.log('Using mock implementation');
    }
    
    // Check model paths
    console.log(`Model path: ${sherpaonnx.modelPath || 'Not set'}`);
    console.log(`Base directory: ${sherpaonnx.baseDir}`);
    
    // Generate audio with different text lengths
    const texts = [
      'Hello',
      'This is a test of SherpaOnnx TTS',
      'This is a longer test of SherpaOnnx Text to Speech synthesis with multiple sentences. It should generate a longer audio file.'
    ];
    
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      console.log(`\nGenerating audio for text ${i + 1}: "${text}"`);
      
      // Generate audio
      const outputPath = path.join(__dirname, `sherpaonnx-debug-${i + 1}.mp3`);
      try {
        const audioBytes = await sherpaonnx.synthToBytes(text, { format: 'mp3' });
        
        // Log audio details
        console.log(`Audio size: ${audioBytes.length} bytes`);
        console.log(`Sample rate: ${sherpaonnx.sampleRate} Hz`);
        
        // Save to file
        fs.writeFileSync(outputPath, Buffer.from(audioBytes));
        console.log(`Audio saved to ${outputPath}`);
        
        // Check if the audio file is valid
        if (isValidAudio(outputPath)) {
          console.log('Audio file appears to be valid');
        } else {
          console.warn('Audio file may be invalid or too small');
        }
      } catch (error) {
        console.error(`Error generating audio for text ${i + 1}:`, error);
      }
    }
    
    // Try generating audio with different formats
    const formats = ['mp3', 'wav'];
    for (const format of formats) {
      console.log(`\nGenerating audio in ${format} format`);
      const outputPath = path.join(__dirname, `sherpaonnx-debug-format-${format}.${format}`);
      
      try {
        const audioBytes = await sherpaonnx.synthToBytes('This is a test of SherpaOnnx TTS in ' + format + ' format', { format });
        fs.writeFileSync(outputPath, Buffer.from(audioBytes));
        console.log(`Audio saved to ${outputPath}`);
      } catch (error) {
        console.error(`Error generating ${format} audio:`, error);
      }
    }
    
    console.log('\nDebug complete');
  } catch (error) {
    console.error('Error debugging SherpaOnnx:', error);
  }
}

// Run the debug function
debugSherpaOnnx();
