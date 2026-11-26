const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const root = __dirname;
const staging = path.join(root, "course-page-recovery");
const manifest = require("./chatgpt-course-export-manifest.json");
const targets = new Map();
for (const project of manifest.projects.filter(item => item.kind === "subject")) {
  const subject = project.name.startsWith("選修物理") ? "物理"
    : project.name.startsWith("選修化學") ? "化學" : "數學";
  const folder = path.join(root, "course-exports", subject, `${project.name} [${project.projectId}]`);
  for (const id of project.conversationIds) {
    const file = path.join(folder, id + ".json");
    if (!fs.existsSync(file)) continue;
    const record = JSON.parse(fs.readFileSync(file, "utf8"));
    if (record.source === "chatgpt-page" && record.restoredAssets?.otherImages > 0) {
      targets.set(id, { file, record });
    }
  }
}

function captureFile(id) {
  return path.join(staging, `${id}.images.json`);
}

function check(capture) {
  const record = targets.get(capture?.id)?.record;
  if (!record || !Array.isArray(capture.images) || capture.images.length !== record.restoredAssets.otherImages) {
    throw new Error("image_count_does_not_match");
  }
  for (const { url, alt, messageId } of capture.images) {
    const address = new URL(url);
    if (address.origin !== "https://images.openai.com" || address.username || address.password ||
        !address.pathname.startsWith("/static-rsc-4/") || typeof alt !== "string" || !alt.trim() ||
        !record.messages.some(message => message.role === "assistant" && message.id === messageId)) {
      throw new Error("invalid_source_image");
    }
  }
}

function atomicWrite(file, bytes) {
  const temporary = file + "." + randomUUID() + ".tmp";
  try {
    fs.writeFileSync(temporary, bytes, { flag: "wx" });
    fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function serve() {
  const origin = "http://127.0.0.1:48177";
  const route = "/" + randomUUID();
  fs.mkdirSync(staging, { recursive: true });
  http.createServer(async (req, res) => {
    const send = (status, text) => res.writeHead(status, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; form-action 'self'; frame-ancestors 'none'"
    }).end(text);
    if (req.url !== route || req.headers.host !== "127.0.0.1:48177") return send(404, "找不到頁面");
    if (req.method === "GET") return send(200, '<!doctype html><meta charset="utf-8"><form method="post"><label>圖片清單<textarea name="capture" required></textarea></label><button>儲存清單</button></form>');
    if (req.method !== "POST" || req.headers.origin !== origin) return send(403, "拒絕此來源");
    try {
      const parts = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 128 * 1024) throw new Error("image_inventory_too_large");
        parts.push(chunk);
      }
      const input = new URLSearchParams(Buffer.concat(parts).toString("utf8"));
      const capture = JSON.parse(input.get("capture"));
      check(capture);
      atomicWrite(captureFile(capture.id), JSON.stringify(capture));
      console.log(JSON.stringify({ id: capture.id, count: capture.images.length }));
      send(201, "圖片清單已儲存");
    } catch (error) {
      console.error(error instanceof TypeError || error instanceof SyntaxError ? "invalid_capture" : error.message);
      if (!res.destroyed) send(400, "儲存失敗");
    }
  }).listen(48177, "127.0.0.1", () => console.log(origin + route));
}

function rasterType(bytes) {
  if (bytes.length < 16) throw new Error("image_data_missing");
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "jpg";
  if (bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) return "png";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (/^GIF8[79]a$/.test(bytes.toString("ascii", 0, 6))) return "gif";
  throw new Error("unsupported_image_type");
}

async function download(image, id, position) {
  const response = await fetch(image.url, { redirect: "error", signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error("image_http_" + response.status);
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 8 * 1024 * 1024) throw new Error("image_too_large");
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  const src = `course-media/${id}/${position + 1}.${rasterType(bytes)}`;
  return { ...image, src, bytes };
}

function replacePlaceholders(record, images) {
  return record.messages.map(message => {
    const matching = images.filter(image => image.messageId === message.id);
    if (!matching.length) return message;
    let cursor = 0;
    let text = "";
    for (const { src, alt } of matching) {
      const label = `[${alt}]`;
      const at = message.text.indexOf(label, cursor);
      if (at < 0) throw new Error("image_position_not_found");
      text += message.text.slice(cursor, at)
        + "\n\n```lesson-image\n" + JSON.stringify({ src, alt }) + "\n```\n\n";
      cursor = at + label.length;
    }
    return { ...message, text: text + message.text.slice(cursor) };
  });
}

async function apply() {
  const recovered = [];
  for (const [id, { file, record }] of targets) {
    const capture = JSON.parse(fs.readFileSync(captureFile(id), "utf8"));
    check(capture);
    if (record.restoredAssets.raster === capture.images.length) continue;
    const images = [];
    for (const [position, image] of capture.images.entries()) {
      try {
        images.push(await download(image, id, position));
      } catch (error) {
        throw new Error(`${id} 圖片 ${position + 1}: ${error.message}`);
      }
    }
    const messages = replacePlaceholders(record, images);
    recovered.push({ file, record: { ...record, messages, restoredAssets: {
      ...record.restoredAssets, raster: images.length, rasterFiles: images.map(image => image.src)
    } }, images });
  }
  for (const { file, record, images } of recovered) {
    for (const { src, bytes } of images) {
      const target = path.join(root, src);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      atomicWrite(target, bytes);
    }
    atomicWrite(file, JSON.stringify(record, null, 2) + "\n");
    console.log(JSON.stringify({ id: record.conversationId, raster: images.length }));
  }
}

async function main() {
  if (targets.size !== 4) throw new Error("expected_four_lessons_with_missing_images");
  if (process.argv[2] === "--serve") serve();
  else if (process.argv[2] === "--apply") await apply();
  else throw new Error("請使用 --serve 或 --apply");
}

module.exports = { atomicWrite, download };
if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
