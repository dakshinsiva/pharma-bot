const { EventEmitter } = require('events');
const WebSocket = require('ws');

/**
 * One Twilio Media Stream, i.e. the bidirectional audio of one live call.
 *
 * Inbound (customer → us): Twilio sends JSON frames over the WebSocket; the
 * `media` frames carry base64 μ-law at 8 kHz. They are decoded and re-emitted
 * as 'media' events with a Buffer.
 *
 * Outbound (us → customer): `play()` takes synthesised μ-law audio, strips a
 * WAV header if there is one, sends it as a series of `media` frames followed
 * by a `mark`, and resolves when Twilio reports that the mark was reached,
 * i.e. when the customer has actually heard the whole clip. `clear()` flushes
 * whatever is still queued on Twilio's side, which is how barge-in works.
 *
 * Twilio protocol reference: https://www.twilio.com/docs/voice/media-streams/websocket-messages
 */

const SAMPLE_RATE = 8000; // μ-law bytes per second
const DEFAULT_CHUNK_BYTES = 1600; // 200 ms of audio per frame
const MARK_GRACE_MS = 5000;

class TwilioMediaStream extends EventEmitter {
  /**
   * @param {WebSocket} ws - the accepted WebSocket connection
   * @param {Object} [options]
   * @param {String} [options.callId] - our call id, if known from the URL
   * @param {Number} [options.chunkBytes] - bytes of μ-law per outbound frame
   */
  constructor(ws, options = {}) {
    super();
    this.ws = ws;
    this.callId = options.callId || null;
    this.chunkBytes = options.chunkBytes || DEFAULT_CHUNK_BYTES;
    this.streamSid = null;
    this.callSid = null;
    this.started = false;
    this.closed = false;
    this.pendingMarks = new Map(); // mark name → resolve()
    this.markCounter = 0;

    ws.on('message', (data) => this.handleFrame(data));
    ws.on('close', () => this.handleClose());
    ws.on('error', (error) => {
      this.emit('error', error);
      this.handleClose();
    });
  }

  handleFrame(data) {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch (error) {
      this.emit('error', new Error(`Unparseable media stream frame: ${error.message}`));
      return;
    }

    switch (msg.event) {
      case 'connected':
        break;

      case 'start': {
        this.streamSid = msg.start.streamSid;
        this.callSid = msg.start.callSid;
        const custom = msg.start.customParameters || {};
        if (!this.callId && custom.callId) this.callId = custom.callId;
        this.started = true;
        this.emit('start', {
          callId: this.callId,
          streamSid: this.streamSid,
          callSid: this.callSid,
          customParameters: custom,
        });
        break;
      }

      case 'media':
        if (msg.media && msg.media.payload) {
          this.emit('media', Buffer.from(msg.media.payload, 'base64'));
        }
        break;

      case 'mark': {
        const name = msg.mark && msg.mark.name;
        const resolve = this.pendingMarks.get(name);
        if (resolve) {
          this.pendingMarks.delete(name);
          resolve(true);
        }
        this.emit('mark', name);
        break;
      }

      case 'stop':
        this.emit('stop');
        break;

      default:
        break;
    }
  }

  handleClose() {
    if (this.closed) return;
    this.closed = true;
    // Nobody is listening any more; let every pending play() settle.
    for (const resolve of this.pendingMarks.values()) resolve(false);
    this.pendingMarks.clear();
    this.emit('close');
  }

  get isOpen() {
    return !this.closed && this.ws.readyState === WebSocket.OPEN && this.started;
  }

  send(frame) {
    if (this.closed || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(frame));
    return true;
  }

  /**
   * Play μ-law audio to the customer.
   * @param {Buffer} audio - 8 kHz μ-law, with or without a WAV header
   * @returns {Promise<Boolean>} true once Twilio confirms playback finished, false if the stream went away
   */
  play(audio) {
    if (!this.isOpen) return Promise.resolve(false);

    const pcmu = stripWavHeader(audio);
    for (const piece of chunkBuffer(pcmu, this.chunkBytes)) {
      this.send({
        event: 'media',
        streamSid: this.streamSid,
        media: { payload: piece.toString('base64') },
      });
    }

    const name = `clip-${++this.markCounter}`;
    const durationMs = Math.ceil((pcmu.length / SAMPLE_RATE) * 1000);

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this.pendingMarks.delete(name)) resolve(this.isOpen);
      }, durationMs + MARK_GRACE_MS);
      this.pendingMarks.set(name, (reached) => {
        clearTimeout(timer);
        resolve(reached);
      });
      this.send({ event: 'mark', streamSid: this.streamSid, mark: { name } });
    });
  }

  /**
   * Drop any audio Twilio has not played yet (barge-in).
   */
  clear() {
    if (!this.isOpen) return false;
    const sent = this.send({ event: 'clear', streamSid: this.streamSid });
    // Twilio will not send marks for cleared audio; settle those plays now.
    for (const resolve of this.pendingMarks.values()) resolve(false);
    this.pendingMarks.clear();
    return sent;
  }

  close() {
    if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.close();
    }
    this.handleClose();
  }
}

/**
 * Google TTS returns MULAW inside a RIFF/WAVE container; Twilio wants bare
 * samples. Walks the chunk list to the `data` chunk rather than assuming a
 * 44-byte header, and returns the buffer untouched if it is not a WAV file.
 * @param {Buffer} buffer
 * @returns {Buffer}
 */
function stripWavHeader(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return buffer;
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    return buffer;
  }
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === 'data') {
      return buffer.subarray(start, Math.min(start + size, buffer.length));
    }
    offset = start + size + (size % 2); // chunks are word-aligned
  }
  return buffer;
}

function chunkBuffer(buffer, size) {
  const pieces = [];
  for (let i = 0; i < buffer.length; i += size) {
    pieces.push(buffer.subarray(i, Math.min(i + size, buffer.length)));
  }
  return pieces;
}

module.exports = {
  TwilioMediaStream,
  stripWavHeader,
  chunkBuffer,
  SAMPLE_RATE,
};
