## ADDED Requirements

### Requirement: CLI entrypoint and command routing
The system SHALL provide a CLI entrypoint that routes subcommands to corresponding workflow handlers.

#### Scenario: Execute a known command
- **WHEN** the user runs a supported command such as `init`
- **THEN** the CLI routes execution to the `init` workflow handler and returns success output on completion

#### Scenario: Execute an unknown command
- **WHEN** the user runs an unsupported command
- **THEN** the CLI returns a validation error and a non-zero exit code

### Requirement: Project initialization command
The CLI SHALL expose an `init` command that creates a new project using supported project templates.

#### Scenario: Initialize script-series project
- **WHEN** the user runs `init` with `--type script-series` and a target path
- **THEN** the CLI creates project scaffolding with `资产/`, `剧本/`, and `剧本/大纲.md`

### Requirement: Episode creation command
The CLI SHALL expose an `add-episode` command for series projects.

#### Scenario: Add episode EP01
- **WHEN** the user runs `add-episode` with episode index or name for an existing project
- **THEN** the CLI creates `剧本/EP01/大纲.md`, `剧本/EP01/剧本.md`, and `剧本/EP01/场次/`

### Requirement: Asset creation command
The CLI SHALL expose a `new-asset` command for `角色`, `道具`, and `场景` assets.

#### Scenario: Create role asset with minimal fields
- **WHEN** the user runs `new-asset` with `--type 角色`, `--name`, `--description`, and `--image`
- **THEN** the CLI creates an asset document with required managed metadata and base content fields

### Requirement: Ingest command
The CLI SHALL expose an `ingest` command supporting copy and move modes for media import.

#### Scenario: Import media with default copy mode
- **WHEN** the user runs `ingest` without specifying mode
- **THEN** files are imported using copy behavior and source files remain unchanged

#### Scenario: Import media with explicit move mode
- **WHEN** the user runs `ingest --mode move`
- **THEN** files are moved into project storage and command output reports moved artifacts

### Requirement: Search command
The CLI SHALL expose a `search` command that queries workspace content.

#### Scenario: Search by keyword and type
- **WHEN** the user runs `search --query 茶馆 --type script`
- **THEN** the CLI returns matching script documents in deterministic order
