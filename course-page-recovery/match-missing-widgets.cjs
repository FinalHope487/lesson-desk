const fs = require('node:fs');
const path = require('node:path');
const release = path.join(__dirname, '..', 'github-pages-release');
const reader = fs.readFileSync(path.join(release, 'reader.js'), 'utf8');
const fragment = (from, until) => reader.slice(reader.indexOf(from), reader.indexOf(until));
const { markdownBlocks, fingerprint, messageText, widgetLeftover } = new Function(
  fragment('const chartMarker', 'function tableCells') + fragment('function fingerprint', 'function exportedMessages') +
  fragment('const widgetLostButton', 'function renderMessage') + 'return { markdownBlocks, fingerprint, messageText, widgetLeftover };'
)();
const audit = require('../reports/course-browser-audit-online.json');
const parse = file => JSON.parse(JSON.parse(fs.readFileSync(file, 'utf8').trim().match(/JSON\.parse\(("[^]*")\);$/)[1]));
const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const grams = value => new Set(Array.from({ length: Math.max(0, value.length - 1) }, (_, i) => value.slice(i, i + 2)));
const compare = (a, b) => {
  if (a.length < 4 || b.length < 4) return 0;
  if (a.includes(b) || b.includes(a)) return Math.min(1, Math.min(a.length, b.length) / 12);
  const left = grams(a), right = grams(b);
  return [...left].filter(k => right.has(k)).length / Math.min(left.size, right.size);
};
const maxMatch = (a, b) => Math.max(0, ...a.flatMap(left => b.map(right => compare(left, right))));
const leftOf = (blocks, i) => blocks.slice(Math.max(0, i - 6), i).reverse().filter(x => !widgetLeftover(x.text) && x.kind !== 'rule' && x.text.length > 3);
const rightOf = (blocks, i) => blocks.slice(i + 1, i + 6).filter(x => !widgetLeftover(x.text) && x.kind !== 'rule' && x.text.length > 3);
const textBlocks = blocks => blocks.map(x => normalize(x.text));
const grouped = new Map();
for (const issue of audit.issues.filter(issue => issue.type === 'source-widget-lost')) {
  if (!grouped.has(issue.id)) grouped.set(issue.id, []);
  grouped.get(issue.id).push(issue.location);
}
const summary = [];
const rows = [];
let rowNumber = 0;
for (const [id, gaps] of grouped) {
  const capture = require(path.join(__dirname, 'missing-widgets', id + '.json'));
  const doc = parse(path.join(release, 'course-content', id + '.js'));
  const assistant = doc.messages.filter(x => x.role === 'assistant');
  const allBlocks = assistant.map(x => markdownBlocks(messageText(x)));
  const oldQuestions = [...(doc.questions ?? []), ...(doc.quizGroups ?? []).flatMap(g => g.questions)];
  for (const site of gaps) {
    const row = ++rowNumber;
    const [messageId, hash, occurrence] = site.anchor?.split(':') ?? [];
    const mi = assistant.findIndex(x => (x.id ?? x.role) === messageId);
    const blocks = allBlocks[mi] ?? [];
    const anchor = blocks.flatMap((x, i) => fingerprint(x.text) === hash ? [i] : [])[Number(occurrence) - 1];
    const index = blocks.findIndex((x, i) => i > anchor && x.kind === 'paragraph' && ['lost', 'set'].includes(widgetLeftover(x.text)));
    if (index < 0 || index - anchor > 6) {
      summary.push([row, id.slice(0, 8), 'no adjacent source block', mi, anchor, index]);
      rows.push({ row, id, site, mi, anchor, index });
      continue;
    }
    const left = leftOf(blocks, index);
    const right = rightOf(blocks, index);
    const heads = blocks.slice(0, index).filter(x => x.kind === 'heading').slice(-3);
    const leftText = textBlocks(left), rightText = textBlocks(right), headText = textBlocks(heads);
    const marker = normalize(blocks[index].text.replace(/（無法取得目前的值。）/g, ''));
    const ranks = capture.cards.map((card, cardIndex) => {
      const body = card.body.map(normalize), before = card.before.map(normalize), after = card.after.map(normalize);
      const nearby = Math.max(maxMatch(leftText.slice(0, 2), body), maxMatch(leftText.slice(0, 2), before));
      const context = maxMatch(leftText, [...before, ...body]);
      const following = maxMatch(rightText, after);
      const headings = maxMatch(headText, card.h.map(normalize));
      const same = normalize(card.button) === marker;
      const present = Math.max(0, ...oldQuestions.map(q => maxMatch(body, [normalize(q.prompt), normalize(q.title)])));
      const score = (same ? 3 : 0) + 2.5 * nearby + context + following + .65 * headings;
      return { cardIndex, type: card.type, options: card.options.length, score, same, nearby, present };
    }).sort((a, b) => b.score - a.score);
    rows.push({ row, id, site, mi, anchor, index, marker: blocks[index].text, left: left.map(x => x.text), right: right.map(x => x.text), ranks });
    summary.push([row, id.slice(0, 8), ranks.slice(0, 3).map(r => `${r.cardIndex}:${r.same ? '=' : '-'}${r.type[0]}${r.options}:${r.score.toFixed(1)}/${r.present.toFixed(1)}`).join(' ')]);
  }
}
fs.writeFileSync(path.join(__dirname, 'missing-widgets', 'matches.json'), JSON.stringify(rows, null, 2));
for (const row of summary) console.log(...row);
