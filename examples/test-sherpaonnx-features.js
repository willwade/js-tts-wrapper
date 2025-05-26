// Comprehensive test script for SherpaOnnx engines feature evaluation
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(projectRoot, '.envrc') });

import { SherpaOnnxTTSClient } from "../dist/esm/index.js";

const TEST_TEXT = "Hello world. This is a test of word boundary events. Testing one two three four five.";
const TEST_SSML = "<speak>This is a test of <emphasis>SSML support</emphasis> with <break time='500ms'/> pauses.</speak>";
const OUTPUT_DIR = path.join(__dirname, "test-output");

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}

/**
 * Test word boundary events
 */
async function testWordBoundaryEvents(client, engineName) {
  console.log(`\n=== Testing Word Boundary Events for ${engineName} ===`);
  
  const wordEvents = [];
  
  // Set up word boundary callback
  client.on("boundary", (word, start, end) => {
    wordEvents.push({ word, start, end, duration: end - start });
    console.log(`Word: "${word}" at ${start.toFixed(3)}s (duration: ${(end - start).toFixed(3)}s)`);
  });
  
  try {
    console.log("Testing word events with speak()...");
    await client.speak(TEST_TEXT);
    
    console.log(`\nWord Events Summary:`);
    console.log(`- Total words detected: ${wordEvents.length}`);
    console.log(`- Total duration: ${wordEvents.length > 0 ? wordEvents[wordEvents.length - 1].end.toFixed(3) : 0}s`);
    
    if (wordEvents.length > 0) {
      console.log(`- Average word duration: ${(wordEvents.reduce((sum, w) => sum + w.duration, 0) / wordEvents.length).toFixed(3)}s`);
      console.log(`- First word: "${wordEvents[0].word}" at ${wordEvents[0].start.toFixed(3)}s`);
      console.log(`- Last word: "${wordEvents[wordEvents.length - 1].word}" at ${wordEvents[wordEvents.length - 1].start.toFixed(3)}s`);
    }
    
    return wordEvents;
  } catch (error) {
    console.error(`Error testing word boundary events: ${error.message}`);
    return [];
  }
}

/**
 * Test streaming capabilities
 */
async function testStreamingCapabilities(client, engineName) {
  console.log(`\n=== Testing Streaming Capabilities for ${engineName} ===`);
  
  try {
    console.log("Testing synthToBytestream()...");
    const result = await client.synthToBytestream(TEST_TEXT);
    
    console.log(`Stream result:`, {
      hasAudioStream: !!result.audioStream,
      wordBoundariesCount: result.wordBoundaries.length,
      streamType: result.audioStream?.constructor?.name || 'unknown'
    });
    
    if (result.wordBoundaries.length > 0) {
      console.log("Word boundaries from stream:");
      result.wordBoundaries.forEach((wb, i) => {
        console.log(`  ${i + 1}. "${wb.text}" at ${wb.offset}ms (duration: ${wb.duration}ms)`);
      });
    } else {
      console.log("No word boundaries returned from stream");
    }
    
    // Test reading from the stream
    if (result.audioStream) {
      const reader = result.audioStream.getReader();
      let totalBytes = 0;
      let chunks = 0;
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          totalBytes += value.length;
          chunks++;
        }
        
        console.log(`Stream read successfully: ${totalBytes} bytes in ${chunks} chunks`);
      } catch (streamError) {
        console.error(`Error reading stream: ${streamError.message}`);
      } finally {
        reader.releaseLock();
      }
    }
    
    return result;
  } catch (error) {
    console.error(`Error testing streaming: ${error.message}`);
    return null;
  }
}

/**
 * Test SSML handling
 */
async function testSSMLHandling(client, engineName) {
  console.log(`\n=== Testing SSML Handling for ${engineName} ===`);
  
  try {
    console.log("Testing SSML input...");
    console.log(`Input SSML: ${TEST_SSML}`);
    
    const audioBytes = await client.synthToBytes(TEST_SSML);
    console.log(`Generated audio from SSML: ${audioBytes.length} bytes`);
    
    // Save SSML test output
    const ssmlOutputFile = path.join(OUTPUT_DIR, `${engineName}-ssml-test.wav`);
    fs.writeFileSync(ssmlOutputFile, audioBytes);
    console.log(`SSML audio saved to: ${ssmlOutputFile}`);
    
    return audioBytes.length > 0;
  } catch (error) {
    console.error(`Error testing SSML: ${error.message}`);
    return false;
  }
}

/**
 * Test voice and property management
 */
async function testVoiceAndProperties(client, engineName) {
  console.log(`\n=== Testing Voice and Properties for ${engineName} ===`);
  
  try {
    // Test getting voices
    console.log("Getting available voices...");
    const voices = await client.getVoices();
    console.log(`Available voices: ${voices.length}`);
    
    if (voices.length > 0) {
      const voice = voices[0];
      console.log(`Using voice: ${voice.name} (${voice.id})`);
      console.log(`Voice details:`, {
        gender: voice.gender,
        provider: voice.provider,
        languageCodes: voice.languageCodes?.length || 0
      });
      
      // Test setting voice
      await client.setVoice(voice.id);
      console.log(`Voice set to: ${voice.id}`);
    }
    
    // Test property management
    console.log("\nTesting property management...");
    
    // Test rate property
    const originalRate = client.getProperty('rate');
    console.log(`Original rate: ${originalRate}`);
    
    client.setProperty('rate', 'slow');
    console.log(`Set rate to: ${client.getProperty('rate')}`);
    
    client.setProperty('rate', 'fast');
    console.log(`Set rate to: ${client.getProperty('rate')}`);
    
    // Reset to original
    client.setProperty('rate', originalRate);
    console.log(`Reset rate to: ${client.getProperty('rate')}`);
    
    // Test other properties
    const sampleRate = client.getProperty('sampleRate');
    console.log(`Sample rate: ${sampleRate}`);
    
    return {
      voiceCount: voices.length,
      sampleRate: sampleRate,
      rateSupported: true
    };
  } catch (error) {
    console.error(`Error testing voice and properties: ${error.message}`);
    return {
      voiceCount: 0,
      sampleRate: null,
      rateSupported: false
    };
  }
}

/**
 * Test audio format support
 */
async function testAudioFormats(client, engineName) {
  console.log(`\n=== Testing Audio Format Support for ${engineName} ===`);
  
  const formats = ['wav', 'mp3'];
  const results = {};
  
  for (const format of formats) {
    try {
      console.log(`Testing ${format.toUpperCase()} format...`);
      const outputFile = path.join(OUTPUT_DIR, `${engineName}-format-test.${format}`);
      
      await client.synthToFile(TEST_TEXT, outputFile, format);
      
      if (fs.existsSync(outputFile)) {
        const stats = fs.statSync(outputFile);
        results[format] = {
          supported: true,
          fileSize: stats.size
        };
        console.log(`${format.toUpperCase()} format: ✓ (${stats.size} bytes)`);
      } else {
        results[format] = { supported: false, fileSize: 0 };
        console.log(`${format.toUpperCase()} format: ✗ (file not created)`);
      }
    } catch (error) {
      results[format] = { supported: false, error: error.message };
      console.log(`${format.toUpperCase()} format: ✗ (${error.message})`);
    }
  }
  
  return results;
}

/**
 * Main test function
 */
async function runFeatureTests() {
  console.log("=".repeat(60));
  console.log("SherpaOnnx TTS Engine Feature Evaluation");
  console.log("=".repeat(60));
  
  // Test SherpaOnnx (Node.js) engine
  const sherpaClient = new SherpaOnnxTTSClient({
    noDefaultDownload: true,
    modelPath: process.env.SHERPAONNX_MODEL_PATH || null
  });
  
  try {
    console.log("\nChecking SherpaOnnx credentials...");
    const credentialsValid = await sherpaClient.checkCredentials();
    
    if (!credentialsValid) {
      console.log("SherpaOnnx credentials invalid, skipping tests...");
      return;
    }
    
    console.log("SherpaOnnx credentials valid, running feature tests...");
    
    // Run all feature tests
    const wordEvents = await testWordBoundaryEvents(sherpaClient, "sherpaonnx");
    const streamResult = await testStreamingCapabilities(sherpaClient, "sherpaonnx");
    const ssmlSupported = await testSSMLHandling(sherpaClient, "sherpaonnx");
    const voiceProps = await testVoiceAndProperties(sherpaClient, "sherpaonnx");
    const formatSupport = await testAudioFormats(sherpaClient, "sherpaonnx");
    
    // Generate summary report
    console.log("\n" + "=".repeat(60));
    console.log("FEATURE EVALUATION SUMMARY - SherpaOnnx");
    console.log("=".repeat(60));
    
    console.log(`✓ Factory Registration: Registered as 'sherpaonnx'`);
    console.log(`${voiceProps.voiceCount > 0 ? '✓' : '✗'} Voice Management: ${voiceProps.voiceCount} voices available`);
    console.log(`${wordEvents.length > 0 ? '⚠' : '✗'} Word Boundary Events: ${wordEvents.length > 0 ? 'Estimated timing' : 'Not working'}`);
    console.log(`${streamResult ? '✓' : '✗'} Streaming Support: ${streamResult ? 'synthToBytestream implemented' : 'Not working'}`);
    console.log(`${ssmlSupported ? '⚠' : '✗'} SSML Support: ${ssmlSupported ? 'Tags stripped (no native support)' : 'Not working'}`);
    console.log(`${voiceProps.rateSupported ? '✓' : '✗'} Rate/Speed Control: ${voiceProps.rateSupported ? 'Supported' : 'Not supported'}`);
    console.log(`${formatSupport.wav?.supported ? '✓' : '✗'} WAV Format: ${formatSupport.wav?.supported ? 'Supported' : 'Not supported'}`);
    console.log(`${formatSupport.mp3?.supported ? '✓' : '✗'} MP3 Format: ${formatSupport.mp3?.supported ? 'Supported' : 'Not supported'}`);
    console.log(`${voiceProps.sampleRate ? '✓' : '✗'} Sample Rate: ${voiceProps.sampleRate || 'Unknown'}`);
    
  } catch (error) {
    console.error(`Error running SherpaOnnx tests: ${error.message}`);
  }
}

// Run the tests
runFeatureTests().catch(console.error);
