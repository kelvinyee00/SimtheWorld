# CHANGELOG.md — Mobile-Reactive Simulink Web Environment

---
**Date/Time:** 2026-03-17 21:27 CET
**Task Executed:** Project initialization + architecture/task formalization
**Files Modified/Created:** `ARCHITECTURE.md`, `TASK_QUEUE.md`, `CHANGELOG.md`
**Notes/Bugs:**
- Initialized new project directory at `~/code/web-simulink`.
- Formalized architecture for mobile-reactive Simulink-style prototype.
- Created isolated P0 execution queue for fast Counter-model delivery.
- No code scaffold created yet (awaiting execution approval for delegation).

---
**Date/Time:** 2026-03-17 22:02 CET
**Task Executed:** GO received for P0 execution
**Files Modified/Created:** `CHANGELOG.md`
**Notes/Bugs:**
- Authorized to execute P0 immediately.
- PO constraints added: straight edges by default, high-density technical comments in engine/interface/state layers.
- Delegation starting with P0-1 and P0-2.

---
**Date/Time:** 2026-03-17 22:03 CET
**Task Executed:** Delegated P0-1 scaffold to sub-agent
**Files Modified/Created:** `CHANGELOG.md`
**Notes/Bugs:**
- Sub-agent tasked with Next.js/TS/Tailwind scaffold + dependency baseline.
- Lock-prevention policy enforced: single active worker for repo.

---
**Date/Time:** 2026-03-17 22:06 CET
**Task Executed:** P0-1 scaffold verified + P0-2 delegated
**Files Modified/Created:** `TASK_QUEUE.md`, `CHANGELOG.md`
**Notes/Bugs:**
- Verified scaffold baseline in main session: `npm run lint` ✅, `npm run build` ✅.
- P0-1 marked complete.
- Delegating P0-2 simulation engine implementation next.

---
**Date/Time:** 2026-03-17 22:07 CET
**Task Executed:** Delegated P0-2 simulation engine
**Files Modified/Created:** `CHANGELOG.md`
**Notes/Bugs:**
- Engine scope includes deterministic scheduler, topological ordering utility, Zustand runtime store.
- Mandatory high-density comments required for engine/interface/state files.

-----
**Date/Time:** 2026-03-17 22:15 CET
**Task Executed:** P0-2 Simulation core engine verified
**Files Modified/Created:** `src/simulation/*`, `src/store/simulationRuntimeStore.ts`, `TASK_QUEUE.md`, `CHANGELOG.md`
**Notes/Bugs:**
- Verified engine implementation in main session.
- Core runtime features (scheduler, topological ordering, Zustand store) are active.
- High-density documentation/comments added per PO requirement.
- Project still builds and lints successfully.
- Moving to P0-3 Block system foundation.

-----
**Date/Time:** 2026-03-17 22:18 CET
**Task Executed:** Delegated P0-3 Block system foundation
**Files Modified/Created:** `CHANGELOG.md`
**Notes/Bugs:**
- Sub-agent tasked with implementing block registry and `CounterBlock`.
- Counter logic: configurable start, step, and mode (inc/dec).
- Maintaining high-density documentation standard.

-----
**Date/Time:** 2026-03-17 22:25 CET
**Task Executed:** P0-3 Block system foundation verified
**Files Modified/Created:** `src/simulation/blocks/counterBlock.ts`, `src/simulation/registry.ts`, `src/store/simulationRuntimeStore.ts`, `TASK_QUEUE.md`, `CHANGELOG.md`
**Notes/Bugs:**
- Verified `CounterBlock` implementation and block registry.
- Updated runtime store to use the global block registry.
- Confirmed basic signal propagation and state management.
- Moving to P0-4 Visualization blocks.

-----
**Date/Time:** 2026-03-17 22:28 CET
**Task Executed:** Delegated P0-4 Visualization blocks
**Files Modified/Created:** `CHANGELOG.md`
**Notes/Bugs:**
- Sub-agent tasked with implementing `DisplayBlock` and `ScopeBlock`.
- Scope includes time-series buffering for graphs and real-time numeric display.

-----
**Date/Time:** 2026-03-17 23:12 CET
**Task Executed:** Model switch + P0-4 verification recovery after timeout
**Files Modified/Created:** `src/simulation/blocks/displayBlock.tsx`, `src/simulation/blocks/scopeBlock.tsx`, `src/simulation/registry.ts`, `src/canvas/edgeDefaults.ts`, `TASK_QUEUE.md`, `CHANGELOG.md`
**Notes/Bugs:**
- Model override request handled: direct `google/gemini-2.0-pro-exp-02-05:free` was not allowed by runtime policy; switched session model to allowed `gemini` alias (`google/gemini-3-flash-preview`) for continued execution.
- Verified P0-4 outputs from delegated implementation:
  - `DisplayBlock` numeric sink with deterministic state handling.
  - `ScopeBlock` chart sink with windowed buffer and scalability-oriented comments.
  - Registry updated to include Counter + Display + Scope block definitions.
- Added straight-edge policy artifact for integration: `src/canvas/edgeDefaults.ts` sets default edge type to `straight`.
- Validation gate re-run in main session: `npm run lint` ✅, `npm run build` ✅.

---
**Date/Time:** 2026-03-17 23:16 CET
**Task Executed:** Delegated P0-5 Canvas + mobile interaction
**Files Modified/Created:** `CHANGELOG.md`
**Notes/Bugs:**
- Sub-agent tasked with React Flow canvas integration, touch usability, and mobile UI components.
- Straight-edge requirement enforced via `src/canvas/edgeDefaults.ts`.
- Switched back to `gpt-5.3-codex` per PO preference.

---
**Date/Time:** 2026-03-17 23:25 CET
**Task Executed:** P0-5 Canvas + mobile interaction verified
**Files Modified/Created:** `app/page.tsx`, `TASK_QUEUE.md`, `CHANGELOG.md`
**Notes/Bugs:**
- Verified React Flow integration and Zustand store connectivity.
- Confirmed straight edges and touch interaction support.
- Mobile UI (compact toolbar and inspector bottom-sheet) is functional.
- High-density documentation maintained in UI/Canvas logic.
- Project still builds and lints successfully.
- Moving to P0-6 End-to-end Counter demo + validation.

---
**Date/Time:** 2026-03-17 23:28 CET
**Task Executed:** Delegated P0-6 End-to-end Counter demo + validation
**Files Modified/Created:** `CHANGELOG.md`
**Notes/Bugs:**
- Sub-agent tasked with implementing custom React Flow nodes for Counter, Display, and Scope.
- Establishing default model wiring on load.
- Integrating runtime store outputs with UI components for real-time visualization.

---
**Date/Time:** 2026-03-17 23:45 CET
**Task Executed:** P0-6 End-to-end Counter demo + validation verified (P0 COMPLETE)
**Files Modified/Created:** `TASK_QUEUE.md`, `CHANGELOG.md`
**Notes/Bugs:**
- Verified custom node implementation and real-time visual updates.
- Confirmed default model wiring (Counter -> Display + Scope) on application load.
- Final validation in main session: `npm run lint` ✅, `npm run build` ✅.
- **P0 PHASE COMPLETE.** The prototype is functional, documented, and mobile-reactive.

---
**Date/Time:** 2026-03-18 00:20 CET
**Task Executed:** P1-1 Block Library Sidebar verified
**Files Modified/Created:** `app/page.tsx`, `TASK_QUEUE.md`, `CHANGELOG.md`
**Notes/Bugs:**
- Replaced Components placeholder with functional Block Library.
- Implemented HTML5 Drag & Drop for block instantiation.
- Added block deletion via UI button and Delete/Backspace keys.
- Straight-edge policy and high-density documentation maintained.
- Validation: `npm run lint` ✅, `npm run build` ✅.
- Moving to P1-2 Simulation Control Panel.

---
**Date/Time:** 2026-03-18 00:26 CET
**Task Executed:** Delegated P1-2 Advanced Simulation Controls
**Files Modified/Created:** `CHANGELOG.md`
**Notes/Bugs:**
- Sub-agent label: `web-simulink-p1-2-controls-20260318-0026` (unique per lock-management protocol).
- Model pinned to `openai-codex/gpt-5.3-codex`.
- Scope: Stop Time + Step Time toolbar controls, runtime store binding, speed behavior verification.

---
**Date/Time:** 2026-03-18 00:31 CET
**Task Executed:** P1-2 Advanced Simulation Controls verified
**Files Modified/Created:** `app/page.tsx`, `src/store/simulationRuntimeStore.ts`, `TASK_QUEUE.md`, `CHANGELOG.md`
**Notes/Bugs:**
- Added Stop Time + Step Time inputs for desktop/mobile toolbar.
- Bound UI controls to runtime timing via `setTiming` (seconds↔milliseconds conversion).
- Updated runtime timing policy to safely restart scheduler on timing edits during run.
- Validation: `npm run lint` ✅, `npm run build` ✅.
- Proceeding to P1-3 Matlab Aesthetics & Grid.

---
**Date/Time:** 2026-03-18 00:32 CET
**Task Executed:** Delegated P1-3 Matlab Aesthetics & Grid
**Files Modified/Created:** `CHANGELOG.md`
**Notes/Bugs:**
- Sub-agent label: `web-simulink-p1-3-aesthetic-grid-20260318-0032` (unique per lock-management protocol).
- Model pinned to `openai-codex/gpt-5.3-codex`.
- Scope: Simulink light-gray dot-grid canvas + 3D white block styling while preserving straight edges.

---
**Date/Time:** 2026-03-18 00:34 CET
**Task Executed:** P1-3 Matlab Aesthetics & Grid verified
**Files Modified/Created:** `app/page.tsx`, `src/canvas/customBlockNode.tsx`, `TASK_QUEUE.md`, `CHANGELOG.md`
**Notes/Bugs:**
- Applied Simulink-like light-gray canvas with persistent dot grid.
- Upgraded block appearance to white 3D-style visuals with refined typography.
- Hardened straight-edge policy for initial and newly created edges.
- Validation: `npm run lint` ✅, `npm run build` ✅.
- Proceeding to P1-4 Scope Interactive Modal.

---
**Date/Time:** 2026-03-18 00:35 CET
**Task Executed:** Delegated P1-4 Scope Interactive Modal
**Files Modified/Created:** `CHANGELOG.md`
**Notes/Bugs:**
- Sub-agent label: `web-simulink-p1-4-scope-modal-20260318-0035` (unique per lock-management protocol).
- Model pinned to `openai-codex/gpt-5.3-codex`.
- Scope includes icon block + double-click modal + cursor/zoom/measurement behaviors.

---
**Date/Time:** 2026-03-18 01:29 CET
**Task Executed:** P1-4 Scope Interactive Modal verified
**Files Modified/Created:** `src/simulation/blocks/scopeBlock.tsx`, `src/canvas/customBlockNode.tsx`, `TASK_QUEUE.md`, `CHANGELOG.md`
**Notes/Bugs:**
- Scope block now compact icon-style on canvas with double-click modal launch.
- Modal includes cursor/crosshair behavior, brush-based zoom, and measurement readout.
- Validation: `npm run lint` ✅, `npm run build` ✅.
- Proceeding to P1-5 Counter Refinement.

---
**Date/Time:** 2026-03-18 01:34 CET
**Task Executed:** P1-5 Counter Refinement verified (P1 COMPLETE)
**Files Modified/Created:** `app/page.tsx`, `src/canvas/customBlockNode.tsx`, `TASK_QUEUE.md`, `CHANGELOG.md`
**Notes/Bugs:**
- Counter node now hides live numeric value on canvas; acts as background source.
- Added Inspector editing for Counter Start/Step/Mode (desktop + mobile inspector paths).
- Inspector edits patch node data safely and feed existing graph->runtime synchronization.
- Validation re-run in main session: `npm run lint` ✅, `npm run build` ✅.
- All P1 tasks (P1-1..P1-5) complete and ready for commit/push.

---
**Date/Time:** 2026-03-18 09:12 CET
**Task Executed:** P2-1 Aesthetic Shift initiated and implemented
**Files Modified/Created:** `src/canvas/customBlockNode.tsx`, `app/page.tsx`, `TASK_QUEUE.md`, `CHANGELOG.md`
**Notes/Bugs:**
- Applied industrial palette: source blocks orange (#f97316), sink blocks light blue (#0ea5e9).
- Counter block redesigned to compact icon-only square ("123") with subtext removed.
- Updated library block styling to reflect source/sink color semantics.

---
**Date/Time:** 2026-03-18 09:15 CET
**Task Executed:** P2-2 Connectivity & interaction hardening
**Files Modified/Created:** `src/canvas/customBlockNode.tsx`, `src/canvas/edgeDefaults.ts`, `app/page.tsx`, `CHANGELOG.md`
**Notes/Bugs:**
- Enlarged connection handles and hover-scale feedback for easier latching.
- Increased edge interaction corridor (`interactionWidth`) for easier edge targeting.
- Added direct edge deletion path via existing Delete/Backspace flow and toolbar Delete action.

---
**Date/Time:** 2026-03-18 09:18 CET
**Task Executed:** P2-3 Scope modal oscilloscope overhaul
**Files Modified/Created:** `src/simulation/blocks/scopeBlock.tsx`, `CHANGELOG.md`
**Notes/Bugs:**
- Converted modal to solid-background standalone window style.
- Added resizable container behavior for desktop workflow.
- Added auto-scroll follow mode on X-axis with Brush zoom + "Follow latest" reset.
- Preserved double-click launch flow and measurement readout (cursor t/y).

---
**Date/Time:** 2026-03-18 09:20 CET
**Task Executed:** P2-4 Final validation and deployment
**Files Modified/Created:** `TASK_QUEUE.md`, `CHANGELOG.md`
**Notes/Bugs:**
- Validation gates passed in main session:
  - `npm run lint` ✅
  - `npm run build` ✅
- Ready for commit + push to `origin/master`.

---
**Date/Time:** 2026-03-19 03:40 CET
**Task Executed:** P3-1 Signal Routing Logic implemented and verified
**Files Modified/Created:**
- `src/simulation/blocks/gainBlock.ts` (new)
- `src/simulation/blocks/sumBlock.ts` (new)
- `src/simulation/blocks/productBlock.ts` (new)
- `src/simulation/engine.ts`
- `src/simulation/registry.ts`
- `src/canvas/customBlockNode.tsx`
- `app/page.tsx`
- `TASK_QUEUE.md`
- `CHANGELOG.md`
**Notes/Bugs:**
- Added deterministic math block family: **Gain**, **Sum**, **Product**.
- Upgraded engine input collection for multi-wire fan-in:
  - Stable incoming-edge sort for deterministic routing.
  - Duplicate target-handle preservation via synthetic keys (`<handle>__N`).
  - Backward compatibility retained for existing single-input blocks (`default`/`in`).
- Added library/canvas integration for new blocks:
  - Gain, Sum, Product appear in draggable library.
  - New nodes keep industrial sink-blue visual language.
  - Sum/Product expose dual input handles (`in1`, `in2`) for explicit multi-input composition.
  - Gain exposes input (`in`) and editable scalar parameter (`gain`) in Inspector.
- Validation gates passed:
  - `npm run lint` ✅
  - `npm run build` ✅

---
**Date/Time:** 2026-03-19 08:38 CET
**Task Executed:** P3-2 Signal Logging & Export implemented and verified
**Files Modified/Created:**
- `src/simulation/blocks/toFileBlock.ts` (new)
- `src/persistence/simulationRunStore.ts` (new)
- `src/simulation/registry.ts`
- `src/canvas/customBlockNode.tsx`
- `app/page.tsx`
- `TASK_QUEUE.md`
- `ARCHITECTURE.md`
- `CHANGELOG.md`
**Notes/Bugs:**
- Added **To File** sink block:
  - Captures deterministic per-tick numeric input snapshots keyed by handle.
  - Supports export formats: JSON / CSV.
  - Supports configurable `fileName` and `maxRows`.
- Added export payload serializers:
  - JSON serializer for structured sample history.
  - CSV serializer with dynamic handle columns.
- Added client-side IndexedDB persistence adapter:
  - DB `web-simulink`, store `simulationRunExports`.
  - Stores run payload, format, fileName, sampleCount, nodeId, timestamp.
- Added UI/Inspector integration:
  - Library includes **To File** block.
  - Inspector edits format/file name/max rows and can export latest run immediately.
  - Runtime completion auto-persists To File outputs to IndexedDB with duplicate-write guard.
- Validation gates passed:
  - `npm run lint` ✅
  - `npm run build` ✅

---
**Date/Time:** 2026-03-19 09:36 CET
**Task Executed:** P3-3 Integrator + Unit Delay foundation implemented and verified
**Files Modified/Created:**
- `src/simulation/blocks/integratorBlock.ts` (new)
- `src/simulation/blocks/unitDelayBlock.ts` (new)
- `src/simulation/types.ts`
- `src/simulation/topology.ts`
- `src/simulation/engine.ts`
- `src/simulation/registry.ts`
- `src/canvas/customBlockNode.tsx`
- `app/page.tsx`
- `TASK_QUEUE.md`
- `ARCHITECTURE.md`
- `CHANGELOG.md`
**Notes/Bugs:**
- Added Integrator and Unit Delay blocks with deterministic state-first output semantics.
- Added `breaksAlgebraicLoop` block metadata and scheduler feedback-edge relaxation support.
- Preserved hard failure for unsupported algebraic loops without memory elements.
- Added library/canvas/inspector support for new blocks while preserving industrial UI conventions.
- Validation gates passed:
  - `npm run lint` ✅
  - `npm run build` ✅

---
**Date/Time:** 2026-03-19 09:44 CET
**Task Executed:** P3-4 Graph validation + guardrails implemented and verified
**Files Modified/Created:**
- `src/simulation/validation.ts` (new)
- `src/store/simulationRuntimeStore.ts`
- `app/page.tsx`
- `TASK_QUEUE.md`
- `ARCHITECTURE.md`
- `CHANGELOG.md`
**Notes/Bugs:**
- Added pre-run graph validation gate integrated into `run()`.
- Added actionable diagnostics for unknown blocks, invalid endpoints/handles, unsupported cycles.
- Added runtime error surfacing in sidebar status panel.
- Validation gates passed:
  - `npm run lint` ✅
  - `npm run build` ✅

---
**Date/Time:** 2026-03-19 09:54 CET
**Task Executed:** P3-5 Model persistence v2 implemented and verified
**Files Modified/Created:**
- `src/persistence/modelPersistence.ts` (new)
- `app/page.tsx`
- `TASK_QUEUE.md`
- `ARCHITECTURE.md`
- `CHANGELOG.md`
**Notes/Bugs:**
- Added schema-versioned model document serializer/parser (`schemaVersion: 2`).
- Added legacy v1 migration support in parser.
- Added localStorage autosave + startup restore workflow.
- Added model export/import controls in desktop toolbar + sidebar.
- Validation gates passed:
  - `npm run lint` ✅
  - `npm run build` ✅

---
**Date/Time:** 2026-03-19 09:58 CET
**Task Executed:** P3-6 Final verification + deployment synchronization
**Files Modified/Created:**
- `TASK_QUEUE.md`
- `CHANGELOG.md`
**Notes/Bugs:**
- Final integrated validation after P3-3/P3-4/P3-5 stack:
  - `npm run lint` ✅
  - `npm run build` ✅
- Marked P3-6 complete and closed P3 phase in task queue.
- Repository prepared for final push synchronization.

---
**Date/Time:** 2026-03-21 00:38 CET
**Task Executed:** P4-1 Regression Safety Net implemented and verified
**Files Modified/Created:**
- `package.json` (updated scripts)
- `vitest.config.ts` (new)
- `src/simulation/__tests__/engine.determinism.test.ts` (new)
- `src/simulation/__tests__/validation.test.ts` (new)
- `src/persistence/__tests__/modelPersistence.test.ts` (new)
- `TASK_QUEUE.md`
- `CHANGELOG.md`
**Notes/Bugs:**
- Integrated Vitest as the primary test runner for deterministic engine and validation logic.
- Added comprehensive unit tests for:
  - Deterministic engine stepping with feedback loops (Unit Delay).
  - Pre-run graph validation (unknown blocks, invalid wiring, algebraic loops).
  - Model persistence v1 -> v2 migration and serialization round-trips.
- Verified all 10 tests pass consistently.
- Validation gates passed:
  - `npm run lint` ✅
  - `npm run build` ✅
  - `npm run test` ✅

---
**Date/Time:** 2026-03-21 03:35 CET
**Task Executed:** P4-2 Signal Type System v1 implemented and verified
**Files Modified/Created:**
- `src/simulation/types.ts`
- `src/simulation/validation.ts`
- `src/simulation/registry.ts`
- `src/simulation/blocks/compareBlock.ts` (new)
- `src/simulation/blocks/switchBlock.ts` (new)
- `src/simulation/blocks/*` (typed port metadata updates)
- `src/canvas/customBlockNode.tsx`
- `app/page.tsx`
- `src/simulation/__tests__/engine.determinism.test.ts`
- `src/simulation/__tests__/validation.test.ts`
- `TASK_QUEUE.md`
- `ARCHITECTURE.md`
- `CHANGELOG.md`
**Notes/Bugs:**
- Added typed signal domain and port metadata for validation/connection guardrails.
- Added Compare + Switch boolean-capable blocks.
- Added connection-time validation in canvas connect path.
- Added run-time validation for incompatible signal type wiring.
- Validation gates passed:
  - `npm run test` ✅
  - `npm run lint` ✅
  - `npm run build` ✅

---
**Date/Time:** 2026-03-21 04:30 CET
**Task Executed:** P4-3 Subsystem Block foundation (WIP)
**Files Modified/Created:**
- `src/simulation/blocks/subsystemBlock.ts` (new)
- `src/simulation/blocks/inportBlock.ts` (new)
- `src/simulation/blocks/outportBlock.ts` (new)
- `src/canvas/subsystemEditorModal.tsx` (new)
- `src/simulation/__tests__/subsystem.test.ts` (new)
**Notes/Bugs:**
- Initial implementation of hierarchical modeling foundation.
- Added Inport/Outport interface blocks for subsystem boundary definition.
- Added SubsystemBlock logic for recursive simulation engine invocation.
- Added preliminary subsystem editor modal (React Flow instance inside modal).
- Work in progress: verification and UI integration pending.

---
**Date/Time:** 2026-03-21 04:40 CET
**Task Executed:** P4-3 Subsystem Block completed and verified
**Files Modified/Created:**
- `src/simulation/blocks/subsystemBlock.ts`
- `src/simulation/blocks/inportBlock.ts`
- `src/simulation/blocks/outportBlock.ts`
- `src/canvas/subsystemEditorModal.tsx`
- `src/canvas/customBlockNode.tsx`
- `app/page.tsx`
- `src/simulation/registry.ts`
- `src/simulation/validation.ts`
- `src/simulation/__tests__/subsystem.test.ts`
**Notes/Bugs:**
- Completed subsystem hierarchical modeling v1 foundation.
- Added Inport/Outport subsystem boundary semantics and nested graph stepping.
- Added subsystem editor modal for internal block-diagram editing.
- Added recursive validation for internal subsystem graphs.
- Validation gates passed:
  - `npm run test` ✅
  - `npm run lint` ✅
  - `npm run build` ✅

---
**Date/Time:** 2026-03-21 04:41 CET
**Task Executed:** P4-4 Multi-Rate Scheduler v1 completed and verified
**Files Modified/Created:**
- `src/simulation/engine.ts`
- `src/simulation/validation.ts`
- `src/store/simulationRuntimeStore.ts`
- `app/page.tsx`
- `src/simulation/__tests__/engine.determinism.test.ts`
- `src/simulation/__tests__/validation.test.ts`
**Notes/Bugs:**
- Added per-node `sampleTimeMs` scheduling semantics in engine tick execution.
- Added validation rules for sample-time multiples and base-step compliance.
- Added inspector-level sample-time editing workflow.
- Validation gates passed:
  - `npm run test` ✅
  - `npm run lint` ✅
  - `npm run build` ✅

---
**Date/Time:** 2026-03-21 04:42 CET
**Task Executed:** P4-5 Performance + Observability hardening completed and verified
**Files Modified/Created:**
- `src/store/simulationRuntimeStore.ts`
- `src/simulation/blocks/scopeBlock.tsx`
- `app/page.tsx`
**Notes/Bugs:**
- Added runtime metrics telemetry (last/avg/peak step duration + estimated Hz).
- Surfaced metrics in sidebar diagnostics panel.
- Added scope decimation toggle for high-point-count rendering stabilization.
- Added rendered-point ratio feedback in scope modal.
- Validation gates passed:
  - `npm run test` ✅
  - `npm run lint` ✅
  - `npm run build` ✅

---
**Date/Time:** 2026-03-21 04:45 CET
**Task Executed:** P4-6 Final verification + deployment
**Files Modified/Created:**
- `TASK_QUEUE.md`
- `CHANGELOG.md`
**Notes/Bugs:**
- Final integrated validation across P4 stack (P4-1 to P4-5):
  - `npm run test` ✅ (16 tests passing)
  - `npm run lint` ✅
  - `npm run build` ✅
- Marked P4 phase as complete.
- Ready for final repository synchronization.

---
**Date/Time:** 2026-03-21 14:33 CET
**Task Executed:** P5 phase kickoff + priority queue formalization
**Files Modified/Created:**
- `TASK_QUEUE.md`
- `CHANGELOG.md`
**Notes/Bugs:**
- Confirmed repository is clean and synchronized to `origin/master` before kickoff.
- Initialized P5 workstream with six milestone priorities:
  - P5-1 Deterministic conformance expansion (nested + multi-rate + typed stress tests)
  - P5-2 Subsystem UX v2 (I/O mapping guardrails + editor ergonomics)
  - P5-3 Vector signal system v1 (vector ports + Mux/Demux)
  - P5-4 Runtime trace & debug panel
  - P5-5 Persistence v3 + migration path
  - P5-6 Final verification + deployment
- Marked P5-1 as active `[IN PROGRESS]` for immediate Codex execution continuity.

---
**Date/Time:** 2026-03-21 14:32 CET
**Task Executed:** P5-1 deterministic conformance expansion completed and verified
**Files Modified/Created:**
- `src/simulation/__tests__/subsystem.test.ts`
- `src/simulation/__tests__/validation.test.ts`
- `TASK_QUEUE.md`
- `CHANGELOG.md`
**Notes/Bugs:**
- Added deterministic conformance coverage for subsystem + multi-rate hold behavior.
- Added recursive validation coverage for invalid sample-time constraints inside nested subsystem graphs.
- Test suite expanded from 16 to 18 passing tests.
- Advanced queue state to P5-2 `[IN PROGRESS]`.
- Validation gates passed:
  - `npm run test` ✅
  - `npm run lint` ✅
  - `npm run build` ✅

---
**Date/Time:** 2026-03-21 14:38 CET
**Task Executed:** P5-2 Subsystem UX v2 (phase-1 guardrails + ergonomics)
**Files Modified/Created:**
- `src/canvas/subsystemEditorModal.tsx`
- `src/simulation/validation.ts`
- `src/simulation/__tests__/validation.test.ts`
- `CHANGELOG.md`
**Notes/Bugs:**
- Added subsystem editor save-time guardrails for interface quality:
  - Reject empty Inport/Outport labels.
  - Reject duplicate Inport/Outport labels (case-insensitive).
- Added editor ergonomics:
  - Auto-sequential labels when creating Inport/Outport nodes (`in1`, `in2`, `out1`, ...).
  - Added `Normalize I/O Labels` action for fast deterministic relabeling.
  - Added inline issue banner when save is blocked by interface validation problems.
- Added recursive graph-validation rule `INVALID_SUBSYSTEM_INTERFACE` for subsystem interface conflicts.
- Added regression test coverage for duplicate subsystem interface labels.
- Validation gates passed:
  - `npm run test` ✅ (19 tests)
  - `npm run lint` ✅
  - `npm run build` ✅

---
**Date/Time:** 2026-03-21 14:42 CET
**Task Executed:** P5-2 Subsystem UX v2 completed and verified
**Files Modified/Created:**
- `src/simulation/blocks/subsystemBlock.ts`
- `src/canvas/subsystemEditorModal.tsx`
- `src/simulation/validation.ts`
- `src/simulation/__tests__/subsystem.test.ts`
- `src/simulation/__tests__/validation.test.ts`
- `ARCHITECTURE.md`
- `TASK_QUEUE.md`
- `CHANGELOG.md`
**Notes/Bugs:**
- Completed subsystem UX v2 with deterministic I/O mapping + editor ergonomics.
- Refined Subsystem block I/O mapping:
  - stable deterministic interface-node traversal
  - normalized Inport label -> external input lookup with fallback routing
  - Outport labels now exposed as source-handle addressable outputs in parent graph
- Expanded editor ergonomics and safety:
  - quick-add Inport/Outport controls
  - interface summary with per-port connection count
  - save-time enforcement for empty/duplicate interface labels
  - normalization action for sequential I/O relabeling
- Expanded test suite to cover named subsystem handle mapping and additional interface validation.
- Validation gates passed:
  - `npm run test` ✅ (21 tests)
  - `npm run lint` ✅
  - `npm run build` ✅
- Advanced queue to P5-3 `[IN PROGRESS]`.
