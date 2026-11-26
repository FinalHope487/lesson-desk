// Usage: node audit-course-rendering.js [--all | --region <id>:<message>:<first>[-<last>]]
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// This DOM substitute exercises the actual reader without requiring a browser.
// It checks the output tree, not font metrics or visual layout.
class AuditNode {
  constructor(tagName = "", text = "") {
    this.tagName = tagName;
    this.text = text;
    this.children = [];
    this.className = "";
    this.classList = {
      add: (...names) => { this.className += " " + names.join(" "); },
      contains: name => this.className.split(/\s+/).includes(name)
    };
  }

  append(...nodes) {
    this.children.push(...nodes.map(node => typeof node === "string" ? new AuditNode("", node) : node));
  }

  set textContent(value) {
    this.text = value;
    this.children = [];
  }

  get textContent() {
    return this.text + this.children.map(node => node.textContent).join("");
  }

  setAttribute() {}
  addEventListener() {}
  createTHead() { return this.appendChild("thead"); }
  createTBody() { return this.appendChild("tbody"); }
  insertRow() { return this.appendChild("tr"); }

  appendChild(tagName) {
    const node = new AuditNode(tagName);
    this.append(node);
    return node;
  }
}

const root = __dirname;
const idPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

function loadReader() {
  const code = fs.readFileSync(path.join(root, "reader.js"), "utf8");
  const end = code.indexOf("\nfunction judge(");
  if (end < 0) throw new Error("找不到講義桌的渲染入口");
  return vm.runInNewContext(code.slice(0, end) + "\n({ normalize, markdownBlocks, blockElement, inline, fingerprint });", {
    document: {
      createElement: tag => new AuditNode(tag),
      createElementNS: (_, tag) => new AuditNode(tag)
    },
    Blob,
    URL: { createObjectURL: () => "blob:audit" }
  });
}

function readCatalog() {
  for (const name of ["course-library.html", "index.html"]) {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, "utf8");
    const data = html.match(/<script id="course-catalog" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
    if (data) return JSON.parse(data);
  }
  throw new Error("找不到教材目錄，請先建置講義桌");
}

function readLesson(entry) {
  if (!idPattern.test(entry.conversationId)) throw new Error("教材 ID 不符合格式");
  const file = path.join(root, "course-content", entry.conversationId + ".js");
  const payload = fs.readFileSync(file, "utf8").trim().match(
    /^document\.currentScript\.lessonRecord = JSON\.parse\(("(?:[^"\\]|\\[\s\S])*")\);$/
  )?.[1];
  if (!payload) throw new Error("教材檔格式不符：" + entry.conversationId);
  const record = JSON.parse(JSON.parse(payload));
  if (record.conversationId !== entry.conversationId) throw new Error("教材檔 ID 不符：" + entry.conversationId);
  return record;
}

function scanNode(node, result) {
  if (node.classList.contains("math-fallback")) {
    result.formulas++;
    result.failures.push(node.title.replace(/^LaTeX 原文 · /, ""));
    return;
  }
  if (node.tagName === "math") {
    result.formulas++;
    return;
  }
  if (["code", "pre", "figure"].includes(node.tagName)) return;
  if (!node.tagName) {
    for (const match of node.text.matchAll(/\\u(?:\{[a-f\d]{1,6}\}|[a-f\d]{4})|\\[A-Za-z]+|\\[()[\]]|\$\$/gi)) {
      const token = match[0];
      result.residue.push(/^\\u(?:\{|[a-f\d]{4}$)/i.test(token) ? "未解碼的 Unicode 跳脫序列" : token);
    }
    return;
  }
  for (const child of node.children) scanNode(child, result);
}

function main() {
  const args = process.argv.slice(2);
  const all = args.length === 1 && args[0] === "--all";
  const zone = args[0] === "--region" && args.length === 2
    ? /^([a-f0-9-]{36}):(\d+):(\d+)(?:-(\d+))?$/i.exec(args[1]) : null;
  if (args.length && !all && !zone) throw new Error("用法：node audit-course-rendering.js [--all | --region 對話ID:訊息序號:起始區塊[-結束區塊]]");
  const region = zone ? { id: zone[1], message: Number(zone[2]), first: Number(zone[3]), last: Number(zone[4] ?? zone[3]) } : null;
  if (region && (!idPattern.test(region.id) || region.message < 1 || region.first < 1 || region.last < region.first)) {
    throw new Error("區段 ID 或範圍不符");
  }
  const reader = loadReader();
  const catalog = readCatalog();
  const entries = catalog.conversations.filter(entry => region ? entry.conversationId === region.id : all || entry.subject === "數學");
  if (!entries.length) throw new Error("找不到要掃描的教材");
  const reports = [];
  let blocks = 0;
  let formulas = 0;
  let failures = 0;
  let residueBlocks = 0;
  let regionBlocks = 0;

  function audit(render, location) {
    const result = { formulas: 0, failures: [], residue: [] };
    try {
      scanNode(render(), result);
    } catch (error) {
      throw new Error(`無法掃描 ${location.id} 的 ${location.block ?? location.field}（${error.name}: ${error.message}）`,
        { cause: error });
    }
    blocks++;
    formulas += result.formulas;
    failures += result.failures.length;
    if (result.residue.length) residueBlocks++;
    if (result.failures.length || result.residue.length) reports.push({ ...location, ...result });
  }

  for (const entry of entries) {
    const { id, project, messages, questions } = reader.normalize(readLesson(entry), "未命名教材");
    messages.forEach((message, messageIndex) => {
      if (region ? messageIndex + 1 !== region.message : message.role !== "assistant") return;
      const seen = new Map();
      reader.markdownBlocks(message.text).forEach((block, blockIndex) => {
        const print = reader.fingerprint(block.text);
        const occurrence = (seen.get(print) ?? 0) + 1;
        seen.set(print, occurrence);
        const blockNumber = blockIndex + 1;
        if (region) {
          if (blockNumber < region.first || blockNumber > region.last) return;
          regionBlocks++;
        }
        audit(() => reader.blockElement(block), {
          id, project, message: messageIndex + 1, block: blockNumber,
          anchor: `${message.id}:${print}:${occurrence}`, kind: block.kind
        });
      });
    });
    if (!region) questions.forEach((question, index) => {
      const fields = { prompt: question.prompt, feedback: question.feedback };
      question.options.forEach((option, optionIndex) => { fields["option-" + (optionIndex + 1)] = option.label; });
      for (const [field, value] of Object.entries(fields)) {
        if (value) audit(() => reader.inline(new AuditNode("p"), value), { id, project, question: index + 1, field });
      }
    });
  }

  if (region && regionBlocks !== region.last - region.first + 1) throw new Error("指定區段超出教材範圍");
  const unique = (values) => Object.fromEntries([...values.reduce((counts, value) =>
    counts.set(value, (counts.get(value) ?? 0) + 1), new Map())].sort((a, b) => b[1] - a[1]));
  const report = {
    scope: region ?? (all ? "all" : "math"),
    lessons: entries.length, blocks, formulas, failures, residueBlocks,
    byFailure: unique(reports.flatMap(item => item.failures)),
    byResidue: unique(reports.flatMap(item => item.residue)),
    affectedLessons: new Set(reports.map(item => item.id)).size,
    issues: reports
  };
  const filename = path.join("reports", `course-render-audit-${region ? "region" : report.scope}.json`);
  fs.mkdirSync(path.join(root, "reports"), { recursive: true });
  fs.writeFileSync(path.join(root, filename), JSON.stringify(report, null, 2) + "\n", "utf8");
  const { issues, ...summary } = report;
  console.log(JSON.stringify({ filename, ...summary }, null, 2));
  if (region && (failures || residueBlocks || !formulas)) {
    console.error(!formulas ? "指定區段沒有辨識到公式" : "指定區段發現未渲染的公式或疑似 LaTeX");
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error("掃描失敗：" + error.message);
  process.exitCode = 1;
}
