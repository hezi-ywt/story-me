const state = {
  projectRoot: "",
  advancedMode: false,
  treeNodes: [],
  expanded: new Set(),
  selectedPath: "",
  activeDocumentPath: "",
  activeDocumentContent: "",
  activeScenePreview: null,
  lastAssetId: "",
};

const els = {
  rootInput: document.querySelector("#project-root-input"),
  projectType: document.querySelector("#project-type-select"),
  openButton: document.querySelector("#open-project-btn"),
  initButton: document.querySelector("#init-project-btn"),
  advancedToggle: document.querySelector("#advanced-mode-toggle"),
  searchInput: document.querySelector("#search-input"),
  searchButton: document.querySelector("#search-btn"),
  createEpisodeButton: document.querySelector("#create-episode-btn"),
  createAssetButton: document.querySelector("#create-asset-btn"),
  insertAssetLinkButton: document.querySelector("#insert-asset-link-btn"),
  treeRoot: document.querySelector("#tree-root"),
  saveButton: document.querySelector("#save-doc-btn"),
  editor: document.querySelector("#editor-textarea"),
  documentPath: document.querySelector("#document-path"),
  saveStatus: document.querySelector("#save-status"),
  preview: document.querySelector("#preview-content"),
  dropOverlay: document.querySelector("#drop-overlay"),
  treePanel: document.querySelector(".tree-panel"),
  editorPanel: document.querySelector(".editor-panel"),
  editorDropOverlay: document.querySelector("#editor-drop-overlay"),
  toast: document.querySelector("#toast"),
};

function showToast(text, variant = "") {
  els.toast.textContent = text;
  els.toast.className = `toast ${variant}`.trim();
  els.toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    els.toast.classList.add("hidden");
  }, 2600);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    const message = data?.error?.message || `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data.result;
}

function fileQueryPath(path) {
  return `/api/file?path=${encodeURIComponent(path)}`;
}

function sceneInfoFromPath(path) {
  const normalized = String(path).replace(/\\/g, "/");
  const match = normalized.match(/\/剧本\/(EP\d+)\/场次\/([^/]+)\.md$/i);
  if (!match) {
    return null;
  }
  return {
    episodeName: match[1].toUpperCase(),
    sceneName: match[2],
  };
}

function ingestTargetFromPath(path) {
  const normalized = String(path || "").replace(/\\/g, "/");
  if (!normalized) {
    return null;
  }

  if (normalized.includes("/资产/角色")) {
    return { nodeType: "角色" };
  }
  if (normalized.includes("/资产/场景")) {
    return { nodeType: "场景" };
  }
  if (normalized.includes("/资产/道具")) {
    return { nodeType: "道具" };
  }
  if (normalized.includes("/资产")) {
    return { nodeType: "资产" };
  }

  const scene = sceneInfoFromPath(normalized);
  if (scene) {
    return {
      nodeType: "场次",
      episodeName: scene.episodeName,
      sceneName: scene.sceneName,
    };
  }

  const epMatch = normalized.match(/\/剧本\/(EP\d+)/i);
  if (epMatch) {
    return {
      nodeType: "EP",
      episodeName: epMatch[1].toUpperCase(),
    };
  }

  return null;
}

function inferMediaType(path) {
  const ext = String(path).split(".").pop().toLowerCase();
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
    return "image";
  }
  if (["mp4", "mov", "webm"].includes(ext)) {
    return "video";
  }
  if (["mp3", "wav", "m4a"].includes(ext)) {
    return "audio";
  }
  return "unsupported";
}

function clearChildren(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function parseAssetId(markdown) {
  const match = String(markdown).match(/^asset_id:\s*"?([^"\n]+)"?/m);
  return match ? match[1].trim() : "";
}

function normalizeFsPath(path) {
  return String(path || "").replace(/\\/g, "/");
}

function decodeUriSafe(path) {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

function isExternalReference(path) {
  return /^(https?:)?\/\//i.test(path) || path.startsWith("data:") || path.startsWith("blob:");
}

function resolveDocumentRelativePath(docPath, rawPath) {
  const source = decodeUriSafe(String(rawPath || "").trim());
  if (!source) {
    return "";
  }
  if (isExternalReference(source)) {
    return source;
  }

  if (source.startsWith("/")) {
    return normalizeFsPath(source);
  }

  const baseSegments = normalizeFsPath(docPath).split("/");
  if (!baseSegments.length) {
    return normalizeFsPath(source);
  }
  baseSegments.pop();

  for (const segment of source.split("/")) {
    if (!segment || segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (baseSegments.length > 1) {
        baseSegments.pop();
      }
      continue;
    }
    baseSegments.push(segment);
  }
  return baseSegments.join("/");
}

function localPathForReference(docPath, reference) {
  const resolved = resolveDocumentRelativePath(docPath, reference);
  if (!resolved || isExternalReference(resolved)) {
    return "";
  }
  return resolved;
}

function mediaSourceForReference(docPath, reference) {
  const resolved = resolveDocumentRelativePath(docPath, reference);
  if (!resolved) {
    return "";
  }
  if (isExternalReference(resolved)) {
    return resolved;
  }
  return fileQueryPath(resolved);
}

function createMediaElement(tagName, src) {
  const el = document.createElement(tagName);
  el.controls = true;
  el.src = src;
  return el;
}

function appendInlineMarkdown(container, text, docPath) {
  const source = String(text ?? "");
  const tokenRegex =
    /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|<audio[^>]*src=["']([^"']+)["'][^>]*>\s*<\/audio>|<video[^>]*src=["']([^"']+)["'][^>]*>\s*<\/video>/gi;
  let cursor = 0;
  let match;

  while ((match = tokenRegex.exec(source)) !== null) {
    if (match.index > cursor) {
      container.appendChild(document.createTextNode(source.slice(cursor, match.index)));
    }

    if (match[1] !== undefined && match[2] !== undefined) {
      const img = document.createElement("img");
      img.alt = match[1];
      img.loading = "lazy";
      img.src = mediaSourceForReference(docPath, match[2]);
      container.appendChild(img);
    } else if (match[3] !== undefined && match[4] !== undefined) {
      const anchor = document.createElement("a");
      anchor.textContent = match[3];
      const localPath = localPathForReference(docPath, match[4]);
      if (localPath) {
        anchor.href = fileQueryPath(localPath);
        anchor.addEventListener("click", (event) => {
          event.preventDefault();
          openPath(localPath)
            .then(() => renderTree())
            .catch((error) => showToast(error.message, "error"));
        });
      } else {
        anchor.href = decodeUriSafe(match[4]);
        anchor.target = "_blank";
        anchor.rel = "noreferrer";
      }
      container.appendChild(anchor);
    } else if (match[5] !== undefined) {
      const audioSrc = mediaSourceForReference(docPath, match[5]);
      if (audioSrc) {
        container.appendChild(createMediaElement("audio", audioSrc));
      }
    } else if (match[6] !== undefined) {
      const videoSrc = mediaSourceForReference(docPath, match[6]);
      if (videoSrc) {
        container.appendChild(createMediaElement("video", videoSrc));
      }
    }

    cursor = tokenRegex.lastIndex;
  }

  if (cursor < source.length) {
    container.appendChild(document.createTextNode(source.slice(cursor)));
  }
}

function renderMarkdownPreview(docPath, markdown) {
  const wrapper = document.createElement("article");
  wrapper.className = "markdown-preview";

  const normalized = String(markdown ?? "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  let list = null;
  let inCode = false;
  let codeLines = [];

  function flushList() {
    if (!list) {
      return;
    }
    wrapper.appendChild(list);
    list = null;
  }

  function flushCode() {
    if (!inCode) {
      return;
    }
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = codeLines.join("\n");
    pre.appendChild(code);
    wrapper.appendChild(pre);
    inCode = false;
    codeLines = [];
  }

  for (const rawLine of lines) {
    const line = String(rawLine);
    const trimmed = line.trim();

    if (inCode) {
      if (trimmed.startsWith("```")) {
        flushCode();
      } else {
        codeLines.push(line);
      }
      continue;
    }

    if (trimmed.startsWith("```")) {
      flushList();
      inCode = true;
      codeLines = [];
      continue;
    }

    if (!trimmed) {
      flushList();
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushList();
      const level = heading[1].length;
      const node = document.createElement(`h${level}`);
      appendInlineMarkdown(node, heading[2], docPath);
      wrapper.appendChild(node);
      continue;
    }

    const listItem = /^\s*[-*]\s+(.*)$/.exec(line);
    if (listItem) {
      if (!list) {
        list = document.createElement("ul");
      }
      const li = document.createElement("li");
      appendInlineMarkdown(li, listItem[1], docPath);
      list.appendChild(li);
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flushList();
      const blockquote = document.createElement("blockquote");
      appendInlineMarkdown(blockquote, quote[1], docPath);
      wrapper.appendChild(blockquote);
      continue;
    }

    flushList();
    const p = document.createElement("p");
    appendInlineMarkdown(p, line, docPath);
    wrapper.appendChild(p);
  }

  flushList();
  flushCode();

  if (!wrapper.childNodes.length) {
    const empty = document.createElement("p");
    empty.className = "placeholder";
    empty.textContent = "文档为空。";
    wrapper.appendChild(empty);
  }

  return wrapper;
}

function buildScenePreviewEntries(preview) {
  const entries = [];
  entries.push(...(preview?.groups?.references || []).map((item) => ({ ...item, group: "参考媒体" })));
  for (const shot of preview?.groups?.storyboard || []) {
    for (const ref of shot.references || []) {
      entries.push({ ...ref, group: `分镜 ${shot.title}` });
    }
  }
  return entries;
}

function appendSceneMediaPreview(preview) {
  const entries = buildScenePreviewEntries(preview);

  const sectionLabel = document.createElement("p");
  sectionLabel.className = "meta-line preview-section-title";
  sectionLabel.textContent = "场次媒体";
  els.preview.appendChild(sectionLabel);

  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "placeholder";
    empty.textContent = "该场次暂无媒体文件。";
    els.preview.appendChild(empty);
    return;
  }

  for (const entry of entries) {
    const card = document.createElement("article");
    card.className = "preview-card";

    const title = document.createElement("h4");
    title.textContent = `${entry.group} · ${entry.title}`;
    card.appendChild(title);

    const src = fileQueryPath(entry.path);
    if (entry.mediaType === "image") {
      const img = document.createElement("img");
      img.src = src;
      card.appendChild(img);
    } else if (entry.mediaType === "video") {
      card.appendChild(createMediaElement("video", src));
    } else if (entry.mediaType === "audio") {
      card.appendChild(createMediaElement("audio", src));
    } else {
      const unsupported = document.createElement("p");
      unsupported.className = "unsupported";
      unsupported.textContent = entry.fallbackMessage || "不支持该文件类型。";
      card.appendChild(unsupported);
    }
    els.preview.appendChild(card);
  }
}

function renderActiveDocumentPreview() {
  if (!state.activeDocumentPath) {
    return;
  }
  clearChildren(els.preview);
  els.preview.appendChild(renderMarkdownPreview(state.activeDocumentPath, els.editor.value));
  if (state.activeScenePreview) {
    appendSceneMediaPreview(state.activeScenePreview);
  }
}

async function refreshScenePreviewForDocument(docPath) {
  if (!sceneInfoFromPath(docPath)) {
    state.activeScenePreview = null;
    return;
  }
  state.activeScenePreview = await api(`/api/preview?sceneDocPath=${encodeURIComponent(docPath)}&limit=40`);
}

async function loadTree() {
  if (!state.projectRoot) {
    return;
  }
  const result = await api(
    `/api/workspace/tree?projectRoot=${encodeURIComponent(state.projectRoot)}&advancedMode=${
      state.advancedMode ? "1" : "0"
    }`
  );
  state.treeNodes = result.tree.nodes || [];
  renderTree();
}

function createTreeNode(node, depth = 0) {
  const container = document.createElement("div");
  container.className = "tree-node";
  const isDir = node.kind === "dir";
  const isExpanded = state.expanded.has(node.path);

  const item = document.createElement("button");
  item.className = `tree-item ${state.selectedPath === node.path ? "active" : ""}`;
  item.style.paddingLeft = `${8 + depth * 14}px`;

  const baseName = node.path.split(/[\\/]/).pop();
  item.textContent = isDir ? `${isExpanded ? "▾" : "▸"} ${baseName}` : `• ${baseName}`;

  item.addEventListener("click", async () => {
    state.selectedPath = node.path;
    if (isDir) {
      if (isExpanded) {
        state.expanded.delete(node.path);
      } else {
        state.expanded.add(node.path);
      }
      renderTree();
      return;
    }
    await openPath(node.path);
    renderTree();
  });

  container.appendChild(item);
  if (isDir && isExpanded && Array.isArray(node.children)) {
    const childrenWrap = document.createElement("div");
    childrenWrap.className = "tree-children";
    for (const child of node.children) {
      childrenWrap.appendChild(createTreeNode(child, depth + 1));
    }
    container.appendChild(childrenWrap);
  }

  return container;
}

function renderTree() {
  clearChildren(els.treeRoot);
  if (!state.treeNodes.length) {
    const empty = document.createElement("div");
    empty.className = "tree-empty";
    empty.textContent = "未加载项目。请先输入路径并打开项目。";
    els.treeRoot.appendChild(empty);
    return;
  }

  for (const node of state.treeNodes) {
    if (!state.expanded.has(node.path)) {
      state.expanded.add(node.path);
    }
    els.treeRoot.appendChild(createTreeNode(node, 0));
  }
}

function renderPreviewPlaceholder(text) {
  clearChildren(els.preview);
  const p = document.createElement("p");
  p.className = "placeholder";
  p.textContent = text;
  els.preview.appendChild(p);
}

function renderPreviewFile(path) {
  clearChildren(els.preview);
  const card = document.createElement("article");
  card.className = "preview-card";
  const title = document.createElement("h4");
  title.textContent = path.split(/[\\/]/).pop();
  card.appendChild(title);

  const mediaType = inferMediaType(path);
  const src = fileQueryPath(path);
  if (mediaType === "image") {
    const img = document.createElement("img");
    img.src = src;
    card.appendChild(img);
  } else if (mediaType === "video") {
    const video = document.createElement("video");
    video.controls = true;
    video.src = src;
    card.appendChild(video);
  } else if (mediaType === "audio") {
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = src;
    card.appendChild(audio);
  } else {
    const unsupported = document.createElement("p");
    unsupported.className = "unsupported";
    unsupported.textContent = "当前运行时不支持该格式预览。";
    card.appendChild(unsupported);
  }
  els.preview.appendChild(card);
}

async function openDocument(path) {
  const doc = await api(`/api/document?path=${encodeURIComponent(path)}`);
  state.activeDocumentPath = path;
  state.activeDocumentContent = doc.content;
  state.lastAssetId = parseAssetId(doc.content);

  els.documentPath.textContent = path;
  els.editor.value = doc.content;
  els.editor.disabled = false;
  els.saveStatus.textContent = "";

  await refreshScenePreviewForDocument(path).catch(() => {
    state.activeScenePreview = null;
  });
  renderActiveDocumentPreview();
}

async function openPath(path) {
  state.selectedPath = path;
  if (path.endsWith(".md")) {
    await openDocument(path);
    return;
  }

  state.activeDocumentPath = "";
  state.activeDocumentContent = "";
  state.activeScenePreview = null;
  state.lastAssetId = "";
  els.editor.value = "";
  els.editor.disabled = true;
  els.documentPath.textContent = "未选中文档";
  els.saveStatus.textContent = "";
  els.editorDropOverlay.classList.add("hidden");

  if (/\.(png|jpg|jpeg|webp|gif|mp4|mov|webm|mp3|wav|m4a)$/i.test(path)) {
    renderPreviewFile(path);
    return;
  }
  renderPreviewPlaceholder("该节点暂无直接预览。");
}

async function saveActiveDocument() {
  if (!state.activeDocumentPath) {
    showToast("请先打开一个 Markdown 文档。", "warn");
    return;
  }
  const content = els.editor.value;
  const saved = await api("/api/document/save", {
    method: "POST",
    body: {
      path: state.activeDocumentPath,
      content,
    },
  });
  state.activeDocumentContent = content;
  state.lastAssetId = parseAssetId(content);
  els.saveStatus.textContent = `已保存 · ${saved.updatedAt}`;
  showToast("文档已保存");
}

async function searchWorkspace() {
  if (!state.projectRoot) {
    showToast("请先打开项目。", "warn");
    return;
  }
  const query = els.searchInput.value.trim();
  const result = await api(
    `/api/workspace/search?projectRoot=${encodeURIComponent(state.projectRoot)}&query=${encodeURIComponent(query)}`
  );
  clearChildren(els.preview);
  if (!result.results.length) {
    renderPreviewPlaceholder("未找到匹配内容。");
    return;
  }

  for (const item of result.results) {
    const card = document.createElement("article");
    card.className = "preview-card";
    const title = document.createElement("h4");
    title.textContent = item.title;
    const pathText = document.createElement("p");
    pathText.className = "meta-line";
    pathText.textContent = item.path;
    const button = document.createElement("button");
    button.className = "secondary";
    button.textContent = "打开";
    button.addEventListener("click", async () => {
      await openPath(item.path);
      renderTree();
    });
    card.appendChild(title);
    card.appendChild(pathText);
    card.appendChild(button);
    els.preview.appendChild(card);
  }
}

function withBusyButton(button, fn) {
  return async (...args) => {
    const prev = button.textContent;
    button.disabled = true;
    button.textContent = "处理中...";
    try {
      await fn(...args);
    } finally {
      button.disabled = false;
      button.textContent = prev;
    }
  };
}

async function createEpisode() {
  if (!state.projectRoot) {
    showToast("请先打开项目。", "warn");
    return;
  }
  const input = window.prompt("输入 EP 编号（例如 1 或 EP01）:");
  if (!input) {
    return;
  }
  await api("/api/workspace/episode", {
    method: "POST",
    body: {
      projectRoot: state.projectRoot,
      episode: input.trim(),
    },
  });
  showToast("EP 创建成功");
  await loadTree();
}

async function createAsset() {
  if (!state.projectRoot) {
    showToast("请先打开项目。", "warn");
    return;
  }
  const type = window.prompt("资产类型（角色/场景/道具）:", "角色");
  if (!type) {
    return;
  }
  const name = window.prompt("资产名称:");
  if (!name) {
    return;
  }
  const description = window.prompt("资产描述:", "") || "";
  const image = window.prompt("图像文件名（可空）:", "") || "";

  await api("/api/workspace/asset", {
    method: "POST",
    body: {
      projectRoot: state.projectRoot,
      assetType: type.trim(),
      name: name.trim(),
      description,
      image,
    },
  });
  showToast("资产创建成功");
  await loadTree();
}

function insertAssetReference() {
  if (!state.lastAssetId) {
    showToast("当前文档未检测到 asset_id。请先打开资产文档。", "warn");
    return;
  }
  if (!state.activeDocumentPath) {
    showToast("请先打开需要插入引用的文档。", "warn");
    return;
  }
  const token = `[[${state.lastAssetId}]]`;
  const start = els.editor.selectionStart ?? els.editor.value.length;
  const end = els.editor.selectionEnd ?? start;
  const head = els.editor.value.slice(0, start);
  const tail = els.editor.value.slice(end);
  els.editor.value = `${head}${token}${tail}`;
  state.activeDocumentContent = els.editor.value;
  els.editor.focus();
  els.editor.selectionStart = els.editor.selectionEnd = start + token.length;
  renderActiveDocumentPreview();
}

async function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const raw = String(reader.result || "");
      const commaIndex = raw.indexOf(",");
      resolve(commaIndex >= 0 ? raw.slice(commaIndex + 1) : raw);
    });
    reader.addEventListener("error", () => {
      reject(new Error(`读取文件失败：${file.name}`));
    });
    reader.readAsDataURL(file);
  });
}

async function filesToPayload(files) {
  const payload = [];
  for (const file of files) {
    payload.push({
      name: file.name,
      base64: await toBase64(file),
    });
  }
  return payload;
}

async function handleDrop(event) {
  event.preventDefault();
  els.dropOverlay.classList.add("hidden");

  if (!state.projectRoot) {
    showToast("请先打开项目。", "warn");
    return;
  }
  const files = [...(event.dataTransfer?.files || [])];
  if (!files.length) {
    return;
  }

  const target = ingestTargetFromPath(state.selectedPath);
  if (!target) {
    showToast("当前选择的节点不支持导入。请先选择角色/场景/道具/EP/场次节点。", "warn");
    return;
  }

  const payloadFiles = await filesToPayload(files);

  const result = await api("/api/workspace/ingest-upload", {
    method: "POST",
    body: {
      projectRoot: state.projectRoot,
      target,
      mode: "copy",
      files: payloadFiles,
    },
  });

  showToast(`导入完成：成功 ${result.summary.completed}，失败 ${result.summary.failed}`);
  await loadTree();
  if (state.selectedPath.endsWith(".md")) {
    await openPath(state.selectedPath);
  }
}

async function handleEditorDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  els.editorDropOverlay.classList.add("hidden");

  if (!state.projectRoot) {
    showToast("请先打开项目。", "warn");
    return;
  }
  if (!state.activeDocumentPath) {
    showToast("请先打开一个 Markdown 文档。", "warn");
    return;
  }

  const files = [...(event.dataTransfer?.files || [])];
  if (!files.length) {
    return;
  }

  const payloadFiles = await filesToPayload(files);
  const result = await api("/api/document/ingest", {
    method: "POST",
    body: {
      projectRoot: state.projectRoot,
      docPath: state.activeDocumentPath,
      mode: "copy",
      files: payloadFiles,
    },
  });

  state.activeDocumentContent = result.content;
  state.lastAssetId = parseAssetId(result.content);
  els.editor.value = result.content;
  els.saveStatus.textContent = `已导入 · ${result.updatedAt}`;

  await refreshScenePreviewForDocument(state.activeDocumentPath).catch(() => {
    state.activeScenePreview = null;
  });
  renderActiveDocumentPreview();
  await loadTree();
  showToast(`已导入 ${result.summary.completed} 个文件，失败 ${result.summary.failed}`);
}

function bindDragAndDrop() {
  let treeDragDepth = 0;
  let editorDragDepth = 0;

  els.treePanel.addEventListener("dragenter", (event) => {
    event.preventDefault();
    treeDragDepth += 1;
    els.dropOverlay.classList.remove("hidden");
  });
  els.treePanel.addEventListener("dragover", (event) => {
    event.preventDefault();
    els.dropOverlay.classList.remove("hidden");
  });

  ["dragleave", "dragend"].forEach((eventName) => {
    els.treePanel.addEventListener(eventName, () => {
      treeDragDepth = Math.max(0, treeDragDepth - 1);
      if (treeDragDepth === 0) {
        els.dropOverlay.classList.add("hidden");
      }
    });
  });

  els.treePanel.addEventListener("drop", (event) => {
    treeDragDepth = 0;
    handleDrop(event).catch((error) => {
      showToast(error.message, "error");
    });
  });

  els.editorPanel.addEventListener("dragenter", (event) => {
    event.preventDefault();
    event.stopPropagation();
    editorDragDepth += 1;
    if (state.activeDocumentPath) {
      els.editorDropOverlay.classList.remove("hidden");
    }
  });
  els.editorPanel.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (state.activeDocumentPath) {
      els.editorDropOverlay.classList.remove("hidden");
    }
  });

  ["dragleave", "dragend"].forEach((eventName) => {
    els.editorPanel.addEventListener(eventName, () => {
      editorDragDepth = Math.max(0, editorDragDepth - 1);
      if (editorDragDepth === 0) {
        els.editorDropOverlay.classList.add("hidden");
      }
    });
  });

  els.editorPanel.addEventListener("drop", (event) => {
    editorDragDepth = 0;
    handleEditorDrop(event).catch((error) => {
      showToast(error.message, "error");
    });
  });
}

async function openProject() {
  const root = els.rootInput.value.trim();
  if (!root) {
    showToast("请输入项目路径。", "warn");
    return;
  }
  state.projectRoot = root;
  localStorage.setItem("storyme.projectRoot", root);
  await loadTree();
  showToast("项目已加载");
}

async function initProject() {
  const root = els.rootInput.value.trim();
  if (!root) {
    showToast("请输入项目路径。", "warn");
    return;
  }
  const type = els.projectType.value;
  await api("/api/project/init", {
    method: "POST",
    body: {
      projectRoot: root,
      type,
    },
  });
  state.projectRoot = root;
  localStorage.setItem("storyme.projectRoot", root);
  await loadTree();
  showToast("项目初始化完成");
}

function bindEvents() {
  els.openButton.addEventListener("click", withBusyButton(els.openButton, openProject));
  els.initButton.addEventListener("click", withBusyButton(els.initButton, initProject));
  els.advancedToggle.addEventListener("change", async (event) => {
    state.advancedMode = Boolean(event.target.checked);
    await loadTree();
  });
  els.searchButton.addEventListener(
    "click",
    withBusyButton(els.searchButton, async () => {
      await searchWorkspace();
    })
  );
  els.saveButton.addEventListener(
    "click",
    withBusyButton(els.saveButton, async () => {
      await saveActiveDocument();
    })
  );
  els.createEpisodeButton.addEventListener(
    "click",
    withBusyButton(els.createEpisodeButton, async () => {
      await createEpisode();
    })
  );
  els.createAssetButton.addEventListener(
    "click",
    withBusyButton(els.createAssetButton, async () => {
      await createAsset();
    })
  );
  els.insertAssetLinkButton.addEventListener("click", () => {
    insertAssetReference();
  });
  els.editor.addEventListener("input", () => {
    if (!state.activeDocumentPath) {
      return;
    }
    state.activeDocumentContent = els.editor.value;
    state.lastAssetId = parseAssetId(els.editor.value);
    renderActiveDocumentPreview();
  });
  els.searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchWorkspace().catch((error) => showToast(error.message, "error"));
    }
  });
  bindDragAndDrop();
}

function bootstrap() {
  const remembered = localStorage.getItem("storyme.projectRoot");
  if (remembered) {
    els.rootInput.value = remembered;
    state.projectRoot = remembered;
    loadTree().catch(() => {
      renderTree();
    });
  } else {
    renderTree();
  }
  bindEvents();
}

bootstrap();
