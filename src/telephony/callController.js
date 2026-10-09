const { v4: uuidv4 } = require('uuid');
const { EventEmitter } = require('events');
const { TwilioOutbound, handleMediaStream } = require('./twilioOutbound');
const { ExotelOutbound } = require('./exotelOutbound');
const { startGoogleSTTStream } = require('../stt/googleStreamSTT');
const { synthesizeTamil } = require('../tts/tamilTTS');
const { llmProcessor } = require('../llm/processLLM');
const prisma = require('../db/prisma');

/**
 * Call Controller - Orchestrates the entire call flow
 * Manages telephony, STT, TTS, LLM, and database operations
 */

class CallController extends EventEmitter {
  constructor() {
    super();
    
    // Normalize provider name to lowercase for case-insensitive comparison
    this.provider = (process.env.ACTIVE_TELEPHONY_PROVIDER || 'twilio').toLowerCase();
    
    // Initialize telephony provider
    if (this.provider === 'twilio') {
      this.telephony = new TwilioOutbound();
    } else if (this.provider === 'exotel') {
      this.telephony = new ExotelOutbound();
    } else {
      throw new Error(`Invalid telephony provider: ${this.provider}`);
    }

    // Track active calls
    this.activeCalls = new Map();
    this.callQueue = [];
    this.isProcessingQueue = false;

    // Set up event listeners
    this.setupEventListeners();

    console.log(`[CallController] Initialized with provider: ${this.provider}`);
  }

  /**
   * Set up event listeners for telephony events
   */
  setupEventListeners() {
    this.telephony.on('callInitiated', (data) => {
      console.log(`[CallController] Call initiated:`, data);
      this.updateCallStatus(data.callId, 'initiated');
    });

    this.telephony.on('callRinging', (data) => {
      console.log(`[CallController] Call ringing:`, data);
      this.updateCallStatus(data.callId, 'ringing');
    });

    this.telephony.on('callAnswered', (data) => {
      console.log(`[CallController] Call answered:`, data);
      this.handleCallAnswered(data.callId);
    });

    this.telephony.on('callCompleted', (data) => {
      console.log(`[CallController] Call completed:`, data);
      this.handleCallCompleted(data.callId, data.status);
    });

    this.telephony.on('callFailed', (data) => {
      console.log(`[CallController] Call failed:`, data);
      this.handleCallFailed(data.callId, data.error);
    });

    this.telephony.on('callEnded', (data) => {
      console.log(`[CallController] Call ended:`, data);
      this.cleanupCall(data.callId);
    });
  }

  /**
   * Add customers to call queue
   * @param {Array} customers - List of customer objects
   */
  async addToQueue(customers) {
    console.log(`[CallController] Adding ${customers.length} customers to queue`);
    
    for (const customer of customers) {
      this.callQueue.push({
        customerId: customer.id,
        phone: customer.phone,
        name: customer.name,
      });
    }

    // Start processing queue if not already running
    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  }

  /**
   * Process call queue
   */
  async processQueue() {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    console.log(`[CallController] Starting queue processing`);

    while (this.callQueue.length > 0) {
      const customer = this.callQueue.shift();
      
      console.log(`[CallController] Processing customer: ${customer.name} (${customer.phone})`);
      
      try {
        await this.initiateCall(customer.customerId, customer.phone, customer.name);
        
        // Wait between calls (configurable delay)
        const delayMs = parseInt(process.env.CALL_DELAY_MS || '5000');
        await new Promise(resolve => setTimeout(resolve, delayMs));
        
      } catch (error) {
        console.error(`[CallController] Error processing customer ${customer.customerId}:`, error);
      }
    }

    this.isProcessingQueue = false;
    console.log(`[CallController] Queue processing complete`);
  }

  /**
   * Initiate an outbound call
   * @param {String} customerId - Customer ID from database
   * @param {String} phone - Phone number to call
   * @param {String} name - Customer name
   * @returns {Promise<Object>} Call result
   */
  async initiateCall(customerId, phone, name) {
    const callId = uuidv4();
    
    console.log(`[CallController] Initiating call to ${name} (${phone}), callId: ${callId}`);

    try {
      // Create call log in database
      const callLog = await prisma.callLog.create({
        data: {
          customerId: customerId,
          provider: this.provider,
          status: 'initiated',
        },
      });

      // Initialize call tracking
      this.activeCalls.set(callId, {
        callId,
        customerId,
        phone,
        name,
        callLogId: callLog.id,
        startTime: new Date(),
        status: 'initiated',
        sttStream: null,
        transcript: [],
        actions: [],
      });

      // Make the call
      const result = await this.telephony.makeCall(phone, callId);

      if (result.success) {
        // Update call log with call SID
        await prisma.callLog.update({
          where: { id: callLog.id },
          data: { callSid: result.callSid },
        });

        // Update call tracking
        const callData = this.activeCalls.get(callId);
        callData.callSid = result.callSid;
      }

      return result;

    } catch (error) {
      console.error(`[CallController] Error initiating call:`, error);
      this.cleanupCall(callId);
      throw error;
    }
  }

  /**
   * Handle call answered event
   * @param {String} callId - Unique call identifier
   */
  async handleCallAnswered(callId) {
    const callData = this.activeCalls.get(callId);
    if (!callData) return;

    console.log(`[CallController] Handling answered call ${callId}`);

    try {
      // Update status
      this.updateCallStatus(callId, 'in-progress');

      // Initialize LLM session
      const greeting = llmProcessor.initializeSession(callId, callData.name);

      // Generate Tamil greeting audio
      const audioBuffer = await synthesizeTamil(greeting.assistant_speech);

      // Play greeting (implementation depends on provider)
      await this.playAudio(callId, audioBuffer);

      // Store first action
      callData.actions.push(greeting.agent_action);

      // Initialize STT stream
      callData.sttStream = startGoogleSTTStream(callId, (transcriptData) => {
        this.handleTranscript(callId, transcriptData);
      });

    } catch (error) {
      console.error(`[CallController] Error handling answered call:`, error);
      await this.endCall(callId);
    }
  }

  /**
   * Handle transcript from STT
   * @param {String} callId - Unique call identifier
   * @param {Object} transcriptData - Transcript data from STT
   */
  async handleTranscript(callId, transcriptData) {
    if (!transcriptData.isFinal || transcriptData.error) return;

    const callData = this.activeCalls.get(callId);
    if (!callData) return;

    const transcript = transcriptData.transcript;
    console.log(`[CallController] Transcript for ${callId}: ${transcript}`);

    // Store transcript
    callData.transcript.push({
      text: transcript,
      timestamp: new Date(),
      confidence: transcriptData.confidence,
    });

    try {
      // Process with LLM
      const response = await llmProcessor.processTranscript(callId, transcript);

      // Generate audio for response
      const audioBuffer = await synthesizeTamil(response.assistant_speech);

      // Play response
      await this.playAudio(callId, audioBuffer);

      // Store action
      callData.actions.push(response.agent_action);

      // Handle action
      await this.handleAction(callId, response.agent_action);

    } catch (error) {
      console.error(`[CallController] Error processing transcript:`, error);
    }
  }

  /**
   * Handle agent action
   * @param {String} callId - Unique call identifier
   * @param {Object} action - Agent action object
   */
  async handleAction(callId, action) {
    const callData = this.activeCalls.get(callId);
    if (!callData) return;

    console.log(`[CallController] Handling action for ${callId}: ${action.type}`);

    try {
      switch (action.type) {
        case 'SAVE_ORDER':
          await this.saveOrder(callData.customerId, action.order_details);
          await this.updateCustomerStatus(callData.customerId, 'order_placed');
          break;

        case 'SAVE_CALLBACK':
          await this.saveCallback(callData.customerId, action.callback_time, action.order_details?.notes);
          await this.updateCustomerStatus(callData.customerId, 'callback_scheduled');
          break;

        case 'NOT_AVAILABLE':
          // Just log, no database action needed yet
          console.log(`[CallController] Medicine not available for ${callId}`);
          break;

        case 'END_CALL':
          await this.updateCustomerStatus(callData.customerId, action.customer_status || 'contacted');
          await this.endCall(callId);
          break;

        case 'NEXT_CUSTOMER':
          // This will be handled by queue processing
          console.log(`[CallController] Moving to next customer after ${callId}`);
          break;

        case 'NONE':
        default:
          // Continue conversation
          break;
      }
    } catch (error) {
      console.error(`[CallController] Error handling action:`, error);
    }
  }

  /**
   * Save order to database
   * @param {String} customerId - Customer ID
   * @param {Object} orderDetails - Order details
   */
  async saveOrder(customerId, orderDetails) {
    try {
      const order = await prisma.order.create({
        data: {
          customerId: customerId,
          items: JSON.stringify(orderDetails.items),
          notes: orderDetails.notes,
          status: 'pending',
        },
      });

      console.log(`[CallController] Order saved: ${order.id}`);
      return order;
    } catch (error) {
      console.error(`[CallController] Error saving order:`, error);
      throw error;
    }
  }

  /**
   * Save callback request to database
   * @param {String} customerId - Customer ID
   * @param {String} callbackTime - Requested callback time
   * @param {String} reason - Reason for callback
   */
  async saveCallback(customerId, callbackTime, reason) {
    try {
      // Parse callback time
      let callbackDate = new Date();
      
      // Simple parsing (can be enhanced)
      if (callbackTime.includes('tomorrow')) {
        callbackDate.setDate(callbackDate.getDate() + 1);
        callbackDate.setHours(10, 0, 0, 0);
      } else if (callbackTime.includes('evening')) {
        callbackDate.setHours(18, 0, 0, 0);
      } else {
        // Try to parse as ISO date
        try {
          callbackDate = new Date(callbackTime);
        } catch (e) {
          // Default to next day morning
          callbackDate.setDate(callbackDate.getDate() + 1);
          callbackDate.setHours(10, 0, 0, 0);
        }
      }

      const callback = await prisma.callback.create({
        data: {
          customerId: customerId,
          callbackTime: callbackDate,
          reason: reason || 'Customer requested callback',
          status: 'scheduled',
        },
      });

      console.log(`[CallController] Callback saved: ${callback.id}`);
      return callback;
    } catch (error) {
      console.error(`[CallController] Error saving callback:`, error);
      throw error;
    }
  }

  /**
   * Update customer status
   * @param {String} customerId - Customer ID
   * @param {String} status - New status
   */
  async updateCustomerStatus(customerId, status) {
    try {
      await prisma.customer.update({
        where: { id: customerId },
        data: { 
          status: status,
          lastCallTime: new Date(),
        },
      });

      console.log(`[CallController] Customer ${customerId} status updated to: ${status}`);
    } catch (error) {
      console.error(`[CallController] Error updating customer status:`, error);
    }
  }

  /**
   * Update call status in database
   * @param {String} callId - Unique call identifier
   * @param {String} status - New status
   */
  async updateCallStatus(callId, status) {
    const callData = this.activeCalls.get(callId);
    if (!callData) return;

    callData.status = status;

    try {
      await prisma.callLog.update({
        where: { id: callData.callLogId },
        data: { status: status },
      });
    } catch (error) {
      console.error(`[CallController] Error updating call status:`, error);
    }
  }

  /**
   * Play audio on call
   * @param {String} callId - Unique call identifier
   * @param {Buffer} audioBuffer - Audio buffer to play
   */
  async playAudio(callId, audioBuffer) {
    // This is a simplified version
    // In production, you'd upload audio to cloud storage and use URL
    console.log(`[CallController] Playing audio for call ${callId} (${audioBuffer.length} bytes)`);
    
    // For now, just log - actual implementation depends on provider
    // You would typically:
    // 1. Upload audioBuffer to S3/Cloud Storage
    // 2. Get public URL
    // 3. Call telephony provider's play audio method
  }

  /**
   * End a call
   * @param {String} callId - Unique call identifier
   */
  async endCall(callId) {
    console.log(`[CallController] Ending call ${callId}`);
    
    await this.telephony.endCall(callId);
    await this.cleanupCall(callId);
  }

  /**
   * Handle call completed event
   * @param {String} callId - Unique call identifier
   * @param {String} status - Final call status
   */
  async handleCallCompleted(callId, status) {
    const callData = this.activeCalls.get(callId);
    if (!callData) return;

    console.log(`[CallController] Call ${callId} completed with status: ${status}`);

    try {
      // Get final LLM session data
      const session = llmProcessor.endSession(callId);
      const transcript = session ? llmProcessor.getTranscript(callId) : '';
      const actions = session ? session.actions : [];

      // Calculate duration
      const endTime = new Date();
      const duration = Math.floor((endTime - callData.startTime) / 1000);

      // Update call log
      await prisma.callLog.update({
        where: { id: callData.callLogId },
        data: {
          status: status,
          duration: duration,
          transcript: transcript,
          actions: JSON.stringify(actions),
          endTime: endTime,
        },
      });

      console.log(`[CallController] Call log updated for ${callId}`);

    } catch (error) {
      console.error(`[CallController] Error handling call completion:`, error);
    }

    await this.cleanupCall(callId);
  }

  /**
   * Handle call failed event
   * @param {String} callId - Unique call identifier
   * @param {String} error - Error message
   */
  async handleCallFailed(callId, error) {
    console.error(`[CallController] Call ${callId} failed:`, error);
    
    await this.updateCallStatus(callId, 'failed');
    await this.cleanupCall(callId);
  }

  /**
   * Cleanup call resources
   * @param {String} callId - Unique call identifier
   */
  async cleanupCall(callId) {
    const callData = this.activeCalls.get(callId);
    if (!callData) return;

    console.log(`[CallController] Cleaning up call ${callId}`);

    // Stop STT stream
    if (callData.sttStream) {
      callData.sttStream.stop();
    }

    // End LLM session
    llmProcessor.endSession(callId);

    // Remove from active calls
    this.activeCalls.delete(callId);
  }

  /**
   * Get active call data
   * @param {String} callId - Unique call identifier
   * @returns {Object|null} Call data or null
   */
  getCallData(callId) {
    return this.activeCalls.get(callId) || null;
  }

  /**
   * Get all active calls
   * @returns {Array} List of active calls
   */
  getActiveCalls() {
    return Array.from(this.activeCalls.values());
  }

  /**
   * Get queue status
   * @returns {Object} Queue status
   */
  getQueueStatus() {
    return {
      queueLength: this.callQueue.length,
      activeCalls: this.activeCalls.size,
      isProcessing: this.isProcessingQueue,
    };
  }
}

// Create singleton instance
const callController = new CallController();

module.exports = {
  CallController,
  callController,
};





