const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080/ws-market/websocket');
let totalTicks = 0, batches = 0, lastTps = 0, advancers = 0, decliners = 0, symbolCount = 0, ticksSeen = 0;
const start = Date.now();
ws.on('open', () => {
  ws.send('CONNECT\naccept-version:1.2\nhost:localhost\n\n\0');
  setTimeout(() => ws.send('SUBSCRIBE\nid:sub-0\ndestination:/topic/market\n\n\0'), 200);
  setTimeout(() => { console.log(JSON.stringify({elapsedMs: Date.now() - start, batches, ticksSeen, lastTotalTicks: totalTicks, lastTps, advancers, decliners, symbolCount})); process.exit(0); }, 8000);
});
ws.on('message', d => {
  const s = d.toString();
  const idx = s.indexOf('\n\n');
  if (idx < 0) return;
  const body = s.slice(idx + 2).replace(/\0$/, '');
  try {
    const j = JSON.parse(body);
    if (j.ticksPerSecond !== undefined) {
      batches++;
      totalTicks = j.totalTicks;
      lastTps = j.ticksPerSecond;
      advancers = j.advancers;
      decliners = j.decliners;
      symbolCount = j.symbolCount;
      ticksSeen += (Array.isArray(j.updates) ? j.updates.length : 0);
    }
  } catch (e) {}
});
ws.on('error', e => { console.log('err:', e.message); process.exit(1); });
