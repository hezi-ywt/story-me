function normalizeUnicode(value) {
  return String(value).normalize("NFC");
}

function sanitizePathSegment(value) {
  const normalized = normalizeUnicode(value).trim();
  if (!normalized) {
    throw new Error("Path segment cannot be empty.");
  }

  // Keep Unicode names, only strip cross-platform invalid path characters.
  const sanitized = normalized.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-");
  const collapsed = sanitized.replace(/\s+/g, " ").trim();
  if (!collapsed || collapsed === "." || collapsed === "..") {
    throw new Error(`Invalid path segment: ${value}`);
  }

  return collapsed;
}

function makeDeterministicUniqueName(baseName, existingNames) {
  const base = sanitizePathSegment(baseName);
  const taken = new Set([...existingNames].map((item) => normalizeUnicode(String(item))));

  if (!taken.has(base)) {
    return base;
  }

  let attempt = 2;
  while (taken.has(`${base}-${attempt}`)) {
    attempt += 1;
  }

  return `${base}-${attempt}`;
}

function makeDeterministicUniqueFilename(fileName, existingFileNames) {
  const normalized = sanitizePathSegment(fileName);
  const dot = normalized.lastIndexOf(".");
  const hasExt = dot > 0 && dot < normalized.length - 1;
  const ext = hasExt ? normalized.slice(dot) : "";
  const base = hasExt ? normalized.slice(0, dot) : normalized;
  const existing = new Set([...existingFileNames].map((item) => normalizeUnicode(String(item))));

  if (!existing.has(normalized)) {
    return normalized;
  }

  let attempt = 2;
  while (existing.has(`${base}-${attempt}${ext}`)) {
    attempt += 1;
  }
  return `${base}-${attempt}${ext}`;
}

export {
  makeDeterministicUniqueFilename,
  makeDeterministicUniqueName,
  normalizeUnicode,
  sanitizePathSegment,
};
