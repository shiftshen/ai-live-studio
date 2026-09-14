import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Execute the real UI connection callbacks without opening a live room.
const source = readFileSync(resolve(process.argv[2], 'src/views/IndexView.vue'), 'utf8');
function callback(section, signature) {
  const tail = source.slice(source.indexOf(section));
  const start = tail.indexOf(signature) + signature.length;
  assert.ok(start >= signature.length, 'Connection callback must exist');
  return tail.slice(start, tail.indexOf('\n    });', start));
}
const liveBody = callback('const connectLive =', "cast.on('open', (ev, info) => {");
const relayBody = callback('const relayCast =', "cast.on('open', () => {");
const noop = () => {};
const log = { info: noop }, message = { success: noop };
const room = { roomNum: '52400000000', roomId: 'fixture-only' };
const live = { getLiveInfo: () => room };
const liveOpen = new Function('cast', 'relayWs', 'info', 'CLog', 'SkMessage', 'roomNum', 'setRoomInputStatus', 'connectStatus', 'setRoomInfo', 'addConsoleMessage', liveBody);
const relayOpen = new Function('cast', 'castWs', 'CLog', 'SkMessage', 'setRelayInputStatus', 'relayStatus', 'addConsoleMessage', 'let relayErrorReported = false;\n' + relayBody);
function fixture() {
  const sent = [];
  const relay = { isConnected: () => true, send: s => sent.push(JSON.parse(s)) };
  return { sent, relay, live: () => liveOpen(live, relay, room, log, message, { value: room.roomNum }, noop, {}, noop, noop), relayOpen: cast => relayOpen(relay, cast, log, message, noop, {}, noop) };
}
const first = fixture();
first.relayOpen(undefined);
first.live();
assert.deepEqual(first.sent, [room], 'Starting relay before room must still send the room handshake');
const second = fixture();
liveOpen(live, undefined, room, log, message, { value: room.roomNum }, noop, {}, noop, noop);
second.relayOpen(live);
assert.deepEqual(second.sent, [room], 'Starting room before relay must send the same handshake');
const third = fixture();
third.live();
assert.deepEqual(third.sent, [room], 'Room open must refresh an already-connected relay handshake');
console.log('PASS 3 real-callback relay startup-order regressions');
