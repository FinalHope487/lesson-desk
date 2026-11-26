const fs = require('node:fs');
const path = require('node:path');

const captures = path.join(__dirname, 'chapter-captures');
const read = name => JSON.parse(fs.readFileSync(path.join(captures, name), 'utf8'));
const normalize = value => typeof value === 'string' ? value.normalize('NFC').replace(/\s/g, '') : '';
const ids = process.argv.slice(2);
if (!ids.length || ids.some(id => !/^[\da-f]{8}$/.test(id))) throw new Error('Supply one or more eight-character lesson IDs');
const manifest = [];
const failures = [];

for (const prefix of ids) {
  const { id, heading, sections } = read(`gpt-structured-${prefix}.json`);
  if (!id.startsWith(prefix) || sections.length !== 1 || sections[0].status !== 'ready') {
    failures.push({ id, issue: 'source_not_ready' });
    continue;
  }
  const source = sections[0].questionRecords ?? sections[0].records;
  const questionsFile = `gpt-${id}-questions.json`;
  const draft = read(questionsFile);
  if (!Array.isArray(draft) || draft.length !== source?.length) {
    failures.push({ id, issue: 'question_count' });
    continue;
  }
  const previousFailures = failures.length;
  for (const [i, original] of source.entries()) {
    const question = draft[i];
    const group = original.optionGroups?.[0];
    const text = normalize(original.sourceText);
    const prompt = normalize(question?.prompt);
    const labels = Array.isArray(question?.options) ? question.options.map(x => normalize(x?.label)) : [];
    const positions = labels.map(label => label ? text.indexOf(label) : -1);
    const issues = [];
    if (original.index !== i + 1 || !prompt || !text.includes(prompt)) issues.push('prompt_or_order');
    if (original.optionGroups?.length !== 1 || question?.type !== 'choice' ||
        question.multiple !== (group?.type === 'checkbox')) issues.push('control_type');
    if (labels.length !== group?.options.length || positions.some((pos, j) => pos < 0 || (j > 0 && pos <= positions[j - 1])) ||
        question.options?.some((option, j) => option?.value !== String.fromCharCode(65 + j))) issues.push('option_order_or_count');
    if (!Array.isArray(question?.answers) || !question.answers.length || new Set(question.answers).size !== question.answers.length ||
        (!question.multiple && question.answers.length !== 1) ||
        question.answers.some(answer => !question.options?.some(option => option.value === answer)) ||
        !normalize(question.explanation)) issues.push('answers_missing_or_invalid');
    if (issues.length) failures.push({ id, question: i + 1, issues });
  }
  if (failures.length === previousFailures) manifest.push({ id, heading, questionsFile });
}

console.log(JSON.stringify({ manifest, failures }));
if (failures.length) process.exitCode = 1;
