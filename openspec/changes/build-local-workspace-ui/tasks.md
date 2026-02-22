## 1. Local API Foundation

- [x] 1.1 Add local HTTP server entrypoint and static asset serving
- [x] 1.2 Add shared API response and error helpers (`ok/result`, `error/details`)
- [x] 1.3 Add request parsing and validation helpers for query/body payloads
- [x] 1.4 Add API route map and command dispatcher scaffold

## 2. Workspace API Endpoints

- [x] 2.1 Implement project init endpoint using project scaffold service
- [x] 2.2 Implement tree endpoint using logical workspace tree service
- [x] 2.3 Implement episode and asset create endpoints
- [x] 2.4 Implement ingest endpoint with target validation and `copy`/`move`
- [x] 2.5 Implement search endpoint and deterministic sorting
- [x] 2.6 Implement document read/write endpoints for markdown editing

## 3. Local Web UI

- [x] 3.1 Create workspace HTML shell with tri-pane layout and responsive behavior
- [x] 3.2 Implement API client and local UI store modules
- [x] 3.3 Implement workspace tree view with selection and expand/collapse state
- [x] 3.4 Implement markdown editor panel with open/save feedback
- [x] 3.5 Implement media preview panel and unsupported file fallback cards
- [x] 3.6 Implement asset and episode create dialogs with minimal fields
- [x] 3.7 Implement drag-and-drop ingest interaction and result feedback

## 4. Packaging And Runtime UX

- [x] 4.1 Add npm script(s) to launch local workspace UI server
- [x] 4.2 Add sample startup defaults and usage hints for local-only mode
- [x] 4.3 Ensure API/UI errors are actionable for creator workflows

## 5. Tests And Docs

- [x] 5.1 Add API tests for primary workspace endpoints and validation failures
- [x] 5.2 Add UI-focused smoke test for tree/editor/preview flow
- [x] 5.3 Update README with local UI startup and command examples
- [x] 5.4 Add dedicated `docs/local-ui-usage.md` with workflow walkthrough
