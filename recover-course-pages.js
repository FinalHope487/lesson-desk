// Receive and verify captures from the seven browser-exported course pages.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const root = __dirname;
const manifest = require('./chatgpt-course-export-manifest.json');
const captures = path.join(root, 'course-page-recovery');
const targets = new Map();
for (const entry of manifest.projects.filter(project => project.kind === 'subject')) {
  const subject = entry.name.startsWith('選修物理') ? '物理'
    : entry.name.startsWith('選修化學') ? '化學' : '數學';
  const folder = path.join(root, 'course-exports', subject, `${entry.name} [${entry.projectId}]`);
  for (const id of entry.conversationIds) {
    const file = path.join(folder, id + '.json');
    if (fs.existsSync(file) && JSON.parse(fs.readFileSync(file, 'utf8')).source === 'chatgpt-page') targets.set(id, file);
  }
}

function validate(capture, original) {
  const { conversationId, answers, questions, inventory } = capture;
  const originals = original.messages.filter(message => message.role === 'assistant');
  if (conversationId !== original.conversationId || !Array.isArray(answers) || !Array.isArray(questions)
      || answers.length !== originals.length || !inventory || !Number.isInteger(inventory.svg)
      || !Number.isInteger(inventory.nativeQuestions) || inventory.svg < 1 || inventory.questionHeadings < 1) {
    throw new Error('capture_shape_invalid');
  }
  if (answers.some((answer, index) => answer.id !== originals[index].id
      || typeof answer.text !== 'string' || answer.text.length < originals[index].text.length / 2)) {
    throw new Error('assistant_messages_do_not_match');
  }
  const text = answers.map(answer => answer.text).join('\n');
  const svgCount = (text.match(/^```svg\s*\n<svg[\s>]/gm) ?? []).length;
  const quizIndexes = Array.from(text.matchAll(/^```lesson-quiz\s*\n(\d+)\s*$/gm), m => Number(m[1]));
  if (svgCount !== inventory.svg || quizIndexes.length !== questions.length
      || new Set(quizIndexes).size !== questions.length || inventory.nativeQuestions !== questions.length
      || quizIndexes.some(index => index >= questions.length)) throw new Error('asset_inventory_mismatch');
  if (questions.some(q => !q || !['single-choice', 'multiple-choice', 'fill-in'].includes(q.type)
      || typeof q.prompt !== 'string' || !q.prompt.trim() || !Array.isArray(q.options)
      || (q.type !== 'fill-in' && (q.options.length < 2 || q.options.some(o => typeof o !== 'string' || !o.trim()))))) {
    throw new Error('invalid_question');
  }
}

function write(file, value) {
  const temporary = file + '.' + randomUUID() + '.tmp';
  try {
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function openReceiver() {
  const origin = 'http://127.0.0.1:48175';
  const route = '/' + randomUUID();
  const reply = (res, status, text) => {
    res.writeHead(status, {
      'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; form-action 'self'; frame-ancestors 'none'"
    });
    res.end(text);
  };
  fs.mkdirSync(captures, { recursive: true });
  http.createServer(async (req, res) => {
    if (req.url !== route || req.headers.host !== '127.0.0.1:48175') return reply(res, 404, '找不到匯入頁');
    if (req.method === 'GET') return reply(res, 200, '<!doctype html><meta charset="utf-8"><form method="post"><label>補匯資料<textarea name="capture" required></textarea></label><button>儲存補匯</button></form>');
    if (req.method !== 'POST' || req.headers.origin !== origin) return reply(res, 403, '來源不符');
    try {
      const chunks = [];
      let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 8 * 1024 * 1024) throw new Error('capture_too_large');
        chunks.push(chunk);
      }
      const form = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
      const capture = JSON.parse(form.get('capture'));
      const original = targets.get(capture.conversationId);
      if (!original) throw new Error('target_not_allowed');
      validate(capture, JSON.parse(fs.readFileSync(original, 'utf8')));
      write(path.join(captures, capture.conversationId + '.json'), capture);
      console.log(JSON.stringify({ id: capture.conversationId, ...capture.inventory }));
      reply(res, 201, '補匯已儲存');
    } catch (error) {
      console.error(error instanceof SyntaxError ? 'invalid_json' : error.message);
      if (!res.destroyed) reply(res, 400, '儲存失敗');
    }
  }).listen(48175, '127.0.0.1', () => console.log(origin + route));
}

function applyCaptures() {
  const checked = [];
  const known = require('./plane-motion-export.json');
  const compact = value => value.replace(/\s+/g, '');
  const optionText = value => compact(value.replace(/^\s*[A-Z][.、]\s*/, ''));
  for (const [id, file] of targets) {
    const original = JSON.parse(fs.readFileSync(file, 'utf8'));
    const capture = JSON.parse(fs.readFileSync(path.join(captures, id + '.json'), 'utf8'));
    validate(capture, original);
    const { inventory } = capture;
    const text = capture.answers.map(message => message.text).join('\n');
    const checklists = (text.match(/已完成作答/g) ?? []).length;
    const submissionFields = /繳交綜合習題答案/.test(text) ? 1 : 0;
    if (inventory.unmatchedChoices !== checklists || inventory.unmatchedInputs !== submissionFields) {
      throw new Error('unmatched_question_controls:' + id);
    }
    if (id === known.conversationId) {
      if (inventory.svgInline < 1) throw new Error('free_fall_figure_missing');
      for (const question of capture.questions) {
        const prior = known.questions.find(q => compact(q.prompt) === compact(question.prompt)
          && q.options.length === question.options.length
          && q.options.every((option, index) => optionText(option) === optionText(question.options[index])));
        if (!prior?.visibleCorrectOption) continue;
        const optionIndex = prior.options.findIndex(option => option.startsWith(prior.visibleCorrectOption + '.'));
        if (optionIndex < 0) throw new Error('answer_key_does_not_match');
        question.options = question.options.map((label, index) => ({ label, value: String(index + 1) }));
        question.answers = [String(optionIndex + 1)];
        question.feedback = prior.visibleFeedback;
      }
    }
    const answers = new Map(capture.answers.map(message => [message.id, message.text]));
    checked.push([file, { ...original,
      messages: original.messages.map(message => answers.has(message.id) ? { ...message, text: answers.get(message.id) } : message),
      questions: capture.questions,
      restoredAssets: { ...inventory, progressCheckboxes: checklists, chatSubmissionFields: submissionFields }
    }, inventory]);
  }
  for (const [file, record, inventory] of checked) {
    write(file, record);
    console.log(JSON.stringify({ id: record.conversationId, ...inventory }));
  }
}

try {
  if (targets.size !== 7) throw new Error('expected_seven_browser_captures');
  if (process.argv[2] === '--serve') openReceiver();
  else if (process.argv[2] === '--apply') applyCaptures();
  else throw new Error('請使用 --serve 或 --apply');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
