# Voice Testing Guide

Test your pharmacy calling agent with your actual voice!

---

## **Two Testing Methods**

### **Method 1: Pre-Recorded Audio** (Easiest)
Record yourself Process Hear response

### **Method 2: Real-Time Voice** (Most realistic)
Speak live Instant response Full conversation

---

## **Method 1: Test with Pre-Recorded Audio**

### Step 1: Install sox (if not installed)
```bash
brew install sox
```

### Step 2: Record yourself speaking Tamil
```bash
# Option A: Record with sox (press Ctrl+C to stop)
sox -d -r 16000 -c 1 my-recording.wav

# Option B: Use QuickTime Player
# File New Audio Recording Record Save
```

### Step 3: Run the test
```bash
node scripts/test-with-voice.js my-recording.wav
```

### What Happens:
1. Your audio is transcribed to Tamil text
2. Sent to LLM for processing
3. Agent generates Tamil response
4. Converted to speech
5. Plays automatically

### Example:
```bash
# Record yourself saying "பாராசிட்டமால் கிடைக்குமா?"
sox -d -r 16000 -c 1 question.wav

# Process it
node scripts/test-with-voice.js question.wav

# Output:
# Transcribing: question.wav
# You said: "பாராசிட்டமால் கிடைக்குமா?"
# Agent says: "ஆமாம் கிடைக்கும். எத்தனை ஸ்டிரிப் வேணும்?"
# Playing response...
```

---

## **Method 2: Real-Time Voice Testing**

### Step 1: Install sox
```bash
brew install sox
```

### Step 2: Make sure server is running
```bash
# In one terminal
npm start
```

### Step 3: Start real-time voice test
```bash
# In another terminal
node scripts/test-realtime-voice.js
```

### How It Works:
1. **Script starts listening** to your microphone
2. **You speak in Tamil**
3. ⏸ **Stop for 2 seconds** - triggers processing
4. **Agent responds** in Tamil voice
5. **Continue conversation** naturally
6. **Press Ctrl+C** to end and see transcript

### Example Conversation:
```
Listening... (speak in Tamil)

You: வணக்கம்
Agent: வணக்கம். என் பேர் சரண்யா, ஸ்ரீ பார்மசியில் இருந்து பேசுறேன். என்ன மருந்து தேவை?
[Plays Tamil audio]

You: பாராசிட்டமால் கிடைக்குமா?
Agent: ஆமாம் கிடைக்கும். எத்தனை ஸ்டிரிப் வேணும்?
[Plays Tamil audio]

You: மூணு ஸ்டிரிப் வேணும்
Agent: சரி. பாராசிட்டமால் மூணு ஸ்டிரிப் வேணும் இல்லையா?
[Plays Tamil audio]

You: ஆமாம் போதும்
Agent: சரி சார். உங்க ஆர்டர் நோட் பண்ணிட்டேன். நன்றி.
[Plays Tamil audio]

Call ended. Viewing transcript...
```

---

## **Test Phrases to Try**

### Greeting:
- "வணக்கம்"

### Ask about medicine:
- "பாராசிட்டமால் கிடைக்குமா?"
- "டோலோ 650 இருக்கா?"
- "சித்ரிசின் கிடைக்குமா?"

### Specify quantity:
- "ரெண்டு ஸ்டிரிப் வேணும்"
- "மூணு ஸ்டிரிப் வேணும்"
- "ஒரு ஸ்டிரிப் மட்டும் போதும்"

### Confirm/End:
- "ஆமாம்"
- "போதும்"
- "வேண்டாம்"

### Request callback:
- "நாளைக்கு அழையுங்க"
- "மாலையில் அழைக்கலாம்"

---

## **Quick Commands**

```bash
# Pre-recorded test
sox -d -r 16000 -c 1 test.wav  # Record
node scripts/test-with-voice.js test.wav  # Test

# Real-time test
node scripts/test-realtime-voice.js

# View all customers
curl http://localhost:3000/api/customers | jq

# View conversation transcript
curl http://localhost:3000/api/llm/transcript/<call-id> | jq
```

---

## **Troubleshooting**

### Issue: "sox: command not found"
```bash
# macOS
brew install sox

# Linux
sudo apt-get install sox
```

### Issue: "Permission denied to access microphone"
```bash
# macOS: System Preferences Security & Privacy Microphone
# Allow Terminal or your IDE
```

### Issue: "No audio playing"
```bash
# Check volume
# Try: afplay <audio-file.wav>
# Make sure speakers/headphones connected
```

### Issue: "STT not recognizing Tamil"
- Speak clearly
- Avoid background noise
- Speak at normal pace
- Make sure you're using Tamil words

### Issue: "Server not running"
```bash
# Check server status
curl http://localhost:3000/health

# If not running
npm start
```

---

## **What You're Testing**

**Speech-to-Text**: Google Cloud STT with Tamil
**LLM Processing**: OpenAI GPT-4 Tamil conversation
**Text-to-Speech**: Google Cloud TTS Tamil voice
**Order Logic**: Medicine availability and order taking
**Callback Handling**: Scheduling follow-ups
**Full Flow**: Complete customer interaction

---

## **Tips for Best Results**

1. **Speak clearly** in Tamil
2. **Use natural language** (not robotic)
3. **Pause 2 seconds** between sentences (real-time mode)
4. **Test different scenarios**:
   - Order placed successfully
   - Medicine not available
   - Callback request
   - Customer not interested
5. **Check transcripts** after to see what was captured

---

## **Example Test Session**

```bash
# Terminal 1: Start server
npm start

# Terminal 2: Start real-time voice test
node scripts/test-realtime-voice.js

# Now speak:
# 1. "வணக்கம்"
# 2. Wait for agent response
# 3. "பாராசிட்டமால் கிடைக்குமா?"
# 4. Wait for agent response
# 5. "மூணு ஸ்டிரிப் வேணும்"
# 6. Wait for agent response
# 7. "போதும்"

# Press Ctrl+C to end and view full transcript
```

---

## **Advanced: Record Full Conversation**

```bash
# Record entire session including agent responses
sox -d -r 16000 -c 1 full-conversation.wav &
node scripts/test-realtime-voice.js

# Press Ctrl+C in both when done
# You'll have audio recording of entire conversation!
```

---

## **This Tests Everything!**

By using voice testing, you're verifying:
- Tamil speech recognition accuracy
- LLM understanding of Tamil queries
- Natural conversation flow
- Tamil speech quality
- Response timing
- Order capture logic
- Callback scheduling
- Complete end-to-end flow

**This is as close as you can get to real phone calls without actually making them!**

---

## **Next Steps**

Once voice testing works well:
1. Your logic is proven
2. Tamil processing is verified
3. Only need telephony connection
4. Upgrade Twilio or complete Exotel KYC
5. System ready for production!

---

**Happy Voice Testing!** 






