const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const captures = path.join(__dirname, 'chapter-captures');
const release = path.join(__dirname, '..', 'github-pages-release');
const read = name => JSON.parse(fs.readFileSync(path.join(captures, name), 'utf8'));
const version = content => createHash('sha256').update(content).digest('hex').slice(0, 12);
const html = fs.readFileSync(path.join(release, 'index.html'), 'utf8');
const catalog = JSON.parse(html.match(/<script[^>]*id="course-catalog"[^>]*>([\s\S]*?)<\/script>/)?.[1]);
const versions = new Map(catalog.conversations.map(row => [row.conversationId, row.version]));
const queue = read('authoring-queue.json');
if (!Array.isArray(queue) || !queue.length || new Set(queue.map(row => row.id)).size !== queue.length) {
  throw new Error('Invalid or duplicate release queue');
}

let expectedQuestions = 0;
let implantedQuestions = 0;
let implantedLessons = 0;
const failures = [];
for (const { id, heading } of queue) {
  const matches = read(`${id}.json`).sections.filter(section => section.heading === heading && section.count > 0);
  if (matches.length !== 1) {
    failures.push({ id, issue: 'source_capture_ambiguous' });
    continue;
  }
  const capture = matches[0];
  const extras = capture.additionalQuestionFiles ?? [];
  expectedQuestions += capture.count + extras.reduce((sum, entry) => sum + entry.count, 0);
  let draft;
  try {
    draft = read(`gpt-${id}-questions.json`);
  } catch (error) {
    failures.push({ id, issue: error.code === 'ENOENT' ? 'gpt_output_missing' : 'gpt_output_invalid' });
    continue;
  }
  if (!Array.isArray(draft) || draft.length !== capture.count) {
    failures.push({ id, issue: 'gpt_count_mismatch' });
    continue;
  }
  const additions = extras.map(({ file, count }) => ({ questions: read(file), count }));
  if (additions.some(({ questions, count }) => !Array.isArray(questions) || questions.length !== count)) {
    failures.push({ id, issue: 'gpt_extra_count_mismatch' });
    continue;
  }
  draft.push(...additions.flatMap(({ questions }) => questions));
  const asset = fs.readFileSync(path.join(release, 'course-content', `${id}.js`));
  const packed = /^document\.currentScript\.lessonRecord = JSON\.parse\(("[^]*")\);$/.exec(asset.toString('utf8').trim());
  const lesson = packed && JSON.parse(JSON.parse(packed[1]));
  if (lesson?.conversationId !== id || version(asset) !== versions.get(id)) {
    failures.push({ id, issue: 'invalid_release_asset_or_version' });
    continue;
  }
  const groups = (lesson.quizGroups ?? []).filter(group => group.start.startsWith(`[已補回的章末題組 ${capture.messageId} `) &&
    (group.scoreFillPerBlank === true) === (capture.scoreFillPerBlank === true) &&
    JSON.stringify(group.questions) === JSON.stringify(draft));
  const message = lesson.messages.find(entry => entry.role === 'assistant' && entry.id === capture.messageId);
  if (groups.length !== 1 || message?.text?.split(groups[0].start).length !== 2) {
    failures.push({ id, issue: 'gpt_output_not_implanted_exactly' });
    continue;
  }
  implantedLessons++;
  implantedQuestions += draft.length;
}

console.log(JSON.stringify({ expectedLessons: queue.length, expectedQuestions, implantedLessons, implantedQuestions, failures }));
if (failures.length) process.exitCode = 1;
