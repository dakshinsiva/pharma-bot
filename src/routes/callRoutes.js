const express = require('express');
const router = express.Router();
const { callController } = require('../telephony/callController');
const prisma = require('../db/prisma');

/**
 * Call Management Routes
 */

/**
 * POST /api/calls/initiate
 * Initiate a single outbound call
 */
router.post('/initiate', async (req, res) => {
  try {
    const { customerId, phone, name } = req.body;

    if (!customerId || !phone) {
      return res.status(400).json({
        success: false,
        error: 'customerId and phone are required',
      });
    }

    const result = await callController.initiateCall(customerId, phone, name || '');

    res.json(result);
  } catch (error) {
    console.error('[CallRoutes] Error initiating call:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/calls/batch
 * Add multiple customers to call queue
 */
router.post('/batch', async (req, res) => {
  try {
    const { customerIds } = req.body;

    if (!customerIds || !Array.isArray(customerIds)) {
      return res.status(400).json({
        success: false,
        error: 'customerIds array is required',
      });
    }

    // Fetch customers from database
    const customers = await prisma.customer.findMany({
      where: {
        id: { in: customerIds },
      },
    });

    if (customers.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No customers found',
      });
    }

    // Add to queue
    await callController.addToQueue(customers);

    res.json({
      success: true,
      message: `Added ${customers.length} customers to call queue`,
      queueStatus: callController.getQueueStatus(),
    });
  } catch (error) {
    console.error('[CallRoutes] Error adding batch:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/calls/queue-all
 * Add all pending customers to call queue
 */
router.post('/queue-all', async (req, res) => {
  try {
    const { status = 'pending' } = req.body;

    const customers = await prisma.customer.findMany({
      where: { status: status },
    });

    if (customers.length === 0) {
      return res.json({
        success: true,
        message: 'No customers to queue',
        count: 0,
      });
    }

    await callController.addToQueue(customers);

    res.json({
      success: true,
      message: `Added ${customers.length} customers to call queue`,
      count: customers.length,
      queueStatus: callController.getQueueStatus(),
    });
  } catch (error) {
    console.error('[CallRoutes] Error queueing all:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/calls/:callId/end
 * End an active call
 */
router.post('/:callId/end', async (req, res) => {
  try {
    const { callId } = req.params;

    const result = await callController.endCall(callId);

    res.json({
      success: result,
      message: result ? 'Call ended' : 'Call not found or already ended',
    });
  } catch (error) {
    console.error('[CallRoutes] Error ending call:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/calls/active
 * Get all active calls
 */
router.get('/active', (req, res) => {
  try {
    const activeCalls = callController.getActiveCalls();

    res.json({
      success: true,
      count: activeCalls.length,
      calls: activeCalls,
    });
  } catch (error) {
    console.error('[CallRoutes] Error getting active calls:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/calls/:callId
 * Get call data
 */
router.get('/:callId', (req, res) => {
  try {
    const { callId } = req.params;
    const callData = callController.getCallData(callId);

    if (!callData) {
      return res.status(404).json({
        success: false,
        error: 'Call not found',
      });
    }

    res.json({
      success: true,
      call: callData,
    });
  } catch (error) {
    console.error('[CallRoutes] Error getting call data:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/calls/queue/status
 * Get queue status
 */
router.get('/queue/status', (req, res) => {
  try {
    const status = callController.getQueueStatus();

    res.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error('[CallRoutes] Error getting queue status:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;






