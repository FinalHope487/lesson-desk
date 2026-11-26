const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const audit = require('../reports/course-browser-audit-local-all-media.json');
const folder = path.join(__dirname, 'image-groups');
const origin = 'http://127.0.0.1:48178';
const token = '/' + randomUUID();
const guidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const maxBodyBytes = 8 * 1024 * 1024;
const maxRecords = 64;
const maxGroups = 512;
const maxImages = 2048;
const maxUrlLength = 4096;
const maxAltLength = 2000;

const expected = new Map(audit.issues
  .filter(issue => issue.type === 'source-image-group-without-assets')
  .map(issue => [issue.id, issue.location?.count]));
if ([...expected].some(([id, count]) => !guidPattern.test(id) || !Number.isInteger(count) || count < 1)) {
  throw new Error('invalid_audit_targets');
}
fs.mkdirSync(folder, { recursive: true });

function pendingTargets() {
  return [...expected]
    .filter(([id]) => !fs.existsSync(path.join(folder, `${id}.json`)))
    .map(([id, count]) => `${id}:${count}`)
    .join(' ');
}

function writeAtomic(file, value) {
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temp, JSON.stringify(value), { flag: 'wx' });
    fs.renameSync(temp, file);
  } finally {
    fs.rmSync(temp, { force: true });
  }
}

function validateUrl(value) {
  if (typeof value !== 'string' || value.length > maxUrlLength) throw new Error('invalid_image_url');
  let url;
  try { url = new URL(value); } catch { throw new Error('invalid_image_url'); }
  if (url.protocol !== 'https:' || url.hostname !== 'images.openai.com' || url.port ||
      url.username || url.password || !url.pathname.startsWith('/static-rsc-4/')) {
    throw new Error('invalid_image_url');
  }
}

function validateRecord(record, seen) {
  if (!record || typeof record !== 'object' || Array.isArray(record) ||
      typeof record.id !== 'string' || !expected.has(record.id) || seen.has(record.id)) {
    throw new Error('invalid_record');
  }
  seen.add(record.id);
  const expectedCount = expected.get(record.id);
  if (!Array.isArray(record.groups) || record.groups.length !== expectedCount) throw new Error('group_count_mismatch');
  for (const group of record.groups) {
    if (!group || typeof group !== 'object' || Array.isArray(group) ||
        typeof group.messageId !== 'string' || group.messageId.length > 100 ||
        !guidPattern.test(group.messageId) || !Array.isArray(group.images) || !group.images.length) {
      throw new Error('invalid_group');
    }
    for (const image of group.images) {
      if (!image || typeof image !== 'object' || Array.isArray(image) || image.ready !== true ||
          typeof image.alt !== 'string' || !image.alt.trim() || image.alt.length > maxAltLength) {
        throw new Error('invalid_image');
      }
      validateUrl(image.url);
    }
  }
}

function reply(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; form-action 'self'; frame-ancestors 'none'"
  });
  res.end(body);
}

http.createServer(async (req, res) => {
  if (req.url !== token || req.headers.host !== '127.0.0.1:48178') return reply(res, 404, 'Unknown capture');
  if (req.method === 'GET') {
    return reply(res, 200, `<!doctype html><meta charset="utf-8"><title>圖片群組擷取</title><div id="targets" hidden>${pendingTargets()}</div><form method="post"><label>圖片群組資料<textarea name="capture" required></textarea></label><button>儲存</button></form>`);
  }
  if (req.method !== 'POST' || req.headers.origin !== origin) return reply(res, 403, 'Unknown origin');
  try {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > maxBodyBytes) throw new Error('batch_too_large');
      chunks.push(chunk);
    }
    const raw = new URLSearchParams(Buffer.concat(chunks).toString('utf8')).get('capture');
    const records = JSON.parse(raw);
    if (!Array.isArray(records) || !records.length || records.length > maxRecords) throw new Error('invalid_batch');
    const seen = new Set();
    let groupTotal = 0;
    let imageTotal = 0;
    for (const record of records) {
      validateRecord(record, seen);
      groupTotal += record.groups.length;
      imageTotal += record.groups.reduce((sum, group) => sum + group.images.length, 0);
    }
    if (groupTotal > maxGroups || imageTotal > maxImages) throw new Error('batch_limit_exceeded');
    for (const record of records) writeAtomic(path.join(folder, `${record.id}.json`), record);
    console.log(JSON.stringify({ saved: records.length, groups: groupTotal, images: imageTotal }));
    reply(res, 201, `<p id="saved">已儲存 ${records.length} 篇</p><a href="${token}">下一批</a>`);
  } catch (error) {
    console.error(error instanceof SyntaxError ? 'invalid_json' : error.message);
    reply(res, 400, 'Capture failed');
  }
}).listen(48178, '127.0.0.1', () => console.log(origin + token));
