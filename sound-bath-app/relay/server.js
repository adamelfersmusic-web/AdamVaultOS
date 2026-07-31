/* Bed relay — the entire backend.
   It forwards messages between devices in the same room and stores nothing.
   No database, no accounts, no session data at rest: a room exists only while
   someone is in it.

     npm i && npm start        (PORT from env, default 8787)

   ⚠️ There IS an HTTP server here and it is not decoration. Render, Railway and
   Fly all detect a service by making a plain HTTP request to the port, and they
   health-check the same way. A bare WebSocketServer({ port }) answers nothing on
   HTTP, so the platform decides the service never came up and kills it — with a
   log that says "no open ports detected" and nothing at all about websockets.
   Attaching ws to an http server is what makes this deployable, and GET /
   doubles as a health check you can open in a browser to see it's alive.

   Then set RELAY_URL in app/index.html to wss://<your-host> — or, to try one
   without editing code first, open the app with ?relay=wss://<your-host>  */
const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8787;
const rooms = new Map();                       // code -> Set<socket>

const server = http.createServer((req, res) => {
  // Health check, and something human to look at. Never lists rooms or codes —
  // the count is all anyone outside needs and all we are willing to say.
  // CORS is deliberate: the health check is public by design — it says only
  // "up" and a room count — and letting the app read it means a leader can be
  // told the relay is awake instead of inferring it from a socket that hasn't
  // failed yet.
  res.writeHead(200, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  });
  res.end(JSON.stringify({ ok: true, service: 'bed-relay', rooms: rooms.size }));
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const code = (req.url || '/').slice(1).split('?')[0].toUpperCase().slice(0, 8);
  if (!code) return ws.close();
  if (!rooms.has(code)) rooms.set(code, new Set());
  const room = rooms.get(code);
  room.add(ws);
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', data => {
    for (const peer of room) if (peer !== ws && peer.readyState === 1) peer.send(data.toString());
  });
  const bye = () => { room.delete(ws); if (!room.size) rooms.delete(code); };
  ws.on('close', bye); ws.on('error', bye);
});

/* Free tiers idle out and proxies drop quiet sockets after ~60s. A drone holds
   for fifty minutes without anyone sending a thing, which is exactly the shape
   that gets disconnected — so ping every 30s and drop whatever stops answering.
   The app reconnects with backoff, but not losing the socket is better. */
setInterval(() => {
  for (const room of rooms.values()) {
    for (const ws of room) {
      if (ws.isAlive === false) { ws.terminate(); continue; }
      ws.isAlive = false;
      try { ws.ping(); } catch (e) {}
    }
  }
}, 30000);

server.listen(PORT, () => console.log('bed relay on :' + PORT));
