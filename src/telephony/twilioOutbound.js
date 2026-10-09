const twilio = require('twilio');
const WebSocket = require('ws');
const { EventEmitter } = require('events');

/**
 * Twilio Outbound Calling Module
 * Handles outbound calls via Twilio with Media Streams
 */

class TwilioOutbound extends EventEmitter {
  constructor() {
    super();
    
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER;
    this.baseUrl = process.env.BASE_URL;

    if (!this.accountSid || !this.authToken || !this.phoneNumber) {
      throw new Error('Twilio credentials not configured');
    }

    this.client = twilio(this.accountSid, this.authToken);
    this.activeCalls = new Map();
    
    console.log('[Twilio] Initialized with phone number:', this.phoneNumber);
  }

  /**
   * Make an outbound call
   * @param {String} to - Destination phone number
   * @param {String} callId - Unique call identifier
   * @param {Object} options - Additional call options
   * @returns {Promise<Object>} Call object
   */
  async makeCall(to, callId, options = {}) {
    try {
      console.log(`[Twilio] Initiating call to ${to} (callId: ${callId})`);

      const twiml = this.generateInitialTwiML(callId);
      
      const call = await this.client.calls.create({
        to: to,
        from: this.phoneNumber,
        twiml: twiml,
        statusCallback: `${this.baseUrl}/api/telephony/twilio/status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        machineDetection: 'Enable', // Detect answering machines
        machineDetectionTimeout: 5,
        ...options,
      });

      console.log(`[Twilio] Call created: ${call.sid}`);

      // Store call info
      this.activeCalls.set(callId, {
        callSid: call.sid,
        to: to,
        status: call.status,
        startTime: new Date(),
        callId: callId,
      });

      // Emit call initiated event
      this.emit('callInitiated', {
        callId,
        callSid: call.sid,
        to,
      });

      return {
        success: true,
        callSid: call.sid,
        status: call.status,
        callId,
      };

    } catch (error) {
      console.error(`[Twilio] Error making call to ${to}:`, error);
      
      this.emit('callFailed', {
        callId,
        to,
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
        callId,
      };
    }
  }

  /**
   * Generate initial TwiML for call
   * @param {String} callId - Unique call identifier
   * @returns {String} TwiML XML
   */
  generateInitialTwiML(callId) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${this.baseUrl.replace('https://', '').replace('http://', '')}/media-stream/${callId}">
      <Parameter name="callId" value="${callId}" />
    </Stream>
  </Connect>
</Response>`;
  }

  /**
   * Generate TwiML to play audio
   * @param {String} audioUrl - URL to audio file
   * @returns {String} TwiML XML
   */
  generatePlayAudioTwiML(audioUrl) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${audioUrl}</Play>
</Response>`;
  }

  /**
   * Generate TwiML to say text (fallback if TTS fails)
   * @param {String} text - Text to speak
   * @param {String} language - Language code
   * @returns {String} TwiML XML
   */
  generateSayTwiML(text, language = 'ta-IN') {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="${language}">${text}</Say>
</Response>`;
  }

  /**
   * Update call with new TwiML
   * @param {String} callSid - Twilio call SID
   * @param {String} twiml - TwiML to execute
   * @returns {Promise<Object>} Updated call
   */
  async updateCall(callSid, twiml) {
    try {
      const call = await this.client.calls(callSid).update({
        twiml: twiml,
      });

      console.log(`[Twilio] Updated call ${callSid}`);
      return call;
    } catch (error) {
      console.error(`[Twilio] Error updating call ${callSid}:`, error);
      throw error;
    }
  }

  /**
   * Play audio on active call
   * @param {String} callId - Unique call identifier
   * @param {String} audioUrl - URL to audio file
   * @returns {Promise<Boolean>} Success status
   */
  async playAudio(callId, audioUrl) {
    try {
      const callInfo = this.activeCalls.get(callId);
      
      if (!callInfo) {
        console.error(`[Twilio] No active call found for ${callId}`);
        return false;
      }

      const twiml = this.generatePlayAudioTwiML(audioUrl);
      await this.updateCall(callInfo.callSid, twiml);

      return true;
    } catch (error) {
      console.error(`[Twilio] Error playing audio for call ${callId}:`, error);
      return false;
    }
  }

  /**
   * End an active call
   * @param {String} callId - Unique call identifier
   * @returns {Promise<Boolean>} Success status
   */
  async endCall(callId) {
    try {
      const callInfo = this.activeCalls.get(callId);
      
      if (!callInfo) {
        console.log(`[Twilio] No active call found for ${callId}`);
        return false;
      }

      await this.client.calls(callInfo.callSid).update({
        status: 'completed',
      });

      console.log(`[Twilio] Ended call ${callId} (${callInfo.callSid})`);

      // Clean up
      this.activeCalls.delete(callId);

      this.emit('callEnded', {
        callId,
        callSid: callInfo.callSid,
        duration: (new Date() - callInfo.startTime) / 1000,
      });

      return true;
    } catch (error) {
      console.error(`[Twilio] Error ending call ${callId}:`, error);
      return false;
    }
  }

  /**
   * Handle call status update
   * @param {Object} statusData - Status callback data from Twilio
   */
  handleStatusUpdate(statusData) {
    const { CallSid, CallStatus, To, From } = statusData;
    
    console.log(`[Twilio] Status update for ${CallSid}: ${CallStatus}`);

    // Find call by SID
    let callId = null;
    for (const [id, info] of this.activeCalls.entries()) {
      if (info.callSid === CallSid) {
        callId = id;
        info.status = CallStatus;
        break;
      }
    }

    // Emit appropriate events
    switch (CallStatus) {
      case 'ringing':
        this.emit('callRinging', { callId, callSid: CallSid });
        break;
      case 'in-progress':
        this.emit('callAnswered', { callId, callSid: CallSid });
        break;
      case 'completed':
      case 'busy':
      case 'failed':
      case 'no-answer':
        this.emit('callCompleted', { 
          callId, 
          callSid: CallSid, 
          status: CallStatus 
        });
        if (callId) {
          this.activeCalls.delete(callId);
        }
        break;
    }
  }

  /**
   * Get call information
   * @param {String} callId - Unique call identifier
   * @returns {Object|null} Call info or null
   */
  getCallInfo(callId) {
    return this.activeCalls.get(callId) || null;
  }

  /**
   * Get all active calls
   * @returns {Array} List of active calls
   */
  getActiveCalls() {
    return Array.from(this.activeCalls.entries()).map(([callId, info]) => ({
      callId,
      ...info,
    }));
  }

  /**
   * Check if call is active
   * @param {String} callId - Unique call identifier
   * @returns {Boolean} True if active
   */
  isCallActive(callId) {
    return this.activeCalls.has(callId);
  }

  /**
   * Get call recording (if enabled)
   * @param {String} callSid - Twilio call SID
   * @returns {Promise<Array>} List of recordings
   */
  async getRecordings(callSid) {
    try {
      const recordings = await this.client.recordings.list({
        callSid: callSid,
      });

      return recordings.map(rec => ({
        sid: rec.sid,
        duration: rec.duration,
        url: `https://api.twilio.com${rec.uri.replace('.json', '.mp3')}`,
      }));
    } catch (error) {
      console.error(`[Twilio] Error fetching recordings:`, error);
      return [];
    }
  }
}

/**
 * Handle WebSocket connection for Twilio Media Streams
 * @param {WebSocket} ws - WebSocket connection
 * @param {String} callId - Unique call identifier
 * @param {Function} onAudioData - Callback for audio data
 */
function handleMediaStream(ws, callId, onAudioData) {
  console.log(`[Twilio] Media stream connected for call ${callId}`);

  let streamSid = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);

      switch (msg.event) {
        case 'start':
          streamSid = msg.start.streamSid;
          console.log(`[Twilio] Media stream started: ${streamSid}`);
          break;

        case 'media':
          // Audio data in base64 μ-law format
          const audioPayload = msg.media.payload;
          if (onAudioData) {
            onAudioData(audioPayload, callId);
          }
          break;

        case 'stop':
          console.log(`[Twilio] Media stream stopped for call ${callId}`);
          break;
      }
    } catch (error) {
      console.error(`[Twilio] Error processing media stream message:`, error);
    }
  });

  ws.on('close', () => {
    console.log(`[Twilio] Media stream closed for call ${callId}`);
  });

  ws.on('error', (error) => {
    console.error(`[Twilio] Media stream error for call ${callId}:`, error);
  });

  /**
   * Send audio to call
   * @param {String} audioBase64 - Base64 encoded μ-law audio
   */
  ws.sendAudio = (audioBase64) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        event: 'media',
        streamSid: streamSid,
        media: {
          payload: audioBase64,
        },
      }));
    }
  };

  return ws;
}

module.exports = {
  TwilioOutbound,
  handleMediaStream,
};






