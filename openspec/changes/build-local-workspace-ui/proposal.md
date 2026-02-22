## Why

Core services and CLI are already usable, but creators still lack a visual workspace for day-to-day authoring. We need a local-first UI now so users can manage assets, scripts, and media with drag-and-drop instead of manual file operations.

## What Changes

- Add a local web workspace UI that runs against the existing filesystem-backed services.
- Add a local API layer that exposes project initialization, episode/asset creation, ingest, search, and document read/write operations.
- Add script-first UI layout: logical project tree, document editor, and media preview panel in one workspace.
- Add drag-and-drop media ingest interactions with clear target validation and result feedback.
- Add simple asset creation/edit flows with required fields (`名称`, `描述`, `图像`) and custom field extension.

## Capabilities

### New Capabilities
- `local-workspace-web-ui`: A local-first browser workspace for project navigation, script authoring, and media management.
- `local-workspace-api`: A local API bridge between UI actions and existing service modules.

### Modified Capabilities
- `visual-workspace-explorer`: Extend requirements from abstract capability to concrete local UI interaction and create flows.
- `multimedia-preview-panel`: Extend requirements to include concrete preview behavior in the local UI workspace context.
- `script-creation-workflow`: Extend requirements to include in-app markdown editing and save workflow from the visual workspace.

## Impact

- Adds new runtime modules for local API and web UI entrypoint.
- Reuses `src/services/*` for business logic, minimizing duplication.
- Adds UI/API tests for primary workflows and validation paths.
- Updates README/docs with local UI startup and usage instructions.
