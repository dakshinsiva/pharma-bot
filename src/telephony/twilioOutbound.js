const logger = require('../utils/logger');
const twilio = require('twilio');
const { EventEmitter } = require('events');

/**
 * Twilio Outbound Calling Module
 * Places outbound calls whose audio is carried over a bidirectional Media
 * Stream to this server (see mediaStreamServer.js / twilioMediaStream.js).
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
    
    logger.info('[Twilio] Initialized with phone number:', this.phoneNumber);
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
      logger.info(`[Twilio] Initiating call to ${to} (callId: ${callId})`);

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

      logger.info(`[Twilio] Call created: ${call.sid}`);

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
      logger.error(`[Twilio] Error making call to ${to}:`, error);
      
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
    const host = this.baseUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${host}/media-stream/${callId}">
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

      logger.info(`[Twilio] Updated call ${callSid}`);
      return call;
    } catch (error) {
      logger.error(`[Twilio] Error updating call ${callSid}:`, error);
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
        logger.error(`[Twilio] No active call found for ${callId}`);
        return false;
      }

      const twiml = this.generatePlayAudioTwiML(audioUrl);
      await this.updateCall(callInfo.callSid, twiml);

      return true;
    } catch (error) {
      logger.error(`[Twilio] Error playing audio for call ${callId}:`, error);
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
        logger.info(`[Twilio] No active call found for ${callId}`);
        return false;
      }

      await this.client.calls(callInfo.callSid).update({
        status: 'completed',
      });

      logger.info(`[Twilio] Ended call ${callId} (${callInfo.callSid})`);

      // Clean up
      this.activeCalls.delete(callId);

      this.emit('callEnded', {
        callId,
        callSid: callInfo.callSid,
        duration: (new Date() - callInfo.startTime) / 1000,
      });

      return true;
    } catch (error) {
      logger.error(`[Twilio] Error ending call ${callId}:`, error);
      return false;
    }
  }

  /**
   * Handle call status update
   * @param {Object} statusData - Status callback data from Twilio
   */
  handleStatusUpdate(statusData) {
    const { CallSid, CallStatus, AnsweredBy } = statusData;
    
    logger.info(`[Twilio] Status update for ${CallSid}: ${CallStatus}${AnsweredBy ? ` (answered by ${AnsweredBy})` : ''}`);

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
        if (AnsweredBy && AnsweredBy.startsWith('machine')) {
          // Voicemail picked up: there is nobody to talk to, hang up.
          logger.info(`[Twilio] Answering machine detected on ${CallSid}; hanging up`);
          this.client.calls(CallSid).update({ status: 'completed' }).catch((error) => {
            logger.error(`[Twilio] Could not hang up ${CallSid}:`, error.message);
          });
          break;
        }
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
      logger.error(`[Twilio] Error fetching recordings:`, error);
      return [];
    }
  }
}

module.exports = {
  TwilioOutbound,
};






