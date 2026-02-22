## Why

Current core services are implemented and tested, but creators still need custom scripts to use them. A first-party CLI provides immediate usability, repeatable workflows, and a stable operational contract before building the desktop GUI.

## What Changes

- Add a user-facing CLI entrypoint for the Story Me core services.
- Introduce command workflows for project bootstrapping, episode creation, asset creation, media ingest, and search.
- Standardize CLI output and exit-code behavior for success, validation errors, and operational failures.
- Add CLI-oriented documentation and examples so creators can run workflows without writing code.
- Add command-level integration tests for key flows and error handling.

## Capabilities

### New Capabilities
- `cli-command-interface`: Define command syntax, arguments, and behavior for `init`, `add-episode`, `new-asset`, `ingest`, and `search`.
- `cli-output-and-errors`: Define machine-readable and human-readable output modes, error formatting, and exit code conventions.
- `cli-workflow-testing`: Define CLI integration test requirements for end-to-end command flows and failure scenarios.

### Modified Capabilities
- None.

## Impact

- Adds a new CLI layer and command router in the codebase.
- Reuses existing core/services modules as execution backend.
- Updates README and docs with command usage and examples.
- Expands test suite with CLI command integration coverage.
