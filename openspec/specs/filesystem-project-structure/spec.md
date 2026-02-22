## Purpose

Defines requirements for filesystem-project-structure capability.

## Requirements

### Requirement: V1 project type templates
The system SHALL provide two version-1 project templates named `script-single` and `script-series`, each scaffolded from a deterministic folder and document structure.

#### Scenario: Create a script-single project
- **WHEN** the user creates a project with type `script-single`
- **THEN** the system creates top-level `资产/` and `剧本/` folders and initializes `剧本/大纲.md`

#### Scenario: Create a script-series project
- **WHEN** the user creates a project with type `script-series`
- **THEN** the system creates top-level `资产/` and `剧本/` folders, initializes `剧本/大纲.md`, and prepares the project for `剧本/EPxx/` episode folders

### Requirement: Deterministic episode scaffold
The system SHALL create episode documents and scene containers with deterministic paths so tooling and agents can locate content without heuristics.

#### Scenario: Add an episode
- **WHEN** the user adds a new episode `EP01`
- **THEN** the system creates `剧本/EP01/大纲.md`, `剧本/EP01/剧本.md`, and `剧本/EP01/场次/` in one action

### Requirement: Markdown metadata contract
The system SHALL write schema-stable Markdown frontmatter fields for managed entities.

#### Scenario: Create a managed document
- **WHEN** the system creates a role, scene, prop, script, or scene-card Markdown document
- **THEN** the document frontmatter includes `schema_version`, `asset_id`, `type`, `updated_at`, and `rev`

### Requirement: Minimal and extensible world-asset template
The system SHALL use a unified default template for `角色`, `道具`, and `场景` assets with three base user-editable fields: `名称`, `描述`, and `图像`, and SHALL allow user-defined custom fields.

#### Scenario: Create a role asset document
- **WHEN** the user creates a new `角色` asset
- **THEN** the created asset document contains `名称`, `描述`, and `图像` base fields and system-managed metadata is auto-populated

#### Scenario: Create a prop or scene asset document
- **WHEN** the user creates a new `道具` or `场景` asset
- **THEN** the created asset document uses the same base template (`名称`, `描述`, `图像`) without requiring additional user-entered fields

#### Scenario: Add a custom asset field
- **WHEN** the user adds a custom field such as `阵营` or `状态` to an existing asset
- **THEN** the system persists the custom field in the asset document and reloads it as part of that asset's editable fields

### Requirement: Human-readable asset naming
The system SHALL use the asset `名称` as the default human-readable naming basis for created asset file paths while preserving uniqueness.

#### Scenario: Create asset with Chinese name
- **WHEN** the user creates a `角色` asset with `名称` set to `林月`
- **THEN** the generated asset file path includes a human-readable `林月` segment in its default name

#### Scenario: Handle duplicate asset names
- **WHEN** two assets under the same category are created with the same `名称`
- **THEN** the system keeps both assets by applying deterministic unique suffixing without silently overwriting existing content

### Requirement: Unicode-safe path handling
The system SHALL preserve Unicode folder and file names without lossy transliteration.

#### Scenario: Save and reopen Chinese names
- **WHEN** a user creates a file such as `剧本/EP01/场次/02-茶馆相遇.md`
- **THEN** the system stores and reloads the exact same path and filename without encoding corruption
