## ADDED Requirements

### Requirement: Unified preview pane
The system SHALL provide a unified preview pane for Markdown documents and linked media assets.

#### Scenario: Open a scene workspace
- **WHEN** the user opens a scene card
- **THEN** the workspace shows scene Markdown content and linked media previews in a single view context

### Requirement: Baseline media format support
The system SHALL support baseline preview formats for images, videos, and audio files in version 1.

#### Scenario: Preview common image formats
- **WHEN** the user selects `png`, `jpg`, `jpeg`, `webp`, or `gif` files
- **THEN** the preview pane renders the image content inline

#### Scenario: Preview common video and audio formats
- **WHEN** the user selects `mp4`, `mov`, `webm`, `mp3`, `wav`, or `m4a` files
- **THEN** the preview pane plays supported media inline with standard controls

### Requirement: Storyboard and reference media grouping
The system SHALL group storyboard resources and reference media by scene context.

#### Scenario: Scene with storyboard shots
- **WHEN** the selected scene contains multiple storyboard shot documents and media references
- **THEN** the preview pane displays grouped shot cards in scene order with linked reference media

### Requirement: Progressive loading and responsiveness
The system SHALL use progressive loading so large media projects remain responsive.

#### Scenario: Open a scene with large video files
- **WHEN** the selected scene contains large media assets
- **THEN** the preview pane loads visible items first and defers non-visible media metadata and thumbnails

### Requirement: Preview fallback on unsupported media
The system SHALL provide a non-crashing fallback for unsupported codecs or unreadable files.

#### Scenario: Unsupported codec
- **WHEN** a media file cannot be decoded in the current runtime
- **THEN** the preview pane shows file metadata and a clear unsupported-format message instead of failing the workspace
