const OpenAI = require('openai');
const { 
  SYSTEM_PROMPT, 
  buildUserMessage, 
  getInitialGreeting, 
  getFallbackResponse,
  validateLLMResponse 
} = require('./agentPrompt');

/**
 * LLM Processing Module
 * Handles conversation with OpenAI to generate Tamil responses and action JSONs
 */

class LLMProcessor {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.model = 'gpt-3.5-turbo'; // Faster than GPT-4, good for real-time
    this.conversationSessions = new Map(); // Store conversation history per call
  }

  /**
   * Initialize a new conversation session
   * @param {String} callId - Unique call identifier
   * @param {String} customerName - Customer's name (optional)
   * @returns {Object} Initial greeting response
   */
  initializeSession(callId, customerName = '') {
    const greeting = getInitialGreeting(customerName);
    
    this.conversationSessions.set(callId, {
      history: [{
        role: 'assistant',
        content: greeting.assistant_speech,
      }],
      actions: [greeting.agent_action],
      startTime: new Date(),
    });

    console.log(`[LLM] Session initialized for call ${callId}`);
    
    return greeting;
  }

  /**
   * Process customer transcript and generate response
   * @param {String} callId - Unique call identifier
   * @param {String} transcript - Customer's speech transcript
   * @returns {Promise<Object>} Response with assistant_speech and agent_action
   */
  async processTranscript(callId, transcript) {
    try {
      console.log(`[LLM] Processing transcript for call ${callId}: ${transcript}`);

      // Get or create session
      let session = this.conversationSessions.get(callId);
      if (!session) {
        console.log(`[LLM] No session found for call ${callId}, initializing...`);
        this.initializeSession(callId);
        session = this.conversationSessions.get(callId);
      }

      // Add user message to history
      session.history.push({
        role: 'user',
        content: transcript,
      });

      // Build messages for OpenAI
      const messages = [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        ...session.history,
      ];

      // Call OpenAI API
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 300, // Reduced for faster response
        response_format: { type: 'json_object' }, // Force JSON response
      });

      const responseText = completion.choices[0].message.content;
      console.log(`[LLM] Raw response: ${responseText}`);

      // Parse JSON response
      let response;
      try {
        response = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`[LLM] Failed to parse response JSON:`, parseError);
        response = getFallbackResponse();
      }

      // Validate response format
      if (!validateLLMResponse(response)) {
        console.error(`[LLM] Invalid response format, using fallback`);
        response = getFallbackResponse();
      }

      // Add assistant response to history
      session.history.push({
        role: 'assistant',
        content: response.assistant_speech,
      });

      // Store action
      session.actions.push(response.agent_action);

      // Update session
      this.conversationSessions.set(callId, session);

      console.log(`[LLM] Response for call ${callId}: ${response.assistant_speech}`);
      console.log(`[LLM] Action: ${response.agent_action.type}`);

      return response;

    } catch (error) {
      console.error(`[LLM] Error processing transcript for call ${callId}:`, error);
      
      // Return fallback response on error
      return getFallbackResponse();
    }
  }

  /**
   * Get conversation history for a call
   * @param {String} callId - Unique call identifier
   * @returns {Object|null} Session data or null
   */
  getSession(callId) {
    return this.conversationSessions.get(callId) || null;
  }

  /**
   * Get full conversation transcript
   * @param {String} callId - Unique call identifier
   * @returns {String} Formatted transcript
   */
  getTranscript(callId) {
    const session = this.conversationSessions.get(callId);
    if (!session) return '';

    return session.history
      .map(msg => `${msg.role === 'assistant' ? 'Agent' : 'Customer'}: ${msg.content}`)
      .join('\n');
  }

  /**
   * Get all actions taken during call
   * @param {String} callId - Unique call identifier
   * @returns {Array} List of actions
   */
  getActions(callId) {
    const session = this.conversationSessions.get(callId);
    return session ? session.actions : [];
  }

  /**
   * Check if call should end based on last action
   * @param {String} callId - Unique call identifier
   * @returns {Boolean} True if call should end
   */
  shouldEndCall(callId) {
    const session = this.conversationSessions.get(callId);
    if (!session || session.actions.length === 0) return false;

    const lastAction = session.actions[session.actions.length - 1];
    return lastAction.type === 'END_CALL';
  }

  /**
   * End session and cleanup
   * @param {String} callId - Unique call identifier
   * @returns {Object} Final session data
   */
  endSession(callId) {
    const session = this.conversationSessions.get(callId);
    
    if (session) {
      session.endTime = new Date();
      session.duration = (session.endTime - session.startTime) / 1000; // seconds
      
      console.log(`[LLM] Session ended for call ${callId}, duration: ${session.duration}s`);
      
      // Store final session data before deleting
      const finalData = { ...session };
      
      // Clean up session
      this.conversationSessions.delete(callId);
      
      return finalData;
    }

    return null;
  }

  /**
   * Get session statistics
   * @returns {Object} Statistics about active sessions
   */
  getStats() {
    return {
      activeSessions: this.conversationSessions.size,
      sessions: Array.from(this.conversationSessions.entries()).map(([callId, session]) => ({
        callId,
        messageCount: session.history.length,
        actionCount: session.actions.length,
        duration: session.startTime ? (new Date() - session.startTime) / 1000 : 0,
      })),
    };
  }

  /**
   * Clean up old sessions (prevent memory leaks)
   * @param {Number} maxAgeMinutes - Maximum age in minutes
   */
  cleanupOldSessions(maxAgeMinutes = 60) {
    const now = new Date();
    let cleaned = 0;

    for (const [callId, session] of this.conversationSessions.entries()) {
      const ageMinutes = (now - session.startTime) / 1000 / 60;
      
      if (ageMinutes > maxAgeMinutes) {
        console.log(`[LLM] Cleaning up old session ${callId} (age: ${ageMinutes.toFixed(1)} minutes)`);
        this.conversationSessions.delete(callId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[LLM] Cleaned up ${cleaned} old sessions`);
    }

    return cleaned;
  }
}

// Create singleton instance
const llmProcessor = new LLMProcessor();

// Cleanup old sessions every 30 minutes
setInterval(() => {
  llmProcessor.cleanupOldSessions(60);
}, 30 * 60 * 1000);

module.exports = {
  LLMProcessor,
  llmProcessor,
};



