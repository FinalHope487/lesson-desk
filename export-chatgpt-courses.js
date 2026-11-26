// Run through Codex functions.exec with its tools object and the local manifest.
// The writer receives the complete JSON record. Progress contains IDs and statuses only.
async function exportChatgptCourses(tools, manifest, {
  existing, write, includeMixed = false, deferIds = [], log = () => {}
}) {
  const ids = new Set();
  const targets = [];
  for (const project of manifest.projects) {
    if (project.kind !== 'subject' && !(includeMixed && project.kind === 'mixed')) continue;
    for (const id of project.conversationIds) {
      if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id) || ids.has(id)) {
        throw new Error('Invalid or duplicate conversation ID in manifest');
      }
      ids.add(id);
      targets.push({ id, project: project.name });
    }
  }

  async function fetchConversation({ id, project }) {
    const seen = new Set();
    const pages = [];
    let cursor;
    let title;
    let truncated = false;
    let nonText = false;
    do {
      const result = await tools.mcp__codex_app__read_thread({
        threadId: id, turnLimit: 10, maxOutputCharsPerItem: 20000,
        ...(cursor ? { cursor } : {})
      });
      if (result.isError) {
        const throttled = result.content?.some(block => /rate[ -]?limit|\b429\b/i.test(block.text ?? ''));
        return { status: throttled ? 'rate_limited' : 'read_error' };
      }
      const block = result.content?.find(item => item.type === 'text');
      let data;
      try {
        data = result.structuredContent ?? JSON.parse(block?.text ?? 'null');
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        return { status: 'invalid_response' };
      }
      if (data?.thread?.id !== id || !Array.isArray(data.turns) || data.page?.order !== 'newest_first'
          || typeof data.page.hasMore !== 'boolean') return { status: 'invalid_response' };
      title ??= data.thread.title;
      nonText ||= Boolean(data.attachments?.length);
      const messages = [];
      for (const turn of [...data.turns].reverse()) {
        if (!Array.isArray(turn.items)) return { status: 'invalid_response' };
        for (const item of turn.items) {
          truncated ||= item.truncated === true;
          if (item.type === 'agentMessage' && typeof item.text === 'string') {
            messages.push({ id: item.id, role: 'assistant', text: item.text });
          } else if (item.type === 'userMessage' && Array.isArray(item.content)) {
            const parts = [];
            for (const part of item.content) {
              truncated ||= part.truncated === true;
              if (part.type === 'text' && typeof part.text === 'string') parts.push(part.text);
              else nonText = true;
            }
            if (parts.length) messages.push({ id: item.id, role: 'user', text: parts.join('\n') });
          } else {
            nonText = true;
          }
        }
      }
      pages.push(messages);
      if (!data.page.hasMore) break;
      cursor = data.page.nextCursor;
      if (typeof cursor !== 'string' || !cursor || seen.has(cursor)) return { status: 'invalid_cursor' };
      seen.add(cursor);
    } while (true);

    if (truncated) return { status: 'truncated' };
    if (nonText) return { status: 'unsupported_content' };
    const messages = pages.reverse().flat();
    if (!messages.some(message => message.text.trim())) return { status: 'empty' };
    return { status: 'exported', document: { conversationId: id, project, title, messages } };
  }

  const deferred = new Set(deferIds);
  let pendingDeferred = false;
  for (const target of targets) {
    const { id } = target;
    let status;
    try {
      if (existing.has(id) && await write(id, undefined)) continue;
      if (deferred.has(id)) {
        pendingDeferred = true;
        continue;
      }
      const result = await fetchConversation(target);
      status = result.status;
      if (result.document) {
        const document = result.document;
        await write(id, document);
        existing.add(id);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : '';
      status = /^(?:file_check_failed|file_write_failed|catalog_build_failed|catalog_verification_failed)$/.test(reason)
        ? reason : 'operation_failed';
    }
    const event = { id, project: target.project, status };
    await log(event);
    return event;
  }
  return { status: pendingDeferred ? 'deferred' : 'complete' };
}

async function runCourseExport(tools, options = {}) {
  const manifestFile = await tools.exec_command({
    cmd: "Get-Content -LiteralPath 'chatgpt-course-export-manifest.json' -Raw -Encoding UTF8",
    max_output_tokens: 8000
  });
  if (manifestFile.exit_code !== 0) throw new Error('Cannot read the course export manifest');
  const listing = await tools.exec_command({
    cmd: "if (Test-Path -LiteralPath 'course-exports') { Get-ChildItem -LiteralPath 'course-exports' -Recurse -File -Filter '*.json' | Select-Object -ExpandProperty Name }",
    max_output_tokens: 8000
  });
  if (listing.exit_code !== 0) throw new Error('Cannot list the local course exports');
  const existing = new Set(listing.output.split(/\r?\n/).filter(name => name.endsWith('.json'))
    .map(name => name.slice(0, -5).toLowerCase()));
  const manifest = JSON.parse(manifestFile.output);
  const log = options.log ?? (async event => {
    const line = JSON.stringify({ at: new Date().toISOString(), ...event });
    const result = await tools.exec_command({
      cmd: `Add-Content -LiteralPath 'course-export-progress.jsonl' -Value '${line.replaceAll("'", "''")}' -Encoding UTF8`,
      max_output_tokens: 100
    });
    if (result.exit_code !== 0) throw new Error('progress_log_failed');
  });
  const projects = new Map();
  for (const project of manifest.projects) {
    if (!/^[^<>:"/\\|?*\x00-\x1f]+$/u.test(project.name) || /[. ]$/.test(project.name) || !/^g-p-[a-f0-9]{32}$/i.test(project.projectId)) {
      throw new Error('Invalid project name or ID in manifest');
    }
    const subject = /^選修物理/.test(project.name) ? '物理'
      : /^選修化學/.test(project.name) ? '化學' : project.kind === 'mixed' ? '綜合' : '數學';
    for (const id of project.conversationIds) projects.set(id, { subject, projectId: project.projectId });
  }
  const catalog = await tools.exec_command({ cmd: 'node build-course-library.js --local', max_output_tokens: 300 });
  if (catalog.exit_code !== 0) throw new Error('catalog_build_failed');
  return exportChatgptCourses(tools, manifest, {
      ...options, existing, log,
      async write(id, document) {
        const { subject, projectId } = projects.get(id);
        const project = manifest.projects.find(item => item.projectId === projectId);
        const relativePath = `course-exports/${subject}/${project.name} [${projectId}]/${id}.json`;
        const path = relativePath.replaceAll("'", "''");
        const check = await tools.exec_command({
          cmd: `if (Test-Path -LiteralPath '${path}') { try { $record = Get-Content -LiteralPath '${path}' -Raw -Encoding UTF8 | ConvertFrom-Json; if ($record.conversationId -eq '${id}') { 'valid' } else { 'invalid' } } catch { 'invalid' } } else { 'missing' }`,
          max_output_tokens: 100
        });
        if (check.exit_code !== 0) throw new Error('file_check_failed');
        if (check.output.trim() === 'valid' && !document) return true;
        if (check.output.trim() !== 'valid') {
          if (!document) return false;
          const lines = JSON.stringify({ ...document, subject, projectId }, null, 2).split('\n').map(line => `+${line}`).join('\n');
          const result = await tools.apply_patch(`*** Begin Patch\n*** Add File: ${relativePath}\n${lines}\n*** End Patch`);
          if (result?.isError) throw new Error('file_write_failed');
        }
        const catalog = await tools.exec_command({ cmd: 'node build-course-library.js --local', max_output_tokens: 300 });
        if (catalog.exit_code !== 0) throw new Error('catalog_build_failed');
        const report = await tools.exec_command({
          cmd: `((Get-Content -LiteralPath 'reports/course-library-report.json' -Raw -Encoding UTF8 | ConvertFrom-Json).missing -notcontains '${id}')`,
          max_output_tokens: 100
        });
        if (report.exit_code !== 0 || report.output.trim() !== 'True') throw new Error('catalog_verification_failed');
        return true;
      }
  });
}
