## ADDED Requirements

### Requirement: Preview synchronized with active document
The system SHALL synchronize preview panel content with the currently active markdown document.

#### Scenario: Open a scene markdown document
- **WHEN** the user opens a scene card markdown file
- **THEN** the preview panel renders document preview and linked media grouped by scene context

### Requirement: Immediate preview refresh after ingest
The system SHALL refresh preview data after successful media ingest from the workspace UI.

#### Scenario: Drop new media into scene target
- **WHEN** ingest completes for a scene target
- **THEN** the preview panel updates to include newly imported media without requiring full page reload

### Requirement: Unsupported media fallback card
The system SHALL show fallback metadata cards for unsupported files in preview panel.

#### Scenario: Select unsupported media file
- **WHEN** preview cannot decode a selected media file
- **THEN** the preview panel shows filename, extension, and unsupported-format guidance instead of crashing
