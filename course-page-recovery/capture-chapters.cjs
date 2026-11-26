const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const audit = require('../reports/course-browser-audit-local-all-media-chapters.json');
const folder = path.join(__dirname, 'chapter-captures');
const origin = 'http://127.0.0.1:48179';
const token = '/' + randomUUID();
const guidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const maxBodyBytes = 8 * 1024 * 1024;
const maxRecords = 64;
const maxSectionsPerRecord = 256;
const maxTotalSections = 2048;
const maxHeadingLength = 1000;
const maxMessageIdLength = 200;
const maxHtmlLength = 200000;
const maxSectionBytes = 300000;

const expected = new Set(audit.issues
  .filter(issue => issue.type === 'chapter-empty-candidate' || issue.type === 'chapter-question-shortfall')
  .map(issue => issue.id));
if ([...expected].some(id => typeof id !== 'string' || !guidPattern.test(id))) {
  throw new Error('invalid_audit_targets');
}
fs.mkdirSync(folder, { recursive: true });

function pendingTargets() {
  return [...expected].filter(id => !fs.existsSync(path.join(folder, `${id}.json`))).join(' ');
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

function validateRecord(record, seen) {
  if (!record || typeof record !== 'object' || Array.isArray(record) ||
      typeof record.id !== 'string' || !expected.has(record.id) || seen.has(record.id) ||
      !Array.isArray(record.sections) || record.sections.length > maxSectionsPerRecord) {
    throw new Error('invalid_record');
  }
  seen.add(record.id);
  for (const section of record.sections) {
    if (!section || typeof section !== 'object' || Array.isArray(section) ||
        typeof section.heading !== 'string' || section.heading.length > maxHeadingLength ||
        typeof section.messageId !== 'string' || section.messageId.length > maxMessageIdLength) {
      throw new Error('invalid_section');
    }
    if (section.html !== undefined &&
        (typeof section.html !== 'string' || section.html.length > maxHtmlLength)) {
      throw new Error('invalid_section_html');
    }
    if (section.count !== undefined &&
        (!Number.isSafeInteger(section.count) || section.count < 0 || section.count > 1000000)) {
      throw new Error('invalid_section_count');
    }
    if (Buffer.byteLength(JSON.stringify(section), 'utf8') > maxSectionBytes) {
      throw new Error('section_too_large');
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
  if (req.url !== token || req.headers.host !== '127.0.0.1:48179') return reply(res, 404, 'Unknown capture');
  if (req.method === 'GET') {
    return reply(res, 200, `<!doctype html><meta charset="utf-8"><title>章節擷取</title><div id="targets" hidden>${pendingTargets()}</div><form method="post"><label>章節資料<textarea name="capture" required></textarea></label><button>儲存</button></form>`);
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
    let sectionTotal = 0;
    for (const record of records) {
      validateRecord(record, seen);
      sectionTotal += record.sections.length;
    }
    if (sectionTotal > maxTotalSections) throw new Error('batch_limit_exceeded');
    for (const record of records) writeAtomic(path.join(folder, `${record.id}.json`), record);
    console.log(JSON.stringify({ saved: records.length, sections: sectionTotal }));
    reply(res, 201, `<p id="saved">已儲存 ${records.length} 篇</p><a href="${token}">下一批</a>`);
  } catch (error) {
    console.error(error instanceof SyntaxError ? 'invalid_json' : error.message);
    reply(res, 400, 'Capture failed');
  }
}).listen(48179, '127.0.0.1', () => console.log(origin + token));
