const logger = require('./src/utils/logger');
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
  logger.info(`Pharmacy calling agent listening on http://localhost:${PORT} (media stream at ws://localhost:${PORT}/media-stream)`);
  logger.info(`Telephony provider: ${process.env.ACTIVE_TELEPHONY_PROVIDER || 'twilio'}; log level: ${process.env.LOG_LEVEL || 'info'}`);
  logger.info('Routes: /health, /api/calls/{initiate,batch,queue-all,active,queue/status}, /api/customers, /api/tts/tamil, /api/llm/process');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

process.on('SIGINT', async () => {
  logger.info('\nSIGINT received, shutting down gracefully...');
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});






