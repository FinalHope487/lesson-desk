const fs = require('node:fs');
const path = require('node:path');

const captures = path.join(__dirname, 'chapter-captures');
const read = name => JSON.parse(fs.readFileSync(path.join(captures, name), 'utf8'));
const answerValues = ['A', 'B', 'C', 'D'];

const batch = process.argv[2];
if (!/^\d+$/.test(batch ?? '')) throw new Error('Supply a choice batch number');
const lessons = read(`gpt-choice-input-${batch}.json`);
const failures = [];
const manifest = [];

for (const { id, heading, questions: original } of lessons) {
  const questionsFile = `gpt-${id}-questions.json`;
  let draft;
  try {
    draft = read(questionsFile);
  } catch (error) {
    failures.push({ id, issue: error.code === 'ENOENT' ? 'output_missing' : 'output_unreadable' });
    continue;
  }
  if (!Array.isArray(draft) || draft.length !== original.length) {
    failures.push({ id, issue: 'question_count' });
    continue;
  }
  const priorFailures = failures.length;
  for (const [index, source] of original.entries()) {
    const question = draft[index];
    const multiple = source.optionType === 'checkbox';
    const issues = [];
    if (question?.title !== `第${source.number}題` || question.type !== 'choice' || question.multiple !== multiple) issues.push('type_or_number');
    if (question?.prompt !== source.prompt) issues.push('prompt_changed');
    if (!Array.isArray(question?.options) || question.options.length !== source.options.length ||
        !source.options.every((label, i) => question.options[i]?.value === answerValues[i] && question.options[i]?.label === label)) {
      issues.push('options_changed');
    }
    const answers = question?.answers;
    if (!Array.isArray(answers) || !answers.length || (!multiple && answers.length !== 1) ||
        new Set(answers).size !== answers.length || answers.some(answer => !answerValues.slice(0, source.options.length).includes(answer))) {
      issues.push('invalid_answers');
    }
    if (typeof question?.explanation !== 'string' || !/^補解[\s\S]+$/.test(question.explanation.trim())) issues.push('explanation_missing');
    if (issues.length) failures.push({ id, question: source.number, issues });
  }
  if (failures.length === priorFailures) manifest.push({ id, heading, questionsFile });
}

console.log(JSON.stringify({ manifest, failures }));
if (failures.length) process.exitCode = 1;
