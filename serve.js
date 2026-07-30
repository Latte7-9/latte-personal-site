const http = require('http');
const fs = require('fs');
const path = require('path');
const D = __dirname;

const PORT = 8760;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};

function sendHeaders(res, status, contentType) {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache'
  });
}

function serveStatic(req, res) {
  let f = req.url.split('?')[0];
  try {
    f = decodeURIComponent(f);
  } catch (e) {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }
  if (f === '/') f = '/index.html';
  const fp = path.join(D, f);

  fs.readFile(fp, (e, d) => {
    if (!e) {
      const ext = path.extname(f).toLowerCase();
      sendHeaders(res, 200, mime[ext] || 'text/plain');
      res.end(d);
      return;
    }
    if (f.endsWith('/')) {
      fs.readFile(path.join(D, f + 'index.html'), (e2, d2) => {
        if (!e2) {
          sendHeaders(res, 200, 'text/html; charset=utf-8');
          res.end(d2);
          return;
        }
        res.writeHead(404); res.end('404');
      });
    } else if (!path.extname(f)) {
      fs.readFile(path.join(D, f + '/index.html'), (e2, d2) => {
        if (!e2) {
          sendHeaders(res, 200, 'text/html; charset=utf-8');
          res.end(d2);
          return;
        }
        res.writeHead(404); res.end('404');
      });
    } else {
      res.writeHead(404); res.end('404');
    }
  });
}

const server = http.createServer((req, res) => {
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log('Server: http://localhost:' + PORT + '/');
});
