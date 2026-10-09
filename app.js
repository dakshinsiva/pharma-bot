const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { attachMediaStreamServer } = require('./src/telephony/mediaStreamServer');
const { callController } = require('./src/telephony/callController');

// Import routes
const callRoutes = require('./src/routes/callRoutes');
const telephonyRoutes = require('./src/routes/telephonyRoutes');
const llmRoutes = require('./src/routes/llmRoutes');
const ttsRoutes = require('./src/routes/ttsRoutes');
const customerRoutes = require('./src/routes/customerRoutes');
const orderTakerRoutes = require('./src/routes/orderTakerRoutes');

/**
 * Express Application Setup
 */

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files (for voice testing UI)
app.use(express.static('public'));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    provider: process.env.ACTIVE_TELEPHONY_PROVIDER,
  });
});

// API Routes
app.use('/api/calls', callRoutes);
app.use('/api/telephony', telephonyRoutes);
app.use('/api/llm', llmRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/order-taker', orderTakerRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Pharmacy Calling Agent API',
    version: '1.0.0',
    status: 'running',
    modes: {
      conversational: 'Full back-and-forth conversation (default)',
      orderTaker: 'Quick order taking - customer lists all, system confirms',
    },
    endpoints: {
      health: '/health',
      calls: '/api/calls',
      telephony: '/api/telephony',
      llm: '/api/llm (conversational mode)',
      orderTaker: '/api/order-taker (order taking mode)',
      tts: '/api/tts',
      customers: '/api/customers',
      voiceTest: '/voice-test.html',
    },
  });
});

// Voice test redirect for convenience
app.get('/test', (req, res) => {
  res.redirect('/voice-test.html');
});

// 404 handler (only for non-static files)
app.use((req, res, next) => {
  // Check if this might be a static file request
  if (req.path.includes('.')) {
    return next();
  }
  
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Error:', error);
  
  res.status(error.status || 500).json({
    success: false,
    error: error.message || 'Internal server error',
  });
});

/**
 * WebSocket server for Twilio Media Streams.
 * Twilio connects to wss://BASE_URL/media-stream/:callId once the customer
 * answers; the stream is handed to the call controller, which runs the
 * conversation over it (customer audio → STT, synthesised replies → customer).
 */
function setupWebSocketServer(server) {
  const wss = attachMediaStreamServer(server, (callId, stream) => {
    console.log(`[WebSocket] Media stream connected for call ${callId}`);
    callController.attachMediaStream(callId, stream);
  });

  console.log('[WebSocket] Media stream server initialized');
  return wss;
}

module.exports = {
  app,
  setupWebSocketServer,
};

