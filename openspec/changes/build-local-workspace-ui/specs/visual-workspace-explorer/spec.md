## ADDED Requirements

### Requirement: Tree interaction state in local UI
The system SHALL maintain deterministic selection and expansion state for workspace tree nodes in local mode.

#### Scenario: Select and expand script nodes
- **WHEN** the user expands `剧本/EP01` and selects a scene card document
- **THEN** the tree keeps expansion state and highlights the selected node while loading detail content

### Requirement: Create actions from contextual tree menu
The system SHALL expose contextual create actions directly from tree nodes for episode and asset workflows.

#### Scenario: Create episode from script root node
- **WHEN** the user invokes create episode action on `剧本`
- **THEN** the system creates the episode artifacts and inserts the new episode node into the current tree view

### Requirement: Clear drag-drop affordance and validation messaging
The system SHALL provide explicit drop affordances and invalid-drop guidance in the explorer.

#### Scenario: Drag media to incompatible node
- **WHEN** the user drags media onto an incompatible node type
- **THEN** the explorer blocks drop and displays a reason with a valid-target hint
