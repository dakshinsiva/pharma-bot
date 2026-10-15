const logger = require('../utils/logger');
const express = require('express');
const router = express.Router();
const {
  initializeOrderTaker,
  processOrderTranscript,
  getOrderTranscript,
  getOrderActions,
  cleanupOrderSession,
} = require('../llm/processOrderTaker');

/**
 * Order Taker Routes - Non-conversational mode
 * 
 * This is a separate mode from the conversational agent
 */

/**
 * POST /api/order-taker/init
 * Initialize order taking session
 */
router.post('/init', async (req, res) => {
  try {
    const { callId, customerName } = req.body;

    if (!callId) {
      return res.status(400).json({
        success: false,
        error: 'callId is required',
      });
    }

    const result = await initializeOrderTaker(callId, customerName);

    res.json({
      success: true,
      callId,
      greeting: result.greeting,
    });
  } catch (error) {
    logger.error('Order taker init error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/order-taker/process
 * Process customer transcript
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

    const result = await processOrderTranscript(callId, transcript);

    res.json({
      success: true,
      callId,
      response: result.response,
    });
  } catch (error) {
    logger.error('Order taker process error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/order-taker/transcript/:callId
 * Get full conversation transcript
 */
router.get('/transcript/:callId', async (req, res) => {
  try {
    const { callId } = req.params;
    const transcript = getOrderTranscript(callId);

    if (!transcript) {
      return res.status(404).json({
        success: false,
        error: 'Transcript not found',
      });
    }

    res.json({
      success: true,
      callId,
      transcript,
    });
  } catch (error) {
    logger.error('Get transcript error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/order-taker/actions/:callId
 * Get all actions from conversation
 */
router.get('/actions/:callId', async (req, res) => {
  try {
    const { callId } = req.params;
    const actions = getOrderActions(callId);

    res.json({
      success: true,
      callId,
      actions,
    });
  } catch (error) {
    logger.error('Get actions error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/order-taker/session/:callId
 * Clean up session
 */
router.delete('/session/:callId', async (req, res) => {
  try {
    const { callId } = req.params;
    cleanupOrderSession(callId);

    res.json({
      success: true,
      callId,
      message: 'Session cleaned up',
    });
  } catch (error) {
    logger.error('Cleanup error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;







