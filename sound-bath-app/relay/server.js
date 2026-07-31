/* Bed relay — the entire backend.
   It forwards messages between devices in the same room and stores nothing.
   No database, no accounts, no session data at rest: a room exists only while
   someone is in it. Deploy on Render / Railway / Fly free tier.
     npm i ws && node server.js        (PORT from env, default 8787)
   Then set RELAY_URL in app/index.html to wss://<your-host>  */
const { WebSocketServer } = require('ws');
const PORT = process.env.PORT || 8787;
const rooms = new Map();                       // code -> Set<socket>

const wss = new WebSocketServer({ port: PORT });
wss.on('connection', (ws, req) => {
  const code = (req.url || '/').slice(1).split('?')[0].toUpperCase().slice(0, 8);
  if (!code) return ws.close();
  if (!rooms.has(code)) rooms.set(code, new Set());
  const room = rooms.get(code);
  room.add(ws);
  ws.on('message', data => {
    for (const peer of room) if (peer !== ws && peer.readyState === 1) peer.send(data.toString());
  });
  const bye = () => { room.delete(ws); if (!room.size) rooms.delete(code); };
  ws.on('close', bye); ws.on('error', bye);
});
console.log('bed relay on :' + PORT);
