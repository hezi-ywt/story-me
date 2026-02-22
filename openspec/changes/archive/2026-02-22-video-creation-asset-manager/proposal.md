## Why

Creators need a single workspace to organize world-building assets and script artifacts for image/video production, but current workflows are split across folders, note apps, and media tools. Building a filesystem-first manager now enables agent-friendly Markdown workflows while giving creators a visual UI for faster, less error-prone creation.

## What Changes

- Introduce a filesystem-based project model for world assets (characters, scenes, props) and script artifacts using folders plus Markdown files.
- Standardize asset layout so images and other media are stored in corresponding folders, with linked text metadata and narrative context.
- Add a frontend file explorer that supports drag-and-drop organization, friendly folder-tree navigation, and in-place document viewing/editing.
- Add multi-media preview support so users can view common image/video/audio assets alongside Markdown content in one interface.
- Add creation workflow helpers for script-focused production so creators can efficiently move from asset organization to story/video script authoring.
- Explicitly defer render execution/integration in V1, and keep future render capability as plugin-based extension direction.

## Capabilities

### New Capabilities
- `filesystem-project-structure`: Define required folder and Markdown conventions for world assets and script artifacts.
- `asset-ingest-and-linking`: Import media files into the correct folders and maintain links between media and Markdown metadata.
- `visual-workspace-explorer`: Provide drag-and-drop folder management, tree navigation, and file operations in the frontend.
- `multimedia-preview-panel`: Render supported media types and Markdown content in a unified preview/read pane.
- `script-creation-workflow`: Support script document templates and cross-linking with characters, scenes, and props.

### Modified Capabilities
- None.

## Impact

- Adds new specs under `openspec/changes/video-creation-asset-manager/specs/` for each capability above.
- Affects frontend architecture for tree view, drag-and-drop, and content preview modules.
- Requires filesystem indexing and path/link consistency logic between media assets and Markdown documents.
- May add dependencies for drag-and-drop UI, Markdown rendering, and media preview components.
