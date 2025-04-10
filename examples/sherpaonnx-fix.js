/**
 * Fix script for SherpaOnnx TTS
 * 
 * This script demonstrates how to properly set up the environment for SherpaOnnx TTS
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Function to find the sherpa-onnx library path
function findSherpaOnnxLibPath() {
  const platform = process.platform;
  const arch = process.arch;
  
  let libDir;
  if (platform === 'darwin') {
    // macOS
    libDir = arch === 'arm64' ? 'sherpa-onnx-darwin-arm64' : 'sherpa-onnx-darwin-x64';
  } else if (platform === 'linux') {
    // Linux
    libDir = arch === 'arm64' ? 'sherpa-onnx-linux-arm64' : 'sherpa-onnx-linux-x64';
  } else if (platform === 'win32') {
    // Windows
    libDir = 'sherpa-onnx-win32-x64';
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  
  // Check possible paths
  const possiblePaths = [
    path.join(process.cwd(), 'node_modules', libDir),
    path.join(__dirname, '..', 'node_modules', libDir)
  ];
  
  for (const libPath of possiblePaths) {
    if (fs.existsSync(libPath)) {
      return libPath;
    }
  }
  
  throw new Error(`Could not find sherpa-onnx library directory: ${libDir}`);
}

// Function to run a script with the correct environment variables
function runWithSherpaOnnx(scriptPath, ...args) {
  try {
    // Find the sherpa-onnx library path
    const libPath = findSherpaOnnxLibPath();
    console.log(`Found sherpa-onnx library at: ${libPath}`);
    
    // Set up environment variables based on platform
    const env = { ...process.env };
    
    if (process.platform === 'darwin') {
      // macOS uses DYLD_LIBRARY_PATH
      env.DYLD_LIBRARY_PATH = libPath + (env.DYLD_LIBRARY_PATH ? `:${env.DYLD_LIBRARY_PATH}` : '');
      console.log(`Set DYLD_LIBRARY_PATH to: ${env.DYLD_LIBRARY_PATH}`);
    } else if (process.platform === 'linux') {
      // Linux uses LD_LIBRARY_PATH
      env.LD_LIBRARY_PATH = libPath + (env.LD_LIBRARY_PATH ? `:${env.LD_LIBRARY_PATH}` : '');
      console.log(`Set LD_LIBRARY_PATH to: ${env.LD_LIBRARY_PATH}`);
    } else if (process.platform === 'win32') {
      // Windows uses PATH
      env.PATH = libPath + (env.PATH ? `;${env.PATH}` : '');
      console.log(`Set PATH to include: ${libPath}`);
    }
    
    // Create a simple test script
    const testScript = `
    const { SherpaOnnxTTSClient } = require('../dist');
    const fs = require('fs');
    const path = require('path');
    
    async function testSherpaOnnx() {
      try {
        console.log('Creating SherpaOnnx TTS client...');
        const tts = new SherpaOnnxTTSClient({});
        
        console.log('Checking credentials...');
        const valid = await tts.checkCredentials();
        console.log('Credentials valid:', valid);
        
        console.log('Getting voices...');
        const voices = await tts.getVoices();
        console.log(\`Found \${voices.length} voices\`);
        
        // Find a voice to use (preferably mms_eng)
        const voice = voices.find(v => v.id === 'mms_eng') || voices[0];
        console.log(\`Using voice: \${voice.name} (\${voice.id})\`);
        
        // Set the voice
        await tts.setVoice(voice.id);
        
        // Check if TTS is initialized
        console.log(\`TTS initialized: \${tts.tts ? 'Yes' : 'No'}\`);
        
        // Generate audio
        console.log('Generating audio...');
        const text = 'This is a test of SherpaOnnx Text to Speech synthesis.';
        const audioBytes = await tts.synthToBytes(text, { format: 'mp3' });
        
        // Save to file
        const outputPath = path.join(__dirname, 'sherpaonnx-fixed-output.mp3');
        fs.writeFileSync(outputPath, Buffer.from(audioBytes));
        console.log(\`Audio saved to \${outputPath}\`);
        
        // Print audio details
        console.log(\`Audio size: \${audioBytes.length} bytes\`);
        console.log(\`Sample rate: \${tts.sampleRate} Hz\`);
      } catch (error) {
        console.error('Error testing SherpaOnnx:', error);
      }
    }
    
    testSherpaOnnx();
    `;
    
    // Save the test script to a temporary file
    const tempScriptPath = path.join(__dirname, 'temp-sherpaonnx-test.js');
    fs.writeFileSync(tempScriptPath, testScript);
    
    console.log('Running test script with correct environment variables...');
    
    // Spawn a new Node.js process with the correct environment variables
    const child = spawn('node', [tempScriptPath], { 
      env,
      stdio: 'inherit'
    });
    
    // Clean up the temporary file when the process exits
    child.on('exit', (code) => {
      fs.unlinkSync(tempScriptPath);
      console.log(`Test script exited with code ${code}`);
      
      if (code === 0) {
        console.log('\nSuccess! SherpaOnnx TTS is now working correctly.');
        console.log('\nTo use SherpaOnnx TTS in your own scripts, you need to set the environment variable:');
        
        if (process.platform === 'darwin') {
          console.log(`export DYLD_LIBRARY_PATH=${libPath}:$DYLD_LIBRARY_PATH`);
        } else if (process.platform === 'linux') {
          console.log(`export LD_LIBRARY_PATH=${libPath}:$LD_LIBRARY_PATH`);
        } else if (process.platform === 'win32') {
          console.log(`set PATH=${libPath};%PATH%`);
        }
        
        console.log('\nOr use the provided helper script:');
        console.log('node scripts/run-with-sherpaonnx.js your-script.js');
      } else {
        console.log('\nFailed to run SherpaOnnx TTS. Please check the error messages above.');
      }
    });
  } catch (error) {
    console.error('Error setting up SherpaOnnx:', error);
  }
}

// Run the script
runWithSherpaOnnx();
