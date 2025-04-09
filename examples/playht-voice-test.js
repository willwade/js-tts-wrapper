/**
 * Test script to check for duplicate voice IDs in PlayHT
 */

const { PlayHTTTSClient } = require('../dist');

// Create a PlayHT client
const playht = new PlayHTTTSClient({
  apiKey: process.env.PLAYHT_API_KEY,
  userId: process.env.PLAYHT_USER_ID
});

// Function to check for duplicate voice IDs
async function checkDuplicateVoiceIds() {
  try {
    // Check if credentials are valid
    const isValid = await playht.checkCredentials();
    if (!isValid) {
      console.error('PlayHT credentials are not valid');
      return;
    }

    // Get all voices
    const voices = await playht.getVoices();
    console.log(`Found ${voices.length} voices`);

    // Check for duplicate IDs
    const voiceIds = voices.map(voice => voice.id);
    const uniqueVoiceIds = new Set(voiceIds);

    console.log(`Unique voice IDs: ${uniqueVoiceIds.size}`);

    if (uniqueVoiceIds.size < voiceIds.length) {
      console.log('Found duplicate voice IDs:');

      // Find the duplicate IDs
      const duplicateIds = voiceIds.filter((id, index) => voiceIds.indexOf(id) !== index);
      const uniqueDuplicateIds = [...new Set(duplicateIds)];

      console.log(`Number of duplicate IDs: ${uniqueDuplicateIds.length}`);

      // Print details about each duplicate
      uniqueDuplicateIds.forEach(id => {
        const duplicateVoices = voices.filter(voice => voice.id === id);
        console.log(`\nID: ${id}`);
        duplicateVoices.forEach((voice, index) => {
          console.log(`  Voice ${index + 1}:`);
          console.log(`    Name: ${voice.name}`);
          console.log(`    Gender: ${voice.gender}`);
          console.log(`    Language: ${voice.languageCodes[0].display}`);
        });
      });
    } else {
      console.log('No duplicate voice IDs found');
    }

    // Test setting a voice with a modified ID
    console.log('\nTesting voice selection with modified IDs:');
    // Find a voice ID that contains a '#' character (modified ID)
    const modifiedVoiceId = voices.find(voice => voice.id.includes('#'))?.id;

    if (modifiedVoiceId) {
      console.log(`Setting voice to modified ID: ${modifiedVoiceId}`);
      playht.setVoice(modifiedVoiceId);

      // Verify that the voice was set correctly
      console.log(`Current voice ID: ${playht.getProperty('voice')}`);
    } else {
      console.log('No modified voice IDs found');
    }
  } catch (error) {
    console.error('Error checking for duplicate voice IDs:', error);
  }
}

// Run the test
checkDuplicateVoiceIds();
