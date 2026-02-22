## Purpose

Defines requirements for visual-workspace-explorer capability.

## Requirements

### Requirement: Logical creator-first hierarchy
The system SHALL present a simplified authoring hierarchy independent of deep physical folder nesting.

#### Scenario: Open project workspace
- **WHEN** the user opens a project
- **THEN** the primary navigation shows logical nodes for `资产` and `剧本`, with `EP` and `场次` as first-class objects

### Requirement: Hidden storage details by default
The system SHALL hide implementation-level storage folders in default mode and provide an explicit advanced filesystem mode.

#### Scenario: Default view for nested scene resources
- **WHEN** a scene contains deep storage folders for storyboard and references
- **THEN** those implementation folders are hidden from the default tree and represented as friendly cards in scene detail view

#### Scenario: Enable advanced mode
- **WHEN** the user enables advanced filesystem mode
- **THEN** the system reveals actual file and folder paths for power users

### Requirement: Guided create flows
The system SHALL provide guided create actions for episode, scene card, storyboard shot, and asset documents.

#### Scenario: Create a new scene card from an episode
- **WHEN** the user chooses "New Scene" in `EP01`
- **THEN** the system creates the scene Markdown file and any required resource folders and immediately opens the new scene in editor view

#### Scenario: Create a new world asset with minimal inputs
- **WHEN** the user chooses "New Asset" and selects `角色`, `道具`, or `场景`
- **THEN** the create dialog asks only for `名称`, `描述`, and `图像` before generating the asset

### Requirement: Custom field editing in asset detail
The system SHALL allow users to add, edit, and remove custom fields on asset detail pages.

#### Scenario: Add custom field in asset detail
- **WHEN** the user opens an asset and adds a custom field key-value pair
- **THEN** the field appears in the asset detail form and is saved to the backing asset document

### Requirement: Safe drag-and-drop reorganization
The system SHALL support drag-and-drop move or reorder operations for logical nodes with validation and clear feedback.

#### Scenario: Reorder scenes
- **WHEN** the user drags scene `03-身份揭示` above `02-茶馆相遇`
- **THEN** the system updates logical ordering, applies any required file naming updates, and preserves scene links

#### Scenario: Invalid drop target
- **WHEN** the user drops a node onto an incompatible target
- **THEN** the system blocks the action and displays a reason with corrective guidance

### Requirement: Workspace search and filter
The system SHALL provide project-wide search and filtering across script and asset content.

#### Scenario: Filter by tag and type
- **WHEN** the user filters for type `scene` and tag `茶馆`
- **THEN** the workspace returns matching scenes and linked assets in a unified result list
