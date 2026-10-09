const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const WebSocket = require('ws');
const { TwilioMediaStream, stripWavHeader, chunkBuffer } = require('../src/telephony/twilioMediaStream');

/** Minimal stand-in for an accepted ws connection. */
class FakeSocket extends EventEmitter {
  constructor() {
    super();
    this.readyState = WebSocket.OPEN;
    this.sent = [];
  }
  send(data) { this.sent.push(JSON.parse(data)); }
  close() { this.readyState = WebSocket.CLOSED; this.emit('close'); }
  // what Twilio would send us
  receive(frame) { this.emit('message', JSON.stringify(frame)); }
}

function wav(dataBytes, extraChunk = false) {
  // RIFF/WAVE with a 'fmt ' chunk, optionally a 'LIST' chunk, then 'data'
  const fmt = Buffer.alloc(16);
  const parts = [Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.from('fmt '), u32(16), fmt];
  if (extraChunk) parts.push(Buffer.from('LIST'), u32(3), Buffer.from([1, 2, 3, 0])); // odd size + pad byte
  parts.push(Buffer.from('data'), u32(dataBytes.length), dataBytes);
  return Buffer.concat(parts);
}
function u32(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; }

function openStream(callId = 'call-1') {
  const ws = new FakeSocket();
  const stream = new TwilioMediaStream(ws, { callId, chunkBytes: 4 });
  ws.receive({ event: 'connected' });
  ws.receive({ event: 'start', start: { streamSid: 'MZ1', callSid: 'CA1', customParameters: { callId } } });
  return { ws, stream };
}

test('stripWavHeader finds the data chunk and leaves non-WAV buffers alone', () => {
  const samples = Buffer.from([10, 20, 30, 40, 50]);
  assert.deepEqual(stripWavHeader(wav(samples)), samples);
  assert.deepEqual(stripWavHeader(wav(samples, true)), samples);
  assert.deepEqual(stripWavHeader(samples), samples);
  assert.deepEqual(stripWavHeader(Buffer.alloc(0)), Buffer.alloc(0));
});

test('chunkBuffer splits into fixed-size frames with a short tail', () => {
  const pieces = chunkBuffer(Buffer.from([1, 2, 3, 4, 5, 6, 7]), 3);
  assert.deepEqual(pieces.map((p) => [...p]), [[1, 2, 3], [4, 5, 6], [7]]);
});

test('the start frame records the stream and fires once audio can flow', () => {
  const ws = new FakeSocket();
  const stream = new TwilioMediaStream(ws);
  let started = null;
  stream.on('start', (info) => { started = info; });
  assert.equal(stream.isOpen, false);
  ws.receive({ event: 'start', start: { streamSid: 'MZ9', callSid: 'CA9', customParameters: { callId: 'from-twiml' } } });
  assert.equal(stream.isOpen, true);
  assert.equal(stream.streamSid, 'MZ9');
  assert.equal(started.callId, 'from-twiml', 'call id falls back to the TwiML parameter');
});

test('inbound media frames are decoded from base64 to raw bytes', () => {
  const { ws, stream } = openStream();
  const got = [];
  stream.on('media', (buf) => got.push(buf));
  ws.receive({ event: 'media', media: { payload: Buffer.from([7, 8, 9]).toString('base64') } });
  assert.deepEqual([...got[0]], [7, 8, 9]);
});

test('play() strips the header, streams chunks, sends a mark, and resolves when Twilio reaches it', async () => {
  const { ws, stream } = openStream();
  const samples = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const done = stream.play(wav(samples));

  const media = ws.sent.filter((f) => f.event === 'media');
  const marks = ws.sent.filter((f) => f.event === 'mark');
  assert.equal(media.length, 3, 'nine bytes in four-byte chunks');
  assert.ok(media.every((f) => f.streamSid === 'MZ1'));
  const replayed = Buffer.concat(media.map((f) => Buffer.from(f.media.payload, 'base64')));
  assert.deepEqual(replayed, samples, 'what Twilio receives is the bare μ-law, in order');
  assert.equal(marks.length, 1);

  ws.receive({ event: 'mark', mark: { name: marks[0].mark.name } });
  assert.equal(await done, true);
});

test('clear() flushes Twilio and settles any play() still waiting', async () => {
  const { ws, stream } = openStream();
  const done = stream.play(Buffer.from([1, 2, 3]));
  assert.equal(stream.clear(), true);
  assert.ok(ws.sent.some((f) => f.event === 'clear' && f.streamSid === 'MZ1'));
  assert.equal(await done, false);
});

test('a closed socket makes play() resolve false instead of hanging', async () => {
  const { ws, stream } = openStream();
  const pending = stream.play(Buffer.from([1, 2, 3]));
  ws.close();
  assert.equal(await pending, false);
  assert.equal(stream.isOpen, false);
  assert.equal(await stream.play(Buffer.from([1])), false);
});
