const logger = require('../utils/logger');
const axios = require('axios');
const { EventEmitter } = require('events');

/**
 * Exotel Outbound Calling Module
 * Handles outbound calls via Exotel API
 */

class ExotelOutbound extends EventEmitter {
  constructor() {
    super();
    
    this.apiKey = process.env.EXOTEL_API_KEY;
    this.apiToken = process.env.EXOTEL_API_TOKEN;
    this.sid = process.env.EXOTEL_SID;
    this.phoneNumber = process.env.EXOTEL_PHONE_NUMBER;
    this.flowId = process.env.EXOTEL_FLOW_ID; // App/Flow ID for AI agent
    this.baseUrl = process.env.BASE_URL;

    if (!this.apiKey || !this.apiToken || !this.sid || !this.phoneNumber) {
      throw new Error('Exotel credentials not configured');
    }

    // Exotel API base URL
    this.exotelApiUrl = `https://api.exotel.com/v1/Accounts/${this.sid}`;
    
    // Basic auth credentials
    this.authHeader = {
      auth: {
        username: this.apiKey,
        password: this.apiToken,
      },
    };

    this.activeCalls = new Map();
    
    logger.info('[Exotel] Initialized with phone number:', this.phoneNumber);
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
      logger.info(`[Exotel] Initiating call to ${to} (callId: ${callId})`);

      // Format phone number for Exotel (Indian format: 0XXXXXXXXXX)
      // Exotel expects: 0 + 10 digit number (e.g., 09876543210)
      let formattedTo = to;
      if (to.startsWith('+91')) {
        formattedTo = '0' + to.substring(3); // +919876543210 -> 09876543210
      } else if (to.startsWith('91') && to.length === 12) {
        formattedTo = '0' + to.substring(2); // 919876543210 -> 09876543210
      } else if (!to.startsWith('0') && to.length === 10) {
        formattedTo = '0' + to; // 9876543210 -> 09876543210
      }

      logger.info(`[Exotel] Formatted number: ${to} -> ${formattedTo}`);

      // Exotel Connect API parameters for automated outbound calls
      // SOLUTION: Use a special URL format that Exotel recognizes
      // The trick: We need to provide a passthru endpoint that Exotel will call
      // when the customer answers, then Exotel will execute the TwiML we return
      // Exotel Connect API for AI Agent
      // When using AppId (Flow), we still need From, CallerId, and CustomField
      // The Flow will use CustomField to fetch the right TwiML
      const params = new URLSearchParams({
        From: formattedTo, // Customer's number (who we're calling)
        CallerId: this.phoneNumber, // What shows on customer's caller ID
        CallType: 'trans', // Transactional call type
        TimeLimit: '3600', // Max call duration in seconds
        TimeOut: '30', // Ring timeout in seconds
        StatusCallback: `${this.baseUrl}/api/telephony/exotel/status`,
        StatusCallbackMethod: 'POST',
        StatusCallbackEvent: ['terminal'],
        Record: options.record || 'false',
        RecordingStatusCallback: options.recordingCallback || '',
        CustomField: callId, // Store callId - accessible in Flow as {{CustomField}}
      });

      // Use direct webhook URL approach (no Flow needed)
      // Exotel will call this URL when the call connects, and we return TwiML
      // The Url parameter tells Exotel where to fetch TwiML instructions
      params.append('To', this.phoneNumber); // Required: destination number
      params.append('Url', `${this.baseUrl}/api/telephony/exotel/twiml/${callId}`);
      params.append('Method', 'GET'); // Use GET to fetch TwiML
      
      logger.info(`[Exotel] Using direct webhook URL: ${this.baseUrl}/api/telephony/exotel/twiml/${callId}`);
      logger.info(`[Exotel] Exotel will call this URL when call connects to fetch TwiML instructions`);

      logger.info(`[Exotel] API Request URL: ${this.exotelApiUrl}/Calls/connect.json`);
      logger.info(`[Exotel] API Request params:`, Object.fromEntries(params));

      // Always use .json endpoint for consistent JSON responses
      const endpoint = `${this.exotelApiUrl}/Calls/connect.json`;
      logger.info(`[Exotel] Using endpoint: ${endpoint}`);

      const response = await axios.post(
        endpoint,
        params,
        this.authHeader
      );

      logger.info(`[Exotel] Raw API response:`, JSON.stringify(response.data, null, 2));
      
      // Handle different response formats from Exotel
      const callData = response.data.Call || response.data;
      
      if (!callData || !callData.Sid) {
        logger.error(`[Exotel] Unexpected response format:`, response.data);
        throw new Error('Invalid response from Exotel - no Call SID returned');
      }
      
      logger.info(`[Exotel] Call created: ${callData.Sid}`);

      // Store call info
      this.activeCalls.set(callId, {
        callSid: callData.Sid,
        to: to,
        status: callData.Status,
        startTime: new Date(),
        callId: callId,
      });

      // Emit call initiated event
      this.emit('callInitiated', {
        callId,
        callSid: callData.Sid,
        to,
      });

      return {
        success: true,
        callSid: callData.Sid,
        status: callData.Status,
        callId,
      };

    } catch (error) {
      logger.error(`[Exotel] Error making call to ${to}:`, error.response?.data || error.message);
      
      this.emit('callFailed', {
        callId,
        to,
        error: error.response?.data || error.message,
      });

      return {
        success: false,
        error: error.response?.data || error.message,
        callId,
      };
    }
  }

  /**
   * Generate TwiML for call (Exotel supports TwiML-like XML)
   * @param {String} callId - Unique call identifier
   * @returns {String} TwiML-like XML
   */
  generateInitialTwiML(callId) {
    // Exotel TwiML - using the simplest possible format
    // Exotel might need explicit voice and language attributes
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman">Hello, this is a test call from your pharmacy. Please respond.</Say>
  <Gather numDigits="1" timeout="10">
    <Say voice="woman">Press any key to continue.</Say>
  </Gather>
</Response>`;
  }

  /**
   * Generate TwiML to play audio
   * @param {String} audioUrl - URL to audio file
   * @returns {String} TwiML-like XML
   */
  generatePlayAudioTwiML(audioUrl) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${audioUrl}</Play>
</Response>`;
  }

  /**
   * Generate TwiML to say text
   * @param {String} text - Text to speak
   * @param {String} language - Language code
   * @returns {String} TwiML-like XML
   */
  generateSayTwiML(text, language = 'ta-IN') {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman" language="${language}">${this.escapeXml(text)}</Say>
</Response>`;
  }

  /**
   * Escape XML special characters
   * @param {String} text - Text to escape
   * @returns {String} Escaped text
   */
  escapeXml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Get call details from Exotel
   * @param {String} callSid - Exotel call SID
   * @returns {Promise<Object>} Call details
   */
  async getCallDetails(callSid) {
    try {
      const response = await axios.get(
        `${this.exotelApiUrl}/Calls/${callSid}.json`,
        this.authHeader
      );

      return response.data.Call;
    } catch (error) {
      logger.error(`[Exotel] Error fetching call details:`, error);
      throw error;
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
        logger.info(`[Exotel] No active call found for ${callId}`);
        return false;
      }

      // Exotel doesn't have direct API to end call
      // We can update the call flow or just remove from tracking
      logger.info(`[Exotel] Ending call ${callId} (${callInfo.callSid})`);

      // Clean up
      this.activeCalls.delete(callId);

      this.emit('callEnded', {
        callId,
        callSid: callInfo.callSid,
        duration: (new Date() - callInfo.startTime) / 1000,
      });

      return true;
    } catch (error) {
      logger.error(`[Exotel] Error ending call ${callId}:`, error);
      return false;
    }
  }

  /**
   * Handle call status update from Exotel
   * @param {Object} statusData - Status callback data
   */
  handleStatusUpdate(statusData) {
    const { CallSid, Status, To, From, CustomField } = statusData;
    
    // Try to find callId from CallSid if CustomField is not provided
    let callId = CustomField;
    if (!callId && CallSid) {
      // Find callId by matching CallSid in activeCalls
      for (const [id, info] of this.activeCalls.entries()) {
        if (info.callSid === CallSid) {
          callId = id;
          break;
        }
      }
    }
    
    logger.info(`[Exotel] Status update for ${CallSid}: ${Status}, callId: ${callId || 'not found'}`);

    // Update call info
    if (callId && this.activeCalls.has(callId)) {
      const callInfo = this.activeCalls.get(callId);
      callInfo.status = Status;
    } else if (CallSid) {
      // Store status even if we can't find callId
      logger.info(`[Exotel] CallSid ${CallSid} status: ${Status} (callId not found in activeCalls)`);
    }

    // Map Exotel status to our events
    switch (Status) {
      case 'in-progress':
        this.emit('callAnswered', { callId, callSid: CallSid });
        break;
      case 'completed':
      case 'busy':
      case 'failed':
      case 'no-answer':
      case 'canceled':
        this.emit('callCompleted', { 
          callId, 
          callSid: CallSid, 
          status: Status 
        });
        if (callId) {
          this.activeCalls.delete(callId);
        }
        break;
    }
  }

  /**
   * Send SMS via Exotel
   * @param {String} to - Destination phone number
   * @param {String} message - SMS message
   * @returns {Promise<Object>} SMS response
   */
  async sendSMS(to, message) {
    try {
      logger.info(`[Exotel] Sending SMS to ${to}`);

      const params = new URLSearchParams({
        From: this.phoneNumber,
        To: to,
        Body: message,
      });

      const response = await axios.post(
        `${this.exotelApiUrl}/Sms/send.json`,
        params,
        this.authHeader
      );

      logger.info(`[Exotel] SMS sent: ${response.data.SMSMessage.Sid}`);

      return {
        success: true,
        smsSid: response.data.SMSMessage.Sid,
        status: response.data.SMSMessage.Status,
      };

    } catch (error) {
      logger.error(`[Exotel] Error sending SMS:`, error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message,
      };
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
   * Get call recordings from Exotel
   * @param {String} callSid - Exotel call SID
   * @returns {Promise<Array>} List of recordings
   */
  async getRecordings(callSid) {
    try {
      const response = await axios.get(
        `${this.exotelApiUrl}/Calls/${callSid}/Recordings.json`,
        this.authHeader
      );

      return response.data.Recordings.map(rec => ({
        sid: rec.Sid,
        duration: rec.Duration,
        url: rec.Url,
      }));
    } catch (error) {
      logger.error(`[Exotel] Error fetching recordings:`, error);
      return [];
    }
  }

  /**
   * Get account details
   * @returns {Promise<Object>} Account information
   */
  async getAccountDetails() {
    try {
      const response = await axios.get(
        `${this.exotelApiUrl}.json`,
        this.authHeader
      );

      return response.data.Account;
    } catch (error) {
      logger.error(`[Exotel] Error fetching account details:`, error);
      throw error;
    }
  }
}

module.exports = {
  ExotelOutbound,
};






