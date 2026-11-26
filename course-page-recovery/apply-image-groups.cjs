const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { atomicWrite, download } = require('../recover-course-images.js');

const release = path.join(__dirname, '..', 'github-pages-release');
const index = path.join(release, 'index.html');
const stage = path.join(__dirname, 'image-groups');
const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
const groupMarker = /\uE200image_group\uE202[^\uE201]*\uE201/g;
const groupStart = '\uE200image_group\uE202';
const safeAlt = alt => alt.replace(/[\r\n\s]+/gu, ' ').trim().slice(0, 240) || '原始講義圖片';

function inventory(record) {
  return record.messages.flatMap(message => {
    if (message.role !== 'assistant') return [];
    const field = typeof message.content === 'string' ? 'content' : 'text';
    const text = message[field] ?? '';
    const count = [...text.matchAll(groupMarker)].length;
    if (text.split(groupStart).length - 1 !== count) throw new Error('incomplete_image_group_marker');
    return count ? [{ message, field, count }] : [];
  });
}

function checkCapture(capture, id, slots) {
  const expected = slots.flatMap(({ message, count }) => Array(count).fill(message.id));
  if (capture.id !== id || !Array.isArray(capture.groups) || capture.groups.length !== expected.length) {
    throw new Error('image_group_count_mismatch');
  }
  for (const [i, group] of capture.groups.entries()) {
    if (group.messageId !== expected[i] || !Array.isArray(group.images) || !group.images.length) {
      throw new Error(`image_group_message_mismatch_${i + 1}`);
    }
    for (const image of group.images) {
      const url = URL.parse(image.url);
      if (url?.origin !== 'https://images.openai.com' || url.username || url.password ||
          !url.pathname.startsWith('/static-rsc-4/') || image.ready !== true || typeof image.alt !== 'string') {
        throw new Error(`unverified_image_${i + 1}`);
      }
    }
  }
}

function replaceMarkers(slots, assets) {
  let group = 0;
  for (const { message, field } of slots) {
    message[field] = message[field].replace(groupMarker, () => {
      const blocks = assets[group++].map(({ src, alt }) =>
        '```lesson-image\n' + JSON.stringify({ src, alt: safeAlt(alt) }) + '\n```');
      return '\n\n' + blocks.join('\n\n') + '\n\n';
    });
  }
}

async function main() {
  const mode = process.argv[2];
  if (mode !== '--check' && mode !== '--write') throw new Error('Use --check or --write');
  const ids = process.argv.slice(3);
  if (!ids.length) ids.push(...fs.readdirSync(stage).filter(name => name.endsWith('.json')).map(name => name.slice(0, -5)));
  if (!ids.length || ids.some(id => !uuid.test(id)) || new Set(ids).size !== ids.length) throw new Error('Invalid capture IDs');
  let catalog = fs.readFileSync(index, 'utf8');
  let groups = 0, images = 0, applied = 0;
  for (const id of ids) {
    try {
      const file = path.join(release, 'course-content', `${id}.js`);
      const serialized = fs.readFileSync(file, 'utf8');
      const payload = /^document\.currentScript\.lessonRecord = JSON\.parse\(("[^]*")\);$/.exec(serialized.trim())?.[1];
      const record = JSON.parse(JSON.parse(payload));
      if (record.conversationId !== id) throw new Error('lesson_id_mismatch');
      const slots = inventory(record);
      if (!slots.length) continue;
      const capture = JSON.parse(fs.readFileSync(path.join(stage, `${id}.json`), 'utf8'));
      checkCapture(capture, id, slots);
      const count = capture.groups.reduce((sum, group) => sum + group.images.length, 0);
      if (mode === '--write') {
        const key = new RegExp(`("conversationId":"${id}"[^}]*?"version":")[0-9a-f]+(")`, 'g');
        if ([...catalog.matchAll(key)].length !== 1) throw new Error('catalog_entry_not_unique');
        const folder = path.join(release, 'course-media', id);
        fs.mkdirSync(folder, { recursive: true });
        const existing = record.restoredAssets?.rasterFiles ?? [];
        let position = existing.reduce((max, entry) => Math.max(max, Number(path.basename(entry).split('.')[0]) || 0), 0);
        const jobs = capture.groups.map(group => group.images.map(image => ({ image, position: position++ })));
        const assets = [];
        for (const group of jobs) {
          assets.push(await Promise.all(group.map(({ image, position }) => download(image, id, position))));
        }
        const files = assets.flat();
        replaceMarkers(slots, assets);
        const rasterFiles = [...existing, ...files.map(({ src }) => src)];
        record.restoredAssets = { ...record.restoredAssets, raster: rasterFiles.length, rasterFiles };
        const data = `document.currentScript.lessonRecord = JSON.parse(${JSON.stringify(JSON.stringify(record))});\n`;
        const version = createHash('sha256').update(data).digest('hex').slice(0, 12);
        for (const { src, bytes } of files) atomicWrite(path.join(release, src), bytes);
        atomicWrite(file, data);
        catalog = catalog.replace(key, (_, before, after) => before + version + after);
        atomicWrite(index, catalog);
      }
      groups += capture.groups.length;
      images += count;
      applied++;
    } catch (error) {
      const code = /^[a-z0-9_]+$/.test(error.message) ? error.message : error.cause?.code ?? error.code ?? error.name;
      console.error(JSON.stringify({ id, error: code }));
      process.exitCode = 1;
    }
  }
  console.log(JSON.stringify({ mode, lessons: applied, groups, images }));
}

main().catch(error => { console.error(error.code ?? error.message); process.exitCode = 1; });
