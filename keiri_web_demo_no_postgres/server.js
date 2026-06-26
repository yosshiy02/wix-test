const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'transactions.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');

function readTransactions() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeTransactions(items) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf8');
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function sendText(res, status, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        req.destroy();
        reject(new Error('送信データが大きすぎます。'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function normalizeTransaction(body) {
  const transaction_date = String(body.transaction_date || '').trim();
  const type = String(body.type || '').trim();
  const partner = String(body.partner || '').trim();
  const description = String(body.description || '').trim();
  const amount = Number(body.amount);
  const tax_type = String(body.tax_type || '10%').trim();
  const payment_method = String(body.payment_method || '').trim();
  const memo = String(body.memo || '').trim();

  const allowedTypes = ['売上', '仕入', '経費', '入金', '支払'];

  if (!transaction_date) throw new Error('日付が未入力です。');
  if (!allowedTypes.includes(type)) throw new Error('区分が不正です。');
  if (!description) throw new Error('内容が未入力です。');
  if (!Number.isFinite(amount) || amount < 0) throw new Error('金額が不正です。');

  return {
    id: Date.now(),
    transaction_date,
    type,
    partner,
    description,
    amount,
    tax_type,
    payment_method,
    memo,
    created_at: new Date().toISOString()
  };
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
  const abs = path.join(PUBLIC_DIR, filePath);

  if (!abs.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  fs.readFile(abs, (err, data) => {
    if (err) {
      sendText(res, 404, 'Not found');
      return;
    }

    const ext = path.extname(abs).toLowerCase();
    const contentType = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8'
    }[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  try {
    if (req.method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, { ok: true, storage: 'JSON file', file: DATA_FILE });
    }

    if (req.method === 'GET' && pathname === '/api/transactions') {
      const items = readTransactions()
        .sort((a, b) => String(b.transaction_date).localeCompare(String(a.transaction_date)) || b.id - a.id)
        .slice(0, 200);
      return sendJson(res, 200, { ok: true, items });
    }

    if (req.method === 'POST' && pathname === '/api/transactions') {
      const raw = await readBody(req);
      const payload = JSON.parse(raw || '{}');
      const item = normalizeTransaction(payload);
      const items = readTransactions();
      items.push(item);
      writeTransactions(items);
      return sendJson(res, 200, { ok: true, item });
    }

    if (req.method === 'GET' && pathname === '/api/transactions.csv') {
      const items = readTransactions()
        .sort((a, b) => String(a.transaction_date).localeCompare(String(b.transaction_date)) || a.id - b.id);

      const header = ['日付', '区分', '取引先', '内容', '金額', '税区分', '支払方法', 'メモ', '作成日時'];
      const rows = items.map(item => [
        item.transaction_date,
        item.type,
        item.partner,
        item.description,
        item.amount,
        item.tax_type,
        item.payment_method,
        item.memo,
        item.created_at
      ]);

      const csv = [header, ...rows].map(cols => cols.map(csvEscape).join(',')).join('\n');
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="transactions.csv"'
      });
      return res.end('\ufeff' + csv);
    }

    return serveStatic(req, res, pathname);
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`Keiri web demo no PostgreSQL running: http://localhost:${PORT}`);
});
