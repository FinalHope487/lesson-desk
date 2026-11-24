"use strict";

const LessonMarkdown = (() => {
  const options = { gfm: true };
  const allowed = new Set("A B BLOCKQUOTE BR CODE DEL DIV EM H1 H2 H3 H4 H5 H6 HR I IMG INPUT LI OL P PRE S SPAN STRONG SUB SUP TABLE TBODY TD TH THEAD TR UL".split(" "));
  const placeholder = /\uE110(\d+)\uE111/g;
  const bracketMath = /\\[a-zA-Z]|[\^_=<>+]|\d\s*[-*/]\s*\d|\([^)]*\)\s*\(/;
  const customCode = new Set(["lesson-image", "lesson-quiz", "svg"]);
  const special = block => block.kind === "math" || block.kind === "chart" ||
    block.kind === "code" && customCode.has(block.language);

  function safeUrl(value) {
    if (!value || /[\u0000-\u0020]/.test(value)) return "";
    const scheme = /^([a-z][\w+.-]*):/i.exec(value)?.[1]?.toLowerCase();
    return !scheme || ["http", "https", "mailto"].includes(scheme) ? value : "";
  }

  function render(parent, source, { inline = false, renderMath, fragment = false, references } = {}) {
    const protectedText = [];
    const store = (raw, math) => {
      const index = protectedText.push({ raw, math }) - 1;
      return "\uE110" + index + "\uE111";
    };
    const input = source
      .replace(/\uE200cite\uE202[^\uE201]*\uE201/g, "")
      .replace(/（無法取得目前的值。）/g, "")
      .replace(/\s*\\?\(目前的選取項目無法使用。\)/g, "")
      .replace(/[\uE110\uE111]/g, "\uFFFD")
      .replace(/(`+)([^`\n]+)\1|\\\[(?:(?!\\[[\]])[\s\S])+?\\\]|\\\((?:(?!\\[()])[\s\S])+?\\\)|(?<![\\$])\$\$[\s\S]+?\$\$|(?<![\\$])\$[^$\n]+\$(?!\$)/g,
        (raw, ticks, code) => ticks ? ticks + code.replace(/\|/g, () => store("|", false)) + ticks : store(raw, true));
    const template = document.createElement("template");
    if (inline) template.innerHTML = marked.parseInline(input, options);
    else {
      const lexer = new marked.Lexer(options);
      Object.assign(lexer.tokens.links, references);
      template.innerHTML = marked.parser(lexer.lex(input), options);
    }
    const restore = text => text.replace(placeholder, (token, index) => protectedText[index]?.raw ?? token);

    function copy(target, source, literal = false) {
      for (const node of source.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent;
          if (literal || !renderMath) {
            target.append(restore(text));
            continue;
          }
          let end = 0;
          for (const match of text.matchAll(placeholder)) {
            target.append(text.slice(end, match.index));
            const item = protectedText[match[1]];
            if (item?.math) {
              const display = !inline && text.trim() === match[0] && source.childNodes.length === 1;
              if (!display && item.raw.startsWith("\\[") && !bracketMath.test(item.raw.slice(2, -2))) {
                target.append("[" + item.raw.slice(2, -2).trim() + "]");
              } else renderMath(target, item.raw, display);
            } else target.append(item?.raw ?? match[0]);
            end = match.index + match[0].length;
          }
          target.append(text.slice(end));
          continue;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        const tag = node.tagName;
        if (!allowed.has(tag)) {
          // Omit raw active HTML while retaining text from harmless unknown tags.
          if (!["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "TEMPLATE", "SVG", "MATH"].includes(tag)) {
            copy(target, node, literal);
          }
          continue;
        }
        const output = document.createElement(tag === "H1" ? "h2" : tag.toLowerCase());
        if (tag === "A" || tag === "IMG") {
          const attribute = tag === "A" ? "href" : "src";
          const href = safeUrl(restore(node.getAttribute(attribute) ?? ""));
          if (href) output.setAttribute(attribute, href);
          if (tag === "IMG") {
            output.alt = restore(node.alt);
            output.loading = "lazy";
          }
          if (node.title) output.title = restore(node.title);
        } else if (tag === "INPUT") {
          if (node.type !== "checkbox") continue;
          output.type = "checkbox";
          output.checked = node.checked;
          output.disabled = true;
          output.setAttribute("aria-label", node.checked ? "已完成" : "未完成");
        } else if (tag === "OL") output.start = node.start;
        else if (tag === "TH" || tag === "TD") {
          if (tag === "TH") output.scope = "col";
          if (["left", "center", "right"].includes(node.align)) output.style.textAlign = node.align;
        }
        copy(output, node, literal || tag === "CODE" || tag === "PRE");
        if (tag === "TABLE") {
          const wrap = document.createElement("div");
          wrap.className = "table-wrap";
          wrap.append(output);
          target.append(wrap);
        } else target.append(output);
      }
    }

    if (fragment && template.content.childElementCount === 1 && template.content.firstElementChild.tagName === "P") {
      copy(parent, template.content.firstElementChild);
    } else copy(parent, template.content);
    return parent;
  }

  // Legacy blocks still identify annotations and quiz replacements. Group only
  // the blocks that the Markdown lexer considers part of the same construct.
  function plan(raw, blocks, isBoundary = () => false) {
    const lines = raw.replace(/\r\n?/g, "\n").split("\n");
    const result = new Map();
    const boundary = block => special(block) || isBoundary(block);
    const references = marked.lexer(raw, options).links;
    for (let from = 0; from < blocks.length;) {
      if (boundary(blocks[from])) {
        from++;
        continue;
      }
      let to = from + 1;
      while (to < blocks.length && !boundary(blocks[to])) to++;
      const sectionStart = blocks[from].startLine;
      const rawSection = lines.slice(sectionStart, blocks[to - 1].endLine).join("\n");
      let line = sectionStart;
      let cursor = from;
      const joins = new Set();
      for (const token of marked.lexer(rawSection, options)) {
        const newlineCount = token.raw.split("\n").length - 1;
        const finalLine = line + newlineCount;
        const exclusive = finalLine + Number(!token.raw.endsWith("\n"));
        while (cursor < to && blocks[cursor].startLine < exclusive) {
          if (blocks[cursor].startLine > line) joins.add(cursor);
          cursor++;
        }
        line = finalLine;
      }
      for (let start = from; start < to;) {
        let end = start + 1;
        while (end < to && joins.has(end)) end++;
        result.set(start, { source: lines.slice(blocks[start].startLine, blocks[end - 1].endLine).join("\n"), references });
        for (let i = start + 1; i < end; i++) result.set(i, { continuation: true });
        start = end;
      }
      from = to;
    }
    return result;
  }

  const chapterExercise = /(?:章末|本章).*(?:習題|練習|測驗|題組)/;

  function chapterQuizGaps(blocks, groups, questionCount) {
    const gaps = new Map();
    for (let start = 0; start < blocks.length; start++) {
      const heading = blocks[start];
      if (heading.kind !== "heading" || !chapterExercise.test(heading.text)) continue;
      let end = start + 1;
      while (end < blocks.length && (blocks[end].kind !== "heading" || blocks[end].level > heading.level)) end++;
      const section = blocks.slice(start + 1, end);
      const progress = section.findIndex(block => block.kind === "paragraph" && /作答進度[^\n]*[/／]\s*\d+\s*題/.test(block.text));
      if (progress < 0) continue;
      const expected = Number(/作答進度[^\n]*[/／]\s*(\d+)\s*題/.exec(section[progress].text)[1]);
      const starts = new Set(section.filter(block => !special(block)).map(block => block.text.trim()));
      const slots = new Set(section.filter(block => block.kind === "code" && block.language === "lesson-quiz" &&
        /^\d+$/.test(block.text) && Number(block.text) < questionCount).map(block => Number(block.text)));
      const available = groups.filter(group => starts.has(group.start)).reduce((sum, group) => sum + group.questions.length, slots.size);
      if (expected > available) gaps.set(section[progress], expected - available);
    }
    return gaps;
  }

  function gapNotice(missing, anchor) {
    const note = document.createElement("p");
    note.className = "widget-lost";
    note.dataset.anchor = anchor;
    note.dataset.missingQuestions = missing;
    note.textContent = `原始匯出未包含這一節的 ${missing} 道互動題，這些題目目前無法作答。`;
    return note;
  }

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
      console.warn("LaTeX 渲染失敗", { reader: parserError.name, katex: error.name });
      wrapper.textContent = source;
      wrapper.classList.add("math-fallback");
      wrapper.title = `LaTeX 原文 · ${parserError.message}；KaTeX：${error.message}`;
    }
  }

  return { plan, render, chapterQuizGaps, gapNotice, renderWithKatex };
})();
