const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const routes = require('./http/routes');

const PORT = Number(process.env.PORT || 3133);
const HTML_FILE = path.join(__dirname, '..', 'pose-library.html');
const MAX_JSON_BODY = 12 * 1024 * 1024;

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(text);
}

function readJson(req, maxBytes = MAX_JSON_BODY) {
  return new Promise((resolve, reject) => {
    let body = '';
    let tooLarge = false;
    req.on('data', chunk => {
      if (tooLarge) return;
      body += chunk;
      if (Buffer.byteLength(body) > maxBytes) {
        tooLarge = true;
        reject(new Error('Payload demasiado grande'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (tooLarge) return;
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('JSON invalido'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  try {
    if (parsed.pathname.startsWith('/api/pose-library/')) {
      const handled = await routes.handle(req, res, parsed, { sendJson, readJson });
      if (handled) return;
    }

    if (req.method === 'GET' && (parsed.pathname === '/' || parsed.pathname === '/pose-library.html')) {
      if (!fs.existsSync(HTML_FILE)) { sendText(res, 404, 'pose-library.html no encontrado'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(HTML_FILE).pipe(res);
      return;
    }

    if (parsed.pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }

    sendJson(res, 404, { error: true, cause: 'No encontrado' });
  } catch (err) {
    sendJson(res, 500, { error: true, cause: err.message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Pose Library escuchando en http://localhost:${PORT}/pose-library.html`);
  console.log('Ctrl+C para detener.');
});
