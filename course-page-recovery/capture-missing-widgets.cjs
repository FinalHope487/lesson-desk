const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const audit = require('../reports/course-browser-audit-online.json');
const ids = [...new Set(audit.issues.filter(issue => issue.type === 'source-widget-lost').map(issue => issue.id))];
const token = '/' + randomUUID();
const origin = 'http://127.0.0.1:48176';
const folder = path.join(__dirname, 'missing-widgets');
fs.mkdirSync(folder, { recursive: true });

http.createServer(async (req, res) => {
  const reply = (status, body) => {
    res.writeHead(status, {
      'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; form-action 'self'; frame-ancestors 'none'"
    });
    res.end(body);
  };
  if (req.url !== token || req.headers.host !== '127.0.0.1:48176') return reply(404, 'Unknown capture');
  if (req.method === 'GET') return reply(200, `<!doctype html><title>講義卡片補匯</title><div id="targets" hidden>${ids.join(' ')}</div><form method="post"><label>題卡資料<textarea name="capture" required></textarea></label><button>儲存</button></form>`);
  if (req.method !== 'POST' || req.headers.origin !== origin) return reply(403, 'Unknown origin');
  try {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) throw new Error('Capture exceeds 2 MB');
      chunks.push(chunk);
    }
    const records = JSON.parse(new URLSearchParams(Buffer.concat(chunks).toString('utf8')).get('capture'));
    if (!Array.isArray(records) || !records.length || records.some(record =>
      !ids.includes(record.id) || !Array.isArray(record.cards) || !record.cards.length)) throw new Error('Invalid record');
    for (const record of records) {
      const file = path.join(folder, `${record.id}.json`);
      const temp = `${file}.${randomUUID()}.tmp`;
      fs.writeFileSync(temp, JSON.stringify(record), { flag: 'wx' });
      fs.renameSync(temp, file);
    }
    console.log(`Saved ${records.length} captures, ${records.reduce((sum, record) => sum + record.cards.length, 0)} cards`);
    reply(201, `<p id="saved">已儲存 ${records.length} 篇</p><a href="${token}">下一批</a>`);
  } catch (error) {
    console.error(error.name, error.message);
    reply(400, 'Capture failed');
  }
}).listen(48176, '127.0.0.1', () => console.log(origin + token));
