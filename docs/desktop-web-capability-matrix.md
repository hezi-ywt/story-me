# Desktop vs Web Capability Matrix

## Scope

This matrix documents current platform expectations for the Story Me workspace.
Desktop is the primary runtime for version 1.

## Capability Matrix

| Capability | Desktop (Primary) | Web (Planned) | Notes |
|---|---|---|---|
| Open local project folders | Full | Partial | Web depends on browser filesystem permissions |
| Recursive file watcher | Full | Limited | Browser watchers are not equivalent to native recursive watch |
| Drag-and-drop import (copy/move) | Full | Partial | Web move support may require copy-only fallback |
| Markdown editing | Full | Full | Shared UI/core logic |
| Media preview (image/video/audio) | Full | Full | Subject to browser codec differences |
| Hidden/advanced filesystem modes | Full | Full | Shared explorer model |
| Incremental indexing | Full | Full | Different adapter implementation |
| Render plugin execution | Deferred | Deferred | Not in v1; plugin contract only |
| Cloud collaboration | Deferred | Deferred | Future phase after local-first stabilization |

## Adapter Boundaries

- `src/platform/platform-adapter.js` defines platform contracts.
- `src/platform/desktop-adapter.js` implements native filesystem behavior.
- Future web adapter should implement the same contract without changing core/workflow services.
- Render integrations remain outside core modules and use plugin manifests only.
