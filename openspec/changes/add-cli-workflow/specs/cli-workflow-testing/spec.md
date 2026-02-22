## ADDED Requirements

### Requirement: Integration coverage for primary command flows
The project SHALL include CLI integration tests for primary happy-path workflows.

#### Scenario: Initialize then add episode
- **WHEN** integration tests run the `init` command followed by `add-episode`
- **THEN** tests verify expected project and episode files are created

#### Scenario: Create asset then search
- **WHEN** integration tests run `new-asset` and then `search`
- **THEN** tests verify the created asset can be found through CLI search output

### Requirement: Error-path coverage
The project SHALL include tests for validation and runtime error handling.

#### Scenario: Unknown command
- **WHEN** integration tests invoke an unsupported command
- **THEN** tests verify non-zero exit code and error output

#### Scenario: Missing required arguments
- **WHEN** integration tests omit required arguments for a command
- **THEN** tests verify exit code `2` and argument-level guidance

### Requirement: Output contract coverage
The project SHALL verify output contracts for both default and JSON modes.

#### Scenario: JSON output schema validation
- **WHEN** integration tests run commands with `--json`
- **THEN** tests verify parseable JSON with stable keys for status and result

### Requirement: Ingest behavior coverage
The project SHALL verify ingest command conflict handling and undo-safe workflows.

#### Scenario: Ingest duplicate names
- **WHEN** integration tests import duplicate filenames via CLI ingest
- **THEN** tests verify deterministic renamed outputs and no data loss
