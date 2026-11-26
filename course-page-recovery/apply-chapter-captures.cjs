const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');

const release = path.join(__dirname, '..', 'github-pages-release');
const captures = path.join(__dirname, 'chapter-captures');
const index = path.join(release, 'index.html');
const reader = fs.readFileSync(path.join(release, 'reader.js'));
const code = reader.toString('utf8');
const markdownBlocks = new Function(code.slice(code.indexOf('const chartMarker'), code.indexOf('function tableCells')) +
  'return markdownBlocks;')();
const guid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const readJson = name => JSON.parse(fs.readFileSync(path.join(captures, name), 'utf8'));
const version = contents => createHash('sha256').update(contents).digest('hex').slice(0, 12);
const encode = record => `document.currentScript.lessonRecord = JSON.parse(${JSON.stringify(JSON.stringify(record))});\n`;

function atomicWrite(file, contents) {
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temp, contents, { flag: 'wx' });
    fs.renameSync(temp, file);
  } finally {
    fs.rmSync(temp, { force: true });
  }
}

function validateQuestion(question, at) {
  const text = value => typeof value === 'string' && value.trim();
  if (!text(question.title) || !text(question.prompt)) throw new Error(`Missing question text at ${at}`);
  if (question.type === 'reveal' || question.type === 'essay') {
    if (!text(question.reference)) throw new Error(`Missing reference at ${at}`);
  } else if (question.type === 'fill') {
    const parts = Array.isArray(question.parts) ? question.parts : [];
    const blanks = parts.filter(part => part?.blank && typeof part.blank === 'object');
    const answers = question.answers ?? [];
    if (!blanks.length || !parts.some(part => text(part?.text)) ||
        parts.some(part => (text(part?.text) ? 1 : 0) + Number(blanks.includes(part)) !== 1) ||
        !Array.isArray(answers) || answers.length !== blanks.length ||
        answers.some(answer => !Array.isArray(answer) || !answer.length || answer.some(value => !text(value))) ||
        (question.tolerance !== undefined && (!Number.isFinite(question.tolerance) || question.tolerance < 0)) ||
        !text(question.explanation)) {
      throw new Error(`Invalid fill-in parts or answers at ${at}`);
    }
  } else if (question.type === 'choice') {
    const values = question.options?.map(option => option.value) ?? [];
    const answers = question.answers ?? [];
    if (values.length < 2 || new Set(values).size !== values.length || question.options.some(option => !text(option.label)) ||
        !answers.length || (question.multiple !== true && answers.length !== 1) ||
        new Set(answers).size !== answers.length || answers.some(answer => !values.includes(answer)) || !text(question.explanation)) {
      throw new Error(`Invalid choices or answer at ${at}`);
    }
  } else throw new Error(`Unsupported question type at ${at}`);
}

const args = process.argv.slice(2);
const write = args.includes('--write');
const manifestName = args.find(arg => arg !== '--write');
if (!/^[\w-]+\.json$/.test(manifestName ?? '')) throw new Error('Supply a manifest filename from chapter-captures');
const manifest = readJson(manifestName);
if (!Array.isArray(manifest) || !manifest.length) throw new Error('Empty chapter manifest');
const updates = new Map();
const totals = [];
for (const { id, heading, questionsFile, afterBlocks = 1, replaceIntro = false } of manifest) {
  if (!guid.test(id) || !/^[\w-]+\.json$/.test(questionsFile) || !Number.isInteger(afterBlocks) || afterBlocks < 0) {
    throw new Error('Invalid chapter manifest row');
  }
  const original = readJson(`${id}.json`);
  const capturesForHeading = original.sections.filter(section => section.heading === heading && section.count > 0);
  if (capturesForHeading.length !== 1) throw new Error(`Ambiguous chapter capture: ${id}`);
  const capture = capturesForHeading[0];
  const primaryQuestions = readJson(questionsFile);
  if (!Array.isArray(primaryQuestions) || primaryQuestions.length !== capture.count) throw new Error(`Question count mismatch: ${id}`);
  const questions = [...primaryQuestions];
  for (const { file, count } of capture.additionalQuestionFiles ?? []) {
    if (!/^[\w-]+\.json$/.test(file) || file === questionsFile || !Number.isSafeInteger(count) || count < 1) {
      throw new Error(`Invalid extra source entry: ${id}`);
    }
    const extra = readJson(file);
    if (!Array.isArray(extra) || extra.length !== count) throw new Error(`Extra question count mismatch: ${id}`);
    questions.push(...extra);
  }
  questions.forEach((question, i) => validateQuestion(question, `${id}/${i + 1}`));
  const filename = path.join(release, 'course-content', `${id}.js`);
  const old = fs.readFileSync(filename, 'utf8');
  const packed = /^document\.currentScript\.lessonRecord = JSON\.parse\(("[^]*")\);$/.exec(old.trim());
  const record = updates.get(id)?.record ?? (packed && JSON.parse(JSON.parse(packed[1])));
  if (record?.conversationId !== id) throw new Error(`Invalid lesson record: ${id}`);
  const message = record.messages.find(entry => entry.role === 'assistant' && entry.id === capture.messageId && typeof entry.text === 'string');
  if (!message) throw new Error(`Original message unavailable: ${id}`);
  const blocks = markdownBlocks(message.text);
  const headings = blocks.filter(block => block.kind === 'heading' && block.text.replace(/^\*+|\*+$/g, '').trim() === heading);
  if (headings.length !== 1) throw new Error(`Release heading not unique: ${id}`);
  const chapter = headings[0];
  const ordinal = blocks.indexOf(chapter);
  const boundary = blocks.findIndex((block, i) => i > ordinal && block.kind === 'heading' && block.level <= chapter.level);
  const section = blocks.slice(ordinal + 1, boundary < 0 ? undefined : boundary);
  const slot = `[已補回的章末題組 ${capture.messageId} ${ordinal + 1}]`;
  const grading = capture.scoreFillPerBlank === true ? { scoreFillPerBlank: true } : {};
  const previous = (record.quizGroups ?? []).find(group => group.start === slot);
  if (previous) {
    if (!message.text.includes(slot)) throw new Error(`Conflicting prior recovery: ${id}`);
    if (JSON.stringify(previous.questions) === JSON.stringify(questions)) {
      if (grading.scoreFillPerBlank && previous.scoreFillPerBlank !== true) {
        Object.assign(previous, grading);
        updates.set(id, { filename, record });
        totals.push({ id, questions: questions.length, gradingUpdated: true });
      } else totals.push({ id, questions: questions.length, alreadyApplied: true });
      continue;
    }
    const priorCount = previous.questions.length;
    if (priorCount < primaryQuestions.length || priorCount >= questions.length ||
        JSON.stringify(previous.questions) !== JSON.stringify(questions.slice(0, priorCount))) {
      throw new Error(`Conflicting prior recovery: ${id}`);
    }
    previous.questions = questions;
    Object.assign(previous, grading);
    updates.set(id, { filename, record });
    totals.push({ id, questions: questions.length, appended: questions.length - priorCount });
    continue;
  }
  if (section.length < afterBlocks || section.slice(0, afterBlocks).some(block => block.kind === 'heading') ||
      (record.quizGroups ?? []).some(group => section.some(block => block.text.trim() === group.start))) throw new Error(`Chapter insertion is not empty: ${id}`);
  const lines = message.text.replace(/\r\n?/g, '\n').split('\n');
  const before = afterBlocks ? section[afterBlocks - 1].endLine : chapter.endLine;
  const from = replaceIntro ? chapter.endLine : before;
  lines.splice(from, before - from, '', slot, '');
  message.text = lines.join('\n');
  (record.quizGroups ??= []).push({ start: slot, count: 1, questions, ...grading });
  updates.set(id, { filename, record });
  totals.push({ id, questions: questions.length });
}

let html = fs.readFileSync(index, 'utf8');
html = html.replace(/(<script defer src="reader\.js\?v=)[\da-f]+(?=")/, (_, prefix) => prefix + version(reader));
for (const [id, update] of updates) {
  update.contents = encode(update.record);
  const needle = new RegExp(`("conversationId":"${id}"[^}]*"version":")[\\da-f]+(?=")`, 'g');
  if ([...html.matchAll(needle)].length !== 1) throw new Error(`Missing or duplicate catalog record: ${id}`);
  html = html.replace(needle, (_, prefix) => prefix + version(update.contents));
}
if (write) {
  for (const update of updates.values()) atomicWrite(update.filename, update.contents);
  atomicWrite(index, html);
}
console.log(JSON.stringify({ write, updates: totals }));
