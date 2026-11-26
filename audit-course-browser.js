// Usage: node audit-course-browser.js [--local | --online]
//   [--fixtures-only | --sample | --batch=<number> | --all-media | --lesson=<ID>] [--chapter-audit]
// Requires Playwright. Set PLAYWRIGHT_MODULE and CHROME_PATH for a custom installation.
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { pathToFileURL } = require("node:url");
let chromium;

const local = process.argv.includes("--local");
const online = process.argv.includes("--online");
const fixturesOnly = process.argv.includes("--fixtures-only");
const sample = process.argv.includes("--sample");
const allMedia = process.argv.includes("--all-media");
const chapterAudit = process.argv.includes("--chapter-audit");
const visualizationAudit = process.argv.includes("--visualization-audit");
const batchArgument = process.argv.find(arg => arg.startsWith("--batch="));
const batch = batchArgument === undefined ? null : Number(batchArgument.slice("--batch=".length));
const batchSize = 9;
const sampleSeed = "course-render-audit-v1";
const sampleIds = [
  "6af9590b-e9f8-83ee-86ad-a6f985f07b9d", "6af9558a-5144-83e8-b71a-6caa5c591a9c", "6af95661-c488-83ec-9b13-986d06cf2b7f",
  "6af8b721-b69c-83e8-ad56-94fd9ee5bd96", "6af8c96e-69f0-83ee-a3e0-d9bb91598fcd", "6af8b2ab-59ec-83ee-ad40-ab08b031bac4",
  "6afd779b-834c-83ec-adbb-b61d16d5ed32", "6afd5529-0690-83e8-aee7-a4d75e05600e", "6afd5445-1e00-83e8-8dfa-b2637590b63b",
];
const lessonOptions = process.argv.filter(arg => arg.startsWith("--lesson="))
  .map(arg => arg.slice("--lesson=".length));
const root = __dirname;
const onlinePage = "https://finalhope487.github.io/lesson-desk/";
const localPage = path.join(__dirname, "course-library.html");
const releaseHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const releaseVersion = createHash("sha256").update(releaseHtml).digest("hex").slice(0, 12);
const pageUrl = online ? `${onlinePage}?v=${releaseVersion}`
  : pathToFileURL(local ? localPage : path.join(root, "index.html")).href;
const report = { edition: online ? "online" : local ? "local" : "pages", checks: {}, issues: [] };
const chemistryChapter = "6afd5445-1e00-83e8-8dfa-b2637590b63b";
// Counts verified in the original conversation, independently of the export.
const verifiedChapterCounts = {
  "6afd53e1-2b34-83ec-b9e0-003c061d14e4": { "十二、本章綜合習題": 5 },
  "6afd75aa-352c-83ee-ba6c-61b179191072": { "十三、本章綜合習題": 6 },
  "6afd79be-45d4-83ee-bcda-066079974065": { "九、本章綜合習題": 5 },
  "6afd5572-9ea0-83ee-81b7-0d775b578b48": { "十一、本章綜合習題": 5 },
  "6afd6d01-4058-83ec-8556-affbfbd46800": { "十二、本章綜合習題": 5 },
  "6afd6d79-c8d0-83ee-8fd6-a9627b2900ab": { "十、本章綜合習題": 6 },
  "6afd55c3-2658-83ee-9d8f-e71f367eaa57": { "十一、本章綜合習題": 4 },
  "6afd52ed-e4e0-83e8-80ed-187991462cf6": { "第六節：本章綜合練習": 4 },
  "6afd5396-48ec-83ee-b084-fe3725a1cfc7": { "八、本章綜合習題": 5 },
  "6afd6f6b-7a08-83ee-9bc9-a8cc35e59982": { "十二、本章綜合習題": 5 },
  "6afd7429-7798-83ee-bbf4-3caa599ce766": { "十一、本章綜合習題": 5 },
  "6afd6dcd-aafc-83e8-af2c-8bcd0523da3e": { "十一、本章習題": 5 },
  "6afd6e26-09a4-83e8-ab21-2ce0d09f4c45": { "十二、本章綜合習題": 5 },
  "6afd6e80-aadc-83ee-b9eb-4f8cc1d9e04a": { "十一、本章綜合習題": 5 },
  "6afd5491-aca8-83ee-8779-8ccb4624bca8": { "九、本章綜合習題": 4 },
  "6afd5529-0690-83e8-aee7-a4d75e05600e": { "十一、本章綜合習題": 5 },
  "6afd57ef-bf7c-83ee-9662-ce9fd0e6a08d": { "十、本章綜合習題": 4 },
  "6afd5605-635c-83ee-80e0-5bec3e6c7759": { "十、本章綜合習題": 4 },
  "6afd58dc-cb18-83ee-94fb-50b9e7ebe18d": { "九、本章綜合習題": 5 },
  "6af8cc07-8c48-83ec-9446-fbd8e47da050": { "九、章末習題": 4 },
  "6afd7b73-0bfc-83e8-939b-bf200f7c6002": { "十四、本章綜合習題": 5 },
  "6afd6c8e-ad10-83ee-bee4-b9bdb921c71e": { "十、本章綜合習題": 4 },
  "6afd70eb-8bf8-83e8-9273-5a10a71af1b6": { "十、本章綜合習題": 5 },
  "6afd733b-981c-83ee-af7f-e84934e89848": { "十一、本章綜合習題": 5 },
  "6afd565d-9a08-83ee-8d10-7feb69917418": { "十四、本章進階習題": 4 },
  "6afd54da-7e70-83ec-8771-36f269ff7846": { "十二、本章綜合習題": 5 },
  "6afd56e7-9954-83ec-a904-16424b62a913": { "十、本章綜合習題": 5 },
  "6afd5739-9200-83ee-a351-f8c4a0797707": { "十、本章綜合習題": 5 },
  "6afd7a9d-38f0-83e8-bcd4-e23476d2a829": { "十、本章綜合習題": 4 },
  "6af95540-cc94-83ee-a684-394882b52822": { "十一、章末綜合習題": 6 },
  "6afd73b8-b520-83e8-b386-6971b84f907b": { "十四、本章綜合習題": 6 },
  "6afd7491-5308-83e8-bdf3-4619eb561c21": { "九、本章綜合習題": 5 },
  "6afd578f-69fc-83e8-a5a0-c099e0b343fb": { "十一、本章綜合習題": 4 },
  "6afd583c-8a64-83e8-82e1-9b7ee437d461": { "八、本章綜合習題": 5 },
  "6afd5932-2f34-83ee-ba40-57222bb343c3": { "十三、本章綜合習題": 5 },
  "6afd534c-8960-83ec-b48d-440c64d34d1e": { "十、本章綜合習題": 4 },
  "6afd6f15-0a20-83ec-9655-7113a69d5dab": { "十一、章末綜合習題": 6 },
  "6af8b2ab-59ec-83ee-ad40-ab08b031bac4": { "第二章｜直線運動・章末測驗": 10 },
  "6af8cb59-be70-83ec-8c96-80bb124eda94": { "八、章末綜合習題": 5 },
  "6af8cbd0-8524-83e8-a28b-b32c180c11e3": { "八、章末綜合習題": 5 },
  "6af8c88a-fe88-83ec-b39e-633d06351e96": { "七、章末習題": 6 },
  [chemistryChapter]: { "八、本章綜合習題": 5 },
};

function readSourceExport({ conversationId, subject, project, projectId }) {
  const directory = path.join(__dirname, "course-exports");
  const name = `${conversationId}.json`;
  const primary = path.join(directory, subject, `${project} [${projectId}]`, name);
  const filename = fs.existsSync(primary) ? primary : path.join(directory, name);
  if (!fs.existsSync(filename)) return null;
  const source = JSON.parse(fs.readFileSync(filename, "utf8"));
  if ((source.conversationId ?? source.conversation_id ?? source.id) !== conversationId) {
    throw new Error(`Invalid source export ID: ${conversationId}`);
  }
  return source;
}

function contentVersion(catalog) {
  const files = ["index.html", "reader.js", "reader.css", "lesson-markdown.js", "lesson-visualization.js", "marked.umd.js", "katex.min.js"];
  if (releaseHtml.includes('src="lesson-legacy-widgets.js')) files.push("lesson-legacy-widgets.js");
  files.push(...catalog.map(item => `course-content/${item.conversationId}.js`));
  const media = path.join(root, "course-media");
  for (const name of fs.readdirSync(media, { recursive: true })) {
    if (fs.statSync(path.join(media, name)).isFile()) files.push(`course-media/${name}`);
  }
  const digest = createHash("sha256");
  for (const name of files.sort()) {
    digest.update(name.replaceAll("\\", "/")).update("\0");
    digest.update(createHash("sha256").update(fs.readFileSync(path.join(root, name))).digest());
  }
  return digest.digest("hex");
}

function batchSample(catalog, number) {
  const groups = new Map();
  for (const { subject, conversationId } of catalog) {
    if (!subject) throw new Error("Catalog entry without a subject");
    if (!groups.has(subject)) groups.set(subject, []);
    groups.get(subject).push({ id: conversationId, rank: createHash("sha256")
      .update(`${sampleSeed}:${subject}:${conversationId}`).digest("hex") });
  }
  function quotas(total) {
    const shares = [...groups].map(([subject, entries]) => {
      const numerator = total * entries.length;
      return { subject, count: Math.floor(numerator / catalog.length), remainder: numerator % catalog.length };
    }).sort((a, b) => b.remainder - a.remainder || a.subject.localeCompare(b.subject, "zh-TW"));
    const remaining = total - shares.reduce((sum, share) => sum + share.count, 0);
    return new Map(shares.map(({ subject, count }, index) => [subject, count + Number(index < remaining)]));
  }

  if (number > Math.ceil(catalog.length / batchSize)) throw new Error("Sample catalog exhausted");
  const picked = new Map([...groups].map(([subject]) => [subject, 0]));
  for (const entries of groups.values()) entries.sort((a, b) => a.rank.localeCompare(b.rank) || a.id.localeCompare(b.id));
  for (let round = 1; round <= number; round++) {
    const total = Math.min(round * batchSize, catalog.length);
    const assigned = [...picked.values()].reduce((sum, count) => sum + count, 0);
    const current = quotas(total);
    const ids = [];
    while (ids.length < total - assigned) {
      const next = [...groups].filter(([subject, entries]) => picked.get(subject) < entries.length)
        .sort(([a], [b]) => (current.get(b) - picked.get(b)) - (current.get(a) - picked.get(a)) ||
          a.localeCompare(b, "zh-TW"))[0];
      const [subject, entries] = next;
      ids.push(entries[picked.get(subject)].id);
      picked.set(subject, picked.get(subject) + 1);
    }
    if (round === number) return ids;
  }
}

const normalizedLines = text => text.replace(/\r\n/g, "\n");
const readerFile = /^(?:reader\.css|(?:katex\.min|marked\.umd|lesson-markdown|lesson-visualization|lesson-legacy-widgets|reader)\.js)$/;

async function compareOnlineAsset(response, name, binary) {
  const received = await response.body();
  const expected = fs.readFileSync(path.join(root, name));
  if (!response.ok() || (binary ? !received.equals(expected) :
    normalizedLines(received.toString("utf8")) !== normalizedLines(expected.toString("utf8")))) {
    throw new Error(`Online asset differs from the release: ${name}`);
  }
}

function readLesson(id) {
  if (!/^[\da-f-]{36}$/i.test(id)) throw new Error("Invalid catalog ID");
  const file = fs.readFileSync(path.join(root, "course-content", id + ".js"), "utf8").trim();
  const payload = /^document\.currentScript\.lessonRecord = JSON\.parse\(("[^]*")\);$/.exec(file)?.[1];
  if (!payload) throw new Error("Invalid lesson asset");
  const record = JSON.parse(JSON.parse(payload));
  if (record.conversationId !== id) throw new Error("Lesson ID mismatch");
  return record;
}

function structuredWidgetKeys(value, pathParts = [], found = []) {
  if (!value || typeof value !== "object") return found;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => structuredWidgetKeys(entry, [...pathParts, String(index)], found));
    return found;
  }
  for (const [key, entry] of Object.entries(value)) {
    const next = [...pathParts, key];
    if (/widget|visualization|interactive|app.?block/i.test(key)) found.push(next.join("."));
    structuredWidgetKeys(entry, next, found);
  }
  return found;
}

function payloadSearchStatus(record, paths) {
  if (!record) return "source-export-missing";
  return paths.length ? "widget-like-key-paths-found" : "no-widget-like-key-path-found";
}

function visualizationSignals(record, payloadPaths = []) {
  const messages = Array.isArray(record.messages) ? record.messages : [];
  const assistant = messages.filter(message => message?.role === "assistant" && typeof message.text === "string");
  const text = assistant.map(message => message.text).join("\n");
  const ranges = [...text.matchAll(/滑桿|滑块|\bsliders?\b|\brange\s+input\b|\bnumeric\s+input\b|\bnumber\s+input\b/gi)];
  const placeholders = [...text.matchAll(/目前的值無法使用|目前值無法使用|目前的值不可用/gi)];
  const parameterLanguage = [...text.matchAll(/調整(?:參數|質量|質量|作用力|頻率|相位|振幅|角度|係數)|移動滑桿|改變.*(?:曲線|波形|圖形|加速度|質心)|slider.{0,80}(?:curve|wave|mass|force|value|graph)/gi)];
  const fences = [...text.matchAll(/```([^\r\n`]*)\r?\n([\s\S]*?)```/g)];
  const fencedSvg = fences.filter(match => match[1].trim().toLowerCase() === "svg");
  const interactiveSvg = fencedSvg.filter(match => /aria-label\s*=\s*["'][^"']*(?:interactive|可互動|可拖曳|draggable)|\bdraggable\s*=\s*["']?true|\bdata-learning-block-pan\s*=|\brole\s*=\s*["'](?:button|slider)["']|on(?:pointer|mouse|touch|key)\w+\s*=/i.test(match[2]));
  const fencedHtml = fences.filter(match => /^html(?:\s|$)/i.test(match[1].trim()))
    .filter(match => /<\s*(?:input|canvas|button|select|textarea|details)\b/i.test(match[2]));
  const htmlControls = [...text.matchAll(/<\s*(?:input|select|textarea|button)\b[^>]*>/gi)];
  const controls = {
    input: [...text.matchAll(/<\s*input\b/gi)].length,
    range: [...text.matchAll(/<\s*input\b[^>]*\btype\s*=\s*["']?range/gi)].length,
    number: [...text.matchAll(/<\s*input\b[^>]*\btype\s*=\s*["']?number/gi)].length,
    roleSlider: [...text.matchAll(/\brole\s*=\s*["']slider["']/gi)].length,
  };
  const semanticMarkers = [...text.matchAll(/\uE200(?:[\w.-]+)\uE202/gu)].map(match => match[0]);
  return {
    assistantMessageCount: assistant.length,
    sliderOrNumericInputMentions: ranges.length,
    visualizationBehaviorMentions: parameterLanguage.length,
    unavailablePlaceholders: placeholders.length,
    fencedSvgBlocks: fencedSvg.length,
    fencedInteractiveSvgBlocks: interactiveSvg.length,
    fencedInteractiveHtmlBlocks: fencedHtml.length,
    literalHtmlControls: htmlControls.length,
    literalControlCounts: controls,
    privateUseMarkers: [...new Set(semanticMarkers)],
    widgetPayloadPaths: payloadPaths,
    candidate: Boolean(ranges.length || placeholders.length || interactiveSvg.length || htmlControls.length || payloadPaths.length),
  };
}

function runVisualizationAudit() {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const catalogText = /<script id="course-catalog" type="application\/json">([\s\S]*?)<\/script>/.exec(html)?.[1];
  if (!catalogText) throw new Error("Release course catalog not found");
  const catalog = JSON.parse(catalogText).conversations;
  if (catalog.length !== 103) throw new Error(`Expected 103 lessons, received ${catalog.length}`);

  const inventory = catalog.map(item => {
    const release = readLesson(item.conversationId);
    const source = readSourceExport(item);
    const payloadPaths = source ? structuredWidgetKeys(source).filter(key => !/\.messages\.\d+\.text$/.test(key)) : [];
    const releasePayloadPaths = structuredWidgetKeys(release).filter(key => !/\.messages\.\d+\.text$/.test(key));
    const releaseSignals = visualizationSignals(release, releasePayloadPaths);
    const sourceSignals = source ? visualizationSignals(source, payloadPaths) : null;
    const assistantText = (release.messages ?? []).filter(message => message?.role === "assistant")
      .map(message => message.text ?? "").join("\n");
    const sourceAssistant = (source?.messages ?? []).filter(message => message?.role === "assistant");
    const candidate = releaseSignals.candidate || Boolean(sourceSignals?.candidate);
    return {
      lessonId: item.conversationId,
      title: item.title,
      subject: item.subject,
      candidate,
      classification: candidate ? (releaseSignals.unavailablePlaceholders ? "widget-placeholder"
        : releaseSignals.fencedInteractiveSvgBlocks ? "interactive-svg-renderer-review"
          : "visualization-hint-needs-source-review")
        : releaseSignals.fencedSvgBlocks ? "static-svg-or-unverified-svg" : "no-local-visualization-signal",
      sourceExport: {
        present: Boolean(source),
        assistantMessageCount: sourceSignals?.assistantMessageCount ?? 0,
        payloadPaths,
        signals: sourceSignals,
      },
      releaseRecord: {
        present: true,
        assistantMessageCount: releaseSignals.assistantMessageCount,
        payloadPaths: releasePayloadPaths,
        signals: releaseSignals,
        quizGroupCount: Array.isArray(release.quizGroups) ? release.quizGroups.length : 0,
        questionCount: Array.isArray(release.questions) ? release.questions.length : 0,
      },
      sourceAndReleaseTextEqual: source ? sourceAssistant.length === (release.messages ?? []).filter(message => message?.role === "assistant").length &&
        sourceAssistant.every((message, index) => message.text === (release.messages ?? []).filter(entry => entry?.role === "assistant")[index]?.text) : null,
      evidence: candidate ? {
        sourcePayloadSearch: payloadSearchStatus(source, payloadPaths),
        releasePayloadSearch: payloadSearchStatus(release, releasePayloadPaths),
        note: "Key-name search is heuristic; it cannot establish payload absence by itself.",
      } : null,
    };
  });
  const candidates = inventory.filter(item => item.candidate);
  const payloadSearchFixturePaths = structuredWidgetKeys({ visualization: { slider: { min: 0, max: 10 } } });
  const payloadSearchFixture = payloadSearchStatus({ visualization: true }, payloadSearchFixturePaths) === "widget-like-key-paths-found";
  if (!payloadSearchFixture) throw new Error("Synthetic visualization payload was not detected consistently");
  const summary = {
    catalogLessons: inventory.length,
    sourceExportsPresent: inventory.filter(item => item.sourceExport.present).length,
    lessonsWithLocalVisualizationSignals: candidates.length,
    placeholderLessons: candidates.filter(item => item.releaseRecord.signals.unavailablePlaceholders > 0).length,
    lessonsWithSliderOrNumericInputMentions: candidates.filter(item => item.releaseRecord.signals.sliderOrNumericInputMentions > 0).length,
    lessonsWithVisualizationBehaviorMentions: candidates.filter(item => item.releaseRecord.signals.visualizationBehaviorMentions > 0).length,
    lessonsWithFencedSvg: candidates.filter(item => item.releaseRecord.signals.fencedSvgBlocks > 0).length,
    lessonsWithLiteralHtmlControls: candidates.filter(item => item.releaseRecord.signals.literalHtmlControls > 0).length,
    structuredWidgetPayloadsInSourceExports: inventory.filter(item => item.sourceExport.payloadPaths.length > 0).length,
    structuredWidgetPayloadsInReleaseRecords: inventory.filter(item => item.releaseRecord.payloadPaths.length > 0).length,
    positivePayloadSearchFixturePassed: payloadSearchFixture,
    lessonRecordsWhoseAssistantTextMatchesSource: inventory.filter(item => item.sourceAndReleaseTextEqual === true).length,
    limitations: [
      "This static inventory finds visualization hints retained in local text. It cannot identify a widget that left no text, marker, or payload in any local source.",
      "Original ChatGPT runtime behavior was directly observed for the center-of-mass slider and the triangle drag/keyboard widget; other candidates still require source-page inspection.",
      "A phrase match is a candidate, not proof that the original message contained an interactive visualization.",
      "Widget payload paths are found by key-name heuristics; zero matches do not prove that every possible payload format is absent.",
    ],
  };
  const recordedBrowserObservations = {
    evidenceType: "recorded-browser-observation",
    observedAt: null,
    verifiedByCurrentRun: false,
    testedUrls: {
      originalChat: "https://chatgpt.com/g/g-p-6af8d5d808348191bc23555287ada356/c/6af8b6e9-9c9c-83ec-a21d-ddc263f50348",
      onlineReader: "https://finalhope487.github.io/lesson-desk/",
    },
    assetVersion: null,
    observations: [
      { lessonId: "6af8b6e9-9c9c-83ec-a21d-ddc263f50348", originalChat: { roleSliderCount: 1, min: 1, max: 10, step: 1, before: 6, afterArrowRight: 7, outputBefore: "6.00 m", outputAfter: "6.22 m" }, onlineReader: { rangeInputCount: 0, numberInputCount: 0, roleSliderCount: 0, inlineSvgCount: 0, placeholderCount: 1, consoleErrors: 0 } },
      { lessonId: "6af8b3dc-5ad4-83ee-9a6c-e98105cb5cd8", onlineReader: { rangeInputCount: 0, numberInputCount: 0, inlineSvgCount: 0, consoleErrors: 0 } },
    ],
  };
  const output = { schemaVersion: 1, edition: "pages", inventorySource: "local source exports and release records", liveBrowserAuditPerformedByThisCommand: false, summary, recordedBrowserObservations, inventory };
  const reportsDir = path.join(__dirname, "reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const pagesPath = path.join(reportsDir, "course-visualization-audit-pages.json");
  fs.writeFileSync(pagesPath, JSON.stringify(output, null, 2) + "\n");
  const onlinePath = path.join(reportsDir, "course-visualization-audit-online.json");
  fs.writeFileSync(onlinePath, JSON.stringify({ ...output, edition: "online", liveBrowserAuditPerformedByThisCommand: false, onlineAuditNote: "This file contains a local source/release inventory plus separately labeled recorded browser observations; it is not a live scan of the published site." }, null, 2) + "\n");
  console.log(JSON.stringify({ reports: [pagesPath, onlinePath], summary, candidateIds: candidates.map(item => item.lessonId) }));
}

async function auditLesson({ id, raw, checkMedia, source, verified = {} }) {
  const checks = {};
  const issues = [];
  const count = (type, n = 1) => { checks[type] = (checks[type] ?? 0) + n; };
  const issue = (type, location) => issues.push({ id, type, location });
  const body = document.getElementById("body");
  const doc = normalize(raw, "");
  if (activeId !== id || body.hidden) {
    issue("lesson-load", {});
    return { checks, issues };
  }
  count("lessons");

  // Compare against source records before the reader filters invalid questions.
  const groupForms = [...body.querySelectorAll(".quiz-group")];
  const sourceBlocks = doc.messages.filter(message => message.role === "assistant")
    .flatMap(message => markdownBlocks(message.text));
  if (checkMedia) {
    const charts = sourceBlocks.filter(block => block.kind === "chart");
    const figures = [...body.querySelectorAll("figure.chart")];
    count("chartsExpected", charts.length);
    if (figures.length !== charts.length) issue("chart-count", { expected: charts.length, rendered: figures.length });
    for (const [i, block] of charts.entries()) {
      const figure = figures[i];
      const canvas = figure?.querySelector(':scope > svg[role="img"]');
      const details = figure?.querySelector("details.chart-data");
      details?.querySelector("summary")?.click();
      let expectedRows;
      try { expectedRows = chartSpec(block.text).data.filter(row => row && typeof row === "object").length; }
      catch (error) { issue("chart-source-invalid", { occurrence: i + 1, name: error.name }); }
      if (canvas?.getBoundingClientRect().width > 0 && canvas.querySelector(".chart-marks > *") && details?.open &&
        details.querySelectorAll("tbody tr").length === expectedRows) count("chartsRendered");
      else issue("chart-render", { occurrence: i + 1 });
    }

    const raster = sourceBlocks.filter(block => block.language === "lesson-image").length;
    const svg = sourceBlocks.filter(block => block.language === "svg" && /^\s*<svg[\s>]/i.test(block.text)).length;
    const images = [...body.querySelectorAll("img")];
    count("rasterExpected", raster);
    count("svgExpected", svg);
    let packaged = 0, drawings = 0;
    for (const [i, img] of images.entries()) {
      const kind = img.src.startsWith("blob:") ? "svg" : new URL(img.src).pathname.includes("/course-media/") ? "raster" : "markdownImage";
      if (kind === "raster") packaged++;
      if (kind === "svg") drawings++;
      img.scrollIntoView({ block: "center" });
      try {
        await img.decode();
        if (!img.naturalWidth || img.getBoundingClientRect().width === 0) throw new Error("Invisible image");
        count(`${kind}Rendered`);
      } catch (error) { issue("image-render", { occurrence: i + 1, kind, name: error.name }); }
    }
    const interactiveSvg = body.querySelectorAll("figure.interactive-triangle > svg").length;
    count("svgRendered", interactiveSvg);
    if (packaged !== raster || drawings + interactiveSvg !== svg) {
      issue("packaged-image-count", { raster, svg, packaged, staticSvg: drawings, interactiveSvg });
    }

    if (id === "6af955d0-1168-83ec-b520-a752fce3ba9b") {
      const widget = body.querySelector("figure.interactive-triangle > svg");
      const controls = widget?.querySelectorAll('[role="button"][tabindex="0"]') ?? [];
      if (interactiveSvg !== 1 || controls.length !== 2 || drawings !== 4) {
        issue("triangle-widget-render", { interactiveSvg, controls: controls.length, staticSvg: drawings });
      }
    }

    const imageGroups = sourceBlocks.reduce((n, block) => n + (block.text.match(/\uE200image_group\uE202/g) ?? []).length, 0);
    count("unresolvedImageGroups", imageGroups);
    if (imageGroups) issue("source-image-group-without-assets", { count: imageGroups });
    count("visibleImageGroupMarkers", (body.innerText.match(/\uE200image_group\uE202/g) ?? []).length);
  }
  const groups = (raw.quizGroups ?? []).map((group, index) => {
    const anchors = sourceBlocks.flatMap((block, i) =>
      block.kind !== "code" && block.kind !== "rule" && block.text.trim() === group.start.trim() ? [i] : []);
    if (anchors.length !== 1) issue("group-source-anchor", { group: index + 1, matches: anchors.length });
    return { group, index, position: anchors[0] ?? Infinity };
  }).sort((a, b) => a.position - b.position);
  const claimed = new Set();
  for (const [position, { group, index }] of groups.entries()) {
    const location = { group: index + 1 };
    const recovered = /^\[已補回的原始題卡 \d+\]$/.test(group.start);
    const titles = group.questions.map((q, i) => q.title?.trim() || `第 ${i + 1} 題`);
    // Different groups can share all their titles. Match in document order as well.
    const candidate = groupForms[position];
    const form = candidate && [...candidate.querySelectorAll(".quiz-item > h3")].map(node => node.textContent).join("\0") ===
      titles.map(title => inline(document.createElement("span"), title).textContent).join("\0") && candidate;
    if (form) {
      claimed.add(form);
      if (recovered) count("recoveredGroups");
    }
    else issue("group-render", location);
    const items = form?.querySelectorAll(".quiz-item");
    const expected = normalizeQuizGroups([group])[0]?.questions ?? [];
    const states = [];
    if (form?.querySelector('[type="submit"]')) form.requestSubmit();
    group.questions.forEach((rawQuestion, i) => {
      const at = { ...location, question: i + 1 };
      count("groupQuestions");
      if (recovered) count("recoveredQuestions");
      const question = expected[i];
      const item = items?.[i];
      const type = rawQuestion.type;
      const answer = type === "essay" || type === "reveal" ? Boolean(question?.reference)
        : type === "fill" ? question?.answers.every(values => values.length > 0)
          : question?.answers.length && (question.multiple || question.answers.length === 1);
      if (!answer) issue("missing-or-invalid-answer", at);
      if (!item || !question) {
        issue("question-render", at);
        return;
      }
      const controls = [...item.querySelectorAll("input, textarea")];
      if (checkMedia && (!item.querySelector(".quiz-prompt")?.innerText.trim() ||
          (type === "choice" && controls.some(input => !input.closest("label")?.innerText.trim())))) issue("question-text-render", at);
      if (question.hint) {
        const hint = item.querySelector("details.quiz-hint");
        const summary = hint?.querySelector("summary");
        const initiallyClosed = hint && !hint.open;
        summary?.click();
        if (initiallyClosed && hint.open && hint.querySelector(".quiz-prompt")?.innerText.trim()) {
          summary.click();
          if (!hint.open) count("groupHints");
          else issue("hint-disclosure", at);
        } else issue("hint-disclosure", at);
      }
      if (type === "reveal") {
        const disclosure = item.querySelector("details.quiz-feedback");
        const summary = disclosure?.querySelector("summary");
        const initiallyClosed = disclosure && !disclosure.open;
        summary?.click();
        if (initiallyClosed && disclosure.open && disclosure.querySelector(".quiz-prompt")?.innerText.trim() && !controls.length) {
          summary.click();
          if (!disclosure.open) count("revealAnswers");
          else issue("reveal-answer", at);
        } else issue("reveal-answer", at);
        return;
      }
      const wanted = type === "choice" ? question.options.length
        : type === "fill" ? question.answers.length : Math.max(1, question.parts.filter(part => part.area).length);
      const controlKind = type === "choice" ? (question.multiple ? "checkbox" : "radio") : type === "fill" ? "text" : "textarea";
      if (!wanted || controls.length !== wanted || controls.some(input => input.disabled || !input.getClientRects().length || input.type !== controlKind)) {
        issue("answer-controls", at);
        return;
      }
      if (type === "essay" && wanted > 1 && new Set(controls.map(input => input.getAttribute("aria-label"))).size !== wanted) {
        issue("ambiguous-essay-control-label", at);
      }
      if (recovered) count("recoveredControls", controls.length);
      if (type !== "essay" &&
          !item.querySelector(".quiz-slot")?.textContent.includes("尚未作答")) issue("empty-submit", at);
      controls.forEach((input, inputIndex) => {
        if (type === "choice") {
          if (answer ? question.answers.includes(input.value) : inputIndex === 0) input.click();
        } else input.value = type === "fill" && answer ? question.answers[inputIndex][0] : "audit";
      });
      states.push({ at, item, type, answer, controls, question });
    });
    if (states.length) form.requestSubmit();
    if (form && group.scoreFillPerBlank) {
      const points = states.reduce((sum, { type, controls }) => sum + (type === "fill" ? controls.length : Number(type === "choice")), 0);
      if (form.querySelector(".quiz-score")?.textContent === `本組得分：${points} / ${points}`) count("scoredPoints", points);
      else issue("group-point-total", { ...location, expected: points });
    }
    for (const { at, item, type, answer, controls, question } of states) {
      const slot = item.querySelector(".quiz-slot");
      const disclosure = slot.querySelector("details");
      if (disclosure) disclosure.querySelector("summary").click();
      const accepted = type === "essay" ? disclosure?.open &&
        (answer ? !slot.textContent.includes("尚未填入參考答案") : slot.textContent.includes("尚未填入參考答案"))
        : answer ? Boolean(slot.querySelector(".correct")) : slot.textContent.includes("尚未設定正解");
      if (accepted) {
        count("groupSubmissions");
        if (recovered) count("recoveredSubmissions");
      }
      else issue("submit-feedback", at);
      if (answer && type === "fill") controls[0].value = "__incorrect_audit_value__";
      if (answer && type === "choice") {
        const other = controls.find(input => !question.answers.includes(input.value));
        if (other) other.click();
        else if (question.multiple) controls[0].click();
      }
    }
    if (states.length) form.requestSubmit();
    for (const { at, item, type, answer, controls, question } of states) {
      if (!answer || type === "essay" || type === "choice" && !controls.some(input => input.checked)) continue;
      if (type === "choice" && controls.length === 1 && !question.multiple) continue;
      if (!item.querySelector(".quiz-slot .incorrect")) issue("incorrect-submit-feedback", at);
    }
  }
  if (claimed.size !== groupForms.length) issue("extra-or-duplicate-group", { count: groupForms.length - claimed.size });
  if (/\[已補回的章末題組 [\da-f-]{36} \d+\]/i.test(body.innerText)) issue("visible-chapter-recovery-marker");

  const legacyForms = [...body.querySelectorAll("form.quiz")];
  let normalizedIndex = 0;
  for (const [index, record] of (raw.questions ?? []).entries()) {
    const at = { legacyQuestion: index + 1 };
    count("legacyQuestions");
    const question = normalizeQuestion(record);
    if (!question) {
      issue("question-render", at);
      continue;
    }
    const form = body.querySelector(`#exercise-quiz-${++normalizedIndex}`) ??
      legacyForms.find(candidate => candidate.querySelector("legend")?.textContent ===
        inline(document.createElement("span"), question.prompt).textContent);
    if (!question.answers.length) issue("missing-or-invalid-answer", at);
    if (!form) {
      issue("question-render", at);
      continue;
    }
    if (checkMedia && !form.querySelector("legend")?.innerText.trim()) issue("question-text-render", at);
    const controls = [...form.querySelectorAll("input")];
    const fill = question.type === "fill-in";
    if (controls.length !== (fill ? 1 : question.options.length) ||
        controls.some(input => input.disabled || !input.getClientRects().length)) {
      issue("answer-controls", at);
      continue;
    }
    form.requestSubmit();
    if (!form.querySelector(".quiz-status.incorrect")) issue("empty-submit", at);
    if (fill) controls[0].value = question.answers[0] ?? "audit";
    else controls.forEach((input, i) => {
      if (question.answers.length ? question.answers.includes(input.value) : i === 0) input.click();
    });
    form.requestSubmit();
    if (question.answers.length ? !form.querySelector(".quiz-status.correct")
      : !form.querySelector(".quiz-status")?.textContent.includes("沒有可用正解")) issue("submit-feedback", at);
    else count("legacySubmissions");
  }
  if (legacyForms.length !== doc.questions.length) issue("legacy-form-count", { count: legacyForms.length });

  const selector = ".widget-lost:not([data-missing-questions])";
  const lostWidgets = [...body.querySelectorAll(selector)];
  if (localAudit()) {
    for (const node of body.querySelectorAll("[data-anchor]")) {
      if (node.matches("p") && /^\s*\[(?:確認答案|檢查答案|提交|送出|批改)[^\]]*\]\s*$/.test(node.textContent)) lostWidgets.push(node);
    }
  }
  for (const [index, node] of lostWidgets.entries()) {
    const sibling = node.previousElementSibling;
    issue("source-widget-lost", { occurrence: index + 1,
      anchor: node.dataset.anchor || sibling?.dataset.anchor || sibling?.querySelector("[data-anchor]")?.dataset.anchor,
      kind: node.textContent.includes("選項") ? "choice-options" : "widget" });
  }
  function localAudit() { return !Object.hasOwn(doc, "quizGroups"); }

  const chapters = [];
  if (source) {
    const chapterHeading = /(?:章末|本章).*(?:習題|試題|練習|測驗|題組)|(?:綜合|總複習)(?:習題|試題|練習|測驗|題組)/;
    const numberedQuestion = /^\s*(?:\*\*|__)?\s*(?:第\s*)?([0-9０-９]{1,2}|[一二三四五六七八九十]+)\s*(?:題|[、)｜:：]|[.．](?![0-9０-９]))/u;
    const chapterSections = record => record.messages.filter(message => message.role === "assistant").flatMap(message => {
      const blocks = markdownBlocks(messageText(message));
      const seen = new Map();
      return blocks.flatMap((heading, index) => {
        if (heading.kind !== "heading" || !chapterHeading.test(heading.text)) return [];
        const ordinal = (seen.get(heading.text) ?? 0) + 1;
        seen.set(heading.text, ordinal);
        const next = blocks.findIndex((block, position) => position > index && block.kind === "heading" && block.level <= heading.level);
        return [{ message: message.id, heading, ordinal, blocks: blocks.slice(index + 1, next < 0 ? blocks.length : next) }];
      });
    });
    const cues = blocks => {
      const counters = blocks.flatMap(block => [...block.text.matchAll(/作答進度[^\n]*[/／]\s*(\d+)\s*題/g)].map(match => Number(match[1])));
      const numbers = new Set(blocks.flatMap(block => {
        if (block.kind !== "heading" && block.kind !== "paragraph") return [];
        const number = numberedQuestion.exec(block.text)?.[1];
        return number ? [number.normalize("NFKC")] : [];
      }));
      return { progress: Math.max(0, ...counters), numbered: numbers.size };
    };
    const release = chapterSections(raw);
    for (const original of chapterSections(source)) {
      const { message, heading, ordinal } = original;
      const current = release.find(section => section.message === message && section.heading.text === heading.text && section.ordinal === ordinal);
      const key = `${message}:${fingerprint(heading.text)}:${ordinal}`;
      const anchor = body.querySelector(`[data-anchor="${CSS.escape(key)}"]`);
      const row = anchor?.closest(".reading-block");
      const sourceCues = cues(original.blocks);
      const expected = Math.max(verified[heading.text.trim()] ?? 0, sourceCues.progress, sourceCues.numbered);
      const blocks = current?.blocks ?? [];
      const starts = new Set(blocks.filter(block => block.kind !== "code" && block.kind !== "rule").map(block => block.text.trim()));
      const slots = new Set(blocks.filter(block => block.kind === "code" && block.language === "lesson-quiz" &&
        /^\d+$/.test(block.text) && Number(block.text) < doc.questions.length).map(block => Number(block.text)));
      const structured = (raw.quizGroups ?? []).filter(group => starts.has(group.start.trim()))
        .reduce((total, group) => total + group.questions.length, slots.size);
      let rendered = 0;
      let staticNumbered = 0;
      for (let node = row?.nextElementSibling; node; node = node.nextElementSibling) {
        const headingNode = node.classList.contains("reading-block") && node.querySelector(".block-content > :is(h1,h2,h3,h4,h5,h6)");
        if (headingNode && Number(headingNode.tagName.slice(1)) <= heading.level) break;
        if (node.matches("form.quiz") && node.getClientRects().length) rendered++;
        rendered += [...node.querySelectorAll(".quiz-item")].filter(item => item.getClientRects().length).length;
        if (node.matches(".reading-block")) {
          const content = node.querySelector(".block-content");
          if (content && node.getClientRects().length) {
            staticNumbered += Number(numberedQuestion.test(headingNode?.textContent ?? content.textContent));
          }
        }
      }
      const at = { message, line: heading.startLine + 1, anchor: anchor?.id || key, expected,
        sourceNumbered: sourceCues.numbered, progress: sourceCues.progress, structured, rendered, staticNumbered,
        verified: verified[heading.text.trim()] ?? 0 };
      chapters.push(at);
      if (!row || !row.getClientRects().length) issue("chapter-heading-render", at);
      if (structured > rendered) issue("chapter-question-render", at);
      if (expected > rendered + staticNumbered) issue("chapter-question-shortfall", at);
      if (!expected && !rendered && !staticNumbered) issue("chapter-empty-candidate", at);
    }
  }

  // Some exports retain only a progress counter. Those gaps must be reported
  // even if the reader suppresses the inactive widget UI.
  for (const [messageIndex, message] of doc.messages.entries()) {
    if (message.role !== "assistant") continue;
    const blocks = markdownBlocks(message.text);
    const seen = new Map();
    for (const [index, block] of blocks.entries()) {
      const hash = fingerprint(block.text);
      const occurrence = (seen.get(hash) ?? 0) + 1;
      seen.set(hash, occurrence);
      if (block.kind === "code" && block.language === "lesson-quiz") {
        const key = `${message.id ?? message.role}:${hash}:${occurrence}`;
        if (body.querySelector(`pre[data-anchor="${CSS.escape(key)}"]`)) {
          issue("inactive-quiz-slot", { message: messageIndex + 1, block: index + 1, anchor: key });
        }
      }
      const expected = /作答進度[^\n]*[/／]\s*(\d+)\s*題/.exec(block.text);
      if (!expected) continue;
      const earlier = blocks.slice(0, index).findLastIndex(item => item.kind === "heading");
      if (earlier < 0 || !/(?:章末|本章).*(?:習題|練習|測驗|題組)/.test(blocks[earlier].text)) continue;
      const next = blocks.findIndex((item, i) => i > index && item.kind === "heading" && item.level <= blocks[earlier].level);
      const section = blocks.slice(earlier, next === -1 ? blocks.length : next);
      const starts = new Set(section.map(item => item.text.trim()));
      const available = (raw.quizGroups ?? []).filter(group => starts.has(group.start.trim()))
        .reduce((total, group) => total + group.questions.length, 0) +
        section.filter(item => item.kind === "code" && item.language === "lesson-quiz").length;
      const missing = Number(expected[1]) - available;
      if (missing <= 0) continue;
      const at = { message: messageIndex + 1, block: index + 1, missing };
      issue("chapter-source-questions-missing", at);
      if (!body.querySelector(`.widget-lost[data-missing-questions="${missing}"]`)) issue("chapter-gap-hidden", at);
    }
  }

  const leadIns = Object.entries(raw.leadIns ?? {});
  const leadQuestions = leadIns.filter(([, entry]) => entry.question).length;
  const leadAnswers = leadIns.filter(([, entry]) => entry.answer).length;
  count("leadInQuestions", leadQuestions);
  count("leadInAnswers", leadAnswers);
  // Authoring deliberately stores question and answer under different anchors.
  if (leadQuestions !== leadAnswers) issue("lead-in-count-mismatch", { questions: leadQuestions, answers: leadAnswers });
  for (const [anchor, lead] of leadIns) {
    const row = body.querySelector(`[data-anchor="${CSS.escape(anchor)}"]`)?.closest(".reading-block");
    if (lead.question && !row?.querySelector(".lead-in")) issue("lead-in-render", { anchor });
    if (lead.answer) {
      const disclosure = row?.querySelector("details.lead-in-answer");
      disclosure?.querySelector("summary")?.click();
      if (!disclosure?.open) issue("lead-in-answer-render", { anchor });
    }
  }
  count("tables", body.querySelectorAll("table").length);
  for (const node of body.querySelectorAll("p, li, blockquote, legend, .option > div")) {
    if (node.querySelector("table") || ![...node.childNodes].some(child => child.nodeType === Node.TEXT_NODE &&
      /^\s*\|?\s*:?-{3,}:?\s*\|(?:\s*:?-{3,}:?\s*\|?)+\s*$/m.test(child.textContent))) continue;
    issue("unrendered-table", { anchor: node.closest("[data-anchor]")?.dataset.anchor,
      question: node.closest(".quiz-item")?.querySelector("h3")?.id });
  }
  count("formulas", body.querySelectorAll("math").length);
  for (const [index, formula] of [...body.querySelectorAll(".math-fallback")].entries()) {
    issue("formula-fallback", { occurrence: index + 1, anchor: formula.closest("[data-anchor]")?.dataset.anchor });
  }
  for (const [index, link] of [...document.querySelectorAll("#exercise-links a")].entries()) {
    const target = document.getElementById(link.hash.slice(1));
    if (!target || checkMedia && (!target.textContent.trim() || !target.getClientRects().length)) issue("exercise-navigation", { link: index + 1 });
    else if (checkMedia && !target.closest(".quiz-item, form.quiz")) count("staticExerciseLinks");
  }
  if (id === "6afd5445-1e00-83e8-8dfa-b2637590b63b") {
    const children = [...body.children];
    const heading = children.findIndex(node => node.querySelector("h2,h3")?.textContent.includes("本章綜合習題"));
    const chapter = heading < 0 ? [] : children.slice(heading + 1);
    const forms = chapter.flatMap(node => node.matches(".quiz") ? [node] : [...node.querySelectorAll(".quiz-item")]);
    count("chemistryChapterRecovered", forms.length);
    if (forms.length !== 5 || forms.some(form => form.querySelectorAll('input[type="radio"]').length !== 4)) {
      issue("chemistry-chapter-question-count", { want: 5, got: forms.length });
    }
  }
  if (id === "6af9578f-3cd4-83e8-adcf-08000d30a960") {
    for (const index of [2, 3, 4]) {
      if (!body.querySelector(`#exercise-quiz-${index} fieldset math`)) {
        issue("vector-question-math-missing", { legacyQuestion: index });
      }
    }
  }
  return { checks, issues, chapters };
}

function markdownFixtures() {
  const raw = {
    id: "audit-fixtures",
    markdown: "# Audit\n\nText directly before\nName | Value\n--- | ---:\nExample | 42\n\n> | Name | Value |\n> | --- | --- |\n> | A | B |\n\n- Item\n\n  | Name | Value |\n  | --- | --- |\n  | A | B |\n\n*italic* _also_ ~~removed~~ **bold**\n\n- First\n  - Nested\n\nHeading\n=======\n\n```txt\n| Not | a table |\n| --- | --- |\n```\n\n## 本章綜合習題\n\n**作答進度** / 5 題",
    questions: [{
      type: "single-choice",
      prompt: "Name | Value\n--- | ---\nA | B",
      options: [{ value: "a", label: "A" }], answers: ["a"],
      feedback: "Name | Value\n--- | ---\nA | B"
    }]
  };
  const fixture = normalize(raw, "Audit");
  const noteAnchor = `document:${fingerprint("Text directly before\nName | Value\n--- | ---:\nExample | 42")}:1`;
  fixture.annotations.set(noteAnchor, { note: "A | B\n--- | ---\n1 | 2", side: "right" });
  raw.markdown += "\n\n[Reference][r]\n\nA separate paragraph.\n\n[r]: ./sample.js\n\n- [x] Task\n\n| Formula | Cell |\n| --- | ---: |\n| $|x|$ | `a|b` |\n\n[Unsafe](javascript:alert(1))";
  raw.markdown += "\n\n\\(1) Text with \\(x\\) as a variable. An escaped label \\[Ar\\] stays bracketed.";
  fixture.messages[0].text = raw.markdown;
  addLesson(fixture);
  select(fixture.id);
  const body = document.getElementById("body");
  body.querySelector("form.quiz input").click();
  body.querySelector("form.quiz").requestSubmit();
  const expectations = {
    "table-without-outer-pipes": [...body.querySelectorAll("table")].some(table => table.rows[1]?.cells[1]?.textContent === "42"),
    "table-in-quote": Boolean(body.querySelector("blockquote table")),
    "table-in-list": Boolean(body.querySelector("li table")),
    "table-in-question": Boolean(body.querySelector(".quiz fieldset table")),
    "table-in-feedback": Boolean(body.querySelector(".quiz-status table")),
    "table-in-annotation": Boolean(body.querySelector(".annotation-copy table")),
    "table-in-code-stays-literal": body.querySelector("pre")?.textContent.includes("| --- | --- |"),
    emphasis: body.querySelectorAll("em").length === 2,
    strikethrough: Boolean(body.querySelector("del, s")),
    "nested-list": Boolean(body.querySelector("li ul")),
    "setext-heading": [...body.querySelectorAll("h1,h2")].some(node => node.textContent === "Heading"),
    "reference-link": [...body.querySelectorAll("a")].some(node => node.textContent === "Reference" && node.getAttribute("href") === "./sample.js"),
    "unsafe-link-disabled": [...body.querySelectorAll("a")].some(node => node.textContent === "Unsafe" && !node.hasAttribute("href")),
    "checked-task-list": Boolean(body.querySelector("li input[type=checkbox]:checked:disabled")),
    "escaped-number-before-latex": [...body.querySelectorAll("p")].some(node =>
      node.textContent.startsWith("(1) Text with") && node.querySelector("math") && !node.querySelector(".math-fallback")),
    "escaped-bracket-label": body.textContent.includes("An escaped label [Ar] stays bracketed."),
    "table-math-code-and-alignment": [...body.querySelectorAll("table")].some(table => {
      const row = table.rows[1];
      return row?.cells.length === 2 && row.cells[0].querySelector("math") &&
        row.cells[1].querySelector("code")?.textContent === "a|b" && row.cells[1].style.textAlign === "right";
    }),
    "chapter-missing-widget-notice": Boolean(body.querySelector('.widget-lost[data-missing-questions="5"]'))
  };
  const revealFixture = normalize({ id: "audit-reveal", markdown: "## Audit\n\n[reveal slot]",
    quizGroups: [{ start: "[reveal slot]", count: 1, questions: [{ type: "reveal", title: "Reveal question",
      prompt: "Compute $2+2$.", hint: "Start with **2**.", reference: "The result is **4**." }] }] }, "Audit");
  addLesson(revealFixture);
  select(revealFixture.id);
  const hint = body.querySelector(".quiz-item details.quiz-hint");
  const hintWasHidden = hint && !hint.open;
  hint?.querySelector("summary").click();
  const answer = body.querySelector(".quiz-item details.quiz-feedback");
  const answerWasHidden = answer && !answer.open;
  answer?.querySelector("summary").click();
  expectations["quiz-reveal-hint"] = Boolean(hintWasHidden && hint.open && hint.querySelector("strong")?.textContent === "2" && answerWasHidden);
  expectations["quiz-reveal-answer"] = Boolean(answerWasHidden && answer.open && answer.querySelector("strong") &&
    body.querySelector(".quiz-prompt math") && !body.querySelector(".quiz-group button[type=submit]"));
  const fillQuestion = { type: "fill", title: "Fill question", parts: [{ text: "Enter 2." }, { blank: {} }], answers: [["2"]] };
  const timedFill = { ...fillQuestion, parts: [...fillQuestion.parts, { blank: {} }], answers: [["2"], ["8"]], tolerance: 0.01 };
  const fillFixture = normalize({ id: "audit-fill", markdown: "## Audit\n\n[fill slot]",
    quizGroups: [{ start: "[fill slot]", count: 1, scoreFillPerBlank: true, questions: [timedFill, fillQuestion] }] }, "Audit");
  addLesson(fillFixture);
  select(fillFixture.id);
  const fillForm = body.querySelector(".quiz-group");
  const fillItems = [...(fillForm?.querySelectorAll(".quiz-item") ?? [])];
  if (fillItems.length === 2) {
    fillItems.forEach(item => { item.querySelector("input").value = "2.01"; });
    fillItems[0].querySelectorAll("input")[1].value = "8";
    fillForm.requestSubmit();
    const edge = fillItems[0].querySelector(".quiz-slot .correct") && fillItems[1].querySelector(".quiz-slot .incorrect");
    const withAllBlanks = fillForm.querySelector(".quiz-score")?.textContent.endsWith("2 / 3");
    fillItems[0].querySelector("input").value = "2.011";
    fillForm.requestSubmit();
    expectations["quiz-fill-tolerance"] = Boolean(edge && fillItems[0].querySelector(".quiz-slot .incorrect"));
    fillItems[0].querySelector("input").value = "";
    fillForm.requestSubmit();
    expectations["quiz-fill-partial-score"] = Boolean(withAllBlanks && fillForm.querySelector(".quiz-score")?.textContent.endsWith("1 / 3"));
  } else expectations["quiz-fill-tolerance"] = expectations["quiz-fill-partial-score"] = false;
  const crossMessage = normalize({
    id: "audit-slot",
    messages: [
      { role: "assistant", id: "title", text: "## Same title" },
      { role: "assistant", id: "slot", text: "```lesson-quiz\n0\n```" }
    ],
    questions: [{ title: "Same title", prompt: "Prompt", type: "fill-in", answers: ["1"] }]
  }, "Audit");
  addLesson(crossMessage);
  select(crossMessage.id);
  expectations["explicit-quiz-slot-across-messages"] = Boolean(body.querySelector("form#exercise-quiz-1")) && !body.querySelector("pre");

  const duplicate = normalize({
    id: "audit-anchor",
    messages: [{ role: "assistant", id: "repeated", text: "## Same title\n\nPrompt\n\nA. Choice\n\n## Later\n\nPrompt" }],
    questions: [{ title: "Same title", prompt: "Prompt", type: "single-choice", options: ["A. Choice"], answers: ["A"] }]
  }, "Audit");
  const laterAnchor = `repeated:${fingerprint("Prompt")}:2`;
  duplicate.annotations.set(laterAnchor, { note: "Kept note", side: "right" });
  addLesson(duplicate);
  select(duplicate.id);
  expectations["anchor-after-quiz-replacement"] = [...body.querySelectorAll(".annotation-copy")].some(node => node.textContent.includes("Kept note"));
  return Object.entries(expectations).filter(([, passed]) => !passed).map(([type]) => ({ id: raw.id, type }));
}

async function main() {
  if (visualizationAudit) {
    if ([local, online, fixturesOnly, sample, batch !== null, lessonOptions.length > 0, allMedia, chapterAudit].some(Boolean)) {
      throw new Error("--visualization-audit runs by itself");
    }
    runVisualizationAudit();
    return;
  }
  if (local && online || [fixturesOnly, sample, batch !== null, lessonOptions.length > 0, allMedia].filter(Boolean).length > 1) {
    throw new Error("Conflicting browser audit options");
  }
  if (new Set(lessonOptions).size !== lessonOptions.length) throw new Error("Duplicate lesson IDs");
  if (batch !== null && (!Number.isSafeInteger(batch) || batch < 1 || String(batch) !== batchArgument.slice(8))) {
    throw new Error("Expected a positive sample batch number");
  }
  if (local) {
    const offlineHtml = fs.readFileSync(localPage, "utf8");
    if (normalizedLines(offlineHtml) !== normalizedLines(releaseHtml)) {
      throw new Error("Offline HTML is out of sync; run node build-course-library.js --sync-local");
    }
  }
  ({ chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright"));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const comparisons = new Map();
    if (online) page.on("response", response => {
      if (!response.url().startsWith(onlinePage)) return;
      const name = new URL(response.url()).pathname.slice(new URL(onlinePage).pathname.length);
      const lesson = /^course-content\/[\da-f-]{36}\.js$/i.test(name);
      const media = /^course-media\/[\da-f-]{36}\/\d+\.(?:jpg|png|webp|gif)$/i.test(name);
      if (!comparisons.has(name) && (readerFile.test(name) || lesson || media)) {
        comparisons.set(name, compareOnlineAsset(response, name, media).then(() => null, error => error));
      }
    });
    let active;
    page.on("pageerror", error => report.issues.push({ id: active, type: "page-error", location: { name: error.name } }));
    await page.route(/^https?:/, route => online && route.request().url().startsWith(onlinePage) ? route.continue() : route.abort());
    const response = await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    if (online && (response?.status() !== 200 ||
      normalizedLines(await response.text()) !== normalizedLines(releaseHtml))) {
      throw new Error("Online release HTML does not match the local release");
    }
    report.issues.push(...await page.evaluate(markdownFixtures));
    if (!fixturesOnly) {
      const catalog = await page.evaluate(() => JSON.parse(document.getElementById("course-catalog").textContent).conversations);
      const ids = catalog.map(item => item.conversationId);
      if (!ids.length || new Set(ids).size !== ids.length) throw new Error("Empty or duplicate catalog");
      report.checks.catalog = ids.length;
      report.version = contentVersion(catalog);
      if (lessonOptions.some(id => !ids.includes(id))) throw new Error("Lesson ID not found in catalog");
      const rotation = batch !== null;
      const checkMedia = sample || rotation || allMedia || lessonOptions.length > 0;
      const catalogById = new Map(catalog.map(item => [item.conversationId, item]));
      if (chapterAudit) report.chapters = [];
      const selected = rotation ? batchSample(catalog, batch) : sample ? sampleIds : lessonOptions.length ? lessonOptions : ids;
      if (sample || rotation) report.samples = [];
      if (rotation) report.batch = { number: batch, seed: sampleSeed, ids: selected };
      for (const id of selected) {
        active = id;
        try {
          const raw = readLesson(id);
          const source = chapterAudit ? readSourceExport(catalogById.get(id)) : null;
          if (chapterAudit && !source) report.issues.push({ id, type: "chapter-source-export-missing" });
          await page.evaluate(async id => openLesson(library.get(id)), id);
          if (id === "6af955d0-1168-83ec-b520-a752fce3ba9b") {
            const widget = page.locator("figure.interactive-triangle > svg");
            const handle = widget.locator('[role="button"][aria-label*="頂點 B"]');
            try {
              if (await widget.count() !== 1 || await handle.count() !== 1) throw new Error("Interactive triangle was not rendered");
              const beforeKeyboard = Number(await handle.getAttribute("cx"));
              await handle.focus();
              await page.keyboard.press("ArrowRight");
              const afterKeyboard = Number(await handle.getAttribute("cx"));
              if (!(afterKeyboard > beforeKeyboard)) throw new Error("ArrowRight did not move point B");
              const box = await handle.boundingBox();
              if (!box) throw new Error("Point B has no visible hit area");
              await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
              await page.mouse.down();
              await page.mouse.move(box.x + box.width / 2 + 18, box.y + box.height / 2 + 12, { steps: 3 });
              await page.mouse.up();
              const afterPointer = Number(await handle.getAttribute("cx"));
              const description = await widget.getAttribute("aria-label");
              if (!(afterPointer > afterKeyboard) || !description?.includes("鄰邊") || /NaN|Infinity/.test(description)) {
                throw new Error("Pointer movement or geometry labels did not update");
              }
              report.checks.interactiveTriangleKeyboard = (report.checks.interactiveTriangleKeyboard ?? 0) + 1;
              report.checks.interactiveTrianglePointer = (report.checks.interactiveTrianglePointer ?? 0) + 1;
            } catch (error) {
              report.issues.push({ id, type: "interactive-triangle-behavior", location: { name: error.name } });
            }
          }
          const { checks, issues, chapters } = await page.evaluate(auditLesson, { id, raw, checkMedia, source, verified: verifiedChapterCounts[id] });
          if (chapterAudit) report.chapters.push(...(chapters ?? []).map(chapter => ({ id, ...chapter })));
          if (report.samples) {
            const { subject, title } = catalogById.get(id);
            report.samples.push({ id, subject, title, checks });
          }
          report.issues.push(...issues);
          for (const [type, count] of Object.entries(checks)) report.checks[type] = (report.checks[type] ?? 0) + count;
        } catch (error) {
          report.issues.push({ id, type: "audit-error", location: { name: error.name,
            function: error.stack?.match(/at (\w+) \(/)?.[1] } });
        }
      }
      if (!sample && selected.includes(chemistryChapter)) {
        active = chemistryChapter;
        await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
        await page.evaluate(id => openLesson(library.get(id)), chemistryChapter);
        const question = page.locator(".quiz-item").filter({
          has: page.getByRole("heading", { name: "第 1 題｜分壓計算", exact: true })
        });
        try {
          const radio = question.locator('input[type="radio"][value="B"]');
          await radio.focus({ timeout: 2000 });
          await page.keyboard.press("Space");
          const submit = question.locator("xpath=ancestor::form").locator('button[type="submit"]');
          await submit.press("Enter", { timeout: 2000 });
          const status = question.locator(".quiz-slot .correct");
          if (!await radio.isChecked() || !await status.count()) throw new Error("Keyboard submission did not reach correct state");
          report.checks.chemistryKeyboardSubmission = 1;
        } catch (error) {
          report.issues.push({ id: chemistryChapter, type: "chemistry-keyboard-submission", location: { name: error.name } });
        }
      }
    }
    if (online) {
      const error = (await Promise.all(comparisons.values())).find(Boolean);
      if (error) throw error;
      report.verifiedOnlineAssets = comparisons.size;
    }
  } finally {
    await browser.close();
  }
  const selectionSuffix = lessonOptions.length === 1 ? `-${lessonOptions[0].slice(0, 8)}` : lessonOptions.length
    ? `-selected-${createHash("sha256").update(lessonOptions.join("\n")).digest("hex").slice(0, 8)}` : "";
  const suffix = fixturesOnly ? "-fixtures" : sample ? "-sample" : batch !== null ? `-batch-${batch}`
    : selectionSuffix || (allMedia ? "-all-media" : "");
  const filename = path.join("reports", `course-browser-audit-${report.edition}${suffix}${chapterAudit ? "-chapters" : ""}.json`);
  fs.mkdirSync(path.join(__dirname, "reports"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, filename), JSON.stringify(report, null, 2) + "\n");
  const byType = {};
  for (const { type } of report.issues) byType[type] = (byType[type] ?? 0) + 1;
  const subjects = report.samples?.reduce((result, { subject }) => ({ ...result, [subject]: (result[subject] ?? 0) + 1 }), {});
  console.log(JSON.stringify({ filename, version: report.version?.slice(0, 12), subjects, checks: report.checks, issues: byType }));
  if (report.issues.length) process.exitCode = 1;
}

main().catch(error => {
  console.error("Browser audit failed:", error.message);
  process.exitCode = 1;
});
