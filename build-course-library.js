const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = __dirname;
const localDirectory = path.join(root, '.course-local');
const localTemplate = path.join(localDirectory, 'index.template.html');
const output = path.join(localDirectory, 'course-library-export.html');
const releasePage = path.join(root, 'index.html');
const catalogMarker = '<!-- course-catalog -->';
const catalogScript = /<script id="course-catalog" type="application\/json">[\s\S]*?<\/script>/g;
const readerAsset = /((?:href|src)=")(?:github-pages-release\/)?(reader\.css|(?:katex\.min|marked\.umd|lesson-markdown|lesson-visualization|lesson-legacy-widgets|reader)\.js)(\?[^"]*)?"/g;
const exportEntry = /^(?:[\w.-]+\/)*(?:conversations(?:[-_]\d+)?\.json|conversations\/\d+\.json)$/i;
const idPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

function tar(args, maxBuffer) {
  const result = spawnSync('tar.exe', args, { encoding: 'utf8', maxBuffer, windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`無法讀取 ZIP（tar 結束碼 ${result.status}）`);
  return result.stdout;
}

function loadManifest() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'chatgpt-course-export-manifest.json'), 'utf8'));
  const targets = new Map();
  for (const project of manifest.projects) {
    if (project.kind !== 'subject') continue;
    const subject = /^選修物理/.test(project.name) ? '物理'
      : /^選修化學/.test(project.name) ? '化學' : '數學';
    for (const id of project.conversationIds) {
      if (!idPattern.test(id) || targets.has(id.toLowerCase())) throw new Error('對話清單的 ID 無效或重複');
      if (!/^[^<>:"/\\|?*\x00-\x1f]+$/u.test(project.name) || /[. ]$/.test(project.name) || !/^g-p-[a-f0-9]{32}$/i.test(project.projectId)) {
        throw new Error('專案名稱或 ID 無效');
      }
      targets.set(id.toLowerCase(), { project: project.name, projectId: project.projectId, subject });
    }
  }
  return targets;
}

function collect(zip, entries, targets) {
  const matched = new Map();
  for (const entry of entries) {
    const data = JSON.parse(tar(['-xOf', zip, '--', entry], 256 * 1024 * 1024).replace(/^\uFEFF/, ''));
    const records = Array.isArray(data) ? data : data?.conversations;
    if (!Array.isArray(records)) throw new Error('ZIP 內的對話 JSON 格式不符');
    for (const record of records) {
      const id = record?.conversationId ?? record?.conversation_id ?? record?.id;
      if (typeof id !== 'string' || !targets.has(id.toLowerCase())) continue;
      const key = id.toLowerCase();
      const previous = matched.get(key);
      if (!previous || (record.update_time ?? 0) > (previous.update_time ?? 0)) matched.set(key, record);
    }
  }
  return matched;
}

function atomicWrite(file, data) {
  const temp = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temp, data, { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(temp, file);
  } finally {
    if (fs.existsSync(temp)) fs.rmSync(temp);
  }
}

function syncLocal() {
  atomicWrite(path.join(root, 'course-library.html'), fs.readFileSync(releasePage, 'utf8'));
}

function build(zip) {
  const entries = tar(['-tf', zip], 16 * 1024 * 1024).split(/\r?\n/).filter(name => exportEntry.test(name));
  if (!entries.length) return false;
  if (new Set(entries).size !== entries.length) throw new Error('ZIP 包含重複的對話資料檔');
  const targets = loadManifest();
  const matches = collect(zip, entries, targets);
  if (!matches.size) throw new Error('這份 ZIP 沒有符合清單的對話');
  publish(targets, matches);
  return true;
}

function publish(targets, matches = new Map(), page = output) {
  const isRelease = page === releasePage;
  const pageDirectory = path.dirname(page);
  const template = fs.readFileSync(isRelease ? releasePage : localTemplate, 'utf8');
  if (isRelease && [...template.matchAll(catalogScript)].length !== 1) {
    throw new Error('發布頁找不到唯一的課程目錄');
  }
  const source = isRelease ? template.replace(catalogScript, catalogMarker) : template;
  if (source.split(catalogMarker).length !== 2) throw new Error('找不到唯一的課程資料插入點');
  const assetVersions = new Map();
  for (const [, , name, query] of source.matchAll(readerAsset)) {
    const data = fs.readFileSync(path.join(root, name));
    if (!isRelease) atomicWrite(path.join(pageDirectory, name), data);
    const version = /^(?:katex\.min|marked\.umd)\.js$/.test(name)
      ? query ?? ''
      : '?v=' + createHash('sha256').update(data).digest('hex').slice(0, 12);
    assetVersions.set(name, version);
  }
  const directory = path.join(root, 'course-exports');
  const conversations = [];
  const missing = [];
  for (const [id, project] of targets) {
    const folder = path.join(directory, project.subject, `${project.project} [${project.projectId}]`);
    const file = path.join(folder, `${id}.json`);
    const legacy = path.join(directory, `${id}.json`);
    const existing = fs.existsSync(file) ? file : fs.existsSync(legacy) ? legacy : undefined;
    const record = matches.get(id) ?? (existing && JSON.parse(fs.readFileSync(existing, 'utf8')));
    if (!record) {
      missing.push(id);
      continue;
    }
    const recordId = record.conversationId ?? record.conversation_id ?? record.id;
    if (typeof recordId !== 'string' || recordId.toLowerCase() !== id) throw new Error('匯出檔與清單的對話 ID 不一致');
    const conversation = { ...record, ...project, conversationId: id };
    if (matches.has(id) || existing === legacy) {
      fs.mkdirSync(folder, { recursive: true });
      atomicWrite(file, JSON.stringify(conversation));
    }
    conversations.push(conversation);
  }
  const projects = [...new Map([...targets.values()].map(project => [project.projectId, project])).values()];
  const content = path.join(pageDirectory, 'course-content');
  fs.mkdirSync(content, { recursive: true });
  const entries = conversations.map(conversation => {
    const { conversationId, project, projectId, subject } = conversation;
    for (const media of conversation.restoredAssets?.rasterFiles ?? []) {
      if (!/^course-media\/[a-f0-9-]{36}\/\d+\.(?:jpg|png|webp|gif)$/i.test(media)
          || media.split('/')[1] !== conversationId) throw new Error('教材圖片路徑無效');
      const saved = path.join(localDirectory, 'before-migration', media);
      const destination = path.join(pageDirectory, media);
      const original = !isRelease && fs.existsSync(saved) ? saved : path.join(root, media);
      if (!fs.existsSync(original)) throw new Error(`找不到教材圖片：${media}`);
      if (original !== destination) {
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(original, destination);
      }
    }
    const data = JSON.stringify(conversation);
    const version = createHash('sha256').update(data).digest('hex').slice(0, 12);
    // A classic script also works when the library is opened as a file:// page.
    const script = `document.currentScript.lessonRecord = JSON.parse(${JSON.stringify(data)});\n`;
    const file = path.join(content, `${conversationId}.js`);
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== script) atomicWrite(file, script);
    const title = typeof conversation.title === 'string' && conversation.title.trim()
      ? conversation.title : '未命名教材';
    return { conversationId, title, project, projectId, subject, version };
  });
  const safeJson = JSON.stringify({ expected: targets.size, projects, conversations: entries, deferred: true })
    .replace(/</g, '\\u003c');
  atomicWrite(page, source
    .replace(/^\s*<script defer src="sample\.js"><\/script>\r?\n/m, '\n')
    .replace(readerAsset, (_, prefix, name) => prefix + name + assetVersions.get(name) + '"')
    .replace(catalogMarker, () => `<script id="course-catalog" type="application/json">${safeJson}</script>`));
  const report = { expected: targets.size, matched: conversations.length, missing };
  const reportDir = path.join(root, 'reports');
  fs.mkdirSync(reportDir, { recursive: true });
  atomicWrite(path.join(reportDir, 'course-library-report.json'), JSON.stringify(report, null, 2) + '\n');
  syncLocal();
  console.log(`已整理 ${conversations.length}／${targets.size} 篇。缺少 ${missing.length} 篇，詳見 reports/course-library-report.json。`);
}

function watch(folder) {
  const scanned = new Map();
  const stability = new Map();
  let newestBuilt = -Infinity;
  let latestFolderError;
  function scan() {
    let files;
    try {
      files = fs.readdirSync(folder, { withFileTypes: true }).filter(entry => entry.isFile() && /\.zip$/i.test(entry.name));
      latestFolderError = undefined;
    } catch (error) {
      if (latestFolderError !== error.code) console.error(`無法檢查下載資料夾（${error.code ?? error.name}）`);
      latestFolderError = error.code;
      return;
    }
    const candidates = [];
    for (const file of files) {
      const zip = path.join(folder, file.name);
      let info;
      try {
        info = fs.statSync(zip);
      } catch (error) {
        console.error(`無法取得 ZIP 狀態（${error.code ?? error.name}）`);
        continue;
      }
      const signature = `${info.size}:${info.mtimeMs}`;
      if (stability.get(zip) === signature && scanned.get(zip) !== signature && info.mtimeMs >= newestBuilt) {
        candidates.push({ zip, signature, modified: info.mtimeMs });
      }
      stability.set(zip, signature);
    }
    candidates.sort((a, b) => b.modified - a.modified);
    for (const candidate of candidates) {
      scanned.set(candidate.zip, candidate.signature);
      try {
        if (build(candidate.zip)) {
          newestBuilt = candidate.modified;
          break;
        }
      } catch (error) {
        console.error(`略過無法匯入的 ZIP（${error.code ?? error.name}）`);
      }
    }
  }
  console.log('等待下載完成的 ChatGPT ZIP，每 15 秒檢查一次。');
  scan();
  setInterval(scan, 15_000);
}

try {
  const [mode, customFolder] = process.argv.slice(2);
  if (mode === '--watch') watch(path.resolve(customFolder ?? path.join(os.homedir(), 'Downloads')));
  else if (mode === '--local') publish(loadManifest());
  else if (mode === '--sync-local') syncLocal();
  else if (mode === '--pages') publish(loadManifest(), new Map(), releasePage);
  else if (!mode || !build(path.resolve(mode))) throw new Error('請提供 ChatGPT 匯出 ZIP，或使用 --watch');
} catch (error) {
  console.error(error instanceof SyntaxError ? '無法解析匯出資料 JSON' : error.message);
  process.exitCode = 1;
}
