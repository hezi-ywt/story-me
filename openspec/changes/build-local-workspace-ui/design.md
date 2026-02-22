## Context

The repository already has production-ready core services for project scaffolding, asset creation, ingest, search, script workflow, and preview preparation. The gap is operational UX: creators must run scripts or CLI commands instead of using a visual workspace.

Constraints:
- Local-first and single-user in v1.
- File system + Markdown remain the source of truth.
- No render-engine integration in this change.
- Keep implementation lightweight and fast to iterate.

## Goals / Non-Goals

**Goals:**
- Provide a local web UI for daily creator workflows (assets, scripts, media).
- Reuse existing `src/services/*` as the only business-logic backend.
- Support drag-and-drop ingest and multi-media preview in a script-first layout.
- Keep architecture ready for future desktop wrapper and cloud collaboration layers.

**Non-Goals:**
- Multi-user real-time collaboration.
- Rendering pipeline integration.
- Replacing core data model or folder conventions.
- Building a complete design system in v1.

## Decisions

### 1. Runtime architecture: local API + static web app

Decision:
- Add a Node local HTTP server module for API endpoints and static file serving.
- Add a browser UI app under `src/ui/` with no framework dependency.

Rationale:
- Zero additional external dependencies.
- Fastest path to a usable local UI while preserving portability.
- Easy to wrap later in Tauri/Electron or keep as local web mode.

Alternatives considered:
- React/Vite stack: stronger component model but adds tooling/dependency overhead for v1.
- Desktop-only shell first: limits iteration speed and web portability.

### 2. Service reuse as integration boundary

Decision:
- API handlers call existing service modules directly:
  - `project-service`
  - `workspace-explorer-service`
  - `ingest-service`
  - `preview-service`
  - `script-workflow-service` (where needed)

Rationale:
- Avoids duplicate business logic and behavior drift.
- Keeps existing tests and constraints meaningful.

Alternatives considered:
- Re-implement logic in UI/API layer: rejected due to maintenance risk.

### 3. UI information architecture: script-first tri-pane workspace

Decision:
- Use three-pane layout:
  - Left: logical project tree + search + create actions.
  - Middle: markdown document editor (asset/script/scene).
  - Right: media and document preview cards.

Rationale:
- Matches user requirement for friendly folder/document/media operations.
- Reduces navigation context switching for script-centric workflows.

### 4. Drag-and-drop ingest contract

Decision:
- Implement drop zones on tree nodes and detail panes.
- Validate target via backend rules before ingest.
- Return deterministic result payload with success/failure per input.

Rationale:
- Keeps ingest safety consistent with existing service behavior.
- Produces clear user feedback for batch operations.

### 5. State management approach

Decision:
- Use small client-side store module (plain JS object + event emitters).
- Use optimistic UI updates only where backend operation is idempotent.

Rationale:
- Keeps complexity low and testability high for v1.

## Risks / Trade-offs

- [Vanilla JS UI can grow complex] -> Mitigation: modularize by feature (tree/editor/preview/api client/store).
- [HTTP API surface may drift from future cloud API] -> Mitigation: keep request/response envelopes stable and document contracts.
- [Large workspaces may feel slow without virtualization] -> Mitigation: start with simple rendering and add incremental loading hooks.
- [Markdown editing conflicts in future multi-user mode] -> Mitigation: preserve revision metadata and explicit save flow now.

## Migration Plan

1. Add local API server with endpoints for core workflows.
2. Add static web UI and hook to API endpoints.
3. Add npm scripts to launch server/UI.
4. Add tests for API contracts and UI-critical flows.
5. Update README/docs for local UI usage.

Rollback strategy:
- The change is additive and can be disabled by removing UI start scripts.
- Existing CLI/service workflows remain operational if UI regressions occur.

## Open Questions

- Should v1 include auto-save interval or manual save only for markdown editor?
- Should search results include non-markdown media metadata by default or only docs?
- Should we persist UI preferences (pane widths, advanced mode) in local config now or defer?
