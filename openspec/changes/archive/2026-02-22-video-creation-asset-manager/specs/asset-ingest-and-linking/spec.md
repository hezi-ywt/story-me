## ADDED Requirements

### Requirement: Context-aware drag-and-drop ingest
The system SHALL allow users to drag files or folders onto logical workspace nodes (`资产`, `角色`, `场景`, `道具`, `EP`, `场次`) and automatically route inputs to canonical storage paths.

#### Scenario: Drop image assets onto a scene
- **WHEN** the user drags image files onto scene node `EP01/场次/02-茶馆相遇`
- **THEN** the system stores files in that scene's canonical resource location and registers links from the scene document to imported assets

### Requirement: Non-destructive ingest default
The system SHALL use copy-import as the default behavior and provide an explicit move-import option.

#### Scenario: Default import behavior
- **WHEN** the user drops files without changing import mode
- **THEN** the original source files remain unchanged and copied files are created in the project

#### Scenario: Optional move behavior
- **WHEN** the user selects move-import and confirms the action
- **THEN** the system moves files into project storage and updates internal references accordingly

### Requirement: Automatic metadata and linking
The system SHALL create or update metadata records for imported media and connect them to the target context.

#### Scenario: Import media into an asset category
- **WHEN** the user drops files into `资产/角色`
- **THEN** the system assigns `asset_id` values, updates metadata fields, and creates links from relevant script or scene documents when a target context is provided

### Requirement: Conflict-safe batch import
The system SHALL handle filename conflicts and batch import failures without data loss.

#### Scenario: Filename conflict during import
- **WHEN** an incoming file name matches an existing file in the target location
- **THEN** the system presents conflict resolution options and preserves both files if the user selects rename

#### Scenario: Partial batch failure
- **WHEN** a batch import contains unsupported or unreadable files
- **THEN** the system reports per-file results, completes successful imports, and offers retry for failed items

### Requirement: Import progress and undo entry
The system SHALL provide visible progress for batch ingest and a reversible operation entry for the most recent import action.

#### Scenario: Batch ingest feedback
- **WHEN** the user imports multiple files
- **THEN** the system displays total progress and completion status by file

#### Scenario: Undo last import
- **WHEN** the user invokes undo for the latest import operation
- **THEN** the system removes imported files and metadata created by that operation and restores pre-import links
