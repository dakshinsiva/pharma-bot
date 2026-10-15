const logger = require('../utils/logger');
const OpenAI = require('openai');
const { ORDER_TAKER_PROMPT } = require('./orderTakerPrompt');

/**
 * Order Taker LLM Processor
 * Non-conversational mode for quick order taking
 */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Store conversation history per call
const conversationHistory = new Map();

/**
 * Initialize order taking session
 */
async function initializeOrderTaker(callId, customerName = 'Customer') {
  logger.info(`[OrderTaker] Initializing session for ${customerName} (${callId})`);

  const systemMessage = {
    role: 'system',
    content: ORDER_TAKER_PROMPT,
  };

  const initialMessage = {
    role: 'user',
    content: `Start order taking for customer: ${customerName}`,
  };

  conversationHistory.set(callId, [systemMessage, initialMessage]);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // Faster than GPT-4
      messages: [systemMessage, initialMessage],
      temperature: 0.7,
      max_tokens: 200, // Reduced for faster response
    });

    const response = completion.choices[0].message.content;
    let parsedResponse;

    try {
      parsedResponse = JSON.parse(response);
    } catch (parseError) {
      logger.error('[OrderTaker] JSON parse error:', parseError);
      // Fallback greeting
      parsedResponse = {
        assistant_speech: 'வணக்கம். என்ன மருந்து வேணும்? சொல்லுங்க.',
        agent_action: {
          type: 'NONE',
          order_details: {
            items: [],
            notes: '',
          },
        },
      };
    }

    // Add assistant response to history
    conversationHistory.get(callId).push({
      role: 'assistant',
      content: response,
    });

    logger.info('[OrderTaker] Greeting:', parsedResponse.assistant_speech);

    return {
      greeting: parsedResponse,
      conversationHistory: conversationHistory.get(callId),
    };
  } catch (error) {
    logger.error('[OrderTaker] Initialization error:', error);
    throw error;
  }
}

/**
 * Process customer transcript and extract order
 */
async function processOrderTranscript(callId, transcript) {
  logger.info(`[OrderTaker] Processing for ${callId}: "${transcript}"`);

  const history = conversationHistory.get(callId);
  if (!history) {
    throw new Error(`No conversation history found for call ${callId}`);
  }

  // Add customer message to history
  history.push({
    role: 'user',
    content: transcript,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', // Faster than GPT-4
      messages: history,
      temperature: 0.7,
      max_tokens: 300, // Reduced for faster response
    });

    const response = completion.choices[0].message.content;
    let parsedResponse;

    try {
      parsedResponse = JSON.parse(response);
    } catch (parseError) {
      logger.error('[OrderTaker] JSON parse error:', parseError);
      logger.error('[OrderTaker] Raw response:', response);

      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse LLM response');
      }
    }

    // Add assistant response to history
    history.push({
      role: 'assistant',
      content: response,
    });

    logger.info('[OrderTaker] Response:', parsedResponse.assistant_speech);
    logger.info('[OrderTaker] Action:', parsedResponse.agent_action.type);

    if (parsedResponse.agent_action.type === 'SAVE_ORDER') {
      logger.info('[OrderTaker] Order items:', parsedResponse.agent_action.order_details.items);
    }

    return {
      response: parsedResponse,
      conversationHistory: history,
    };
  } catch (error) {
    logger.error('[OrderTaker] Processing error:', error);
    throw error;
  }
}

/**
 * Get conversation transcript
 */
function getOrderTranscript(callId) {
  const history = conversationHistory.get(callId);
  if (!history) {
    return null;
  }

  return history
    .filter((msg) => msg.role !== 'system')
    .map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
}

/**
 * Get all actions from conversation
 */
function getOrderActions(callId) {
  const history = conversationHistory.get(callId);
  if (!history) {
    return [];
  }

  const actions = [];

  history
    .filter((msg) => msg.role === 'assistant')
    .forEach((msg) => {
      try {
        const parsed = JSON.parse(msg.content);
        if (parsed.agent_action && parsed.agent_action.type !== 'NONE') {
          actions.push({
            type: parsed.agent_action.type,
            details: parsed.agent_action,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (e) {
        // Skip unparseable messages
      }
    });

  return actions;
}

/**
 * Clean up conversation history
 */
function cleanupOrderSession(callId) {
  logger.info(`[OrderTaker] Cleaning up session ${callId}`);
  conversationHistory.delete(callId);
}

module.exports = {
  initializeOrderTaker,
  processOrderTranscript,
  getOrderTranscript,
  getOrderActions,
  cleanupOrderSession,
};



