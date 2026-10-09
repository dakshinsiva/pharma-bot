const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const WebSocket = require('ws');
const { attachMediaStreamServer } = require('../src/telephony/mediaStreamServer');

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

test('upgrades on /media-stream/:callId are routed to the handler with the call id', async () => {
  const server = http.createServer((req, res) => res.end('http still works'));
  const seen = [];
  const wss = attachMediaStreamServer(server, (callId, stream) => {
    seen.push(callId);
    stream.on('start', (info) => seen.push(`start:${info.streamSid}`));
  });
  const port = await listen(server);

  const client = new WebSocket(`ws://127.0.0.1:${port}/media-stream/abc-123`);
  await new Promise((resolve, reject) => { client.on('open', resolve); client.on('error', reject); });
  client.send(JSON.stringify({ event: 'start', start: { streamSid: 'MZ42', callSid: 'CA1' } }));
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.deepEqual(seen, ['abc-123', 'start:MZ42']);

  client.close();
  wss.close();
  await new Promise((resolve) => server.close(resolve));
});

test('other upgrade paths are refused and ordinary HTTP is untouched', async () => {
  const server = http.createServer((req, res) => res.end('ok'));
  let handlerCalls = 0;
  const wss = attachMediaStreamServer(server, () => { handlerCalls += 1; });
  const port = await listen(server);

  const refused = await new Promise((resolve) => {
    const client = new WebSocket(`ws://127.0.0.1:${port}/somewhere-else`);
    client.on('open', () => resolve('opened'));
    client.on('error', () => resolve('refused'));
    client.on('unexpected-response', (req, res) => resolve(`refused:${res.statusCode}`));
  });
  assert.match(refused, /^refused/);
  assert.equal(handlerCalls, 0);

  const body = await new Promise((resolve) => {
    http.get(`http://127.0.0.1:${port}/health`, (res) => {
      let data = ''; res.on('data', (c) => { data += c; }); res.on('end', () => resolve(data));
    });
  });
  assert.equal(body, 'ok');

  wss.close();
  await new Promise((resolve) => server.close(resolve));
});
