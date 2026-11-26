// Accepts a transcript captured from the user's browser on this computer.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const manifest = require('./chatgpt-course-export-manifest.json');
const report = require('./reports/course-library-report.json');
const missing = new Set(report.missing);
const targets = new Map();
for (const entry of manifest.projects.filter(project => project.kind === 'subject')) {
  const subject = entry.name.startsWith('選修物理') ? '物理'
    : entry.name.startsWith('選修化學') ? '化學' : '數學';
  for (const id of entry.conversationIds) {
    if (missing.has(id)) targets.set(id, { project: entry.name, projectId: entry.projectId, subject });
  }
}

const host = '127.0.0.1';
const port = 48173;
const origin = `http://${host}:${port}`;
const route = '/' + randomUUID();

function respond(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; form-action 'self'; frame-ancestors 'none'"
  });
  response.end(body);
}

function save(record) {
  const project = targets.get(record?.conversationId);
  if (!project || typeof record.title !== 'string' || !Array.isArray(record.messages)
      || !record.messages.some(message => message?.role === 'assistant')
      || record.messages.some(message => !['user', 'assistant'].includes(message?.role)
        || typeof message.id !== 'string' || typeof message.text !== 'string' || !message.text.trim())
      || new Set(record.messages.map(message => message.id)).size !== record.messages.length) {
    throw new Error('invalid_transcript');
  }
  const { conversationId, title, messages } = record;
  const folder = path.join(__dirname, 'course-exports', project.subject, `${project.project} [${project.projectId}]`);
  fs.mkdirSync(folder, { recursive: true });
  const destination = path.join(folder, conversationId + '.json');
  const temp = path.join(folder, randomUUID() + '.tmp');
  try {
    fs.writeFileSync(temp, JSON.stringify({ conversationId, title, messages, ...project, source: 'chatgpt-page' }), { flag: 'wx' });
    fs.linkSync(temp, destination);
  } finally {
    fs.rmSync(temp, { force: true });
  }
  targets.delete(conversationId);
  console.log(JSON.stringify({ conversationId, ...project, messages: messages.length, longest: Math.max(...messages.map(message => message.text.length)) }));
}

const server = http.createServer(async (request, response) => {
  if (request.url !== route || request.headers.host !== `${host}:${port}`) {
    respond(response, 404, '找不到匯入頁');
    return;
  }
  if (request.method === 'GET') {
    respond(response, 200, '<!doctype html><meta charset="utf-8"><title>教材單篇匯入</title><form method="post"><label>對話紀錄<textarea name="record" required></textarea></label><button>存到講義桌</button></form>');
    return;
  }
  if (request.method !== 'POST' || request.headers.origin !== origin) {
    respond(response, 403, '來源不符');
    return;
  }
  try {
    const chunks = [];
    let bytes = 0;
    for await (const chunk of request) {
      bytes += chunk.length;
      if (bytes > 8 * 1024 * 1024) throw new Error('transcript_too_large');
      chunks.push(chunk);
    }
    const input = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
    save(JSON.parse(input.get('record')));
    respond(response, 201, '<!doctype html><meta charset="utf-8"><p>已寫入教材檔</p>');
  } catch (error) {
    console.error(error.code || (error instanceof SyntaxError ? 'invalid_json' : error.message));
    if (!response.destroyed) respond(response, 400, '匯入失敗，請查看本機日誌');
  }
});

server.listen(port, host, () => console.log(origin + route));
