const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const release = path.join(__dirname, '..', 'github-pages-release');
const stage = path.join(__dirname, 'missing-widgets');
const index = path.join(release, 'index.html');
const rows = require('./missing-widgets/matches.json');
const reader = fs.readFileSync(path.join(release, 'reader.js'), 'utf8');
const markdownBlocks = new Function(reader.slice(reader.indexOf('const chartMarker'), reader.indexOf('function tableCells')) + 'return markdownBlocks;')();
const solution = Object.assign({}, ...['a', 'b', 'c', 'local'].map(name => require(`./missing-widgets/solutions-${name}.json`)));
const compound = Object.assign({}, ...['composite-a', 'composite-b', 'composite-c', 'row35-c'].flatMap(name => {
  const file = path.join(stage, `solutions-${name}.json`);
  return fs.existsSync(file) ? [require(file)] : [];
}));
const write = process.argv.includes('--write');
const indexContents = fs.readFileSync(index, 'utf8');
const titlePattern = /^(?:(?:理解|觀念|概念)檢查|第\s*\d+\s*題|題目\s*\d+|進階題)/u;
const parse = contents => JSON.parse(JSON.parse(contents.trim().match(/JSON\.parse\(("[^]*")\);$/)[1]));
const encode = doc => `document.currentScript.lessonRecord = JSON.parse(${JSON.stringify(JSON.stringify(doc))});\n`;
const assetVersion = contents => createHash('sha256').update(contents).digest('hex').slice(0, 12);
const update = (file, contents) => {
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, contents, { flag: 'wx' });
  fs.renameSync(temp, file);
};

function caption(text) {
  return text.replace(/^\*+|\*+$/g, '').trim().replace(/\*\*/g, '');
}

function single(row, result, card) {
  if (!['single-choice', 'multiple-choice'].includes(card.type) || card.options.length < 2) throw new Error(`Invalid choice at row ${row.row}`);
  const [first, ...rest] = card.body;
  const firstLine = first?.split('\n')[0] ?? '';
  const titleInCard = rest.length && firstLine.length < 55 && titlePattern.test(firstLine) && !/[?？]/.test(firstLine);
  const title = titleInCard ? firstLine : row.left.map(caption).find(x => x.length < 65 && titlePattern.test(x) && !/[?？]/.test(x));
  const prompt = (titleInCard ? rest : card.body).join('\n\n') || row.left[0];
  const options = card.options.map((label, i) => ({ label, value: String.fromCharCode(65 + i) }));
  return { type: 'choice', title: title || '理解檢查', prompt, multiple: card.type === 'multiple-choice', options,
    answers: result.answers, explanation: result.explanation };
}

function essayGroup(row, result, card, message) {
  if (row.row === 4) {
    const before = message.slice(0, message.indexOf(row.marker));
    const prompts = [...before.matchAll(/^\*\*(第 [1-4] 題｜[^*]+)\*\*[^\n]*\n([\s\S]+?)(?=^\*\*第 [1-4] 題｜|^作答區\s*$)/gm)];
    if (prompts.length !== 4) throw new Error('Could not identify all four source prompts');
    return prompts.map(([, title, prompt], i) => ({ type: 'essay', title,
      prompt: prompt.trim().replace(/^\\\(([1-9]\d*)\)/gm, '（$1）'), reference: result.references[i], placeholder: '寫下答案與主要理由…' }));
  }
  const originals = card.body.filter(block => /^(?:第\s*\d+\s*題|題目\s*\d+)｜/.test(block));
  if (originals.length !== result.answers.length) throw new Error(`Source essay count mismatch at row ${row.row}`);
  return originals.map((original, i) => {
    const [title, ...rest] = original.split('\n');
    return { type: 'essay', title, prompt: rest.join('\n\n'), reference: `補解：${result.answers[i]}` };
  });
}

function validateQuestion(question, row) {
  if (!question.prompt?.trim() && !question.parts?.some(part => part.text?.trim())) throw new Error(`Empty prompt at row ${row}`);
  if (question.type === 'choice') {
    const values = question.options.map(option => option.value);
    if (values.length < 2 || new Set(values).size !== values.length || question.options.some(option => !option.label?.trim()) ||
      !question.answers?.length || (!question.multiple && question.answers.length !== 1) ||
      question.answers.some(answer => !values.includes(answer)) || !question.explanation?.trim()) throw new Error(`Invalid answer at row ${row}`);
  } else if (question.type === 'essay') {
    if (!question.reference?.trim()) throw new Error(`Missing reference at row ${row}`);
  } else if (question.type === 'fill') {
    const blanks = question.parts.filter(part => part.blank).length;
    if (!blanks || question.answers?.length !== blanks || question.answers.some(answer => !(Array.isArray(answer) ? answer.every(Boolean) && answer.length : answer.trim()))) {
      throw new Error(`Missing blank answer at row ${row}`);
    }
  } else throw new Error(`Unknown question type at row ${row}`);
}

function markNewAnswer(question) {
  const field = question.type === 'essay' ? 'reference' : 'explanation';
  if (!question[field]?.trim() || /^補解/.test(question[field])) return false;
  question[field] = `補解：\n\n${question[field]}`;
  return true;
}

const records = new Map();
const receipt = [];
const pending = [];
const compoundRows = new Set([3, 7, 13, 18, 26, 30, 35, 36]);
for (const row of rows) {
  const result = solution[row.row];
  const composite = compound[row.row]?.questions ?? compound[row.row]?.groups;
  if (compoundRows.has(row.row) ? !composite?.length : !result && row.row !== 37) {
    pending.push(row.row);
    continue;
  }
  const file = path.join(release, 'course-content', `${row.id}.js`);
  if (!records.has(row.id)) records.set(row.id, { file, doc: parse(fs.readFileSync(file, 'utf8')) });
  const entry = records.get(row.id);
  const original = entry.doc.messages.filter(message => message.role === 'assistant')[row.mi];
  const field = typeof original.content === 'string' ? 'content' : 'text';
  const body = original[field];
  const start = `[已補回的原始題卡 ${String(row.row).padStart(2, '0')}]`;

  if (row.row === 37) {
    const existing = entry.doc.quizGroups.find(group => group.start === '第 1 題｜電荷與靜電作用');
    if (existing?.questions.length !== 6 || !existing.questions.every(question => question.type === 'essay' && question.reference?.trim())) {
      throw new Error('Existing six-question group is missing');
    }
    receipt.push({ row: row.row, id: row.id, existing: 6, removed: row.marker });
    if (!body.split(/\r?\n/).includes(row.marker)) continue;
  } else if (entry.doc.quizGroups?.some(group => group.start === start)) {
    const existing = entry.doc.quizGroups.find(group => group.start === start);
    existing.questions.forEach(question => {
      validateQuestion(question, row.row);
      if (markNewAnswer(question)) entry.changed = true;
    });
    receipt.push({ row: row.row, id: row.id, start, questions: existing.questions.length });
    continue;
  }

  const lines = body.split('\n');
  // A sibling marker may already have been replaced. Every replacement spans one original paragraph.
  const blocks = markdownBlocks(body);
  const block = blocks[row.index];
  if (block?.text !== row.marker || block.endLine - block.startLine !== 1) throw new Error(`Source marker changed at row ${row.row}`);

  if (row.row === 37) {
    lines.splice(block.startLine, 1);
  } else {
    const capture = require(path.join(stage, `${row.id}.json`));
    const card = result?.variant !== undefined ? capture.variants[result.variant] : capture.cards[result?.cardIndex ?? row.ranks[0].cardIndex];
    const questions = composite ?? ([1, 4, 6].includes(row.row) ? essayGroup(row, result, card, body) : [single(row, result, card)]);
    questions.forEach(question => {
      validateQuestion(question, row.row);
      markNewAnswer(question);
    });
    if (!entry.doc.quizGroups) entry.doc.quizGroups = [];
    entry.doc.quizGroups.push({ start, count: 1, questions });
    lines[block.startLine] = start;
    receipt.push({ row: row.row, id: row.id, start, questions: questions.length });
  }
  original[field] = lines.join('\n');
  entry.changed = true;
}

let catalog = indexContents;
for (const [id, entry] of records) {
  if (!entry.changed) continue;
  const contents = encode(entry.doc);
  const asset = new RegExp(`("conversationId":"${id}"[^}]*?"version":")[0-9a-f]+(")`, 'g');
  if ([...catalog.matchAll(asset)].length !== 1) throw new Error(`Catalog entry not unique for ${id}`);
  catalog = catalog.replace(asset, (_, before, after) => before + assetVersion(contents) + after);
  if (write) update(entry.file, contents);
}
if (write) {
  if (catalog !== indexContents) update(index, catalog);
  update(path.join(stage, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
}
console.log(JSON.stringify({ locations: receipt.length, questions: receipt.reduce((sum, row) => sum + (row.questions ?? 0), 0), pending, write }));
