#!/usr/bin/env node
// 通用題組轉換器：把講義原文裡的題目（單選、多選、填空、申論）轉成 quizGroups 結構。
// 只新增 quizGroups 欄位，不改動原文，所以隨時可以移除該欄位還原。
//
//   node quiz-convert.js analyze [id前綴]          只分析並列出統計與疑點，不寫入
//   node quiz-convert.js write   [id前綴] [--force]  寫入 quizGroups（先備份），並更新目錄版本與報告
//
// 題組判定：相鄰且 ≥2 題成組；夾在正文中間的單題自成一組。正解、詳解、引導、參考答案一律留空。
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const dir = path.join(root, "course-content");
const readerSource = fs.readFileSync(path.join(root, "reader.js"), "utf8");
// 直接取用講義桌自己的段落切法，才能確保「取代範圍」和實際渲染一致。
// 從 chartMarker 開始取，才帶得到 markdownBlocks 用到的圖表標記常數。
const markdownBlocks = new Function(
  readerSource.slice(readerSource.indexOf("const chartMarker"), readerSource.indexOf("function tableCells")) + "; return markdownBlocks;")();

const args = process.argv.slice(2);
const [command, idPrefix] = args.filter(a => !a.startsWith("--"));
const force = args.includes("--force");

// ---------- 小工具 ----------
const NOISE = [/（無法取得目前的值。）/g, /\s*\\?\(目前的選取項目無法使用。\)/g];
const clean = text => NOISE.reduce((t, re) => t.replace(re, ""), text).trim();
const blockMarkdown = b => {
  switch (b.kind) {
    case "heading": return "#".repeat(b.level) + " " + b.text;
    case "math": return "\\[\n" + b.text.trim() + "\n\\]";
    case "list": return b.items.map((item, i) => (b.ordered ? `${i + 1}. ` : "- ") + item).join("\n");
    case "table": return b.rows.join("\n");
    case "code": return "```" + (b.language || "") + "\n" + b.text + "\n```";
    case "quote": return b.text.split("\n").map(l => "> " + l).join("\n");
    default: return b.text;
  }
};
const joinMarkdown = blocks => blocks.map(blockMarkdown).join("\n\n").trim();

const CHOICE_BUTTON = /^\[(?:確認答案|檢查答案)[^\]]*\]/;
const FILL_FIELD = /^\[輸入欄位提示文字：([^\]]*)\]/;
const AREA_FIELD = /^\[多行文字欄位預留文字：([^\]]*)\]/;
const SUBMIT_BUTTON = /^\[(?:提交|送出|查看答案|顯示全部|重新作答|重設|重新練習)[^\]]*\]/;
const QUESTION_TITLE = /(檢查|檢核|題|練習|測驗|挑戰|思考|Quiz)/;
const NUMBERED_TITLE = /^(?:第\s*[0-9０-９]+\s*題|題目\s*[0-9０-９]+|習題\s*[0-9０-９]+|問題\s*[0-9０-９]+|[0-9０-９]+\s*[.、])/;
const EXERCISE_SECTION = /(綜合習題|章末.*(?:習題|測驗)|進階習題|本章習題|綜合理解檢查)/;
const CLOSING = /^(?:本章|完成本章|最後|以上|整體而言|總結|只要能|希望)/;
const QUIZ_LABEL = /^(?:理解檢查|概念檢查|概念預測|觀念檢查|觀念應用|自我檢核|第\s*[0-9０-９]+\s*題)/;
const UNIT =/^[A-Za-zμΩ°%/²³·.\s\\(){}^_\-−]{1,16}$/;

const boldOnly = b => b.kind === "paragraph" && !b.text.includes("\n") && b.text.length < 100 &&
  /^\*\*.+\*\*(?:\s*[（(][^)）]{1,10}[)）])?(?:\s*\d+\s*分)?$/.test(b.text.trim());
const isTitle = b => b.kind === "heading" || boldOnly(b);
const titleText = b => b.kind === "heading" ? b.text : b.text;

function parseTitle(raw) {
  let text = raw.replace(/\*\*/g, "").trim();
  let multiple = false;
  text = text.replace(/\s*[（(]([^)）]{1,10})[)）]\s*(?=\d+\s*分$|$)/, (m, tag) => {
    if (/多選/.test(tag)) multiple = true;
    return /^(?:單選|多選)(?:題)?$/.test(tag) ? "" : m;
  });
  text = text.replace(/\s*[｜|]\s*(單選|多選|複選)\s*$/, (m, tag) => { if (/多選|複選/.test(tag)) multiple = true; return ""; });
  text = text.replace(/\s*\d+\s*分$/, "").trim();
  return { title: text, multiple };
}

// ---------- 選擇題內容解析 ----------
const LETTER = /^([A-E])[.．、)）]\s*(?=\S)/;
function extractChoice(body, titled) {
  const problems = [];
  let optionBlocks = [], options = [], multiple = false, first = -1;
  const lettered = b => (b.kind === "paragraph" && b.text.split("\n").every(l => LETTER.test(l.trim()))) ||
    (b.kind === "list" && b.items.every(item => LETTER.test(item.replace(/^\[[ xX]\]\s*/, ""))));
  const checkboxList = b => b.kind === "list" && b.items.length >= 2 && b.items.every(item => /^\[[ xX]\]\s/.test(item));
  const cb = body.findIndex(checkboxList);
  if (cb >= 0) multiple = true;
  const firstLettered = body.findIndex(lettered);
  if (cb >= 0 || firstLettered >= 0) {
    first = cb >= 0 ? cb : firstLettered;
    for (let i = first; i < body.length && lettered(body[i]); i++) {
      optionBlocks.push(i);
      const b = body[i];
      const lines = b.kind === "list" ? b.items.map(item => item.replace(/^\[[ xX]\]\s*/, "")) : b.text.split("\n");
      for (const line of lines) options.push(clean(line.trim()));
    }
    if (optionBlocks.at(-1) < body.length - 1) problems.push("選項後還有其他內容");
  } else {
    // 無字母選項：最後一個以問號或冒號結尾的段落是題幹，其後的並列段落是選項
    let k = -1;
    body.forEach((b, i) => { if (b.kind === "paragraph" && /[？?：:]\s*(?:（[^）]*）)?$/.test(clean(b.text).replace(/\*\*/g, ""))) k = i; });
    let rest = k >= 0 ? body.slice(k + 1) : [];
    if (k < 0 || rest.length < 2 || rest.length > 6) {
      const n = body.length;
      if (n >= 5 && body.slice(-4).every(b => b.kind === "paragraph" || b.kind === "math")) { k = n - 5; rest = body.slice(-4); problems.push("無字母選項：以最後 4 段推測"); }
      else return { problems: ["找不到選項"] };
    }
    first = k + 1;
    optionBlocks = rest.map((_, i) => first + i);
    options = rest.map(b => clean(blockMarkdown(b)).replace(/\n/g, " "));
  }
  if (options.length < 2 || options.length > 6) problems.push(`選項數 ${options.length}`);
  const values = [];
  const items = options.map((label, i) => {
    const m = label.match(LETTER);
    const value = m ? m[1] : String.fromCharCode(65 + i);
    values.push(value);
    return { value, label: m ? label.replace(LETTER, `${value}. `) : `${value}. ${label}` };
  });
  if (new Set(values).size !== values.length) problems.push("選項代號重複");
  // 沒有標題時，只取緊鄰選項的題幹（含其前面的算式或表格），不吞掉前面的教學內容
  let promptFrom = 0, promptStart = 0, label = "", promptTo = first;
  if (!titled) {
    promptFrom = Math.max(0, first - 1);
    while (promptFrom > 0 && ["math", "table", "code"].includes(body[promptFrom - 1].kind)) promptFrom--;
    // 題目前面若有「理解檢查 ②｜單選」這類標籤段落，連它一起取代，並當成題目標題
    const isLabel = b => b?.kind === "paragraph" && !b.text.includes("\n") && QUIZ_LABEL.test(b.text.replace(/\*\*/g, "").trim());
    let k = -1;
    for (let j = first - 1; j >= Math.max(0, first - 5); j--) if (isLabel(body[j])) { k = j; break; }
    if (k >= 0) {
      label = body[k].text;
      if (k === first - 1) {
        // 標籤夾在題幹與選項之間：題幹是標籤前面那一塊（含緊接的算式），標籤本身只當標題
        promptTo = k;
        promptFrom = Math.max(0, k - 1);
        while (promptFrom > 0 && ["math", "table", "code"].includes(body[promptFrom - 1].kind)) promptFrom--;
        promptStart = promptFrom;
      } else {
        promptFrom = k;      // 取代範圍從標籤開始
        promptStart = k + 1; // 題幹是標籤後面到選項之間
      }
    } else promptStart = promptFrom;
  }
  const prompt = joinMarkdown(body.slice(promptStart, promptTo));
  if (!prompt) problems.push("沒有題幹");
  if (/多選|複選|哪些/.test(prompt.split("\n").slice(-2).join(" ")) || /多選|複選/.test(label)) multiple = true;
  return { prompt, options: items, multiple, problems, promptFrom, label };
}

// ---------- 以區塊為單位的題目抽取 ----------
// 章末習題區段：回傳每個區塊是否落在其中
function exerciseFlags(blocks) {
  const inExercise = new Array(blocks.length).fill(false);
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const level = b.kind === "heading" ? b.level : boldOnly(b) && /^\*\*[0-9０-９一二三四五六七八九十]+[、.]/.test(b.text) ? 2 : 0;
    if (level && level <= 3 && EXERCISE_SECTION.test(b.text.replace(/\*\*/g, ""))) {
      let j = i + 1;
      while (j < blocks.length && !(blocks[j].kind === "heading" && blocks[j].level <= level)) { inExercise[j] = true; j++; }
    }
  }
  return inExercise;
}

// 有些講義的選擇題只剩「題幹＋A～D 選項」，匯出時按鈕文字整個消失。
// 在選項後面補一顆虛擬的 [確認答案]，讓後面的流程當成一般選擇題處理；
// 虛擬區塊的索引記在 synthetic，算 count 時要扣掉（原文並沒有這個區塊）。
const QUESTION_HINT = /[？?：:]\s*(?:\*\*)?\s*(?:[（(][^)）]*[)）])?\s*(?:\*\*)?$|下列|何者|哪[一個些]/;
function injectButtons(blocks) {
  const skip = exerciseFlags(blocks);
  const lettered = b => (b.kind === "paragraph" && b.text.split("\n").every(l => LETTER.test(l.trim()))) ||
    (b.kind === "list" && b.items.every(item => LETTER.test(item.replace(/^\[[ xX]\]\s*/, ""))));
  const out = [], synthetic = new Set();
  for (let i = 0; i < blocks.length; i++) {
    out.push(blocks[i]);
    if (skip[i] || !lettered(blocks[i])) continue;
    let j = i;
    while (j + 1 < blocks.length && lettered(blocks[j + 1]) && !skip[j + 1]) { j++; out.push(blocks[j]); }
    const letters = [];
    for (let k = i; k <= j; k++) {
      const b = blocks[k];
      (b.kind === "list" ? b.items.map(item => item.replace(/^\[[ xX]\]\s*/, "")) : b.text.split("\n")).forEach(l => letters.push(l.trim()[0]));
    }
    const promptBlock = blocks[i - 1];
    const next = blocks[j + 1];
    const hasButton = next?.kind === "paragraph" && CHOICE_BUTTON.test(next.text.split("\n")[0]);
    const consecutive = letters.every((c, n) => c === String.fromCharCode(65 + n));
    const prompted = promptBlock && ["paragraph", "math", "table"].includes(promptBlock.kind) &&
      (promptBlock.kind !== "paragraph" || QUESTION_HINT.test(clean(promptBlock.text).replace(/\*\*/g, "").trim().split("\n").at(-1)) ||
        (blocks[i - 2] && QUESTION_HINT.test(clean(blocks[i - 2].text ?? "").replace(/\*\*/g, ""))));
    if (!hasButton && consecutive && letters.length >= 2 && letters.length <= 6 && prompted) {
      synthetic.add(out.length);
      out.push({ kind: "paragraph", text: "[確認答案]" });
    }
    i = j;
  }
  return { blocks: out, synthetic };
}

function analyzeMessage(rawBlocks) {
  const { blocks, synthetic } = injectButtons(rawBlocks);
  const kind = blocks.map(b => {
    if (b.kind === "rule") return "rule";
    if (b.kind === "paragraph") {
      const first = b.text.split("\n")[0];
      if (CHOICE_BUTTON.test(first)) return "choiceButton";
      if (FILL_FIELD.test(first)) return "fill";
      if (AREA_FIELD.test(first)) return "area";
      if (SUBMIT_BUTTON.test(first)) return "submit";
    }
    // 緊接在「理解檢查 N」標題後的粗體句子是題幹，不是新的題目標題
    if (boldOnly(b) && blocks[blocks.indexOf(b) - 1]?.kind === "heading" && QUESTION_TITLE.test(blocks[blocks.indexOf(b) - 1].text)) return "other";
    return isTitle(b) ? "title" : "other";
  });
  const inExercise = exerciseFlags(blocks);
  // 依標題與分隔線切段
  const segments = [];
  let current = { from: 0, idx: [] };
  const close = () => { if (current.idx.length) segments.push(current); };
  for (let i = 0; i < blocks.length; i++) {
    if (kind[i] === "rule") { close(); current = { from: i + 1, idx: [] }; continue; }
    if (kind[i] === "title") { close(); current = { from: i, idx: [] }; }
    current.idx.push(i);
  }
  close();

  const questions = [], flags = [];
  const push = (q, from, to) => questions.push({ ...q, from, to });
  for (const seg of segments) {
    let idx = seg.idx;
    const head = kind[idx[0]] === "title" ? idx[0] : -1;
    const buttons = idx.filter(i => kind[i] === "choiceButton");
    const fields = idx.filter(i => kind[i] === "fill" || kind[i] === "area");
    const titleParsed = head >= 0 ? parseTitle(titleText(blocks[head])) : { title: "", multiple: false };
    const titleLike = head >= 0 && QUESTION_TITLE.test(titleParsed.title);

    if (buttons.length) {
      // 一個區段可能含多個選擇題：每個按鈕結束一題
      let start = idx[0];
      buttons.forEach((btn, n) => {
        const own = idx.filter(i => i >= start && i < btn);
        let hasTitle = n === 0 && titleLike;
        let bodyIndex = own.filter(i => !(hasTitle && i === head));
        let fromTitle = hasTitle ? own[0] : -1;
        let titleInfo = hasTitle ? titleParsed : { title: "", multiple: false };
        if (hasTitle) {
          // 標題底下夾著一大段教學內容時，不能整段吞進題幹：改從題目自己的標籤（例如「理解檢查 1｜…」）起算
          const lettered = i => blocks[i].kind === "paragraph" && blocks[i].text.split("\n").every(l => LETTER.test(l.trim()));
          const firstOpt = bodyIndex.findIndex(lettered);
          const pre = firstOpt < 0 ? [] : bodyIndex.slice(0, firstOpt);
          const longBody = pre.length > 8 || pre.reduce((s, i) => s + blocks[i].text.length, 0) > 900;
          const plain = i => blocks[i].kind === "paragraph" && !blocks[i].text.includes("\n");
          const labelAt = pre.map(i => plain(i) && QUIZ_LABEL.test(blocks[i].text.replace(/\*\*/g, "").trim())).lastIndexOf(true);
          if (longBody && labelAt >= 0 && labelAt < pre.length - 1) {
            fromTitle = pre[labelAt];
            titleInfo = parseTitle(blocks[pre[labelAt]].text);
            bodyIndex = bodyIndex.slice(labelAt + 1);
          }
        }
        const body = bodyIndex.map(i => blocks[i]);
        const parsed = extractChoice(body, hasTitle);
        const probs = parsed.problems ?? [];
        if (!hasTitle) probs.push("沒有題目標題");
        if (!parsed.options) flags.push({ at: btn, text: `選項遺失或無法解析（${probs[0]}）：${(body[0]?.text ?? "").replace(/\*\*/g, "").slice(0, 40).replace(/\n/g, " ")}` });
        else {
          const from = hasTitle ? fromTitle : bodyIndex[parsed.promptFrom];
          const t = !hasTitle && parsed.label ? parseTitle(parsed.label) : titleInfo;
          push({ type: "choice", title: t.title, prompt: parsed.prompt, options: parsed.options,
            multiple: parsed.multiple || t.multiple, answers: [], explanation: "", guidance: "", problems: probs }, from, btn);
        }
        start = btn + 1;
      });
      continue;
    }
    if (fields.length) {
      const own = idx.filter(i => !(titleLike && i === head));
      const parts = [];
      let text = [];
      const flushText = () => { const t = joinMarkdown(text); if (t) parts.push({ text: t }); text = []; };
      for (let n = 0; n < own.length; n++) {
        const i = own[n], b = blocks[i];
        if (kind[i] === "fill") {
          flushText();
          const blank = { blank: { hint: clean(b.text.match(FILL_FIELD)[1]), unit: "" } };
          const nextBlock = blocks[own[n + 1]];
          if (nextBlock && kind[own[n + 1]] === "other" && nextBlock.kind === "paragraph" && UNIT.test(nextBlock.text.trim())) { blank.blank.unit = nextBlock.text.trim(); n++; }
          parts.push(blank);
        } else if (kind[i] === "area") { flushText(); parts.push({ area: { hint: clean(b.text.match(AREA_FIELD)[1]) } }); }
        else if (kind[i] === "submit") flushText();
        else text.push(b);
      }
      flushText();
      const hasFill = parts.some(p => p.blank);
      const last = own[own.length - 1];
      if (hasFill) {
        const blanks = parts.filter(p => p.blank).length;
        push({ type: "fill", title: titleLike ? titleParsed.title : (head >= 0 ? titleParsed.title : ""), prompt: parts.find(p => p.text)?.text ?? "", parts,
          answers: [], explanation: "", guidance: "", problems: [], blanks }, idx[0], last);
      } else {
        const areas = parts.filter(p => p.area);
        const prompt = parts.filter(p => p.text).map(p => p.text).join("\n\n");
        const q = { type: "essay", title: head >= 0 ? titleParsed.title : "", prompt, reference: "", placeholder: areas[0].area.hint, problems: [] };
        if (areas.length > 1 || parts.findIndex(p => p.area) < parts.length - 1 && parts.slice(parts.findIndex(p => p.area) + 1).some(p => p.text)) q.parts = parts;
        push(q, idx[0], last);
      }
      continue;
    }
    // 沒有作答元件：章末習題區段裡的編號題目，視為申論題
    if (head >= 0 && inExercise[head] && NUMBERED_TITLE.test(titleParsed.title) && kind[head] === "title") {
      let end = idx.length;
      while (end > 1 && blocks[idx[end - 1]].kind === "paragraph" && CLOSING.test(blocks[idx[end - 1]].text.trim())) end--;
      const body = idx.slice(1, end).filter(i => kind[i] !== "submit").map(i => blocks[i]);
      // 有勾選清單或 A.～E. 選項（但原文沒有按鈕）的題目，是選擇題而不是申論題
      // 只認明確的 A.～E. 或勾選清單；「1. 2. 3.」的小題清單是申論題的子問題，不能當選項
      const explicit = body.filter(b => /^(?:[-*]\s*\[[ xX]?\]\s*)?[A-E][.．]\s/m.test(b.text) || (b.kind === "list" && (b.items ?? []).some(t => /^(?:\[[ xX]?\]\s*)?[A-E][.．]\s/.test(String(t.text ?? t))))).length;
      const asChoice = body.length && explicit ? extractChoice(body, true) : null;
      if (asChoice?.options && asChoice.options.length >= 2) {
        push({ type: "choice", title: titleParsed.title, prompt: asChoice.prompt, options: asChoice.options,
          multiple: asChoice.multiple || titleParsed.multiple, answers: [], explanation: "", guidance: "", problems: [] }, idx[0], idx[end - 1]);
      } else if (body.length) push({ type: "essay", title: titleParsed.title, prompt: joinMarkdown(body), reference: "", placeholder: "", problems: [] }, idx[0], idx[end - 1]);
    }
  }
  return { questions, flags, kind, blocks, synthetic };
}

// ---------- 組成題組 ----------
function buildGroups(analysis) {
  const { questions, kind, blocks } = analysis;
  const groups = [];
  const allowedGap = (a, b) => {
    const gap = [];
    for (let i = a + 1; i < b; i++) gap.push(i);
    if (gap.every(i => kind[i] === "rule" || kind[i] === "submit")) return true;
    const hasSubmit = gap.some(i => kind[i] === "submit");
    return hasSubmit && gap.length <= 4 && gap.every(i => kind[i] === "rule" || kind[i] === "submit" || (blocks[i].kind === "paragraph" && blocks[i].text.length < 60));
  };
  let g = null;
  for (const q of questions) {
    if (g && allowedGap(g.to, q.from)) { g.questions.push(q); g.to = q.to; }
    else { g = { from: q.from, to: q.to, questions: [q] }; groups.push(g); }
  }
  for (const grp of groups) {
    // 吃掉緊接在後面的提交按鈕與計分說明
    let end = grp.to;
    for (let i = grp.to + 1, hold = []; i < blocks.length; i++) {
      if (kind[i] === "submit") { end = i; hold = []; continue; }
      if (kind[i] === "rule" || (blocks[i].kind === "paragraph" && blocks[i].text.length < 60 && hold.length < 3)) { hold.push(i); continue; }
      break;
    }
    grp.end = end;
  }
  return groups;
}

function convertRecord(record) {
  const flags = [];
  const out = [];
  const seenStarts = new Map();
  const messages = record.messages.filter(m => m.role === "assistant");
  const perMessage = messages.map(m => markdownBlocks(m.text));
  perMessage.forEach(blocks => blocks.forEach(b => { const t = b.text.trim(); seenStarts.set(t, (seenStarts.get(t) ?? 0) + 1); }));
  perMessage.forEach((blocks, mi) => {
    const analysis = analyzeMessage(blocks);
    analysis.flags.forEach(f => flags.push(f.text));
    for (const grp of buildGroups(analysis)) {
      // analysis.blocks 可能含虛擬按鈕，起點與數量都要換回原文的區塊
      let synthBefore = 0, synthInside = 0;
      for (const s of analysis.synthetic) { if (s < grp.from) synthBefore++; else if (s <= grp.end) synthInside++; }
      grp.from -= synthBefore; grp.end -= synthBefore + synthInside; grp.to -= synthBefore;
      let startBlock = blocks[grp.from];
      let start = startBlock.text.trim();
      let dropTitle = false;
      if (seenStarts.get(start) > 1) {
        // 標題文字重複（例如好幾個「理解檢查」）：講義桌只認第一個，所以改從下一個唯一的區塊開始，
        // 標題留在原文當小標，題目卡片就不再重複標題。
        const second = blocks[grp.from + 1];
        if (isTitle(startBlock) && second && grp.from + 1 <= grp.end && !["code", "rule"].includes(second.kind) && seenStarts.get(second.text.trim()) === 1) {
          grp.from++; startBlock = second; start = second.text.trim(); dropTitle = true;
          flags.push(`起點文字重複，改由下一個區塊起算：${blocks[grp.from - 1].text.slice(0, 30)}`);
        } else { flags.push(`起點文字重複，已略過：${start.slice(0, 30)}`); continue; }
      }
      if (startBlock.kind === "code" || startBlock.kind === "rule") { flags.push("題組起點不是文字區塊"); continue; }
      const questions = grp.questions.map(({ from, to, problems, blanks, ...q }, n) => {
        (problems ?? []).forEach(p => flags.push(`${q.title || "(無標題)"}：${p}`));
        if (dropTitle && n === 0) q.title = "";
        return q;
      });
      out.push({ start, count: grp.end - grp.from + 1, questions, _at: { message: mi, from: grp.from } });
    }
  });
  return { groups: out, flags };
}

// 照講義桌的規則算出「已被既有題組取代」的區塊索引（有 count 用 count，否則吃到分隔線／上層標題／until 為止）
function coveredBlocks(blocks, groups) {
  const covered = new Set();
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.kind === "code" || b.kind === "rule") continue;
    const g = groups.find(x => x.start === b.text.trim());
    if (!g) continue;
    covered.add(i);
    const count = Number.isInteger(g.count) && g.count > 0 ? g.count : 0;
    const stop = count ? Math.min(blocks.length, i + count) : blocks.length;
    let next = i + 1;
    while (next < stop && (count || blocks[next].kind !== "rule") && !(blocks[next].kind === "heading" && blocks[next].level < b.level) &&
        !(g.until && blocks[next].text.trim().startsWith(g.until))) { covered.add(next); next++; }
    i = next - 1;
  }
  return covered;
}

// ---------- 主程式 ----------
const files = fs.readdirSync(dir).filter(n => n.endsWith(".js") && (!idPrefix || n.startsWith(idPrefix)));
function load(file) {
  global.document = { currentScript: {} };
  delete require.cache[require.resolve(file)];
  require(file);
  return document.currentScript.lessonRecord;
}

const summary = { lectures: 0, converted: 0, skippedExisting: 0, skippedStructured: 0, questions: { choice: 0, multi: 0, fill: 0, essay: 0 }, rows: [] };
for (const name of files) {
  const file = path.join(dir, name);
  const record = load(file);
  summary.lectures++;
  const base = { id: name.slice(0, 8), title: record.title };
  // 已手動補過答案的講義一律保護，--force 只會重轉還沒填任何答案的講義
  const hasManual = (record.quizGroups ?? []).some(g => g.questions.some(q => q.answers?.length || q.explanation || q.guidance || q.reference));
  if (command === "supplement" || command === "supplement-write") {
    // 補漏模式：保留既有題組（含手填的答案），只為「還沒被任何題組取代」的題目新增題組
    const existing = record.quizGroups ?? [];
    const { groups, flags } = convertRecord(record);
    const messages = record.messages.filter(m => m.role === "assistant");
    const perMessage = messages.map(m => markdownBlocks(m.text));
    const covered = perMessage.map(blocks => coveredBlocks(blocks, existing));
    const starts = new Set(existing.map(g => g.start));
    const added = groups.filter(g => {
      if (starts.has(g.start)) return false;
      for (let k = g._at.from; k < g._at.from + g.count; k++) if (covered[g._at.message].has(k)) return false;
      return true;
    });
    const nq = added.reduce((s, g) => s + g.questions.length, 0);
    summary.rows.push({ ...base, status: added.length ? "補漏" : "無需補", added: added.length, questions: nq,
      kinds: added.flatMap(g => g.questions.map(q => (q.type === "choice" ? (q.multiple ? "多選" : "單選") : q.type) + (q.answers?.length ? "" : "(無解)"))).join(" "),
      flags: flags.filter(f => /選項遺失|找不到選項/.test(f)) });
    if (!added.length || command !== "supplement-write") continue;
    const backup = path.join(__dirname, "display-fix-backup");
    fs.mkdirSync(backup, { recursive: true });
    if (!fs.existsSync(path.join(backup, name))) fs.copyFileSync(file, path.join(backup, name));
    record.quizGroups = [...existing, ...added.map(({ _at, ...g }) => g)];
    fs.writeFileSync(file, "document.currentScript.lessonRecord = JSON.parse(" + JSON.stringify(JSON.stringify(record)) + ");\n");
    const index = path.join(root, "index.html");
    const id = name.slice(0, -3);
    const version = crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex").slice(0, 12);
    const html = fs.readFileSync(index, "utf8");
    const pattern = new RegExp(`("conversationId":"${id}"[^}]*?"version":")[0-9a-f]+(")`);
    if (pattern.test(html)) fs.writeFileSync(index, html.replace(pattern, `$1${version}$2`));
    else summary.rows.at(-1).flags.push("目錄找不到這份講義的 version");
    continue;
  }
  if (record.quizGroups?.length && (!force || hasManual)) { summary.skippedExisting++; summary.rows.push({ ...base, status: "已有題組" }); continue; }
  const { groups, flags } = convertRecord(record);
  const counts = { choice: 0, multi: 0, fill: 0, essay: 0 };
  groups.forEach(g => g.questions.forEach(q => { if (q.type === "choice") counts[q.multiple ? "multi" : "choice"]++; else counts[q.type]++; }));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const structured = record.questions?.length || 0;
  summary.rows.push({ ...base, status: total ? "可轉換" : "無題目", groups: groups.length, ...counts, structured, flags });
  if (!total) continue;
  summary.converted++;
  for (const k in counts) summary.questions[k] += counts[k];
  if (command === "write") {
    const backup = path.join(__dirname, "quiz-convert-backup");
    fs.mkdirSync(backup, { recursive: true });
    if (!fs.existsSync(path.join(backup, name))) fs.copyFileSync(file, path.join(backup, name));
    record.quizGroups = groups.map(({ _at, ...g }) => g);
    fs.writeFileSync(file, "document.currentScript.lessonRecord = JSON.parse(" + JSON.stringify(JSON.stringify(record)) + ");\n");
    const index = path.join(root, "index.html");
    const id = name.slice(0, -3);
    const version = crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex").slice(0, 12);
    const html = fs.readFileSync(index, "utf8");
    const pattern = new RegExp(`("conversationId":"${id}"[^}]*?"version":")[0-9a-f]+(")`);
    if (pattern.test(html)) fs.writeFileSync(index, html.replace(pattern, `$1${version}$2`));
    else summary.rows.at(-1).flags.push("目錄找不到這份講義的 version");
  }
}
const reportDir = path.join(__dirname, "reports");
fs.mkdirSync(reportDir, { recursive: true });
if (command === "supplement" || command === "supplement-write") {
  fs.writeFileSync(path.join(reportDir, "quiz-supplement-report.json"), JSON.stringify(summary, null, 1));
  const rows = summary.rows.filter(r => r.status === "補漏");
  rows.forEach(r => console.log(`${r.id} ${r.title}｜+${r.added} 組 ${r.questions} 題｜${r.kinds}${r.flags.length ? `｜選項遺失 ${r.flags.length}` : ""}`));
  console.log(`補漏講義 ${rows.length}｜新增題組 ${rows.reduce((s, r) => s + r.added, 0)}｜題目 ${rows.reduce((s, r) => s + r.questions, 0)}`);
  process.exit(0);
}
fs.writeFileSync(path.join(reportDir, "quiz-convert-report.json"), JSON.stringify(summary, null, 1));
const t = summary.questions;
console.log(`講義 ${summary.lectures}｜可轉換 ${summary.converted}｜已有題組 ${summary.skippedExisting}`);
console.log(`題目：單選 ${t.choice}｜多選 ${t.multi}｜填空 ${t.fill}｜申論 ${t.essay}`);
const flagged = summary.rows.filter(r => r.flags?.length);
console.log(`有疑點的講義 ${flagged.length} 份，疑點共 ${flagged.reduce((s, r) => s + r.flags.length, 0)} 項（詳見 reports/quiz-convert-report.json）`);
console.log(`無題目：${summary.rows.filter(r => r.status === "無題目").length} 份`);
