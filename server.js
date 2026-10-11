// QR pager POC: zero dependencies. Run: node server.js
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');

function lanIp() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list) if (i.family === 'IPv4' && !i.internal) return i.address;
  }
  return 'localhost';
}
// Set PUBLIC_URL (e.g. an ngrok/Cloudflare tunnel URL) if phones are not on the same Wi-Fi.
const BASE_URL = process.env.PUBLIC_URL || `http://${lanIp()}:${PORT}`;

const orders = new Map();      // token -> { token, number, status, createdAt }
const listeners = new Map();   // token -> Set<res>
let counter = 0;

const json = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
};

function push(token) {
  const o = orders.get(token);
  for (const res of listeners.get(token) || []) {
    res.write(`data: ${JSON.stringify({ status: o.status, number: o.number })}\n\n`);
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } });
  });
}

function serveFile(res, file, type) {
  fs.readFile(path.join(PUBLIC, file), (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (req.method === 'GET' && p === '/') return serveFile(res, 'staff.html', 'text/html; charset=utf-8');
  if (req.method === 'GET' && p.startsWith('/o/')) return serveFile(res, 'customer.html', 'text/html; charset=utf-8');

  if (req.method === 'GET' && p === '/api/config') return json(res, 200, { baseUrl: BASE_URL });

  if (req.method === 'GET' && p === '/api/orders') {
    return json(res, 200, [...orders.values()].sort((a, b) => b.number - a.number));
  }

  if (req.method === 'POST' && p === '/api/orders') {
    const token = crypto.randomBytes(6).toString('hex');
    const order = { token, number: ++counter, status: 'preparing', createdAt: Date.now() };
    orders.set(token, order);
    return json(res, 201, order);
  }

  let m;
  if (req.method === 'GET' && (m = p.match(/^\/api\/orders\/(\w+)$/))) {
    const o = orders.get(m[1]);
    return o ? json(res, 200, o) : json(res, 404, { error: 'not found' });
  }

  if (req.method === 'POST' && (m = p.match(/^\/api\/orders\/(\w+)\/ready$/))) {
    const o = orders.get(m[1]);
    if (!o) return json(res, 404, { error: 'not found' });
    o.status = 'ready';
    push(o.token);
    return json(res, 200, o);
  }

  if (req.method === 'POST' && (m = p.match(/^\/api\/orders\/(\w+)\/done$/))) {
    const o = orders.get(m[1]);
    if (!o) return json(res, 404, { error: 'not found' });
    o.status = 'collected';
    push(o.token);
    return json(res, 200, o);
  }

  // Server-Sent Events stream for the customer page
  if (req.method === 'GET' && (m = p.match(/^\/api\/orders\/(\w+)\/stream$/))) {
    const o = orders.get(m[1]);
    if (!o) { res.writeHead(404); return res.end(); }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(`data: ${JSON.stringify({ status: o.status, number: o.number })}\n\n`);
    if (!listeners.has(o.token)) listeners.set(o.token, new Set());
    listeners.get(o.token).add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 15000);
    req.on('close', () => { clearInterval(ping); listeners.get(o.token)?.delete(res); });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Staff dashboard : http://localhost:${PORT}/`);
  console.log(`Customer QR base: ${BASE_URL}`);
});
