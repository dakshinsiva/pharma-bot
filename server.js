require('dotenv').config();
const http = require('http');
const { app, setupWebSocketServer } = require('./app');

/**
 * Server Entry Point
 */

const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// Set up WebSocket server for Twilio Media Streams
setupWebSocketServer(server);

// Start server
server.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 Pharmacy Calling Agent - Server Started');
  console.log('='.repeat(60));
  console.log(`📡 HTTP Server: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket Server: ws://localhost:${PORT}/media-stream`);
  console.log(`📞 Telephony Provider: ${process.env.ACTIVE_TELEPHONY_PROVIDER || 'twilio'}`);
  console.log('='.repeat(60));
  console.log('📋 Available Endpoints:');
  console.log('  GET  /health                    - Health check');
  console.log('  POST /api/calls/initiate        - Initiate a call');
  console.log('  POST /api/calls/batch           - Batch call customers');
  console.log('  POST /api/calls/queue-all       - Queue all pending customers');
  console.log('  GET  /api/calls/active          - Get active calls');
  console.log('  GET  /api/calls/queue/status    - Get queue status');
  console.log('  POST /api/customers             - Create customer');
  console.log('  GET  /api/customers             - List customers');
  console.log('  POST /api/tts/tamil             - Tamil text-to-speech');
  console.log('  POST /api/llm/process           - Process transcript');
  console.log('='.repeat(60));
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});






