## ADDED Requirements

### Requirement: Local API for workspace operations
The system SHALL expose a local HTTP API that wraps existing workspace services for UI operations.

#### Scenario: UI requests logical tree data
- **WHEN** the UI calls the tree endpoint with project path and mode flags
- **THEN** the API returns logical workspace data compatible with tree rendering

### Requirement: Deterministic JSON response envelope
The system SHALL return deterministic JSON envelopes for success and failure responses.

#### Scenario: Successful endpoint response
- **WHEN** a workspace operation succeeds
- **THEN** the API returns `{ ok: true, result: ... }` with endpoint-specific payload

#### Scenario: Validation failure response
- **WHEN** required request parameters are missing or invalid
- **THEN** the API returns `{ ok: false, error: { code, message, details } }` with HTTP 400

### Requirement: API endpoint coverage for v1 UI
The system SHALL provide endpoint coverage for initialization, episode/asset creation, ingest, search, and document read/write operations.

#### Scenario: UI saves markdown document
- **WHEN** the UI submits document content to the save endpoint
- **THEN** the API persists content to filesystem and returns updated metadata for the editor state

### Requirement: Ingest endpoint with target validation
The system SHALL validate ingest target context before processing file imports.

#### Scenario: Invalid ingest target
- **WHEN** UI submits ingest request with incompatible target data
- **THEN** the API rejects request with validation error and does not import files
