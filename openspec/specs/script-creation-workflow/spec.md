## Purpose

Defines requirements for script-creation-workflow capability.

## Requirements

### Requirement: Script-first project workflow
The system SHALL optimize primary workflows around script creation and revision for both `script-single` and `script-series` projects.

#### Scenario: Start writing in a new project
- **WHEN** the user creates a new script project
- **THEN** the workspace opens with script authoring actions as primary entry points and pre-created outline documents

### Requirement: Hierarchical script documents
The system SHALL support hierarchical script documents at project, episode, and scene levels.

#### Scenario: Episode-level writing
- **WHEN** the user opens episode `EP01`
- **THEN** the workspace provides direct access to `EP01/大纲.md`, `EP01/剧本.md`, and ordered scene cards under `EP01/场次/`

### Requirement: Asset reference linking from scripts
The system SHALL allow scripts and scene cards to reference world assets using stable `asset_id` values and maintain backlinks.

#### Scenario: Link a character from scene script
- **WHEN** the user references a character asset in a scene document
- **THEN** the system stores an `asset_id`-based link and shows the reverse link from that character asset back to the scene

### Requirement: Scene ordering consistency
The system SHALL preserve and synchronize scene ordering between logical workspace order and persisted scene-card artifacts.

#### Scenario: Reorder scene cards
- **WHEN** the user changes scene order in an episode
- **THEN** the system updates ordering metadata and preserves script-to-scene references without breaking links

### Requirement: Collaboration-ready revision metadata
The system SHALL maintain revision metadata for script and scene documents even in local single-user mode.

#### Scenario: Save script content
- **WHEN** the user saves a script or scene document
- **THEN** the system increments `rev`, updates `updated_at`, and records `updated_by` placeholder metadata

### Requirement: File-level optimistic lock contract
The system SHALL provide a file-level optimistic lock contract for future cloud collaboration with manual conflict resolution fallback.

#### Scenario: Revision mismatch detected
- **WHEN** a save operation is attempted with stale revision metadata
- **THEN** the system rejects silent overwrite, marks a conflict state, and provides manual merge entry points

### Requirement: Render-agnostic core workflow
The system SHALL complete script and asset workflows without requiring any render-engine integration in version 1.

#### Scenario: Finish script workflow without render plugin
- **WHEN** no render plugin is configured
- **THEN** users can still create projects, organize assets, author scripts, and manage scene resources end-to-end
