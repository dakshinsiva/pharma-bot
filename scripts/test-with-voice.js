#!/usr/bin/env node
/**
 * Test Pharmacy Agent with Voice Recording
 * Records audio → STT → LLM → TTS → Play response
 */

require('dotenv').config();
const speech = require('@google-cloud/speech');
const fs = require('fs');
const axios = require('axios');
const { exec } = require('child_process');

const sttClient = new speech.SpeechClient();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

/**
 * Convert audio file to text using Google STT
 */
async function transcribeAudio(audioFile) {
  console.log(`🎤 Transcribing: ${audioFile}`);
  
  const audioBytes = fs.readFileSync(audioFile).toString('base64');
  
  const request = {
    audio: { content: audioBytes },
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode: 'ta-IN',
      alternativeLanguageCodes: ['en-IN'],
    },
  };

  const [response] = await sttClient.recognize(request);
  const transcription = response.results
    .map(result => result.alternatives[0].transcript)
    .join('\n');

  return transcription;
}

/**
 * Process with LLM
 */
async function processWithLLM(callId, transcript, customerName = 'Test User') {
  console.log(`🤖 Processing with LLM: "${transcript}"`);
  
  // Initialize if new call
  if (!global.sessionInitialized) {
    await axios.post(`${BASE_URL}/api/llm/init`, {
      callId,
      customerName,
    });
    global.sessionInitialized = true;
  }

  // Process transcript
  const response = await axios.post(`${BASE_URL}/api/llm/process`, {
    callId,
    transcript,
  });

  return response.data.response;
}

/**
 * Convert text to speech
 */
async function textToSpeech(text) {
  console.log(`🔊 Converting to speech: "${text.substring(0, 50)}..."`);
  
  const response = await axios.post(`${BASE_URL}/api/tts/tamil`, {
    text,
    format: 'base64',
  });

  return response.data.audio;
}

/**
 * Play audio
 */
function playAudio(audioBase64, filename = 'response.wav') {
  const buffer = Buffer.from(audioBase64, 'base64');
  fs.writeFileSync(filename, buffer);
  
  console.log(`🔊 Playing response...`);
  exec(`afplay ${filename}`, (error) => {
    if (error) {
      console.error('Error playing audio:', error);
    }
  });
}

/**
 * Main test flow
 */
async function testWithVoice(audioFile, callId = 'voice-test-' + Date.now()) {
  try {
    console.log('\n🎙️  Voice Test Starting...\n');
    console.log('='.repeat(60));

    // Step 1: Transcribe audio
    const transcript = await transcribeAudio(audioFile);
    console.log(`✅ You said: "${transcript}"`);
    console.log('='.repeat(60));

    // Step 2: Process with LLM
    const llmResponse = await processWithLLM(callId, transcript);
    console.log(`✅ Agent says: "${llmResponse.assistant_speech}"`);
    console.log(`📋 Action: ${llmResponse.agent_action.type}`);
    console.log('='.repeat(60));

    // Step 3: Convert to speech
    const audioBase64 = await textToSpeech(llmResponse.assistant_speech);
    console.log('✅ Tamil audio generated');

    // Step 4: Play audio
    playAudio(audioBase64, `response-${Date.now()}.wav`);
    console.log('✅ Playing response...');
    console.log('='.repeat(60));

    // View full conversation
    setTimeout(async () => {
      console.log('\n📜 Full Conversation:');
      const transcript = await axios.get(`${BASE_URL}/api/llm/transcript/${callId}`);
      console.log(transcript.data);
    }, 2000);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// CLI Usage
const audioFile = process.argv[2];

if (!audioFile) {
  console.log(`
🎙️  Voice Test Script

Usage:
  node scripts/test-with-voice.js <audio-file>

Example:
  node scripts/test-with-voice.js my-recording.wav

How to record:
  1. Use QuickTime Player: File → New Audio Recording
  2. Or use command line: sox -d -r 16000 -c 1 recording.wav
  3. Speak in Tamil
  4. Save the file
  5. Run this script with the filename

Test phrases:
  - "வணக்கம்"
  - "பாராசிட்டமால் கிடைக்குமா?"
  - "ரெண்டு ஸ்டிரிப் வேணும்"
  - "போதும்"
  `);
  process.exit(1);
}

if (!fs.existsSync(audioFile)) {
  console.error(`❌ File not found: ${audioFile}`);
  process.exit(1);
}

// Run test
testWithVoice(audioFile);







