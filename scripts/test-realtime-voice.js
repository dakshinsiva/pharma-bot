#!/usr/bin/env node
/**
 * Real-Time Voice Testing (NO SOX!)
 * Uses native macOS audio recording
 * 
 * Talk → STT → LLM → TTS → Hear Response
 */

require('dotenv').config();
const speech = require('@google-cloud/speech');
const { spawn } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const stream = require('stream');

const sttClient = new speech.SpeechClient();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CALL_ID = 'realtime-' + Date.now();

let sessionInitialized = false;
let isProcessing = false;
let currentRecording = null;

console.log(`
╔═══════════════════════════════════════════════════════════╗
║   🎙️  Real-Time Tamil Voice Testing                      ║
║   Pharmacy Calling Agent (Native Audio - No Sox!)        ║
╚═══════════════════════════════════════════════════════════╝

📋 Instructions:
   1. Speak in Tamil when you see "🎤 Listening..."
   2. Stop speaking for 2 seconds to process
   3. Agent will respond in Tamil
   4. Press Ctrl+C to exit

🗣️  Try saying:
   - "வணக்கம்"
   - "பாராசிட்டமால் கிடைக்குமா?"
   - "மூணு ஸ்டிரிப் வேணும்"
   - "போதும்"

⚡ Using native macOS audio recording (no external dependencies!)

═══════════════════════════════════════════════════════════
`);

/**
 * Initialize LLM session
 */
async function initializeSession() {
  if (sessionInitialized) return;
  
  console.log('🚀 Initializing conversation...\n');
  
  try {
    const response = await axios.post(`${BASE_URL}/api/llm/init`, {
      callId: CALL_ID,
      customerName: 'Voice Test User',
    });
    
    const greeting = response.data.greeting.assistant_speech;
    console.log(`🤖 Agent: ${greeting}\n`);
    
    // Convert to speech and play
    await speakText(greeting);
    
    sessionInitialized = true;
  } catch (error) {
    console.error('❌ Error initializing session:', error.message);
    console.error('Make sure server is running: npm start');
    process.exit(1);
  }
}

/**
 * Process transcript with LLM
 */
async function processTranscript(transcript) {
  if (isProcessing || !transcript.trim()) return;
  isProcessing = true;
  
  try {
    console.log(`\n👤 You: ${transcript}`);
    
    const response = await axios.post(`${BASE_URL}/api/llm/process`, {
      callId: CALL_ID,
      transcript,
    });
    
    const agentSpeech = response.data.response.assistant_speech;
    const action = response.data.response.agent_action.type;
    
    console.log(`🤖 Agent: ${agentSpeech}`);
    console.log(`📋 Action: ${action}`);
    
    // Speak response
    await speakText(agentSpeech);
    
    // Check if should end call
    if (action === 'END_CALL') {
      console.log('\n✅ Call ended. Viewing transcript...\n');
      await viewTranscript();
      process.exit(0);
    }
    
    console.log('\n🎤 Listening... (speak now)\n');
    
  } catch (error) {
    console.error('❌ Error processing:', error.message);
  } finally {
    isProcessing = false;
  }
}

/**
 * Convert text to speech and play (native macOS)
 */
async function speakText(text) {
  try {
    const response = await axios.post(`${BASE_URL}/api/tts/tamil`, {
      text,
      format: 'base64',
    });
    
    const filename = `/tmp/agent-response-${Date.now()}.wav`;
    const buffer = Buffer.from(response.data.audio, 'base64');
    fs.writeFileSync(filename, buffer);
    
    // Play using macOS afplay (built-in)
    await new Promise((resolve, reject) => {
      const playProcess = spawn('afplay', [filename]);
      
      playProcess.on('close', (code) => {
        try { fs.unlinkSync(filename); } catch (e) {}
        if (code === 0) resolve();
        else reject(new Error(`afplay exited with code ${code}`));
      });
      
      playProcess.on('error', reject);
    });
    
  } catch (error) {
    console.error('Error speaking:', error.message);
  }
}

/**
 * View full conversation transcript
 */
async function viewTranscript() {
  try {
    const response = await axios.get(`${BASE_URL}/api/llm/transcript/${CALL_ID}`);
    console.log('═'.repeat(60));
    console.log('📜 Full Conversation Transcript:');
    console.log('═'.repeat(60));
    console.log(JSON.stringify(response.data, null, 2));
    console.log('═'.repeat(60));
  } catch (error) {
    console.error('Error viewing transcript:', error.message);
  }
}

/**
 * Record audio using native macOS (no sox!)
 * Returns a PassThrough stream with 16kHz LINEAR16 audio
 */
function recordAudioNative() {
  // Use ffmpeg to capture audio from default input device
  // ffmpeg is commonly installed on macOS or use built-in rec
  const recorder = spawn('ffmpeg', [
    '-f', 'avfoundation',      // macOS audio input
    '-i', ':0',                 // Default audio input device
    '-acodec', 'pcm_s16le',    // LINEAR16 format
    '-ar', '16000',            // 16kHz sample rate
    '-ac', '1',                // Mono
    '-f', 's16le',             // Output format
    'pipe:1'                   // Output to stdout
  ]);

  recorder.stderr.on('data', (data) => {
    // Suppress ffmpeg verbose output
  });

  recorder.on('error', (error) => {
    console.error('❌ Recording error:', error.message);
    console.error('\n📝 Trying alternative method...\n');
    // Try alternative method
    recordAudioAlternative();
  });

  return recorder.stdout;
}

/**
 * Alternative: Use Python sounddevice (if ffmpeg not available)
 */
function recordAudioAlternative() {
  console.log('⚠️  ffmpeg not found. Trying alternative...\n');
  
  // Create a simple Python script for audio capture
  const pythonScript = `
import sounddevice as sd
import sys
import struct

# Record at 16kHz, mono, int16
samplerate = 16000
channels = 1

def callback(indata, frames, time, status):
    if status:
        print(status, file=sys.stderr)
    # Write raw audio bytes to stdout
    sys.stdout.buffer.write(indata.tobytes())
    sys.stdout.buffer.flush()

with sd.InputStream(samplerate=samplerate, channels=channels, 
                     dtype='int16', callback=callback):
    input()  # Keep recording until interrupted
`;

  const tempScript = '/tmp/record_audio.py';
  fs.writeFileSync(tempScript, pythonScript);

  const recorder = spawn('python3', [tempScript]);
  
  recorder.stderr.on('data', (data) => {
    const msg = data.toString();
    if (msg.includes('ModuleNotFoundError')) {
      console.error('❌ Please install: pip3 install sounddevice');
      console.error('\nOr use the simple voice mode instead:');
      console.error('  npm run voice\n');
      process.exit(1);
    }
  });

  return recorder.stdout;
}

/**
 * Start real-time speech recognition with native recording
 */
async function startRealTimeRecognition() {
  // Initialize session first
  await initializeSession();
  
  console.log('🎤 Listening... (speak in Tamil)\n');
  console.log('═'.repeat(60));
  
  const request = {
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode: 'ta-IN',
      alternativeLanguageCodes: ['en-IN'],
      model: 'default',
    },
    interimResults: false,
  };

  let recognizeStream = null;
  let audioStream = null;
  let lastTranscriptTime = Date.now();
  
  const startNewRecognitionStream = () => {
    if (recognizeStream) {
      recognizeStream.destroy();
    }

    recognizeStream = sttClient
      .streamingRecognize(request)
      .on('error', (error) => {
        console.error('STT Error:', error.message);
        // Restart after error
        setTimeout(() => {
          console.log('🔄 Restarting recognition...\n');
          startNewRecognitionStream();
        }, 1000);
      })
      .on('data', (data) => {
        if (data.results[0] && data.results[0].isFinal) {
          const transcript = data.results[0].alternatives[0].transcript;
          lastTranscriptTime = Date.now();
          
          if (transcript.trim()) {
            // Stop current recording temporarily
            if (audioStream) {
              audioStream.unpipe(recognizeStream);
            }
            
            // Process the transcript
            processTranscript(transcript).then(() => {
              // Resume recording after agent speaks
              if (audioStream) {
                audioStream.pipe(recognizeStream);
              }
            });
          }
        }
      });

    // Connect audio stream
    if (audioStream) {
      audioStream.pipe(recognizeStream);
    }
  };

  // Try to start recording with ffmpeg first
  try {
    console.log('🎙️  Starting native audio recording...\n');
    audioStream = recordAudioNative();
    
    // Start recognition
    startNewRecognitionStream();
    
    console.log('✅ Microphone active. Start speaking in Tamil!\n');
    
    // Restart stream every 60 seconds (Google STT limitation)
    setInterval(() => {
      if (Date.now() - lastTranscriptTime > 60000) {
        startNewRecognitionStream();
      }
    }, 60000);
    
  } catch (error) {
    console.error('❌ Failed to start recording:', error.message);
    console.error('\n📝 Alternative: Use simple voice mode instead:');
    console.error('  npm run voice\n');
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', async () => {
  console.log('\n\n👋 Ending conversation...\n');
  await viewTranscript();
  process.exit(0);
});

// Check for ffmpeg
const checkFfmpeg = spawn('which', ['ffmpeg']);
checkFfmpeg.on('close', (code) => {
  if (code !== 0) {
    console.log(`
⚠️  Warning: ffmpeg not found.

For better real-time voice, install ffmpeg:
  brew install ffmpeg

Or use the simple voice mode (no dependencies):
  npm run voice

Attempting to continue anyway...
    `);
  }
  
  // Start recognition
  startRealTimeRecognition().catch((error) => {
    console.error('Fatal error:', error);
    console.error('\n📝 Use simple voice mode instead: npm run voice\n');
    process.exit(1);
  });
});
