## Context

The repository has mature service modules for project scaffolding, asset model operations, ingest, search, preview preparation, script workflow, and platform adapters. However, there is no direct user-facing runtime entrypoint besides writing custom Node scripts.

The CLI should be the first operational layer that:
- exposes core workflows immediately,
- remains stable as the desktop GUI evolves,
- keeps behavior deterministic for automation and tests.

## Goals / Non-Goals

**Goals:**
- Add a single executable CLI entrypoint for common creator workflows.
- Provide predictable command syntax and output contracts.
- Reuse existing service modules without duplicating business logic.
- Establish exit-code and error conventions for scripting and CI usage.
- Add command-level tests for both happy paths and failure paths.

**Non-Goals:**
- Building an interactive TUI wizard in this change.
- Re-implementing backend logic already present in services.
- Adding render-engine integrations.
- Replacing desktop GUI plans; CLI is an operational bridge and automation surface.

## Decisions

### 1. CLI architecture: thin command layer over existing services

Decision:
- Implement `src/cli/main.js` as the command router and argument parser.
- Dispatch command actions into existing modules under `src/services` and `src/core`.

Rationale:
- Keeps business rules centralized.
- Minimizes regression risk and implementation cost.

Alternatives considered:
- Create standalone CLI logic with duplicated workflows: rejected due to drift risk.

### 2. Command set for v1

Decision:
- Implement the following commands:
  - `init`
  - `add-episode`
  - `new-asset`
  - `ingest`
  - `search`

Rationale:
- Covers highest-frequency operations needed before GUI.

Alternatives considered:
- Add many extra commands immediately: rejected to keep CLI focused and stable.

### 3. Output modes and error contract

Decision:
- Default output: concise human-readable text.
- Optional `--json` for machine-readable outputs where applicable.
- Exit codes:
  - `0`: success
  - `2`: invalid arguments / validation errors
  - `1`: runtime or IO failures

Rationale:
- Makes CLI usable by both humans and scripts.

Alternatives considered:
- Human-only output with no JSON mode: rejected for automation limits.

### 4. Validation and safety

Decision:
- Validate required arguments for each command before execution.
- Resolve and sanitize user-provided path/name arguments before write operations.
- Print actionable error messages including failing command context.

Rationale:
- Prevents unsafe operations and improves first-use success.

### 5. Test strategy

Decision:
- Add integration-style CLI tests invoking command handlers with temporary workspaces.
- Cover:
  - successful command flows,
  - validation failures,
  - ingest conflict behavior,
  - deterministic output schema in `--json` mode.

Rationale:
- Ensures command contracts remain stable as internals evolve.

## Risks / Trade-offs

- [Argument parser complexity growth] -> Mitigation: keep parser simple and command-scoped with shared helpers.
- [Output contract drift] -> Mitigation: lock key output fields with JSON-mode tests.
- [Service changes breaking CLI] -> Mitigation: CLI integration tests in CI.
- [Path handling edge cases on different OSes] -> Mitigation: rely on existing path utilities and add path-focused tests.

## Migration Plan

1. Add CLI entrypoint and parser skeleton.
2. Implement command handlers one by one (`init`, `add-episode`, `new-asset`, `ingest`, `search`).
3. Add shared output/error helpers (`human` and `json` modes).
4. Add CLI integration tests.
5. Update `README.md` with command examples.

Rollback strategy:
- CLI is additive; no data migrations needed.
- If a command is unstable, hide it behind a feature flag or remove route while preserving service layer.

## Open Questions

- Should `search` support fuzzy matching in v1 or exact/substring only?
- Do we want global `--quiet` output suppression now or later?
- Should `ingest` expose `undo` in v1 command surface or defer to v1.1?
