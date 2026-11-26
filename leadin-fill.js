#!/usr/bin/env node
// 前導題填寫工具：只讀小節大綱，不讀講義全文；錨點由 reader.js 的同一套切塊與雜湊算出。
//
//   node leadin-fill.js list [科目]           各講義 id 前綴、標題、已有前導題數
//   node leadin-fill.js outline <id前綴> [--depth 2]  小節大綱（標題＋首段摘要）
//   node leadin-fill.js apply <題目.json>      寫入前導題並更新 index.html 版本
//   node leadin-fill.js check [科目]          列出所有前導題，供自檢
//
// 題目.json：[{ "id": "6af8b191", "sec": "有效數字", "q": "題目", "h": "提示", "a": "解答" }]
// sec 比對小節標題（包含即可，需唯一）。題目＋提示掛在標題上；解答掛在本節講解最後一段
// （遇到理解檢查／練習／例題／題組或下一個同級標題之前）。
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const dir = path.join(root, "course-content");
const reader = fs.readFileSync(path.join(root, "reader.js"), "utf8").replace(/\r\n/g, "\n");
const grab = name => reader.match(new RegExp(`\\nfunction ${name}\\([\\s\\S]*?\\n}\\n`))[0];
// markdownBlocks 用到頂層常數 chartMarker，要一併取出
const { fingerprint, markdownBlocks } = new Function(reader.match(/\nconst chartMarker = [^\n]+\n/)[0] + ["fingerprint", "tableCells", "asMath", "markdownBlocks"]
  .map(grab).join("\n") + "\nreturn { fingerprint, markdownBlocks };")();

const args = process.argv.slice(2);
const [command, arg] = args;
const fail = m => { console.error("錯誤：" + m); process.exit(1); };
const load = file => { global.document = { currentScript: {} }; delete require.cache[file]; require(file); return document.currentScript.lessonRecord; };
const files = () => fs.readdirSync(dir).filter(n => n.endsWith(".js")).map(n => path.join(dir, n));
const find = prefix => { const h = files().filter(f => path.basename(f).startsWith(prefix)); if (h.length !== 1) fail(`id「${prefix}」符合 ${h.length} 份`); return h[0]; };
const stopper = /^(?:\**\s*)?(?:理解檢查|自我檢核|練習|習題|例題|範例|測驗|小試身手|觀念檢查|隨堂|課堂檢核|檢核|章末)/;

// 每個 assistant 訊息的區塊，附上與 renderMessage 相同的錨點。
function blocksOf(record) {
  const out = [];
  for (const message of record.messages) {
    if (message.role !== "assistant") continue;
    const counts = new Map();
    for (const block of markdownBlocks(message.text)) {
      const print = fingerprint(block.text);
      const n = (counts.get(print) ?? 0) + 1;
      counts.set(print, n);
      out.push({ ...block, key: `${message.id}:${print}:${n}`, mid: message.id });
    }
  }
  return out;
}

function sections(record) {
  const blocks = blocksOf(record);
  const groupStarts = new Set((record.quizGroups ?? []).map(g => g.start));
  return blocks.map((b, i) => ({ b, i })).filter(({ b }) => b.kind === "heading").map(({ b, i }) => {
    let last;
    for (let j = i + 1; j < blocks.length; j++) {
      const x = blocks[j];
      if (x.mid !== b.mid || (x.kind === "heading" && x.level <= b.level)) break;
      const t = x.text.replace(/^[#*\s]+/, "");
      if (stopper.test(t) || groupStarts.has(x.text.trim())) break;
      if (["paragraph", "list", "math", "table", "quote"].includes(x.kind)) last = x;
    }
    const first = blocks.slice(i + 1).find(x => x.kind === "paragraph");
    return { head: b, last, first };
  });
}

function bump(file) {
  const id = path.basename(file, ".js");
  const index = path.join(root, "index.html");
  const version = crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex").slice(0, 12);
  const html = fs.readFileSync(index, "utf8");
  const pattern = new RegExp(`("conversationId":"${id}"[^}]*?"version":")[0-9a-f]+(")`);
  if (!pattern.test(html)) fail("index.html 找不到 " + id + " 的 version");
  fs.writeFileSync(index, html.replace(pattern, `$1${version}$2`));
}

const bySubject = s => files().map(f => ({ f, r: load(f) })).filter(({ r }) => !s || (r.subject + r.project).includes(s))
  .sort((a, b) => (a.r.project + a.r.title).localeCompare(b.r.project + b.r.title, "zh-Hant", { numeric: true }));

if (command === "list") {
  for (const { f, r } of bySubject(arg)) console.log(path.basename(f).slice(0, 8), r.project, "｜", r.title, "｜", Object.keys(r.leadIns ?? {}).length);
} else if (command === "outline") {
  const depth = Number(args[args.indexOf("--depth") + 1]) || 3;
  const r = load(find(arg));
  console.log(r.project, r.title);
  for (const s of sections(r)) {
    if (s.head.level > depth) continue;
    const t = (s.first?.text ?? "").replace(/\s+/g, " ").slice(0, 50);
    console.log("  ".repeat(s.head.level - 1) + s.head.text.slice(0, 40) + (s.last ? "" : " [無解答段]") + "｜" + t);
  }
} else if (command === "apply") {
  const items = JSON.parse(fs.readFileSync(arg, "utf8"));
  const touched = new Map();
  for (const it of items) {
    const file = find(it.id);
    const r = touched.get(file) ?? load(file);
    const hits = sections(r).filter(s => s.head.text.includes(it.sec));
    const exact = hits.filter(s => s.head.text.replace(/[#*\s]/g, "").endsWith(it.sec.replace(/\s/g, "")));
    const pick = hits.length === 1 ? hits[0] : exact.length === 1 ? exact[0] : undefined;
    if (!pick) { console.error(`✗ ${it.id}「${it.sec}」符合 ${hits.length} 個小節`); continue; }
    if (!pick.last) { console.error(`✗ ${it.id}「${it.sec}」找不到解答段`); continue; }
    if (!it.q || !it.h || !it.a) { console.error(`✗ ${it.id}「${it.sec}」q/h/a 不完整`); continue; }
    r.leadIns = r.leadIns ?? {};
    const qk = pick.head.key, ak = pick.last.key;
    if (qk === ak) { console.error(`✗ ${it.id} 題目與解答同段`); continue; }
    r.leadIns[qk] = { ...(r.leadIns[qk] ?? {}), question: it.q.trim(), hint: it.h.trim() };
    r.leadIns[ak] = { ...(r.leadIns[ak] ?? {}), answer: it.a.trim() };
    touched.set(file, r);
    console.log(`✓ ${it.id} ${pick.head.text.slice(0, 24)} → 解答於「${pick.last.text.replace(/\s+/g, " ").slice(0, 24)}」`);
  }
  for (const [file, r] of touched) {
    fs.writeFileSync(file, "document.currentScript.lessonRecord = JSON.parse(" + JSON.stringify(JSON.stringify(r)) + ");\n");
    bump(file);
  }
  console.log(`寫入 ${touched.size} 份講義`);
} else if (command === "check") {
  for (const { f, r } of bySubject(arg)) {
    const all = blocksOf(r); const byKey = new Map(all.map((b, i) => [b.key, i]));
    const entries = Object.entries(r.leadIns ?? {});
    if (!entries.length) { console.log("— 無前導題：" + r.title); continue; }
    for (const [k, v] of entries) {
      const at = byKey.get(k);
      const tag = at === undefined ? "【錨點失效】" : "";
      if (v.question) console.log(`${path.basename(f).slice(0, 8)} ${r.title}｜${all[at]?.text.slice(0, 20)}${tag}\n Q:${v.question}\n H:${v.hint}`);
      if (v.answer) console.log(` A:${v.answer}${tag}`);
    }
  }
} else if (!["brief", "section"].includes(command)) fail("指令：list | outline | apply | check");
// 精簡大綱：node leadin-fill.js brief <科目>，每份一行，只列二級小節標題。
if (command === "brief") for (const { f, r } of bySubject(arg)) {
  if (Object.keys(r.leadIns ?? {}).length) continue;
  const hs = sections(r).filter(s => s.head.level === 2 && s.last).map(s => s.head.text.replace(/[*#]/g, "").slice(0, 16));
  console.log(path.basename(f).slice(0, 8) + " " + r.title.slice(0, 14) + "：" + hs.join("/"));
}
// 只讀目標小節：node leadin-fill.js section <id前綴> <小節標題片段>
// 印出標題到解答錨點之間的正文，以及本節內既有檢查題的題幹（各 120 字），不讀其他小節。
if (command === "section") {
  const r = load(find(arg));
  const all = blocksOf(r);
  const hits = sections(r).filter(s => s.head.text.includes(args[2] ?? "\u0000"));
  if (hits.length !== 1) fail(`「${args[2]}」符合 ${hits.length} 個小節`);
  const { head } = hits[0];
  const start = all.findIndex(b => b.key === head.key);
  let inChecks = false;
  console.log("# " + head.text);
  for (let j = start + 1; j < all.length; j++) {
    const b = all[j];
    if (b.mid !== head.mid || (b.kind === "heading" && b.level <= head.level)) break;
    const t = b.text.replace(/^[#*\s]+/, "");
    if (stopper.test(t) || (r.quizGroups ?? []).some(g => g.start === b.text.trim())) inChecks = true;
    console.log(inChecks ? "【檢查】" + b.text.replace(/\s+/g, " ").slice(0, 120) : b.text);
  }
}
