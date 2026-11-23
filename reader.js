"use strict";

const $ = id => document.getElementById(id);
const library = new Map();
const sourceLabel = { user: "原始提問", assistant: "教材回覆" };
const catalogGroupState = new Map();
const catalogProjects = [];
const courseSubjects = new Map([["數學", "高中數學"], ["物理", "高中物理"], ["化學", "高中化學"]]);
const conversationIdPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
let activeId;
let tutorialOnly = false;
let requestedLesson;
let annotationBlock;
let revealedBlock;
let importing = false;
let figureUrls = [];

function setupTheme() {
  const storageKey = "lesson-desk-theme";
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  const root = document.documentElement;
  const toggle = $("theme-toggle");
  let preference;
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved === "light" || saved === "dark") preference = saved;
  } catch (error) {
    console.warn("無法讀取講義桌主題偏好", error);
  }

  function applyTheme() {
    const theme = preference ?? (system.matches ? "dark" : "light");
    root.dataset.theme = theme;
    toggle.setAttribute("aria-pressed", String(theme === "dark"));
    $("theme-color").content = window.getComputedStyle(root).getPropertyValue("--page").trim();
  }

  toggle.addEventListener("click", () => {
    preference = root.dataset.theme === "dark" ? "light" : "dark";
    applyTheme();
    try {
      window.localStorage.setItem(storageKey, preference);
    } catch (error) {
      console.warn("無法保存講義桌主題偏好", error);
    }
  });
  system.addEventListener("change", applyTheme);
  applyTheme();
  toggle.hidden = false;
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function fingerprint(text) {
  let hash = 2166136261;
  for (const char of text) hash = Math.imul(hash ^ char.codePointAt(0), 16777619);
  return (hash >>> 0).toString(36);
}

function messageText(message) {
  const content = message.content ?? message.text;
  if (typeof content === "string") return content;
  const parts = Array.isArray(content) ? content : content?.parts ?? [];
  if (!Array.isArray(parts)) return "";
  return parts.map(part => typeof part === "string" ? part
    : typeof part?.text === "string" ? part.text : "［原始訊息含媒體或附件］").join("\n\n");
}

function exportedMessages(data) {
  if (Array.isArray(data.messages)) return data.messages;
  if (Array.isArray(data.turns)) return data.turns.flatMap(turn => turn?.items ?? []).map(item => ({
    ...item, role: item?.type === "userMessage" ? "user" : item?.type === "agentMessage" ? "assistant" : ""
  }));
  if (!data.mapping || typeof data.mapping !== "object") return [];
  const mapping = data.mapping;
  const path = [];
  const visited = new Set();
  let id = data.current_node;
  if (!Object.hasOwn(mapping, id)) {
    const nodes = Object.entries(mapping);
    id = nodes.reduce((latest, entry) =>
      (entry[1]?.message?.create_time ?? -1) >= (latest?.[1]?.message?.create_time ?? -1) ? entry : latest, null)?.[0];
  }
  while (typeof id === "string" && Object.hasOwn(mapping, id) && !visited.has(id)) {
    visited.add(id);
    const node = mapping[id];
    if (node?.message && !node.message.metadata?.is_visually_hidden_from_conversation) path.push(node.message);
    id = node?.parent;
  }
  return path.reverse();
}

function normalize(data, fileName) {
  if (!data || typeof data !== "object") throw new Error("找不到可閱讀的對話。");
  let messages;
  if (typeof data.turn?.assistantMarkdownPrefix === "string") {
    let markdown = data.turn.assistantMarkdownPrefix;
    if (typeof data.turn.visibleTailMarkdown === "string") {
      markdown = markdown.replace(/\n\n已完成\s*\/\s*$/, "") + "\n\n" + data.turn.visibleTailMarkdown;
    }
    messages = [
      { role: "user", text: data.turn.userPrompt, id: data.turn.userMessageId },
      { role: "assistant", text: markdown, id: data.turn.assistantMessageId }
    ].filter(item => typeof item.text === "string" && item.text.trim());
  } else {
    messages = exportedMessages(data).filter(Boolean).map((message, i) => ({
      id: typeof message.id === "string" ? message.id : `message-${i}`,
      role: message.role ?? message.author?.role,
      text: messageText(message)
    })).filter(message => Object.hasOwn(sourceLabel, message.role) && message.text.trim());
  }
  if (!messages.length && typeof data.markdown === "string" && data.markdown.trim()) {
    messages = [{ id: "document", role: "assistant", text: data.markdown }];
  }
  if (!messages.length) throw new Error("沒有可閱讀的使用者或助理訊息。");
  const firstAnswer = messages.find(message => message.role === "assistant");
  const heading = firstAnswer?.text.match(/^#\s+(.+)$/m)?.[1];
  const title = typeof data.title === "string" && data.title.trim() ? data.title : heading || fileName;
  const id = data.conversationId ?? data.conversation_id ?? data.id;
  const annotations = new Map(Object.entries(data.annotations ?? {}).filter(([, entry]) =>
    entry && typeof entry === "object").map(([key, entry]) => [key, {
      note: typeof entry.note === "string" ? entry.note : "",
      guide: typeof entry.guide === "string" ? entry.guide : "",
      side: entry.side === "left" ? "left" : "right"
    }]).filter(([, entry]) => entry.note || entry.guide));
  const leadIns = new Map();
  for (const [key, entry] of Object.entries(data.leadIns ?? {})) {
    if (!entry || typeof entry !== "object") continue;
    const question = typeof entry.question === "string" ? entry.question.trim() : "";
    const hint = typeof entry.hint === "string" ? entry.hint.trim() : "";
    const answer = typeof entry.answer === "string" ? entry.answer.trim() : "";
    if (question || answer) leadIns.set(key, { question, hint, answer });
  }
  return {
    id: typeof id === "string" && id ? id : `local-${fingerprint(title + messages.map(message => message.text).join("\n"))}`,
    title,
    project: typeof data.project === "string" ? data.project : "",
    projectId: typeof data.projectId === "string" ? data.projectId : undefined,
    subject: typeof data.subject === "string" ? data.subject : undefined,
    sourceUrl: typeof data.sourceUrl === "string" && /^https?:\/\//i.test(data.sourceUrl) ? data.sourceUrl : "",
    messages,
    questions: (Array.isArray(data.questions) ? data.questions : []).map(normalizeQuestion).filter(Boolean),
    annotations,
    leadIns,
    quizGroups: normalizeQuizGroups(data.quizGroups),
    savedAnnotations: new Map(annotations),
    dirty: false,
    answers: new Map(),
    scroll: 0
  };
}

// 題組：資料只提供結構，正解、詳解、引導與參考答案可留空，之後再手動補上。
function normalizeQuizGroups(raw) {
  const text = value => typeof value === "string" ? value.trim() : "";
  return (Array.isArray(raw) ? raw : []).map(group => {
    if (!group || !text(group.start) || !Array.isArray(group.questions)) return null;
    const questions = group.questions.map(question => {
      if (!question || !["choice", "essay", "fill"].includes(question.type)) return null;
      // parts：題幹中穿插文字、填空格（blank）與作答區（area）時使用，依序渲染。
      const parts = (Array.isArray(question.parts) ? question.parts : []).map(part => {
        if (part?.blank) return { blank: { hint: text(part.blank.hint), unit: text(part.blank.unit) } };
        if (part?.area) return { area: { hint: text(part.area.hint) } };
        return text(part?.text) ? { text: text(part.text) } : null;
      }).filter(Boolean);
      if (question.type === "fill") {
        if (!parts.some(part => part.blank)) return null;
        const blanks = parts.filter(part => part.blank).length;
        // 每個空格可接受多個等價答案：answers[i] 為字串或字串陣列，留空表示尚未設定。
        const answers = Array.from({ length: blanks }, (_, i) => {
          const value = Array.isArray(question.answers) ? question.answers[i] : "";
          return (Array.isArray(value) ? value : [value]).map(text).filter(Boolean);
        });
        return { type: "fill", title: text(question.title), prompt: text(question.prompt), options: [], multiple: false,
          answers, parts, explanation: text(question.explanation), guidance: text(question.guidance), reference: "", placeholder: "" };
      }
      if (!text(question.prompt) && !parts.length) return null;
      const options = question.type === "choice" && Array.isArray(question.options)
        ? question.options.filter(option => option && text(option.label) && text(option.value))
          .map(option => ({ value: text(option.value), label: text(option.label) })) : [];
      if (question.type === "choice" && !options.length) return null;
      if (question.type === "essay" && !text(question.prompt) && !parts.some(part => part.text)) return null;
      const answers = (Array.isArray(question.answers) ? question.answers : [])
        .map(text).filter(answer => options.some(option => option.value === answer));
      return {
        type: question.type, title: text(question.title), prompt: text(question.prompt), options,
        multiple: question.multiple === true, answers, parts, explanation: text(question.explanation),
        guidance: text(question.guidance), reference: text(question.reference), placeholder: text(question.placeholder)
      };
    }).filter(Boolean);
    // start：被取代範圍的第一個區塊文字；until（選填）：不被取代的第一個區塊開頭，用於沒有分隔線的題組；
    // count（選填）：被取代的區塊總數（含 start），給了就以它為準。
    const count = Number.isInteger(group.count) && group.count > 0 ? group.count : 0;
    return questions.length ? { start: text(group.start), until: text(group.until), count, questions } : null;
  }).filter(Boolean);
}

function normalizeQuestion(question) {
  if (!question || typeof question.prompt !== "string" || !question.prompt.trim()) return null;
  if (!["single-choice", "multiple-choice", "fill-in"].includes(question.type)) return null;
  const options = Array.isArray(question.options) ? question.options.map((option, index) => {
    const label = typeof option === "string" ? option : option?.label;
    if (typeof label !== "string" || !label.trim()) return null;
    const value = typeof option?.value === "string" ? option.value : label.match(/^([A-Z])\.\s/)?.[1] ?? String(index + 1);
    return { label, value };
  }).filter(Boolean).filter((option, index, all) => all.findIndex(item => item.value === option.value) === index) : [];
  if (question.type !== "fill-in" && !options.length) return null;
  const rawAnswers = question.answers ?? question.correctOptions ?? question.visibleCorrectOption;
  const answers = (Array.isArray(rawAnswers) ? rawAnswers : [rawAnswers])
    .filter(answer => typeof answer === "string" || (typeof answer === "number" && Number.isFinite(answer)))
    .map(answer => String(answer).trim()).filter(Boolean);
  const validAnswers = question.type === "fill-in" ? answers : answers.filter(answer => options.some(option => option.value === answer));
  return {
    type: question.type, title: typeof question.title === "string" ? question.title : "", prompt: question.prompt,
    options, answers: validAnswers.length === answers.length &&
      (question.type !== "single-choice" || new Set(validAnswers).size === 1) ? [...new Set(validAnswers)] : [],
    feedback: typeof (question.feedback ?? question.visibleFeedback) === "string" ? question.feedback ?? question.visibleFeedback : "",
    tolerance: typeof question.tolerance === "number" && question.tolerance >= 0 ? question.tolerance : 0
  };
}

// 自製解析器只涵蓋少數指令；其餘交給 KaTeX（僅輸出 MathML，不需字型或 CSS）。
function renderWithKatex(wrapper, source, block, parserError) {
  try {
    if (typeof katex !== "object") throw new Error("KaTeX 未載入");
    const holder = document.createElement("template");
    holder.innerHTML = katex.renderToString(source, { output: "mathml", displayMode: block, throwOnError: true, trust: false });
    const root = holder.content.querySelector("math");
    if (!root) throw new Error("KaTeX 未輸出 MathML");
    root.querySelector("annotation")?.remove();
    root.setAttribute("display", block ? "block" : "inline");
    wrapper.append(root);
    wrapper.classList.add("typeset");
  } catch (error) {
    console.warn("LaTeX 渲染失敗", { source, parser: parserError.message, katex: error.message });
    wrapper.textContent = source;
    wrapper.classList.add("math-fallback");
    wrapper.title = `LaTeX 原文 · ${parserError.message}；KaTeX：${error.message}`;
  }
}

function asMath(tex, block = false) {
  const wrapper = element(block ? "div" : "span", undefined, block ? "formula block" : "formula");
  const source = tex.trim();
  // \text{…} 是純文字，整段當一個記號；\mathrm{…} 內仍是數學（H_2O、m/s^2），所以拆開逐一解析。
  const tokens = source.match(/\\(?:begin|end)\{[a-zA-Z*]+\}|\\text\{[^{}]*\}|\\[a-zA-Z]+|\\.|[^\s]/gu) ?? [];
  const symbols = { "\\Delta": "Δ", "\\theta": "θ", "\\alpha": "α", "\\beta": "β", "\\pi": "π",
    "\\cdot": "·", "\\times": "×", "\\pm": "±", "\\ge": "≥", "\\le": "≤", "\\approx": "≈",
    "\\neq": "≠", "\\circ": "°", "\\infty": "∞", "\\parallel": "∥", "\\perp": "⊥",
    "\\lvert": "|", "\\rvert": "|", "\\vert": "|", "\\|": "‖", "\\Vert": "‖",
    "\\lVert": "‖", "\\rVert": "‖", "\\{": "{", "\\}": "}", "\\rightarrow": "→" };
  const spaces = { "\\,": ".17em", "\\;": ".28em", "\\:": ".22em", "\\ ": ".25em",
    "\\!": "0", "\\quad": "1em", "\\qquad": "2em" };
  let position = 0;
  let upright = false;
  const math = (tag, text) => {
    const node = document.createElementNS("http://www.w3.org/1998/Math/MathML", tag);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const wrap = (tag, ...children) => {
    const node = math(tag);
    node.append(...children);
    return node;
  };
  function group(depth = 0, stop = () => false) {
    if (depth > 25) throw new Error("TeX nesting exceeded");
    const row = math("mrow");
    while (position < tokens.length && tokens[position] !== "}" && !stop(tokens[position])) {
      let base;
      if (/^\d$/.test(tokens[position])) {
        let number = tokens[position++];
        while (/^\d$/.test(tokens[position] ?? "") ||
          (tokens[position] === "." && /^\d$/.test(tokens[position + 1] ?? ""))) number += tokens[position++];
        base = math("mn", number);
      } else base = atom(depth);
      let sub;
      let sup;
      // P' 的撇號是上標（′），之後的 _A 才是下標，與 TeX 一致。
      let primes = 0;
      while (tokens[position] === "'") { position++; primes++; }
      if (primes) sup = math("mo", "′".repeat(primes));
      while (tokens[position] === "_" || tokens[position] === "^") {
        const marker = tokens[position++];
        const value = atom(depth);
        if (marker === "_") sub = value;
        else sup = value;
      }
      if (sub && sup) base = wrap("msubsup", base, sub, sup);
      else if (sub) base = wrap("msub", base, sub);
      else if (sup) base = wrap("msup", base, sup);
      row.append(base);
    }
    return row;
  }
  function operator(symbol, stretchy = false) {
    const node = math("mo", symbol);
    node.setAttribute("stretchy", String(stretchy));
    return node;
  }
  function environment(name, depth) {
    if (!["aligned", "align", "align*", "gathered", "cases"].includes(name)) {
      throw new Error("Unsupported TeX environment");
    }
    const closing = "\\end{" + name + "}";
    const boundary = token => token === "&" || token === "\\\\" || token === closing;
    const table = math("mtable");
    table.classList.add("math-lines", "math-" + name.replace("*", ""));
    if (name.startsWith("align")) table.setAttribute("columnalign", "right left");
    else if (name === "cases") table.setAttribute("columnalign", "left left");
    let row = math("mtr");
    for (;;) {
      row.append(wrap("mtd", group(depth + 1, boundary)));
      const next = tokens[position++];
      if (next === "&") continue;
      if (next === closing) {
        if (row.children.length > 1 || row.children[0].textContent || !table.children.length) table.append(row);
        break;
      }
      if (next !== "\\\\") throw new Error("Unclosed TeX environment");
      // \\[3pt]：換行後的列距參數，不是內容。
      const close = tokens[position] === "[" ? tokens.indexOf("]", position) : -1;
      if (close > 0 && /^-?[\d.]+(?:pt|em|ex|mm|cm|in|bp)$/.test(tokens.slice(position + 1, close).join(""))) position = close + 1;
      table.append(row);
      row = math("mtr");
    }
    return name === "cases" ? wrap("mrow", operator("{", true), table) : table;
  }
  function atom(depth) {
    if (depth > 25) throw new Error("TeX nesting exceeded");
    const token = tokens[position++];
    if (token?.startsWith("\\begin{")) return environment(token.slice(7, -1), depth);
    const literal = token?.match(/^\\text\{([^{}]*)\}$/);
    if (literal) return math("mtext", literal[1]);
    if (token === "{") {
      const row = group(depth + 1);
      if (tokens[position++] !== "}") throw new Error("Unclosed TeX group");
      return row;
    }
    if (token === "\\frac" || token === "\\dfrac" || token === "\\tfrac") {
      return wrap("mfrac", atom(depth + 1), atom(depth + 1));
    }
    if (token === "\\sqrt") {
      if (tokens[position] !== "[") return wrap("msqrt", atom(depth + 1));
      // \sqrt[n]{x}：方括號裡是根指數，MathML 的 mroot 先放被開方數、再放指數。
      position++;
      const index = group(depth + 1, closing => closing === "]");
      if (tokens[position++] !== "]") throw new Error("Unclosed root index");
      return wrap("mroot", atom(depth + 1), index);
    }
    if (token === "\\mathrm") {
      if (tokens[position++] !== "{") throw new Error("Expected TeX group after \\mathrm");
      const outer = upright;
      upright = true;
      try {
        const row = group(depth + 1);
        if (tokens[position++] !== "}") throw new Error("Unclosed TeX group");
        return row;
      } finally {
        upright = outer;
      }
    }
    if (["\\vec", "\\overrightarrow", "\\bar", "\\overline", "\\hat"].includes(token)) {
      const isBar = token === "\\bar" || token === "\\overline";
      const accent = token === "\\hat" ? "ˆ" : isBar ? "¯" : "→";
      const mark = wrap("mover", atom(depth + 1), operator(accent, token === "\\overline" || token === "\\overrightarrow"));
      mark.setAttribute("accent", "true");
      return mark;
    }
    if (token === "\\boxed") {
      const box = wrap("mrow", atom(depth + 1));
      box.classList.add("math-box");
      return box;
    }
    if (token === "\\text") {
      if (tokens[position++] !== "{") throw new Error("Expected TeX text group");
      const text = [];
      while (position < tokens.length && tokens[position] !== "}") text.push(tokens[position++]);
      if (tokens[position++] !== "}") throw new Error("Unclosed TeX text group");
      return math("mtext", text.join(""));
    }
    if (token === "\\left" || token === "\\right" || token === "\\middle") {
      const delimiter = tokens[position++];
      if (delimiter === ".") return math("mspace");
      if (Object.hasOwn(symbols, delimiter) || /^[()[\]|]$/.test(delimiter)) return operator(symbols[delimiter] ?? delimiter, true);
      throw new Error("Unsupported TeX delimiter");
    }
    if (Object.hasOwn(spaces, token)) {
      const space = math("mspace");
      space.setAttribute("width", spaces[token]);
      return space;
    }
    if (/^\\(?:sin|cos|tan|log|ln|lim|exp)$/.test(token)) return math("mi", token.slice(1));
    if (Object.hasOwn(symbols, token)) return operator(symbols[token]);
    if (!token || token.startsWith("\\") || "{}_^&".includes(token)) throw new Error("Unsupported TeX token: " + (token ?? "(end)"));
    if (/^[0-9]/.test(token)) return math("mn", token);
    if (/^[a-zA-Z]$/.test(token)) {
      const letter = math("mi", token);
      if (upright) letter.setAttribute("mathvariant", "normal");
      return letter;
    }
    return operator(token === "-" ? "−" : token);
  }
  try {
    const root = wrap("math", group());
    if (position !== tokens.length) throw new Error("Unexpected TeX closing token");
    root.setAttribute("display", block ? "block" : "inline");
    wrapper.append(root);
    wrapper.classList.add("typeset");
  } catch (error) {
    wrapper.replaceChildren();
    wrapper.classList.remove("typeset");
    renderWithKatex(wrapper, source, block, error);
  }
  return wrapper;
}

// 行內 \[…\]：含 TeX 指令或運算符才是公式，否則（[Ar]、[A]、[↑↓]）只是被跳脫的方括號。
const bracketMath = /\\[a-zA-Z]|[\^_=<>+]|\d\s*[-*/]\s*\d|\([^)]*\)\s*\(/;

function inline(parent, raw) {
  // 匯出時殘留的引用標記與輸入元件說明，都不是教材內容。
  const text = raw.replace(/\uE200cite\uE202[^\uE201]*\uE201/g, "")
    .replace(/（無法取得目前的值。）/g, "").replace(/\s*\\?\(目前的選取項目無法使用。\)/g, "");
  const pattern = /\\\(([^\\()\n]{1,40})\)|\\\(([\s\S]+?)\\\)|\\\[([^\n]+?)\\\]|(?<![\\$])\$([^$\n]+)\$(?!\$)|\*\*([^*]+)\*\*|`([^`\n]+)`|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|\\([.\\*#|$])/g;
  let end = 0;
  for (const match of text.matchAll(pattern)) {
    parent.append(text.slice(end, match.index));
    if (match[1]) parent.append(`(${match[1]})`);
    else if (match[3]) parent.append(bracketMath.test(match[3]) ? asMath(match[3]) : `[${match[3].trim()}]`);
    else if (match[2] || match[4]) parent.append(asMath(match[2] ?? match[4]));
    else if (match[5]) {
      const strong = element("strong");
      inline(strong, match[5]);
      parent.append(strong);
    } else if (match[6]) parent.append(element("code", match[6]));
    else if (match[7]) {
      const link = element("a", match[7]);
      link.href = match[8];
      parent.append(link);
    } else parent.append(match[9]);
    end = match.index + match[0].length;
  }
  parent.append(text.slice(end));
  return parent;
}

// ChatGPT 匯出的圖表元件：私用區字元包住的 JSON（開頭 U+E200 + genui + U+E202）。
const chartMarker = String.fromCharCode(0xE200) + "genui" + String.fromCharCode(0xE202);

function markdownBlocks(raw) {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  const special = /^(?:#{1,6}\s|```|~~~|\\\[|\$\$|(?:[-*+]|\d+[.)])\s|>\s?|\|)/;
  for (let index = 0; index < lines.length;) {
    const line = lines[index++].trim();
    if (!line.trim()) continue;
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    const fence = line.match(/^(`{3,}|~{3,})\s*(\S*)/);
    const list = line.match(/^([-*+]|\d+[.)])\s+(.*)/);
    if (heading) blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] });
    else if (fence) {
      const content = [];
      while (index < lines.length && !lines[index].startsWith(fence[1])) content.push(lines[index++]);
      if (index < lines.length) index++;
      blocks.push({ kind: "code", language: fence[2].toLowerCase(), text: content.join("\n") });
    } else if (line.startsWith("\\[") || line.startsWith("$$")) {
      const closing = line.startsWith("$$") ? "$$" : "\\]";
      const parts = [line.slice(2)];
      let end = index;
      while (!parts.at(-1).includes(closing) && end < lines.length &&
        !/^#{1,6}\s/.test(lines[end].trim())) parts.push(lines[end++]);
      const last = parts.at(-1);
      const closeAt = last.indexOf(closing);
      if (closeAt < 0) {
        blocks.push({ kind: "paragraph", text: line });
      } else {
        const trailingText = last.slice(closeAt + closing.length).trim();
        parts[parts.length - 1] = last.slice(0, closeAt);
        blocks.push({ kind: "math", text: parts.join("\n") });
        if (trailingText) blocks.push({ kind: "paragraph", text: trailingText });
        index = end;
      }
    } else if (line.startsWith(chartMarker)) blocks.push({ kind: "chart", text: line });
    else if (/^([-*_])(?:\s*\1){2,}$/.test(line)) blocks.push({ kind: "rule", text: line });
    else if (line.startsWith("|") && /^\s*\|?\s*:?-{3,}/.test(lines[index] ?? "")) {
      const rows = [line];
      index++;
      while (lines[index]?.startsWith("|")) rows.push(lines[index++]);
      blocks.push({ kind: "table", rows, text: rows.join("\n") });
    } else if (list) {
      const items = [list[2]];
      const ordered = /^\d/.test(list[1]);
      const matcher = ordered ? /^\s*\d+[.)]\s+(.*)/ : /^\s*[-*+]\s+(.*)/;
      let next;
      while ((next = lines[index]?.match(matcher))) {
        items.push(next[1]);
        index++;
      }
      blocks.push({ kind: "list", items, ordered, text: items.join("\n") });
    } else if (line.startsWith(">")) {
      const quotes = [line.replace(/^>\s?/, "")];
      while (lines[index]?.startsWith(">")) quotes.push(lines[index++].replace(/^>\s?/, ""));
      blocks.push({ kind: "quote", text: quotes.join("\n") });
    } else {
      let text = line;
      while (lines[index]?.trim() && !special.test(lines[index].trimStart()) &&
        !lines[index].trimStart().startsWith(chartMarker) &&
        !/^([-*_])(?:\s*\1){2,}$/.test(lines[index].trim())) text += "\n" + lines[index++];
      blocks.push({ kind: "paragraph", text });
    }
  }
  return blocks;
}

function tableCells(row) {
  const text = row.replace(/^\||(?<!\\)\|\s*$/g, "");
  const cells = [];
  let start = 0;
  for (const match of text.matchAll(/\\\([\s\S]*?\\\)|(?<!\\)\$[^$\n]+\$|\\\||\|/g)) {
    if (match[0] !== "|") continue;
    cells.push(text.slice(start, match.index).trim());
    start = match.index + 1;
  }
  cells.push(text.slice(start).trim());
  return cells;
}

// ---- 圖表：匯出檔內的圖表元件只留下 JSON，這裡用 SVG 重畫（折線、散佈、長條）。----
function svgNode(tag, attributes = {}, text) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}

// 刻度取 1、2、5 × 10^n，讓座標軸上的數字好讀。
function chartTicks(low, high, target = 6) {
  const rough = (high > low ? high - low : 1) / target;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map(multiple => multiple * power).find(candidate => candidate >= rough * (1 - 1e-9));
  const ticks = [];
  for (let n = Math.ceil(low / step - 1e-9); n * step <= high + step * 1e-9; n++) ticks.push(+(n * step).toPrecision(12));
  return { ticks, step };
}

function chartDomain(low, high, fixedLow, fixedHigh) {
  if (!(high > low)) high = low + 1;
  const { step } = chartTicks(low, high);
  if (!fixedLow) low = Math.floor(low / step + 1e-9) * step;
  if (!fixedHigh) high = Math.ceil(high / step - 1e-9) * step;
  return { low, high, ticks: chartTicks(low, high).ticks };
}

const chartNumber = value => String(+value.toPrecision(10)).replace("-", "−");

function chartMarkerShape(index, x, y, r) {
  const n = value => +value.toFixed(2);
  switch (index % 4) {
    case 0: return svgNode("circle", { cx: n(x), cy: n(y), r });
    case 1: return svgNode("rect", { x: n(x - r), y: n(y - r), width: 2 * r, height: 2 * r });
    case 2: return svgNode("path", { d: `M${n(x)} ${n(y - r * 1.3)}L${n(x + r * 1.3)} ${n(y)}L${n(x)} ${n(y + r * 1.3)}L${n(x - r * 1.3)} ${n(y)}Z` });
    default: return svgNode("path", { d: `M${n(x)} ${n(y - r * 1.25)}L${n(x + r * 1.15)} ${n(y + r)}L${n(x - r * 1.15)} ${n(y + r)}Z` });
  }
}

function chartSpec(text) {
  const raw = text.trim();
  if (!raw.startsWith(chartMarker) || raw.charCodeAt(raw.length - 1) !== 0xE201) throw new Error("圖表標記不完整");
  const content = JSON.parse(raw.slice(chartMarker.length, -1))?.charts_widget_v2?.content;
  if (!content || !["line", "scatter", "bar"].includes(content.chartType) || typeof content.xKey !== "string" ||
      !Array.isArray(content.series) || !content.series.length || !Array.isArray(content.data) || !content.data.length) {
    throw new Error("不支援的圖表資料");
  }
  return content;
}

function chartFigure(text) {
  const figure = element("figure", undefined, "chart");
  try {
    drawChart(figure, chartSpec(text));
  } catch (error) {
    console.warn("無法繪製圖表", error.message);
    figure.replaceChildren(element("figcaption", "這張圖表的資料無法顯示。"));
  }
  return figure;
}

function drawChart(figure, spec) {
  const kind = spec.chartType;
  const meta = spec.meta ?? {};
  const rows = spec.data.filter(row => row && typeof row === "object");
  const series = spec.series.filter(item => item && typeof item.dataKey === "string")
    .map(item => ({ key: item.dataKey, label: String(item.label ?? item.dataKey) }));
  const suffix = typeof spec.valueSuffix === "string" ? spec.valueSuffix : "";
  const xLabel = typeof spec.xAxisLabel === "string" ? spec.xAxisLabel : "";
  const yLabel = typeof spec.yAxisLabel === "string" ? spec.yAxisLabel : "";
  const number = (row, key) => typeof row[key] === "number" || (typeof row[key] === "string" && row[key].trim()) ? Number(row[key]) : NaN;
  const xs = rows.map(row => row[spec.xKey]);
  const numericX = kind !== "bar" && spec.xAxisScale !== "category" && xs.every(x => x !== "" && x !== null && Number.isFinite(Number(x)));
  const ys = series.flatMap(item => rows.map(row => number(row, item.key))).filter(Number.isFinite);
  if (!rows.length || !series.length || !ys.length) throw new Error("沒有可繪製的數值");

  const width = 520, height = 330;
  const margin = { top: 16, right: 22, bottom: xLabel ? 62 : 42, left: yLabel ? 76 : 56 };
  const plot = { x: margin.left, y: margin.top, w: width - margin.left - margin.right, h: height - margin.top - margin.bottom };
  const yRange = { low: Math.min(...ys), high: Math.max(...ys) };
  if (kind === "bar") { yRange.low = Math.min(yRange.low, 0); yRange.high = Math.max(yRange.high, 0); }
  const fixedLow = typeof spec.yAxisMin === "number", fixedHigh = typeof spec.yAxisMax === "number";
  if (fixedLow) yRange.low = spec.yAxisMin;
  if (fixedHigh) yRange.high = spec.yAxisMax;
  const yAxis = chartDomain(yRange.low, yRange.high, fixedLow, fixedHigh);
  const xValues = numericX ? xs.map(Number) : [];
  const xAxis = numericX ? chartDomain(Math.min(...xValues), Math.max(...xValues), false, false) : undefined;
  const px = numericX ? (index => plot.x + (xValues[index] - xAxis.low) / (xAxis.high - xAxis.low) * plot.w)
    : (index => plot.x + (index + .5) / rows.length * plot.w);
  const py = value => plot.y + plot.h - (value - yAxis.low) / (yAxis.high - yAxis.low) * plot.h;
  const n = value => +value.toFixed(2);

  const canvas = svgNode("svg", { viewBox: `0 0 ${width} ${height}`, role: "img" });
  const title = meta.title || series.map(item => item.label).join("、");
  canvas.setAttribute("aria-label", [title, meta.description].filter(Boolean).join("：") || "圖表");
  canvas.append(svgNode("title", {}, title));
  const grid = svgNode("g", { class: "chart-grid" });
  const labels = svgNode("g", { class: "chart-labels" });
  for (const tick of yAxis.ticks) {
    const y = n(py(tick));
    grid.append(svgNode("line", { x1: plot.x, x2: plot.x + plot.w, y1: y, y2: y, class: tick === 0 ? "chart-axis" : "" }));
    labels.append(svgNode("text", { x: plot.x - 8, y: n(y + 4.5), "text-anchor": "end" }, chartNumber(tick)));
  }
  if (numericX) {
    for (const tick of xAxis.ticks) {
      const x = n(plot.x + (tick - xAxis.low) / (xAxis.high - xAxis.low) * plot.w);
      grid.append(svgNode("line", { x1: x, x2: x, y1: plot.y, y2: plot.y + plot.h, class: tick === 0 ? "chart-axis" : "" }));
      labels.append(svgNode("text", { x, y: plot.y + plot.h + 19, "text-anchor": "middle" }, chartNumber(tick)));
    }
  } else {
    const crowded = Math.max(...xs.map(x => String(x).length)) * 13 * rows.length > plot.w;
    rows.forEach((row, index) => labels.append(svgNode("text", {
      x: n(px(index)), y: plot.y + plot.h + 19, "text-anchor": "middle", class: crowded ? "small" : ""
    }, String(xs[index]))));
  }
  grid.append(svgNode("line", { x1: plot.x, x2: plot.x, y1: plot.y, y2: plot.y + plot.h, class: "chart-axis" }),
    svgNode("line", { x1: plot.x, x2: plot.x + plot.w, y1: plot.y + plot.h, y2: plot.y + plot.h, class: "chart-axis" }));
  if (xLabel) labels.append(svgNode("text", { x: plot.x + plot.w / 2, y: height - 10, "text-anchor": "middle", class: "chart-title" }, xLabel));
  if (yLabel) {
    labels.append(svgNode("text", {
      transform: `translate(16 ${n(plot.y + plot.h / 2)}) rotate(-90)`, "text-anchor": "middle", class: "chart-title"
    }, yLabel));
  }
  canvas.append(grid);

  const marks = svgNode("g", { class: "chart-marks" });
  const describe = (item, index, value) => `${item.label}｜${String(xs[index])}：${chartNumber(value)}${suffix}`;
  series.forEach((item, seriesIndex) => {
    const colour = `s${seriesIndex % 4}`;
    if (kind === "bar") {
      const band = plot.w / rows.length;
      const group = band * .68;
      const bar = group / series.length;
      const base = py(Math.min(Math.max(0, yAxis.low), yAxis.high));
      rows.forEach((row, index) => {
        const value = number(row, item.key);
        if (!Number.isFinite(value)) return;
        const top = py(value);
        const rect = svgNode("rect", {
          x: n(px(index) - group / 2 + seriesIndex * bar), y: n(Math.min(top, base)), width: n(bar - 2),
          height: n(Math.max(1, Math.abs(base - top))), class: `chart-bar ${colour}`
        });
        rect.append(svgNode("title", {}, describe(item, index, value)));
        marks.append(rect);
        marks.append(svgNode("text", {
          x: n(px(index) - group / 2 + seriesIndex * bar + (bar - 2) / 2), y: n(value >= 0 ? top - 5 : top + 14),
          "text-anchor": "middle", class: "chart-value"
        }, chartNumber(value) + suffix));
      });
      return;
    }
    if (kind === "line") {
      let path = "";
      let pen = false;
      rows.forEach((row, index) => {
        const value = number(row, item.key);
        if (!Number.isFinite(value)) { pen = false; return; }
        path += `${pen ? "L" : "M"}${n(px(index))} ${n(py(value))}`;
        pen = true;
      });
      if (path) marks.append(svgNode("path", { d: path, class: `chart-line ${colour}` }));
    }
    rows.forEach((row, index) => {
      const value = number(row, item.key);
      if (!Number.isFinite(value) || (kind === "line" && rows.length > 24)) return;
      const dot = chartMarkerShape(seriesIndex, px(index), py(value), kind === "scatter" ? 5 : 3.4);
      dot.setAttribute("class", `chart-dot ${colour}`);
      dot.append(svgNode("title", {}, describe(item, index, value)));
      marks.append(dot);
    });
  });
  canvas.append(marks, labels);

  const caption = element("figcaption");
  if (meta.title) caption.append(element("strong", meta.title, "chart-name"));
  if (meta.description) caption.append(element("span", meta.description, "chart-description"));
  if (caption.childNodes.length) figure.append(caption);
  figure.append(canvas);

  const legend = element("ul", undefined, "chart-legend");
  series.forEach((item, seriesIndex) => {
    const key = svgNode("svg", { viewBox: "0 0 26 14", width: 26, height: 14, "aria-hidden": "true", class: `chart-key s${seriesIndex % 4}` });
    if (kind === "bar") key.append(svgNode("rect", { x: 6, y: 2, width: 14, height: 10, class: "chart-bar" }));
    else {
      if (kind === "line") key.append(svgNode("path", { d: "M1 7H25", class: "chart-line" }));
      const dot = chartMarkerShape(seriesIndex, 13, 7, 3.6);
      dot.setAttribute("class", "chart-dot");
      key.append(dot);
    }
    const entry = element("li");
    entry.append(key, element("span", item.label));
    legend.append(entry);
  });
  figure.append(legend);
  if (meta.footer) figure.append(element("p", meta.footer, "chart-footer"));

  const details = element("details", undefined, "chart-data");
  details.append(element("summary", "查看資料表"));
  const table = element("table");
  const head = table.createTHead().insertRow();
  for (const text of [xLabel || "x", ...series.map(item => item.label)]) head.append(element("th", text));
  const body = table.createTBody();
  rows.forEach((row, index) => {
    const line = body.insertRow();
    line.insertCell().textContent = String(xs[index]);
    for (const item of series) {
      const value = number(row, item.key);
      line.insertCell().textContent = Number.isFinite(value) ? chartNumber(value) + suffix : "—";
    }
  });
  const wrap = element("div", undefined, "table-wrap");
  wrap.append(table);
  details.append(wrap);
  figure.append(details);
}

function blockElement(block) {
  if (block.kind === "chart") return chartFigure(block.text);
  if (block.kind === "heading") return inline(element(`h${Math.max(2, block.level)}`), block.text);
  if (block.kind === "math") return asMath(block.text, true);
  if (block.kind === "rule") return element("hr");
  if (block.kind === "code") {
    if (block.language === "lesson-image") {
      const figure = element("figure");
      try {
        const { src, alt } = JSON.parse(block.text);
        if (typeof src !== "string" || !/^course-media\/[a-f0-9-]{36}\/\d+\.(?:jpg|png|webp|gif)$/i.test(src) ||
            typeof alt !== "string" || !alt.trim()) throw new Error("教材圖片格式不符");
        const image = element("img");
        image.alt = alt;
        image.loading = "lazy";
        image.addEventListener("error", () => figure.replaceChildren(element("figcaption", `無法載入圖片：${alt}`)));
        image.src = src;
        figure.append(image);
      } catch (error) {
        console.warn("無法讀取教材圖片", error.message);
        figure.append(element("figcaption", "無法讀取教材圖片。"));
      }
      return figure;
    }
    if (block.language === "svg" && /^\s*<svg[\s>]/i.test(block.text)) {
      const figure = element("figure");
      const image = element("img");
      image.alt = "教材插圖";
      image.loading = "lazy";
      image.src = URL.createObjectURL(new Blob([block.text], { type: "image/svg+xml" }));
      figureUrls.push(image.src);
      figure.append(image);
      return figure;
    }
    const pre = element("pre");
    pre.append(element("code", block.text));
    return pre;
  }
  if (block.kind === "table") {
    const wrap = element("div", undefined, "table-wrap");
    const table = element("table");
    const head = table.createTHead();
    const body = table.createTBody();
    block.rows.forEach((row, index) => {
      const tr = (index === 0 ? head : body).insertRow();
      tableCells(row).forEach(value => {
        const cell = element(index === 0 ? "th" : "td");
        if (!index) cell.scope = "col";
        tr.append(inline(cell, value.trim()));
      });
    });
    wrap.append(table);
    return wrap;
  }
  if (block.kind === "list") {
    const list = element(block.ordered ? "ol" : "ul");
    for (const item of block.items) list.append(inline(element("li"), item));
    return list;
  }
  return inline(element(block.kind === "quote" ? "blockquote" : "p"), block.text);
}

function judge(question, values) {
  if (!values.length) return { text: "請先作答。", state: "incorrect" };
  if (!question.answers.length) return { text: "已記下作答。匯入資料沒有可用正解。", state: "" };
  let correct;
  if (question.type === "fill-in") {
    const normalize = value => value.normalize("NFKC").trim().toLocaleLowerCase("zh-TW").replace(/−/g, "-");
    const input = normalize(values[0]);
    const numeric = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i;
    correct = question.answers.some(answer => {
      const expected = normalize(answer);
      return input === expected || (numeric.test(input) && numeric.test(expected)
        && Number.isFinite(Number(input)) && Number.isFinite(Number(expected))
        && Math.abs(Number(input) - Number(expected)) <= question.tolerance);
    });
  } else {
    correct = values.length === question.answers.length && values.every(value => question.answers.includes(value));
  }
  return correct ? { text: ["答對了。", question.feedback].filter(Boolean).join(" "), state: "correct" }
    : { text: "答案還不完全正確，可以再試一次。", state: "incorrect" };
}

function quiz(question, doc, key) {
  const form = element("form", undefined, "quiz");
  form.noValidate = true;
  const fieldset = element("fieldset");
  fieldset.append(inline(element("legend"), question.prompt));
  const remembered = doc.answers.get(key);
  const feedback = element("p", undefined, "quiz-status");
  feedback.setAttribute("role", "status");
  const show = result => {
    feedback.textContent = "";
    inline(feedback, result.text);
    feedback.className = ["quiz-status", result.state].filter(Boolean).join(" ");
  };
  if (question.type === "fill-in") {
    const label = element("label", "填入答案");
    const input = element("input");
    input.name = "answer";
    input.type = "text";
    input.autocomplete = "off";
    input.value = remembered?.[0] ?? "";
    label.append(input);
    fieldset.append(label);
  } else {
    for (const option of question.options) {
      const label = element("label", undefined, "option");
      const input = element("input");
      input.type = question.type === "multiple-choice" ? "checkbox" : "radio";
      input.name = "answer";
      input.value = option.value;
      input.checked = remembered?.includes(option.value) ?? false;
      label.append(input, inline(element("span"), option.label));
      fieldset.append(label);
    }
  }
  const submit = element("button", question.answers.length ? "檢查答案" : "記下作答", "primary");
  submit.type = "submit";
  form.append(fieldset, submit, feedback);
  if (remembered) show(judge(question, remembered));
  form.addEventListener("submit", event => {
    event.preventDefault();
    const values = new FormData(form).getAll("answer").map(value => value.trim()).filter(Boolean);
    if (values.length) doc.answers.set(key, values);
    else fieldset.querySelector("input")?.focus();
    show(judge(question, values));
  });
  return form;
}

function renderAnnotation(view, annotation) {
  for (const bubble of view.bubbles) bubble.remove();
  view.bubbles = [];
  view.trigger.textContent = annotation ? "✎" : "＋";
  const action = annotation ? "編輯段落註解" : "加入段落註解";
  view.trigger.title = action;
  view.trigger.setAttribute("aria-label", `${action}：${view.preview}`);
  for (const [kind, label, placement] of [["guide", "引導問題", "beforebegin"], ["note", "我的註解", "afterend"]]) {
    if (!annotation?.[kind]) continue;
    const details = element("details", undefined, "annotation-copy");
    if (kind === "guide") details.classList.add("is-guide");
    if (annotation.side !== "left") details.classList.add("is-right");
    details.open = true;
    details.append(element("summary", label), element("p", annotation[kind]));
    const edit = element("button", "編輯註解", "note-edit");
    edit.type = "button";
    edit.addEventListener("click", () => editAnnotation(view, edit));
    details.append(edit);
    view.content.insertAdjacentElement(placement, details);
    view.bubbles.push(details);
  }
}

function leadInDisclosure(label, text, className) {
  const details = element("details", undefined, className);
  details.append(element("summary", label), inline(element("p"), text));
  return details;
}

function renderLeadIn(row, { question, hint, answer }) {
  if (question) {
    const bubble = element("section", undefined, "annotation-copy is-guide lead-in");
    bubble.setAttribute("aria-label", "前導題");
    bubble.append(element("p", "前導題", "lead-in-label"), inline(element("p"), question));
    if (hint) bubble.append(leadInDisclosure("查看提示", hint, "lead-in-hint"));
    row.prepend(bubble);
  }
  if (answer) row.append(leadInDisclosure("查看前導題解答", answer, "annotation-copy lead-in-answer"));
}

function feedbackPanel(state, title, text) {
  const box = element("div", undefined, "annotation-copy lead-in-answer quiz-feedback");
  box.append(element("p", title, ["quiz-feedback-title", state].filter(Boolean).join(" ")));
  if (text) box.append(inline(element("p"), text));
  return box;
}

// 題組外觀沿用前導題卡片；整組一次提交，不記住作答，重新整理即重來。
// 填空比對：去空白、全形轉半形、忽略大小寫；兩邊都是數字時比數值。
function normalizeFill(value) {
  const plain = String(value).replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[\s,，]/g, "").replace(/[−–—]/g, "-").toLowerCase();
  return plain;
}
function fillMatches(value, accepted) {
  const got = normalizeFill(value);
  if (!got) return false;
  return accepted.some(answer => {
    const want = normalizeFill(answer);
    return got === want || (Number.isFinite(Number(got)) && Number.isFinite(Number(want)) && Number(got) === Number(want));
  });
}

// 題組外觀沿用前導題卡片；整組一次提交，不記住作答，重新整理即重來。
function quizGroup(group, headings, exercises) {
  const kinds = new Set(group.questions.map(question => question.type));
  const label = kinds.size > 1 ? "題組" : kinds.has("essay") ? "申論題" : kinds.has("fill") ? "填空題" : "選擇題";
  const form = element("form", undefined, "annotation-copy is-guide lead-in quiz-group");
  form.noValidate = true;
  form.setAttribute("aria-label", label);
  form.append(element("p", label, "lead-in-label"));
  const renderMarkdown = (parent, markdown) => {
    for (const block of markdownBlocks(markdown)) parent.append(blockElement(block));
  };
  const items = group.questions.map((question, index) => {
    const item = element("section", undefined, "quiz-item");
    const title = inline(element("h3"), question.title || `第 ${index + 1} 題`);
    title.id = `section-${headings.length + 1}`;
    headings.push({ id: title.id, text: title.textContent, level: 3 });
    exercises.push({ id: title.id, text: title.textContent });
    item.append(title);
    let field;
    const inputs = [];
    const label = `${title.textContent} 作答`;
    const prompt = element("div", undefined, "quiz-prompt");
    if (question.parts.length) {
      // 文字、填空格與作答區依原順序穿插
      let blank = 0;
      for (const part of question.parts) {
        if (part.text) renderMarkdown(prompt, part.text);
        else if (part.blank) {
          const row = element("p", undefined, "quiz-blank");
          const input = element("input");
          input.type = "text";
          input.autocomplete = "off";
          input.placeholder = part.blank.hint || "填入答案";
          input.setAttribute("aria-label", `${label}（第 ${++blank} 格）`);
          inputs.push(input);
          row.append(input);
          if (part.blank.unit) row.append(inline(element("span"), part.blank.unit));
          prompt.append(row);
        } else if (part.area) {
          const area = element("textarea");
          area.rows = 5;
          area.placeholder = part.area.hint || "在這裡寫下你的作答";
          area.setAttribute("aria-label", label);
          inputs.push(area);
          prompt.append(area);
        }
      }
      item.append(prompt);
      field = prompt;
    } else {
      renderMarkdown(prompt, question.prompt);
      item.append(prompt);
      if (question.type === "essay") {
        field = element("textarea");
        field.rows = 6;
        field.setAttribute("aria-label", label);
        field.placeholder = question.placeholder || "在這裡寫下你的作答";
        inputs.push(field);
        item.append(field);
      } else {
        field = element("fieldset");
        field.setAttribute("aria-labelledby", title.id);
        for (const option of question.options) {
          const row = element("label", undefined, "option");
          const input = element("input");
          input.type = question.multiple ? "checkbox" : "radio";
          input.name = `answer-${index}`;
          input.value = option.value;
          row.append(input, inline(element("span"), option.label));
          field.append(row);
        }
        item.append(field);
      }
    }
    const slot = element("div", undefined, "quiz-slot");
    slot.setAttribute("aria-live", "polite");
    item.append(slot);
    form.append(item);
    return { question, field, inputs, slot };
  });
  const submit = element("button", "提交", "primary");
  submit.type = "submit";
  const score = element("p", undefined, "quiz-score");
  score.setAttribute("role", "status");
  const actions = element("div", undefined, "quiz-actions");
  actions.append(submit, score);
  form.append(actions);
  form.addEventListener("submit", event => {
    event.preventDefault();
    let graded = 0, correct = 0, gradable = 0;
    for (const { question, field, inputs, slot } of items) {
      let panel;
      if (question.type === "essay") {
        if (inputs.some(input => input.value.trim())) {
          panel = element("details", undefined, "annotation-copy lead-in-answer quiz-feedback");
          panel.append(element("summary", "參考答案（供自我對照）"));
          const body = element("div", undefined, "quiz-prompt");
          renderMarkdown(body, question.reference || "尚未填入參考答案。");
          panel.append(body);
        }
      } else if (question.type === "fill") {
        gradable++;
        const filled = inputs.filter(input => input.value.trim()).length;
        if (!filled) panel = feedbackPanel("", "尚未作答。");
        else if (question.answers.some(accepted => !accepted.length)) panel = feedbackPanel("", "已送出，這題尚未設定正解，無法判分。");
        else {
          graded++;
          const right = inputs.every((input, i) => fillMatches(input.value, question.answers[i]));
          if (right) correct++;
          panel = right ? feedbackPanel("correct", "答對了", question.explanation)
            : feedbackPanel("incorrect", "再想一想", question.guidance || "答案還不完全正確，可以修改後重新提交。");
        }
      } else {
        gradable++;
        const values = [...field.querySelectorAll("input:checked")].map(input => input.value);
        if (!values.length) panel = feedbackPanel("", "尚未作答。");
        else if (!question.answers.length) panel = feedbackPanel("", "已送出，這題尚未設定正解，無法判分。");
        else {
          graded++;
          const right = values.length === question.answers.length && values.every(value => question.answers.includes(value));
          if (right) correct++;
          panel = right ? feedbackPanel("correct", "答對了", question.explanation)
            : feedbackPanel("incorrect", "再想一想", question.guidance || "答案還不完全正確，可以修改後重新提交。");
        }
      }
      slot.replaceChildren(...(panel ? [panel] : []));
    }
    score.textContent = graded ? `本組得分：${correct} / ${graded}`
      : gradable ? "尚未設定正解，無法計分。" : "";
  });
  return form;
}

function annotatableBlock(node, block, key, annotation) {
  const row = element("div", undefined, "reading-block");
  const content = element("div", undefined, "block-content");
  const trigger = element("button", undefined, "annotation-trigger");
  trigger.type = "button";
  trigger.setAttribute("aria-haspopup", "dialog");
  const text = node.tagName === "FIGURE" ? "教材插圖" : block.text;
  const preview = text.replace(/\s+/g, " ").trim().slice(0, 48) || "此段落";
  const view = { key, text, preview, content, trigger, bubbles: [] };
  trigger.addEventListener("click", () => editAnnotation(view, trigger));
  content.append(node, trigger);
  row.append(content);
  renderAnnotation(view, annotation);
  return row;
}

const exerciseName = /^(?:第\s*[0-9０-９一二三四五六七八九十百]+\s*[題题]|(?:習題|理解檢查|自我檢核|練習題|練習|測驗|question|exercise|problem|quiz)\s*[#＃]?\s*[0-9０-９一二三四五六七八九十百]+)/i;
const exerciseSection = /(?:習題|練習題|理解檢查|自我檢核|測驗|exercises|practice questions)/i;

const widgetLostButton = /^\[(?:確認答案|檢查答案|查看答案與解析|確認答案並繼續)[^\]]*\]$/;
const widgetSubmit = /^\[(?:提交|送出|批改|顯示全部|查看)[^\]]*\]$/;
const widgetButton = /^\[(?:重設|重新|上一題|下一題|檢查|確認)[^\]]*\]$/;
const widgetProgress = /(?:已作答|已填寫|已提交|已檢查|題正確|作答進度|已完成作答|已完成檢查)/;
// 單行、沒有題目轉成互動卡片時才會殘留的 UI 文字；回傳 "lost"（選項遺失的選擇題按鈕）、"set"（整組題目的提交鈕）、"chrome"（其他）或空字串
function widgetLeftover(source) {
  const text = source.replace(/\s*[（(]無法取得目前的值。[)）]/g, "").trim();
  if (text.includes("\n")) return "";
  if (text === "目前的選取項目無法使用。") return "chrome";
  // 對話裡「請把答案回覆給我、我會批改」的句子：搬到講義桌後題目可以直接作答，這句話已經沒有對象
  if (text.length <= 200 && /我會(?:依|根據|先判斷)你的|可一次回覆所有理解檢查|可以先回覆.{0,8}理解檢查的答案/.test(text)) return "chrome";
  // 「說明文字 ＋ 按鈕」同一行的殘影，例如「空白答案會視為未答…。 [提交並批改]」
  if (/^.{1,50}?\s*\[(?:提交|送出|批改|顯示全部|查看|重設|重新)[^\]]*\]$/.test(text)) return "chrome";
  if (widgetLostButton.test(text)) return "lost";
  if (widgetSubmit.test(text)) return "set";
  if (widgetButton.test(text)) return "chrome";
  if (text.length <= 40 && (widgetProgress.test(text) && /[/／]|^\**[^\s*]{2,12}\**$/.test(text) || text === "作答區")) return "chrome";
  return "";
}

function renderMessage(message, doc, parent, pending, headings, exercises = []) {
  const blockCounts = new Map();
  const blocks = markdownBlocks(message.text);
  let exerciseLevel;
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    const print = fingerprint(block.text);
    const occurrence = (blockCounts.get(print) ?? 0) + 1;
    blockCounts.set(print, occurrence);
    const key = `${message.id ?? message.role}:${print}:${occurrence}`;
    if (message.role === "assistant" && block.kind === "code" && block.language === "lesson-quiz" &&
        /^\d+$/.test(block.text)) {
      const slot = pending.findIndex(item => item.index === Number(block.text));
      if (slot >= 0) {
        const [item] = pending.splice(slot, 1);
        const form = quiz(item.question, doc, item.index);
        form.id = "exercise-quiz-" + (item.index + 1);
        exercises.push({ id: form.id, text: item.question.title || "第 " + (item.index + 1) + " 題" });
        parent.append(form);
        continue;
      }
    }
    const group = message.role === "assistant" && block.kind !== "code" && block.kind !== "rule"
      ? doc.quizGroups.find(item => item.start === block.text.trim()) : undefined;
    if (group) {
      // 題組卡片取代原文的題目與選項；跳過的區塊仍計入出現次序，避免後面的註解錨點位移。
      parent.append(quizGroup(group, headings, exercises));
      let next = index + 1;
      const stop = group.count ? Math.min(blocks.length, index + group.count) : blocks.length;
      while (next < stop && (group.count || blocks[next].kind !== "rule") &&
          !(blocks[next].kind === "heading" && blocks[next].level < block.level) &&
          !(group.until && blocks[next].text.trim().startsWith(group.until))) {
        const skipped = fingerprint(blocks[next].text);
        blockCounts.set(skipped, (blockCounts.get(skipped) ?? 0) + 1);
        next++;
      }
      index = next - 1;
      continue;
    }
    // 匯出時留下的互動元件殘影：按鈕文字、作答進度。選項已經遺失的題目補一句說明，其餘直接略過。
    const leftover = message.role === "assistant" && block.kind === "paragraph" ? widgetLeftover(block.text) : "";
    if (leftover) {
      if (leftover === "lost" || leftover === "set") {
        parent.append(element("p", leftover === "lost"
          ? "這題的選項原本是互動元件，匯出時沒有保存下來，目前只能閱讀題幹。"
          : "這一節的作答題目原本是互動元件，匯出時沒有保存下來。", "widget-lost"));
      }
      continue;
    }
    const node = blockElement(block);
    node.dataset.anchor = key;
    const isAssistantHeading = block.kind === "heading" && message.role === "assistant";
    const title = block.text.replace(/^\*+|\*+$/g, "").trim();
    const isNumberedExercise = message.role === "assistant" && (isAssistantHeading || block.kind === "paragraph") &&
      (exerciseName.test(title) || (isAssistantHeading && exerciseLevel !== undefined
        && block.level > exerciseLevel && /^[0-9０-９]+\s*[.、)｜:：]/.test(title)));
    const question = isAssistantHeading ? pending.find(item => item.question.title === block.text) : undefined;
    if (isAssistantHeading) {
      node.id = `section-${headings.length + 1}`;
      headings.push({ id: node.id, text: node.textContent, level: block.level });
      if (exerciseLevel !== undefined && block.level <= exerciseLevel) exerciseLevel = undefined;
      if (!isNumberedExercise && exerciseSection.test(title)) exerciseLevel = block.level;
    }
    if (isNumberedExercise || question) {
      if (!node.id) node.id = "exercise-text-" + (exercises.length + 1);
      exercises.push({ id: node.id, text: isAssistantHeading ? node.textContent : title.split("\n")[0].slice(0, 88) });
    }
    const row = block.kind === "rule" ? node : annotatableBlock(node, block, key, doc.annotations.get(key));
    const leadIn = doc.leadIns.get(key);
    if (leadIn && row !== node) renderLeadIn(row, leadIn);
    parent.append(row);
    if (!question) continue;
    // A matching heading anchors the widget. Skip source question text only when its options also match.
    const options = question.question.options.map(option => option.label.replace(/^([A-Z])\.\s*/, "$1. ").trim());
    const next = blocks[index + 1];
    const followingOptions = blocks.slice(index + 2, index + 2 + options.length);
    if (next?.text.trim() === question.question.prompt.trim()
        && followingOptions.length === options.length
        && followingOptions.every((item, slot) => item.text.trim() === options[slot])) {
      index += 1 + options.length;
    }
    row.after(quiz(question.question, doc, question.index));
    pending.splice(pending.indexOf(question), 1);
  }
}

function libraryGroup(parent, key, label, count) {
  const row = element("li", undefined, "library-group");
  const details = element("details");
  details.open = catalogGroupState.get(key) ?? false;
  details.addEventListener("toggle", () => catalogGroupState.set(key, details.open));
  const list = element("ul");
  details.append(element("summary", `${label}（${count}）`), list);
  row.append(details);
  parent.append(row);
  return list;
}

function renderLibrary() {
  $("library").replaceChildren();
  updateDraftCount();
  const subjects = new Map();
  for (const [subject] of courseSubjects) {
    const projects = catalogProjects.filter(project => project.subject === subject);
    if (!projects.length) continue;
    projects.sort((a, b) => a.project.localeCompare(b.project, "zh-Hant"));
    subjects.set(subject, new Map(projects.map(p => [p.projectId, { label: p.project, items: [] }])));
  }
  for (const item of library.values()) {
    if (!item.project) continue;
    const subject = item.subject ?? "其他專案";
    if (!subjects.has(subject)) subjects.set(subject, new Map());
    const projects = subjects.get(subject);
    const key = item.projectId ?? item.project;
    if (!projects.has(key)) projects.set(key, { label: item.project, items: [] });
    projects.get(key).items.push(item);
  }
  const renderRow = (parent, item) => {
    const row = element("li");
    const open = element("button", item.title, "open");
    open.title = item.dirty ? `${item.title}（有未匯出的變更）` : item.title;
    if (item.dirty) {
      open.append(element("span", " •", "draft-marker"));
      open.setAttribute("aria-label", open.title);
    }
    if (item.id === activeId) open.setAttribute("aria-current", "true");
    open.addEventListener("click", () => {
      if ($("navigation-dialog").open) $("navigation-dialog").close("reading");
      openLesson(item);
    });
    const close = element("button", "×", "close");
    close.setAttribute("aria-label", `關閉 ${item.title}`);
    close.addEventListener("click", () => closeLesson(item));
    row.append(open, close);
    parent.append(row);
  };
  for (const [subject, projects] of subjects) {
    const groups = [...projects.values()];
    const list = libraryGroup($("library"), `subject:${subject}`, courseSubjects.get(subject) ?? subject,
      groups.reduce((count, group) => count + group.items.length, 0));
    for (const [key, project] of projects) {
      const lessons = libraryGroup(list, `project:${subject}:${key}`, project.label, project.items.length);
      for (const item of project.items) renderRow(lessons, item);
    }
  }
  for (const item of library.values()) if (!item.project) renderRow($("library"), item);
}

function render() {
  for (const url of figureUrls) URL.revokeObjectURL(url);
  figureUrls = [];
  $("sections").replaceChildren();
  $("exercise-links").replaceChildren();
  $("body").replaceChildren();
  revealedBlock = undefined;
  const doc = library.get(activeId);
  renderLibrary();
  $("import").disabled = importing;
  $("sample").hidden = typeof window.readLessonSample !== "function" || library.has(window.lessonSampleId);
  $("sample").disabled = importing;
  $("cover").hidden = tutorialOnly;
  $("tutorial").hidden = Boolean(doc);
  $("tutorial-title").setAttribute("aria-level", tutorialOnly ? "1" : "2");
  for (const heading of $("tutorial").querySelectorAll("h3")) {
    heading.setAttribute("aria-level", tutorialOnly ? "2" : "3");
  }
  $("body").hidden = !doc;
  $("reading-tools").hidden = !doc;
  $("outline").hidden = true;
  $("exercise-outline").hidden = true;
  $("show-outline").disabled = true;
  $("title").textContent = doc?.title ?? "開啟一份教材";
  $("subject").textContent = doc?.project ?? "";
  const subtitle = $("subtitle");
  const questionCount = doc?.questions.length ?? 0;
  subtitle.textContent = doc
    ? (questionCount ? `${questionCount} 道互動題` : "")
    : $("course-catalog")
      ? "從課程資料庫挑一份講義，或匯入自己的對話。"
      : "匯入 JSON、Markdown 或純文字對話，或從範例開始。";
  subtitle.hidden = !subtitle.textContent;
  document.title = doc ? `${doc.title}｜講義桌` : "講義桌";
  if (!doc) return;
  const headings = [];
  const exercises = [];
  const pending = doc.questions.map((question, index) => ({ question, index }));
  for (const message of doc.messages) {
    if (message.role === "user") {
      const details = element("details", undefined, "user-turn");
      details.append(element("summary", "原始提問"));
      renderMessage(message, doc, details, [], []);
      $("body").append(details);
    } else renderMessage(message, doc, $("body"), pending, headings, exercises);
  }
  if (pending.length) {
    const heading = element("h2", "練習題");
    heading.id = "remaining-questions";
    $("body").append(heading);
    headings.push({ id: heading.id, text: heading.textContent, level: 2 });
    for (const item of pending) {
      const form = quiz(item.question, doc, item.index);
      form.id = "exercise-quiz-" + (item.index + 1);
      exercises.push({ id: form.id, text: item.question.title || "第 " + (item.index + 1) + " 題｜" + item.question.prompt.slice(0, 48) });
      $("body").append(form);
    }
  }
  for (const [list, entries] of [[ $("sections"), headings.filter(item => item.level <= 3) ], [ $("exercise-links"), exercises ]]) {
    for (const heading of entries) {
      const row = element("li", undefined, heading.level === 3 ? "subsection" : "");
      const link = element("a", heading.text);
    link.href = `#${heading.id}`;
      row.append(link);
      list.append(row);
    }
    list.parentElement.hidden = !entries.length;
  }
  $("show-outline").disabled = !$("sections").children.length && !$("exercise-links").children.length;
}

function setupNavigation() {
  const viewport = window.matchMedia("(max-width: 68rem)");
  const dialog = $("navigation-dialog");
  let opened;
  let jumpTarget;
  for (const [name, title] of [["library", "已開啟教材"], ["outline", "目錄與習題"]]) {
    const trigger = $("show-" + name);
    const home = $(name + "-slot");
    trigger.addEventListener("click", () => {
      if (!viewport.matches || dialog.open || opened) return;
      const panel = home.querySelector("nav");
      opened = { trigger, home, panel };
      jumpTarget = undefined;
      $("navigation-title").textContent = title;
      dialog.dataset.side = name === "outline" ? "right" : "left";
      dialog.returnValue = "";
      $("navigation-content").append(panel);
      trigger.setAttribute("aria-expanded", "true");
      dialog.showModal();
    });
  }
  $("close-navigation").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
    else {
      const link = event.target.closest("a[href^='#']");
      if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      jumpTarget = $(link.hash.slice(1));
      dialog.close("jump");
    }
  });
  dialog.addEventListener("close", () => {
    if (!opened) return;
    const { trigger, home, panel } = opened;
    home.append(panel);
    opened = undefined;
    trigger.setAttribute("aria-expanded", "false");
    if (jumpTarget) {
      jumpTarget.tabIndex = -1;
      jumpTarget.focus({ preventScroll: true });
    } else if (!viewport.matches || dialog.returnValue === "reading") $("lesson").focus({ preventScroll: true });
    else trigger.focus({ preventScroll: true });
  });
  viewport.addEventListener("change", () => {
    if (!viewport.matches && dialog.open) dialog.close();
  });
}

function select(id, showTutorial = false) {
  if (showTutorial) $("status").textContent = "";
  requestedLesson = undefined;
  if (id !== activeId || showTutorial !== tutorialOnly) {
    if (library.has(activeId)) library.get(activeId).scroll = window.scrollY;
    activeId = id;
    tutorialOnly = showTutorial;
    render();
  } else if (!showTutorial) return;
  $(showTutorial ? "tutorial-title" : "lesson").focus({ preventScroll: true });
  window.scrollTo(0, library.get(id)?.scroll ?? 0);
}

async function openLesson(item) {
  const request = { id: item.id };
  requestedLesson = request;
  const status = $("status");
  if (item.deferred) {
    status.textContent = `正在載入「${item.title}」…`;
    try {
      await loadCourseLesson(item);
    } catch (error) {
      console.warn("無法載入教材正文", item.id, error.message);
      if (requestedLesson === request) {
        status.textContent = `無法載入「${item.title}」，請再點一次重試。`;
      }
      return;
    }
  }
  if (requestedLesson !== request || !library.has(item.id)) return;
  status.textContent = "";
  select(item.id);
}

function loadCourseLesson(item) {
  if (item.loading) return item.loading;
  const script = document.createElement("script");
  script.src = `course-content/${item.id}.js${item.version ? `?v=${item.version}` : ""}`;
  item.loading = new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => finish(new Error("教材載入逾時")), 20000);
    function finish(error) {
      window.clearTimeout(timer);
      script.remove();
      if (error) reject(error);
      else resolve();
    }
    script.onerror = () => finish(new Error("找不到或無法讀取教材檔"));
    script.onload = () => {
      try {
        const record = script.lessonRecord;
        if (record?.conversationId !== item.id || record.projectId !== item.projectId) {
          throw new Error("教材檔與目錄不符");
        }
        const doc = normalizeCatalogLesson(record);
        if (library.get(item.id) === item) library.set(item.id, doc);
        finish();
      } catch (error) {
        finish(error);
      }
    };
    document.head.append(script);
  }).finally(() => { delete item.loading; });
  return item.loading;
}

function addLesson(doc) {
  if (library.has(doc.id)) return false;
  library.set(doc.id, doc);
  return true;
}

function draftCount() {
  let count = 0;
  for (const doc of library.values()) if (doc.dirty) count++;
  return count;
}

function updateDraftCount() {
  const pending = draftCount();
  $("draft-count").textContent = pending ? `未匯出 ${pending} 篇` : "";
}

function updateAnnotation(doc, key, entry) {
  entry.side = entry.side === "left" ? "left" : "right";
  if (entry.note || entry.guide) doc.annotations.set(key, entry);
  else doc.annotations.delete(key);
  doc.dirty = doc.annotations.size !== doc.savedAnnotations.size ||
    [...doc.annotations].some(([id, annotation]) => {
      const previous = doc.savedAnnotations.get(id);
      return annotation.note !== previous?.note || annotation.guide !== previous?.guide ||
        annotation.side !== previous?.side;
    });
}

function closeLesson(doc) {
  if (doc.dirty && !window.confirm("這篇有尚未匯出的註解。確定關閉？")) return;
  if (requestedLesson?.id === doc.id) requestedLesson = undefined;
  library.delete(doc.id);
  if (doc.id === activeId) {
    select([...library.values()].find(item => !item.deferred)?.id);
  } else render();
  ($("import").disabled ? $("lesson") : $("import")).focus({ preventScroll: true });
  $("status").textContent = `已關閉「${doc.title}」。`;
}

function loadSample() {
  if (library.has(window.lessonSampleId)) return;
  if (typeof window.readLessonSample !== "function") {
    $("status").textContent = "找不到範例。請手動匯入匯出檔。";
    return;
  }
  const doc = normalize(window.readLessonSample(), "範例");
  if (addLesson(doc)) select(doc.id);
}

function normalizeCatalogLesson(record) {
  const doc = normalize(record, "未命名教材");
  doc.catalog = true;
  const draft = readCatalogAnnotations(doc.id);
  if (draft) {
    doc.annotations = new Map(draft);
    doc.savedAnnotations = new Map(draft);
  }
  return doc;
}

function catalogEntry(record) {
  const { conversationId: id, title, project, projectId, subject, version } = record;
  if (typeof id !== "string" || !conversationIdPattern.test(id) || typeof title !== "string" ||
      typeof project !== "string" || typeof projectId !== "string" || typeof subject !== "string" ||
      (version !== undefined && (typeof version !== "string" || !/^[a-f0-9]{12}$/.test(version)))) {
    throw new Error("教材目錄項目格式不符");
  }
  return { id, title, project, projectId, subject, version, deferred: true };
}

function loadCourseCatalog(source) {
  const status = $("catalog-status");
  status.hidden = false;
  try {
    const catalog = JSON.parse(source.textContent);
    if (!Array.isArray(catalog.conversations) || !Number.isSafeInteger(catalog.expected)) {
      throw new Error("課程資料庫格式錯誤");
    }
    if (Array.isArray(catalog.projects)) catalogProjects.push(...catalog.projects);
    let rejected = 0;
    for (const record of catalog.conversations) {
      try {
        addLesson(catalog.deferred ? catalogEntry(record) : normalizeCatalogLesson(record));
      } catch (error) {
        rejected++;
        console.warn("無法載入一筆課程資料", error.name);
      }
    }
    $("library-heading").textContent = "課程資料庫";
    status.textContent = `已載入 ${library.size} 篇${rejected ? `，${rejected} 篇無法顯示` : ""}`;
    render();
  } catch (error) {
    console.warn("無法開啟課程資料庫", error.name);
    status.textContent = "無法載入課程資料庫。";
  }
}

function catalogAnnotationKey(id) {
  return `lesson-desk-catalog-annotations:${id}`;
}

function readCatalogAnnotations(id) {
  try {
    const raw = window.localStorage.getItem(catalogAnnotationKey(id));
    if (!raw) return;
    const entries = JSON.parse(raw);
    if (Array.isArray(entries)) return entries;
  } catch (error) {
    console.warn("無法讀取本機課程註解", error.name);
  }
}

async function importFiles(files) {
  if (importing || !files.length) return;
  importing = true;
  $("import").disabled = true;
  $("sample").disabled = true;
  $("body").setAttribute("aria-busy", "true");
  let newestId;
  let added = 0;
  let duplicates = 0;
  const errors = [];
  try {
    for (const file of files) {
      try {
        const name = file.name.replace(/\.(json|md|txt)$/i, "");
        if (!/\.(json|md|txt)$/i.test(file.name)) throw new Error("請選擇 JSON、Markdown 或純文字檔。");
        const raw = (await file.text()).replace(/^\uFEFF/, "");
        const parsed = /\.json$/i.test(file.name) ? JSON.parse(raw) : { markdown: raw };
        const records = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.conversations) ? parsed.conversations : [parsed];
        if (!records.length) throw new Error("檔案沒有對話。");
        for (const [index, record] of records.entries()) {
          try {
            const doc = normalize(record, records.length > 1 ? `${name} ${index + 1}` : name);
            if (addLesson(doc)) {
              newestId = doc.id;
              added++;
            } else duplicates++;
          } catch (error) {
            errors.push(`${file.name}${records.length > 1 ? ` #${index + 1}` : ""}：${error.message}`);
          }
        }
      } catch (error) {
        errors.push(`${file.name}：${error.message}`);
      }
    }
  } finally {
    importing = false;
    $("body").removeAttribute("aria-busy");
    if (newestId) select(newestId);
    else render();
    $("status").textContent = [
      added ? `已匯入 ${added} 篇。` : "",
      duplicates ? `略過 ${duplicates} 篇重複對話。` : "",
      errors.length ? errors.join("　") : ""
    ].filter(Boolean).join(" ");
  }
}

function editAnnotation(view, origin) {
  const doc = library.get(activeId);
  if (!doc || $("annotation").open) return;
  annotationBlock = { view, origin };
  const saved = doc.annotations.get(view.key);
  $("excerpt").textContent = view.text;
  $("guide").value = saved?.guide ?? "";
  $("note").value = saved?.note ?? "";
  $("annotation-left").checked = saved?.side === "left";
  $("annotation-right").checked = !$("annotation-left").checked;
  $("annotation").showModal();
}

function revealAnnotationTrigger(event) {
  const target = event.target;
  if (target.closest?.(".annotation-trigger") || window.getSelection()?.toString().trim()) return;
  const block = target.closest?.(".block-content");
  const interactive = target.closest?.("a, button, input, textarea, select, summary");
  const next = block && block !== revealedBlock && !interactive ? block : undefined;
  revealedBlock?.classList.remove("annotation-revealed");
  next?.classList.add("annotation-revealed");
  revealedBlock = next;
}

$("import").addEventListener("click", () => $("files").click());
$("files").addEventListener("change", event => {
  const files = [...event.currentTarget.files];
  event.currentTarget.value = "";
  void importFiles(files);
});
$("sample").addEventListener("click", loadSample);
for (const link of document.querySelectorAll(".tutorial-link")) {
  link.addEventListener("click", event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    select(undefined, true);
  });
}
document.addEventListener("click", revealAnnotationTrigger);
$("cancel-note").addEventListener("click", () => $("annotation").close());
$("annotation").addEventListener("close", () => {
  if ($("annotation").open || !annotationBlock) return;
  annotationBlock.origin.focus({ preventScroll: true });
  annotationBlock = undefined;
});
$("annotation-form").addEventListener("submit", event => {
  event.preventDefault();
  const doc = library.get(activeId);
  if (!doc || !annotationBlock) return;
  const { view } = annotationBlock;
  const note = $("note").value.trim();
  const guide = $("guide").value.trim();
  const side = $("annotation-left").checked ? "left" : "right";
  const top = view.content.getBoundingClientRect().top;
  updateAnnotation(doc, view.key, { note, guide, side });
  let persisted = true;
  if (doc.catalog) {
    try {
      window.localStorage.setItem(catalogAnnotationKey(doc.id), JSON.stringify([...doc.annotations]));
      doc.savedAnnotations = new Map(doc.annotations);
      doc.dirty = false;
    } catch (error) {
      persisted = false;
      console.warn("無法保存本機課程註解", error.name);
    }
  }
  renderAnnotation(view, doc.annotations.get(view.key));
  renderLibrary();
  annotationBlock.origin = view.trigger;
  $("annotation").close();
  window.scrollBy(0, view.content.getBoundingClientRect().top - top);
  $("status").textContent = !persisted ? "瀏覽器無法保存註解，請匯出含註解的 JSON。"
    : note || guide ? "已儲存段落註解。" : "已移除段落註解。";
});
$("save").addEventListener("click", () => {
  const doc = library.get(activeId);
  const data = {
    conversationId: doc.id, title: doc.title, project: doc.project, projectId: doc.projectId,
    subject: doc.subject, sourceUrl: doc.sourceUrl,
    messages: doc.messages, questions: doc.questions, annotations: Object.fromEntries(doc.annotations)
  };
  if (doc.leadIns.size) data.leadIns = Object.fromEntries(doc.leadIns);
  if (doc.quizGroups.length) data.quizGroups = doc.quizGroups;
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = element("a");
  link.href = url;
  link.download = `${doc.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 90)}-含註解.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  doc.savedAnnotations = new Map(doc.annotations);
  doc.dirty = false;
  renderLibrary();
  $("status").textContent = "已送出 JSON 下載。";
});
window.addEventListener("beforeunload", event => {
  if (![...library.values()].some(doc => doc.dirty)) return;
  event.preventDefault();
  event.returnValue = true;
});

setupTheme();
setupNavigation();
render();
const catalog = $("course-catalog");
if (catalog) loadCourseCatalog(catalog);
