#!/usr/bin/env node
// 題組答案填寫工具：讓 subagent 只讀「缺答案的題目」，再把答案寫回講義資料，不必讀講義全文。
//
//   node quiz-fill.js status                     各講義題組的填寫進度
//   node quiz-fill.js todo  <id前綴> [--limit N]  只列出缺欄位的題目（精簡 JSON）
//   node quiz-fill.js apply <id前綴> <答案.json> [--force] [--dry] [--dir 資料夾]
//
// 答案.json 的格式（key 是 todo 給的 key；只能填 todo 列出的 need 欄位）：
//   { "理解檢查 1": { "answers": ["B"], "explanation": "…", "guidance": "…" },
//     "題目 1｜有效數字": { "reference": "…" } }
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const args = process.argv.slice(2);
const flag = name => args.includes(name);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const dir = path.resolve(option("--dir") ?? path.join(root, "course-content"));
const positional = args.filter((a, i) => !a.startsWith("--") && !["--dir", "--limit"].includes(args[i - 1]));
const [command, idPrefix, answersFile] = positional;

const fail = message => { console.error("錯誤：" + message); process.exit(1); };
const need = {
  choice: ["answers", "explanation", "guidance"],
  fill: ["answers", "explanation", "guidance"],
  essay: ["reference"],
  reveal: ["reference"],
};
const TYPE_NAME = { choice: "選擇題", fill: "填空題", essay: "申論題", reveal: "揭示題" };
const requiredFields = question => {
  const fields = need[question.type];
  if (!fields) throw new Error(`不支援題型「${question.type}」（${question.title || question.prompt || "未命名題目"}）。`);
  return fields;
};

// 題目代號：標題在整份講義裡唯一就用標題，否則（無標題或重複）用「#序號」（全講義由 1 起算）。
function keyed(record) {
  const all = (record.quizGroups ?? []).flatMap(group => group.questions);
  const seen = new Map();
  all.forEach(q => seen.set(q.title, (seen.get(q.title) ?? 0) + 1));
  return all.map((q, i) => ({ key: q.title && seen.get(q.title) === 1 ? q.title : "#" + (i + 1), q }));
}

function load(file) {
  global.document = { currentScript: {} };
  delete require.cache[require.resolve(file)];
  require(file);
  return document.currentScript.lessonRecord;
}

function files() {
  return fs.readdirSync(dir).filter(name => name.endsWith(".js")).map(name => path.join(dir, name));
}

function findFile(prefix) {
  if (!prefix) fail("缺少講義 id（可只打前綴）。");
  const hits = files().filter(file => path.basename(file).startsWith(prefix));
  if (hits.length !== 1) fail(`id 前綴「${prefix}」符合 ${hits.length} 份講義。`);
  return hits[0];
}

const filled = (question, field) => field !== "answers" ? Boolean(question[field])
  : question.type === "fill" ? question.answers.length > 0 && question.answers.every(a => a.length) : question.answers.length > 0;
const missing = question => requiredFields(question).filter(field => !filled(question, field));

if (command === "status") {
  for (const file of files()) {
    const record = load(file);
    if (!record.quizGroups?.length) continue;
    const questions = record.quizGroups.flatMap(group => group.questions);
    const total = questions.reduce((sum, q) => sum + requiredFields(q).length, 0);
    const done = questions.reduce((sum, q) => sum + requiredFields(q).length - missing(q).length, 0);
    console.log(`${path.basename(file, ".js").slice(0, 8)}  ${record.title}  ${done}/${total} 欄已填`);
  }
} else if (command === "todo") {
  const record = load(findFile(idPrefix));
  const limit = Number(option("--limit") ?? Infinity);
  const out = [];
  for (const { key, q } of keyed(record)) {
    const lacking = missing(q);
    if (!lacking.length || out.length >= limit) continue;
    out.push({ key, type: q.type, title: q.title, prompt: q.prompt,
      ...(q.type === "choice" ? { options: q.options.map(o => o.label), multiple: q.multiple } : {}),
      ...(q.type === "fill" ? { blanks: q.parts.filter(p => p.blank || p.text).map(p => p.blank ? { blank: p.blank.hint + (p.blank.unit ? "（單位：" + p.blank.unit + "）" : "") } : p.text), answersFormat: "每格一項的陣列，每項為字串或等價答案陣列" } : {}),
      ...(q.type === "essay" && q.parts ? { parts: q.parts } : {}), need: lacking });
  }
  if (flag("--text")) {
    // 精簡純文字：#序號 [類型] 標題｜題幹｜選項/空格；apply 的 key 可直接用 "#序號"。
    const index = new Map(keyed(record).map(({ q }, i) => [q, i + 1]));
    const lines = [`${record.title}（待填 ${out.length}）`];
    for (const { q } of keyed(record)) {
      const lacking = missing(q);
      if (!lacking.length) continue;
      const tag = { choice: q.multiple ? "複選" : "單選", fill: "填空", essay: "申論", reveal: "揭示" }[q.type];
      let body = q.prompt;
      if (q.type === "choice") body += "\n" + q.options.map(o => o.label).join("\n");
      if (q.type === "fill") { let n = 0; body = q.parts.map(p => p.blank ? `［空${++n}:${p.blank.hint}${p.blank.unit ? " 單位" + p.blank.unit : ""}］` : p.text ?? "").join("\n"); }
      lines.push(`#${index.get(q)} [${tag}${lacking.length < need[q.type].length ? " 缺" + lacking.join("/") : ""}] ${q.title}\n${body}`);
    }
    console.log(lines.join("\n\n"));
  } else
  console.log(JSON.stringify({ lecture: record.title, remaining: out.length, questions: out }, null, 1));
} else if (command === "apply") {
  const file = findFile(idPrefix);
  const record = load(file);
  if (!answersFile) fail("缺少答案 JSON 檔。");
  const input = JSON.parse(fs.readFileSync(answersFile, "utf8"));
  const byKey = new Map(keyed(record).flatMap(({ key, q }, i) => [[key, q], ["#" + (i + 1), q]]));
  const changes = [];
  for (const [key, fields] of Object.entries(input)) {
    const question = byKey.get(key);
    if (!question) fail(`找不到題目「${key}」。`);
    for (const [field, value] of Object.entries(fields)) {
      // 題幹寫「可複選」但資料標成單選時，可在同一題先給 "multiple": true 修正（須排在 answers 之前）。
      if (field === "multiple") { if (question.type !== "choice") fail(`「${key}」不是選擇題。`); question.multiple = value === true; changes.push(key + ".multiple"); continue; }
      // 補題：講義轉檔時遺失的題幹／選項，可用 title、prompt、options 直接改寫（須排在 answers 之前）。
      if (field === "title" || field === "prompt") { if (typeof value !== "string" || !value.trim()) fail(`「${key}」的 ${field} 必須是非空字串。`); question[field] = value.trim(); changes.push(key + "." + field); continue; }
      if (field === "options") {
        if (question.type !== "choice") fail(`「${key}」不是選擇題。`);
        if (!Array.isArray(value) || value.length < 2 || value.some((v, i) => typeof v !== "string" || !v.startsWith("ABCDEFGH"[i] + "."))) fail(`「${key}」的 options 必須是 ["A. …","B. …"] 依序排列的字串陣列。`);
        question.options = value.map(v => ({ value: v[0], label: v })); question.answers = []; changes.push(key + ".options"); continue;
      }
      if (!requiredFields(question).includes(field)) fail(`「${key}」是${TYPE_NAME[question.type]}，不能填 ${field}。`);
      if (field === "answers" && question.type === "fill") {
        const blanks = question.parts.filter(p => p.blank).length;
        const ok = Array.isArray(value) && value.length === blanks && value.every(v => (typeof v === "string" && v.trim()) || (Array.isArray(v) && v.length && v.every(x => typeof x === "string" && x.trim())));
        if (!ok) fail(`「${key}」有 ${blanks} 格，answers 必須是長度 ${blanks} 的陣列，每項為非空字串或字串陣列。`);
      } else if (field === "answers") {
        if (!Array.isArray(value) || !value.length || value.some(v => !question.options.some(o => o.value === v))) fail(`「${key}」的 answers 必須是選項代號陣列，例如 ["B"]。`);
        if (!question.multiple && value.length !== 1) fail(`「${key}」是單選，answers 只能有一個。`);
      } else if (typeof value !== "string" || !value.trim()) fail(`「${key}」的 ${field} 必須是非空字串。`);
      if (filled(question, field) && !flag("--force")) { console.log(`略過 ${key}.${field}（已有內容，加 --force 才覆寫）`); continue; }
      question[field] = field === "answers" && question.type === "fill" ? value.map(v => [].concat(v).map(x => x.trim())) : field === "answers" ? value : value.trim();
      changes.push(`${key}.${field}`);
    }
  }
  console.log(`${flag("--dry") ? "（預覽，未寫入）" : "已寫入"} ${changes.length} 個欄位：` + changes.join("、"));
  if (changes.length && !flag("--dry")) {
    fs.copyFileSync(file, file + ".bak");
    fs.writeFileSync(file, "document.currentScript.lessonRecord = JSON.parse(" + JSON.stringify(JSON.stringify(record)) + ");\n");
    // 更新 index.html 目錄裡這份講義的版本字串，瀏覽器才會重新載入。
    const index = path.join(root, "index.html");
    if (!option("--dir") && fs.existsSync(index)) {
      const id = path.basename(file, ".js");
      const version = crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex").slice(0, 12);
      const html = fs.readFileSync(index, "utf8");
      const pattern = new RegExp(`("conversationId":"${id}"[^}]*?"version":")[0-9a-f]+(")`);
      if (!pattern.test(html)) fail("index.html 目錄找不到這份講義的 version，請手動更新。");
      fs.writeFileSync(index, html.replace(pattern, `$1${version}$2`));
      console.log("已更新目錄版本：" + version);
    }
  }
} else fail("用法：status | todo <id> | apply <id> <答案.json>（見檔案開頭說明）");
