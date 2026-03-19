# TASK_QUEUE.md — Mobile-Reactive Simulink Web Environment

## Execution Mode
- P3 tasks prioritize advanced simulation capabilities while preserving P1/P2 UX stability.
- One sub-agent at a time for this repo (lock prevention).
- Validate each task before marking complete.

## STRICT SUB-AGENT DIRECTIVE (must be passed verbatim)
"You are a temporary coding worker.
1. Work ONLY in `~/code/web-simulink`.
2. Execute only your assigned task scope.
3. Keep changes minimal, typed, and production-safe.
4. Run relevant validation commands and report exact outputs.
5. Do NOT commit.
6. Return summary, files changed, validation, and risks."

## P3 Queue (Advanced Simulation Features)
- [x] P3-1 Signal Routing Logic
  - Implemented math blocks: Gain, Sum, Product.
  - Added deterministic multi-input routing support in simulation engine (fan-in key preservation).
  - Added canvas/library support for new blocks with industrial styling and multi-input handles.

- [x] P3-2 Signal Logging & Export
  - Added "To File" block with JSON/CSV export payload support and inspector-triggered file download.
  - Implemented IndexedDB persistence for completed simulation run exports.

- [x] P3-3 Integrator + Delay Blocks (cycle-safe foundation)
  - Added Integrator and Unit Delay blocks with deterministic state semantics.
  - Added algebraic-loop breaker metadata and feedback-edge-aware topological scheduling.
  - Added library/canvas/inspector integration while preserving industrial aesthetic.

- [x] P3-4 Graph Validation & Signal-Type Guardrails
  - Add pre-run graph validation for invalid handles, unknown block types, and unsupported cycles.
  - Surface actionable validation errors in runtime UI.

- [ ] P3-5 Model Persistence v2
  - Add export/import for graph + timing + block params with schema versioning.
  - Add local persistence/autosave workflow without breaking deterministic runtime.

- [ ] P3-6 Final Verification + Deployment
  - Run full validation gates (`npm run lint`, `npm run build`).
  - Sync architecture/changelog/task queue.
  - Push to `origin/master`.

## Completed
- [x] P0 Initial Prototype complete.
- [x] P1 Simulink Refinement complete.
- [x] P2 Industrial UI/UX refinement complete.
