/**
 * Test script to verify that the fetch utility works correctly in different environments
 */

const { getFetch, isFetchAvailable } = require('../dist');

// Check if fetch is available
console.log('Is fetch available?', isFetchAvailable());

// Get the fetch implementation
const fetch = getFetch();
console.log('Fetch implementation type:', typeof fetch);

// Try to use fetch to make a request
async function testFetch() {
  try {
    console.log('Making a test request...');
    const response = await fetch('https://jsonplaceholder.typicode.com/todos/1');
    
    if (response.ok) {
      const data = await response.json();
      console.log('Request successful!');
      console.log('Response data:', data);
    } else {
      console.error('Request failed:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('Error making request:', error.message);
  }
}

// Run the test
testFetch();
