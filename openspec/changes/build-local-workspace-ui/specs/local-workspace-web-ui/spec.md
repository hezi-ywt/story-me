## ADDED Requirements

### Requirement: Local workspace shell
The system SHALL provide a local web workspace shell with a script-first tri-pane layout for navigation, editing, and preview.

#### Scenario: Open a project in local UI
- **WHEN** the user opens a project path in the local UI
- **THEN** the workspace displays project tree navigation, markdown editor, and media preview panel in a single page layout

### Requirement: Guided creation actions in workspace
The system SHALL provide guided create actions for episode and assets from the workspace UI.

#### Scenario: Create an asset with minimal form
- **WHEN** the user clicks create asset and submits `名称`, `描述`, and `图像`
- **THEN** the workspace creates the asset and refreshes tree and detail views without requiring manual file operations

### Requirement: Drag-and-drop media import in UI
The system SHALL support drag-and-drop media import to compatible workspace targets.

#### Scenario: Drop files onto a valid asset target
- **WHEN** the user drags media files onto a valid target such as `角色` or `场次`
- **THEN** the UI imports media through backend ingest and shows per-file success or failure results

### Requirement: Friendly display over deep folder structure
The system SHALL default to friendly logical display while allowing power users to inspect physical structure.

#### Scenario: Toggle advanced filesystem mode
- **WHEN** the user enables advanced mode
- **THEN** the workspace reveals underlying filesystem paths and storage folders that are hidden in default mode
