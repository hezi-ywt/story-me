## 1. CLI Foundation

- [x] 1.1 Add CLI entrypoint file and command router scaffold
- [x] 1.2 Add shared argument parsing helpers for flags and positional args
- [x] 1.3 Add shared response formatter for human and `--json` output modes
- [x] 1.4 Add shared error/exit-code helpers (`0`, `1`, `2`)

## 2. Command Implementations

- [x] 2.1 Implement `init` command wired to project scaffolding service
- [x] 2.2 Implement `add-episode` command wired to episode creation service
- [x] 2.3 Implement `new-asset` command wired to asset creation service
- [x] 2.4 Implement `ingest` command wired to ingest service with `copy`/`move`
- [x] 2.5 Implement `search` command wired to workspace search service
- [x] 2.6 Implement unknown-command and missing-argument validation behavior

## 3. Packaging And UX

- [x] 3.1 Expose CLI through `npm` script and optional package `bin` mapping
- [x] 3.2 Add concise command help text and usage hints
- [x] 3.3 Add deterministic JSON payload shape for success and failure outputs

## 4. Test Coverage

- [x] 4.1 Add CLI integration test for `init` and `add-episode` flow
- [x] 4.2 Add CLI integration test for `new-asset` and `search` flow
- [x] 4.3 Add CLI integration test for ingest conflict and copy/move behavior
- [x] 4.4 Add CLI integration test for validation errors and exit codes

## 5. Documentation

- [x] 5.1 Update `README.md` with CLI command examples
- [x] 5.2 Add dedicated CLI usage document under `docs/`
