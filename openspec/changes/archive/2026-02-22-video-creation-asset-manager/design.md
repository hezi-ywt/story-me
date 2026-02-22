## Context

The change introduces a filesystem-first asset management workspace for video/script creators. The proposal defines five new capabilities: project structure conventions, asset ingest/linking, visual explorer, multimedia preview, and script creation workflow.

Primary product constraints:
- Source of truth must remain local filesystem (folders + Markdown + media files).
- UX must support non-technical creators (drag/drop, clear hierarchy, preview-first interaction).
- Data shape should stay agent-friendly (Markdown-readable, deterministic paths, stable IDs).
- Platform direction is desktop-first while keeping a practical path to a Web edition.
- Version 1 targets local single-user operation, but data contracts must support future cloud collaboration.

## Goals / Non-Goals

**Goals:**
- Deliver a desktop-first application with architecture that allows high code reuse for a future Web version.
- Define a stable project layout and metadata schema that supports characters, scenes, props, scripts, and media linking.
- Provide fast day-to-day workflow: import, organize, preview, edit Markdown, and cross-reference assets.
- Keep platform-specific logic isolated behind interfaces so UI/business logic remains shared.

**Non-Goals:**
- Multi-user collaboration, cloud sync, and permission systems are out of scope for version 1 delivery, but not out of roadmap.
- Any render execution/integration is out of scope for version 1.
- Public plugin marketplace or complex automation workflows in the first version.
- Replacing external DCC/video tools; this product coordinates assets and writing workflows.

## Decisions

### 1. Platform strategy: Desktop-first with Web-portable architecture

Decision:
- Build first release as a desktop app (Tauri preferred) and keep a Web target viable by design.

Rationale:
- Desktop provides reliable filesystem access, local file watchers, and drag/drop behavior needed for heavy media workflows.
- Tauri keeps packaging/runtime lightweight while allowing modern frontend stack reuse.

Alternatives considered:
- Electron desktop-first: mature ecosystem but higher memory/runtime footprint.
- Web-only first: faster distribution but weaker filesystem capabilities and browser API limitations.

### 2. Architecture split: Shared Core + Platform Adapter + UI Shell

Decision:
- Use three-layer architecture:
  - `core` (shared domain logic): project model, metadata validation, link graph, search index model.
  - `platform adapter`: filesystem IO, file dialogs, watcher events, media probing, OS integration.
  - `ui shell`: tree, editors, preview panes, drag/drop and command UX.

Rationale:
- Maximizes desktop/web reuse by isolating platform-specific APIs.
- Keeps testable business logic independent of runtime.

Alternatives considered:
- Direct filesystem calls from UI components: faster initially but high migration cost and lower maintainability.

### 3. Project data model: Filesystem as source of truth with explicit IDs

Decision:
- Use deterministic folder conventions with Markdown frontmatter including stable IDs (`asset_id`, `type`, `tags`, `links`).
- Keep binary media adjacent to corresponding Markdown nodes when possible.

Rationale:
- Maintains human-readable structure, supports Git workflows, and enables agent processing.
- Stable IDs prevent broken references when files are renamed/moved.

Alternatives considered:
- Database-first with exported files: stronger queries but violates filesystem-first requirement and complicates interoperability.

### 4. Metadata and links: Reference graph generated from Markdown

Decision:
- Build an indexed reference graph from Markdown frontmatter/body links.
- Support link targets by ID and canonical relative path.

Rationale:
- Enables backlink views, impact analysis, and script-to-asset navigation.
- Reduces fragile path-only references.

Alternatives considered:
- Path-only links: simpler but brittle under file moves.

### 5. UX scope for MVP

Decision:
- Include:
  - project open/create
  - folder tree browsing
  - drag/drop import and move
  - Markdown edit + preview
  - image/video/audio preview (baseline formats)
  - search/filter by name/type/tag
  - asset-link navigation between scripts and world assets
- Exclude all render execution/integration and real-time collaboration from MVP.

Rationale:
- Focuses on daily creator value while limiting first-release complexity.

Alternatives considered:
- Shipping any render integration in MVP: high integration risk, fragmented adapters, and schedule uncertainty.

### 6. Performance approach: Incremental indexing and lazy preview

Decision:
- Initial full scan at project open, then incremental updates via watcher events.
- Lazy-load media metadata/previews based on viewport selection.

Rationale:
- Keeps UI responsive with large media libraries.

Alternatives considered:
- Full reindex on each change: simpler but unacceptable at scale.

### 7. Collaboration-ready foundations from day one

Decision:
- Keep v1 strictly local/single-user, while baking in collaboration-ready primitives:
  - globally unique immutable asset IDs
  - per-file revision metadata (`updated_at`, `updated_by` placeholder, `rev`)
  - deterministic mergeable Markdown structure
  - explicit conflict markers for unresolved merge states

Rationale:
- Avoids expensive data-model rewrites when adding cloud sync and multi-user editing.
- Enables future server-side diff/merge and audit trails without breaking local projects.

Alternatives considered:
- Add collaboration metadata later: faster v1 delivery but high migration risk and backward-compatibility burden.

### 8. Render extensibility boundary: plugin-ready, not implemented in V1

Decision:
- V1 core SHALL not contain render-engine-specific adapters.
- Define an extension boundary for future render plugins (command contract, input/output manifest shape, and error/status model), but do not implement concrete render plugins in this change.

Rationale:
- Keeps current delivery focused on asset and script management.
- Prevents coupling core modules to unstable external render interfaces.
- Enables rapid future integration by implementing plugins against a stable contract.

Alternatives considered:
- Integrate one render engine now "as a sample": creates false standard and increases early maintenance burden.

## Risks / Trade-offs

- [Filesystem differences across OS] -> Mitigation: define path normalization rules, case-sensitivity tests, and adapter contract tests.
- [Large video assets causing UI stalls] -> Mitigation: background metadata extraction, preview throttling, and size guards.
- [Broken links from manual file edits outside app] -> Mitigation: watcher-driven revalidation and repair prompts based on stable IDs.
- [Desktop/Web capability mismatch] -> Mitigation: capability matrix and graceful degradation in Web adapter.
- [Markdown schema drift over time] -> Mitigation: versioned metadata schema and migration utility per project.
- [Future collaboration requires invasive schema changes] -> Mitigation: reserve collaboration fields in v1 metadata and enforce stable IDs/revision semantics.
- [Future render plugins force core rewrites] -> Mitigation: define stable extension contracts and keep render adapters outside core.

## Migration Plan

1. Define and lock v1 project schema (`folders + frontmatter + link rules`).
2. Implement shared core modules (schema validation, graph build, search model) with unit tests.
3. Implement desktop adapter (filesystem, watcher, dialogs, media probe) and integrate with UI shell.
4. Deliver MVP workflows end-to-end on desktop with sample large project validation.
5. Add collaboration-readiness checks (ID uniqueness, revision updates, merge safety rules) in local mode.
6. Introduce Web adapter prototype with reduced capabilities while reusing core and UI.
7. Add optional cloud sync service and multi-user permission model in phase 2, reusing v1 data contracts.
8. Evaluate gaps and decide whether to expand Web parity or keep Web as read/light-edit mode.

Rollback strategy:
- Preserve user files as-is; do not mutate content without explicit migration markers.
- Feature-flag schema migrations and allow opening in compatibility mode.
- Keep collaboration metadata backward-compatible and optional for existing local-only projects.

## Open Questions

- Which exact baseline media formats are required for v1 (image/video/audio list)?
- Should script references prefer `[[asset_id]]` style links, Markdown links, or both?
- Is internal SQLite cache acceptable for index acceleration if it is disposable and derived from filesystem?
- Do we require offline packaging of media thumbnails or generate on demand only?
- For future collaboration phase, should conflict resolution be manual-first, strategy-based auto-merge, or hybrid?
