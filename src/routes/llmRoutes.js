const express = require('express');
const router = express.Router();
const { llmProcessor } = require('../llm/processLLM');

/**
 * LLM Processing Routes
 */

/**
 * POST /api/llm/process
 * Process customer transcript and generate response
 */
router.post('/process', async (req, res) => {
  try {
    const { callId, transcript } = req.body;

    if (!callId || !transcript) {
      return res.status(400).json({
        success: false,
        error: 'callId and transcript are required',
      });
    }

    const response = await llmProcessor.processTranscript(callId, transcript);

    res.json({
      success: true,
      response: response,
    });
  } catch (error) {
    console.error('[LLMRoutes] Error processing transcript:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/llm/init
 * Initialize a new LLM session
 */
router.post('/init', (req, res) => {
  try {
    const { callId, customerName } = req.body;

    if (!callId) {
      return res.status(400).json({
        success: false,
        error: 'callId is required',
      });
    }

    const greeting = llmProcessor.initializeSession(callId, customerName || '');

    res.json({
      success: true,
      greeting: greeting,
    });
  } catch (error) {
    console.error('[LLMRoutes] Error initializing session:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/llm/session/:callId
 * Get LLM session data
 */
router.get('/session/:callId', (req, res) => {
  try {
    const { callId } = req.params;
    const session = llmProcessor.getSession(callId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    res.json({
      success: true,
      session: session,
    });
  } catch (error) {
    console.error('[LLMRoutes] Error getting session:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/llm/transcript/:callId
 * Get full conversation transcript
 */
router.get('/transcript/:callId', (req, res) => {
  try {
    const { callId } = req.params;
    const transcript = llmProcessor.getTranscript(callId);

    res.json({
      success: true,
      callId: callId,
      transcript: transcript,
    });
  } catch (error) {
    console.error('[LLMRoutes] Error getting transcript:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/llm/actions/:callId
 * Get all actions for a call
 */
router.get('/actions/:callId', (req, res) => {
  try {
    const { callId } = req.params;
    const actions = llmProcessor.getActions(callId);

    res.json({
      success: true,
      callId: callId,
      actions: actions,
    });
  } catch (error) {
    console.error('[LLMRoutes] Error getting actions:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/llm/stats
 * Get LLM processor statistics
 */
router.get('/stats', (req, res) => {
  try {
    const stats = llmProcessor.getStats();

    res.json({
      success: true,
      stats: stats,
    });
  } catch (error) {
    console.error('[LLMRoutes] Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/llm/session/:callId
 * End and cleanup LLM session
 */
router.delete('/session/:callId', (req, res) => {
  try {
    const { callId } = req.params;
    const finalData = llmProcessor.endSession(callId);

    res.json({
      success: true,
      message: 'Session ended',
      finalData: finalData,
    });
  } catch (error) {
    console.error('[LLMRoutes] Error ending session:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;






