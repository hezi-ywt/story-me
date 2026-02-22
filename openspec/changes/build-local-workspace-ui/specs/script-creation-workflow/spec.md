## ADDED Requirements

### Requirement: In-app markdown editing workflow
The system SHALL provide in-app markdown editing for project outline, episode docs, and scene cards.

#### Scenario: Edit and save a scene card
- **WHEN** the user edits scene markdown in the workspace editor and clicks save
- **THEN** the system writes updated content to filesystem and keeps editor state synchronized with saved content

### Requirement: Save feedback and error visibility
The system SHALL provide explicit save status feedback and actionable error messages in the editor workflow.

#### Scenario: Save fails due to filesystem issue
- **WHEN** a save operation fails
- **THEN** the UI shows a non-silent error state with the failing path and retry guidance

### Requirement: Asset link authoring assistance
The system SHALL assist script authors in inserting asset references from the workspace context.

#### Scenario: Insert asset reference token in editor
- **WHEN** the user inserts an asset reference from selected asset context
- **THEN** the editor inserts an `[[asset_id]]` style token at cursor position
