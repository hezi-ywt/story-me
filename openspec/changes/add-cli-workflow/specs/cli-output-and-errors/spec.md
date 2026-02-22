## ADDED Requirements

### Requirement: Human-readable output mode
The CLI SHALL provide concise human-readable output by default.

#### Scenario: Successful command in default mode
- **WHEN** a command completes successfully without `--json`
- **THEN** the CLI prints concise success messages suitable for terminal users

### Requirement: Machine-readable JSON output mode
The CLI SHALL provide structured JSON output when `--json` is enabled.

#### Scenario: Command output in JSON mode
- **WHEN** the user runs a command with `--json`
- **THEN** the CLI prints valid JSON containing command status and result payload fields

### Requirement: Exit code conventions
The CLI SHALL use deterministic exit code semantics.

#### Scenario: Success exit code
- **WHEN** a command succeeds
- **THEN** the process exits with code `0`

#### Scenario: Validation error exit code
- **WHEN** the user provides invalid arguments
- **THEN** the process exits with code `2`

#### Scenario: Runtime failure exit code
- **WHEN** command execution fails due to runtime or IO errors
- **THEN** the process exits with code `1`

### Requirement: Actionable error formatting
The CLI SHALL display actionable error messages with command context.

#### Scenario: Missing required argument
- **WHEN** a required argument is omitted
- **THEN** the CLI error includes the missing argument and a short usage hint
