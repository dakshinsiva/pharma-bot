const logger = require('../utils/logger');
const WebSocket = require('ws');
const { TwilioMediaStream } = require('./twilioMediaStream');

const PATH_PATTERN = /^\/media-stream\/([^/?#]+)\/?$/;

/**
 * Accepts Twilio Media Stream WebSocket upgrades on /media-stream/:callId and
 * hands each one to `onStream(callId, stream)`. Any other upgrade path is
 * refused with a 404 so the HTTP server's other routes are unaffected.
 *
 * The `ws` library's `path` option only matches an exact pathname, which is
 * why the call id is parsed here from the upgrade request instead.
 *
 * @param {import('http').Server} httpServer
 * @param {(callId: String, stream: TwilioMediaStream) => void} onStream
 * @returns {WebSocket.Server}
 */
function attachMediaStreamServer(httpServer, onStream) {
  const wss = new WebSocket.Server({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const match = PATH_PATTERN.exec(pathname);
    if (!match) {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    const callId = decodeURIComponent(match[1]);
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, callId);
    });
  });

  wss.on('connection', (ws, request, callId) => {
    const stream = new TwilioMediaStream(ws, { callId });
    onStream(callId, stream);
  });

  wss.on('error', (error) => {
    logger.error('[MediaStream] Server error:', error);
  });

  return wss;
}

module.exports = { attachMediaStreamServer, PATH_PATTERN };
