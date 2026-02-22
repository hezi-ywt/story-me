## 1. Project Schema And Scaffolding

- [x] 1.1 Define canonical folder layout constants for `script-single` and `script-series`
- [x] 1.2 Implement project creation service for top-level `资产/` and `剧本/` plus `剧本/大纲.md`
- [x] 1.3 Implement episode creation service for `剧本/EPxx/大纲.md`, `剧本/EPxx/剧本.md`, and `剧本/EPxx/场次/`
- [x] 1.4 Implement Unicode-safe path normalization and filename handling utilities
- [x] 1.5 Implement deterministic duplicate-name suffixing for human-readable asset names
- [x] 1.6 Add unit tests for scaffolding output and Chinese-path round trips

## 2. Asset Document Model

- [x] 2.1 Define managed Markdown frontmatter schema (`schema_version`, `asset_id`, `type`, `updated_at`, `updated_by`, `rev`)
- [x] 2.2 Implement asset document factory for `角色`/`道具`/`场景` with base fields `名称`/`描述`/`图像`
- [x] 2.3 Implement custom field persistence and loading for asset documents
- [x] 2.4 Implement revision update logic on each document save
- [x] 2.5 Implement schema validation and compatibility migration for missing legacy metadata fields
- [x] 2.6 Add unit tests for base-field creation, custom-field round-trip, and revision increments

## 3. Ingest And Linking Core

- [x] 3.1 Implement drag-and-drop ingest routing by logical workspace node (`资产`/`角色`/`场景`/`道具`/`EP`/`场次`)
- [x] 3.2 Implement default copy-import flow and explicit move-import flow
- [x] 3.3 Implement metadata generation and `asset_id` assignment for imported media
- [x] 3.4 Implement link/backlink updates between imported assets and script or scene documents
- [x] 3.5 Implement batch import progress tracking and per-file result reporting
- [x] 3.6 Implement conflict handling policies with deterministic rename behavior
- [x] 3.7 Implement undo for the latest import transaction
- [x] 3.8 Add integration tests for partial failure, conflict handling, and undo rollback

## 4. Workspace Explorer UX

- [x] 4.1 Build logical creator-first tree for `资产`/`剧本`/`EP`/`场次` independent of deep storage paths
- [x] 4.2 Implement default hidden-storage mode plus advanced filesystem toggle
- [x] 4.3 Build guided creation flows for episode, scene card, and world assets
- [x] 4.4 Restrict new-asset dialog defaults to `名称`/`描述`/`图像`
- [x] 4.5 Implement asset detail custom-field editor (add/edit/remove)
- [x] 4.6 Implement drag-and-drop scene reordering with invalid-target validation feedback
- [x] 4.7 Implement project-wide search and filters by keyword, type, and tag
- [x] 4.8 Add UI tests for create flows, reordering, and invalid drop behavior

## 5. Multimedia Preview

- [x] 5.1 Build unified preview pane layout for Markdown content and linked media
- [x] 5.2 Implement image preview support (`png`, `jpg`, `jpeg`, `webp`, `gif`)
- [x] 5.3 Implement video/audio preview support (`mp4`, `mov`, `webm`, `mp3`, `wav`, `m4a`)
- [x] 5.4 Implement storyboard and reference-media grouping by scene context
- [x] 5.5 Implement lazy metadata loading and viewport-based preview loading
- [x] 5.6 Implement unsupported-format fallback view with file metadata
- [x] 5.7 Add performance tests for large-media scenes and fallback resilience tests

## 6. Script-First Authoring Workflow

- [x] 6.1 Implement script-first project entry actions for new projects
- [x] 6.2 Implement episode workspace bindings for `大纲.md`, `剧本.md`, and ordered scene cards
- [x] 6.3 Implement script-side asset reference insertion using stable `asset_id`
- [x] 6.4 Implement backlink views from assets to referencing scenes and scripts
- [x] 6.5 Implement scene-order metadata sync with persisted scene-card artifacts
- [x] 6.6 Implement file-level optimistic-lock validation on save (`rev` mismatch detection)
- [x] 6.7 Implement manual merge entry points for revision-conflict states
- [x] 6.8 Add end-to-end tests for complete script workflow without any render plugin

## 7. Platform Adapter And Boundaries

- [x] 7.1 Define platform adapter interfaces for filesystem IO, dialogs, file watcher, and media probing
- [x] 7.2 Implement desktop adapter wiring and watcher-driven incremental reindex pipeline
- [x] 7.3 Enforce render-agnostic boundary by keeping render-engine adapters out of core modules
- [x] 7.4 Define placeholder extension contract for future render plugins (command contract and status/error model)
- [x] 7.5 Document desktop-vs-web capability matrix for planned future Web mode

## 8. Acceptance And Readiness

- [x] 8.1 Build sample `script-single` and `script-series` projects for acceptance walkthrough
- [x] 8.2 Validate Chinese naming and duplicate-name suffix behavior end-to-end
- [x] 8.3 Validate drag-and-drop copy/move, conflict handling, batch progress, and undo flows
- [x] 8.4 Validate metadata compatibility/migration behavior on pre-existing local projects
- [x] 8.5 Finalize developer documentation for project schema, asset model, and link conventions
