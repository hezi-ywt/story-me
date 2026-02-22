const state = {
  projectRoot: "",
  advancedMode: false,
  treeNodes: [],
  expanded: new Set(),
  selectedPath: "",
  activeDocumentPath: "",
  activeDocumentContent: "",
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

function renderScenePreview(preview) {
  clearChildren(els.preview);
  const groups = [];
  groups.push(...(preview.groups.references || []).map((item) => ({ ...item, group: "参考媒体" })));
  for (const shot of preview.groups.storyboard || []) {
    for (const ref of shot.references || []) {
      groups.push({ ...ref, group: `分镜 ${shot.title}` });
    }
  }

  if (!groups.length) {
    renderPreviewPlaceholder("该场次暂无媒体文件。");
    return;
  }

  for (const entry of groups) {
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
      const video = document.createElement("video");
      video.controls = true;
      video.src = src;
      card.appendChild(video);
    } else if (entry.mediaType === "audio") {
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.src = src;
      card.appendChild(audio);
    } else {
      const unsupported = document.createElement("p");
      unsupported.className = "unsupported";
      unsupported.textContent = entry.fallbackMessage || "不支持该文件类型。";
      card.appendChild(unsupported);
    }
    els.preview.appendChild(card);
  }
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
}

async function openPath(path) {
  state.selectedPath = path;
  if (path.endsWith(".md")) {
    await openDocument(path);
    const sceneInfo = sceneInfoFromPath(path);
    if (sceneInfo) {
      const preview = await api(`/api/preview?sceneDocPath=${encodeURIComponent(path)}&limit=40`);
      renderScenePreview(preview);
      return;
    }
    renderPreviewPlaceholder("已打开文档。若是场次文档会显示媒体预览。");
    return;
  }

  state.activeDocumentPath = "";
  state.activeDocumentContent = "";
  els.editor.value = "";
  els.editor.disabled = true;
  els.documentPath.textContent = "未选中文档";

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
  els.editor.focus();
  els.editor.selectionStart = els.editor.selectionEnd = start + token.length;
}

async function toBase64(file) {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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

  const payloadFiles = [];
  for (const file of files) {
    payloadFiles.push({
      name: file.name,
      base64: await toBase64(file),
    });
  }

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

function bindDragAndDrop() {
  ["dragenter", "dragover"].forEach((eventName) => {
    els.treePanel.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.dropOverlay.classList.remove("hidden");
    });
  });

  ["dragleave", "dragend"].forEach((eventName) => {
    els.treePanel.addEventListener(eventName, () => {
      els.dropOverlay.classList.add("hidden");
    });
  });

  els.treePanel.addEventListener("drop", (event) => {
    handleDrop(event).catch((error) => {
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
