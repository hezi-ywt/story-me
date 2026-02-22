# Project Schema, Asset Model, And Link Conventions

## 1. Project Types

Supported v1 templates:

- `script-single`
- `script-series`

Top-level layout:

```text
<project>/
  资产/
  剧本/
```

## 2. Episode And Scene Layout

For `script-series`:

```text
剧本/
  大纲.md
  EP01/
    大纲.md
    剧本.md
    场次/
      01-开场.md
      01-开场/
        分镜/
        媒体/
```

## 3. Asset Model

Asset categories:

- `角色`
- `道具`
- `场景`

Each asset directory stores `asset.md` as the source document.

Minimal user-editable fields:

- `名称`
- `描述`
- `图像`

Custom fields are allowed under `custom_fields`.

Managed frontmatter fields:

- `schema_version`
- `asset_id`
- `type`
- `updated_at`
- `updated_by`
- `rev`

## 4. Naming Rules

- Keep Unicode names (`NFC`) for Chinese and multilingual paths.
- Strip invalid path characters and preserve readability.
- Duplicate names are resolved deterministically using numeric suffixes (for example, `林月-2`).

## 5. Linking Conventions

- Script and scene documents reference assets by stable ID: `[[asset_id]]`.
- Backlinks are discoverable by scanning markdown documents for matching markers.
- Ingest metadata sidecars (`*.meta.json`) can include `backlinks` for quick lookup.

## 6. Revision And Conflict Rules

- Script save operations use file-level optimistic lock (`expected rev` vs current `rev`).
- On mismatch, writes are blocked and a manual merge entry is generated under `.conflicts/`.
- Merge entries include current and incoming content blocks for human resolution.

## 7. Render Boundary

- Version 1 is render-agnostic.
- Render behavior is deferred to future plugins and must not couple into core modules.
