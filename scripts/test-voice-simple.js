#!/usr/bin/env node
/**
 * Simple Voice Testing (ZERO external dependencies!)
 * Uses macOS built-in audio tools only
 * 
 * Best for quick testing without installing anything
 */

require('dotenv').config();
const readline = require('readline');
const axios = require('axios');
const fs = require('fs');
const { spawn } = require('child_process');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CALL_ID = 'simple-voice-' + Date.now();

let sessionInitialized = false;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log(`
╔═══════════════════════════════════════════════════════════╗
║   🎙️  Simple Voice Testing (Type or Speak)               ║
║   Pharmacy Calling Agent                                  ║
╚═══════════════════════════════════════════════════════════╝

📋 Two Ways to Test:

   Option 1: TYPE in Tamil (romanized)
   ----------------------------------------
   Just type what you want to say and press Enter
   Example: "paracetamol kidaikkuma?"

   Option 2: SPEAK using macOS dictation
   ----------------------------------------
   Press Fn key twice → speak → press Fn again
   Your Mac will type what you said!

🗣️  Try these phrases:
   - வணக்கம் (vanakkam)
   - பாராசிட்டமால் கிடைக்குமா? (paracetamol kidaikkuma?)
   - மூணு ஸ்டிரிப் வேணும் (moonu strip venum)
   - போதும் (podhum)

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
      customerName: 'Simple Voice Test',
    });
    
    const greeting = response.data.greeting.assistant_speech;
    console.log(`\n🤖 Agent: ${greeting}\n`);
    
    // Speak the greeting
    await speakText(greeting);
    
    sessionInitialized = true;
  } catch (error) {
    console.error('❌ Error initializing session:', error.message);
    console.error('Make sure the server is running: npm start');
    process.exit(1);
  }
}

/**
 * Process user input
 */
async function processInput(input) {
  try {
    console.log(`\n👤 You: ${input}`);
    
    const response = await axios.post(`${BASE_URL}/api/llm/process`, {
      callId: CALL_ID,
      transcript: input,
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
    
  } catch (error) {
    console.error('❌ Error processing:', error.message);
  }
}

/**
 * Convert text to speech and play (macOS native)
 */
async function speakText(text) {
  try {
    // Option 1: Use Google TTS API (better Tamil support)
    const response = await axios.post(`${BASE_URL}/api/tts/tamil`, {
      text,
      format: 'base64',
    });
    
    const filename = `/tmp/agent-response-${Date.now()}.wav`;
    const buffer = Buffer.from(response.data.audio, 'base64');
    fs.writeFileSync(filename, buffer);
    
    // Play using macOS afplay (built-in, no dependencies!)
    await new Promise((resolve, reject) => {
      const playProcess = spawn('afplay', [filename]);
      
      playProcess.on('close', (code) => {
        // Clean up temp file
        try { fs.unlinkSync(filename); } catch (e) {}
        if (code === 0) resolve();
        else reject(new Error(`afplay exited with code ${code}`));
      });
      
      playProcess.on('error', (error) => {
        // Clean up temp file
        try { fs.unlinkSync(filename); } catch (e) {}
        reject(error);
      });
    });
    
  } catch (error) {
    console.error('Error playing audio:', error.message);
    // Fallback: just show the text
    console.log(`   [Audio: ${text}]`);
  }
}

/**
 * View full conversation transcript
 */
async function viewTranscript() {
  try {
    const response = await axios.get(`${BASE_URL}/api/llm/transcript/${CALL_ID}`);
    console.log('\n' + '═'.repeat(60));
    console.log('📜 Full Conversation Transcript:');
    console.log('═'.repeat(60));
    console.log(response.data);
    console.log('═'.repeat(60));
  } catch (error) {
    console.error('Error viewing transcript:', error.message);
  }
}

/**
 * Start interactive conversation
 */
async function startConversation() {
  // Initialize session
  await initializeSession();
  
  console.log('\n💬 Type your message (or use Fn+Fn to dictate):');
  console.log('   Type "quit" or "exit" to end\n');
  
  // Prompt for input
  const askQuestion = () => {
    rl.question('You: ', async (input) => {
      const trimmed = input.trim();
      
      if (!trimmed) {
        askQuestion();
        return;
      }
      
      if (trimmed.toLowerCase() === 'quit' || trimmed.toLowerCase() === 'exit') {
        console.log('\n👋 Ending conversation...\n');
        await viewTranscript();
        process.exit(0);
      }
      
      await processInput(trimmed);
      askQuestion();
    });
  };
  
  askQuestion();
}

// Handle Ctrl+C gracefully
process.on('SIGINT', async () => {
  console.log('\n\n👋 Ending conversation...\n');
  await viewTranscript();
  process.exit(0);
});

// Start conversation
startConversation().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});







