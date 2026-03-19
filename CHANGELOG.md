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

-----
**Date/Time:** 2026-03-17 23:16 CET
**Task Executed:** Delegated P0-5 Canvas + mobile interaction
**Files Modified/Created:** `CHANGELOG.md`
**Notes/Bugs:**
- Sub-agent tasked with React Flow canvas integration, touch usability, and mobile UI components.
- Straight-edge requirement enforced via `src/canvas/edgeDefaults.ts`.
- Switched back to `gpt-5.3-codex` per PO preference.

-----
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

-----
**Date/Time:** 2026-03-17 23:28 CET
**Task Executed:** Delegated P0-6 End-to-end Counter demo + validation
**Files Modified/Created:** `CHANGELOG.md`
**Notes/Bugs:**
- Sub-agent tasked with implementing custom React Flow nodes for Counter, Display, and Scope.
- Establishing default model wiring on load.
- Integrating runtime store outputs with UI components for real-time visualization.

-----
**Date/Time:** 2026-03-17 23:45 CET
**Task Executed:** P0-6 End-to-end Counter demo + validation verified (P0 COMPLETE)
**Files Modified/Created:** `TASK_QUEUE.md`, `CHANGELOG.md`
**Notes/Bugs:**
- Verified custom node implementation and real-time visual updates.
- Confirmed default model wiring (Counter -> Display + Scope) on application load.
- Final validation in main session: `npm run lint` ✅, `npm run build` ✅.
- **P0 PHASE COMPLETE.** The prototype is functional, documented, and mobile-reactive.

-----
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

-----
**Date/Time:** 2026-03-18 00:26 CET
**Task Executed:** Delegated P1-2 Advanced Simulation Controls
**Files Modified/Created:** `CHANGELOG.md`
**Notes/Bugs:**
- Sub-agent label: `web-simulink-p1-2-controls-20260318-0026` (unique per lock-management protocol).
- Model pinned to `openai-codex/gpt-5.3-codex`.
- Scope: Stop Time + Step Time toolbar controls, runtime store binding, speed behavior verification.

-----
**Date/Time:** 2026-03-18 00:31 CET
**Task Executed:** P1-2 Advanced Simulation Controls verified
**Files Modified/Created:** `app/page.tsx`, `src/store/simulationRuntimeStore.ts`, `TASK_QUEUE.md`, `CHANGELOG.md`
**Notes/Bugs:**
- Added Stop Time + Step Time inputs for desktop/mobile toolbar.
- Bound UI controls to runtime timing via `setTiming` (seconds↔milliseconds conversion).
- Updated runtime timing policy to safely restart scheduler on timing edits during run.
- Validation: `npm run lint` ✅, `npm run build` ✅.
- Proceeding to P1-3 Matlab Aesthetics & Grid.

-----
**Date/Time:** 2026-03-18 00:32 CET
**Task Executed:** Delegated P1-3 Matlab Aesthetics & Grid
**Files Modified/Created:** `CHANGELOG.md`
**Notes/Bugs:**
- Sub-agent label: `web-simulink-p1-3-aesthetic-grid-20260318-0032` (unique per lock-management protocol).
- Model pinned to `openai-codex/gpt-5.3-codex`.
- Scope: Simulink light-gray dot-grid canvas + 3D white block styling while preserving straight edges.

-----
**Date/Time:** 2026-03-18 00:34 CET
**Task Executed:** P1-3 Matlab Aesthetics & Grid verified
**Files Modified/Created:** `app/page.tsx`, `src/canvas/customBlockNode.tsx`, `TASK_QUEUE.md`, `CHANGELOG.md`
**Notes/Bugs:**
- Applied Simulink-like light-gray canvas with persistent dot grid.
- Upgraded block appearance to white 3D-style visuals with refined typography.
- Hardened straight-edge policy for initial and newly created edges.
- Validation: `npm run lint` ✅, `npm run build` ✅.
- Proceeding to P1-4 Scope Interactive Modal.

-----
**Date/Time:** 2026-03-18 00:35 CET
**Task Executed:** Delegated P1-4 Scope Interactive Modal
**Files Modified/Created:** `CHANGELOG.md`
**Notes/Bugs:**
- Sub-agent label: `web-simulink-p1-4-scope-modal-20260318-0035` (unique per lock-management protocol).
- Model pinned to `openai-codex/gpt-5.3-codex`.
- Scope includes icon block + double-click modal + cursor/zoom/measurement behaviors.

-----
**Date/Time:** 2026-03-18 01:29 CET
**Task Executed:** P1-4 Scope Interactive Modal verified
**Files Modified/Created:** `src/simulation/blocks/scopeBlock.tsx`, `src/canvas/customBlockNode.tsx`, `TASK_QUEUE.md`, `CHANGELOG.md`
**Notes/Bugs:**
- Scope block now compact icon-style on canvas with double-click modal launch.
- Modal includes cursor/crosshair behavior, brush-based zoom, and measurement readout.
- Validation: `npm run lint` ✅, `npm run build` ✅.
- Proceeding to P1-5 Counter Refinement.

-----
**Date/Time:** 2026-03-18 01:30 CET
**Task Executed:** Delegated P1-5 Counter Refinement
**Files Modified/Created:** `CHANGELOG.md`
**Notes/Bugs:**
- Sub-agent label: `web-simulink-p1-5-counter-refinement-20260318-0130` (unique per lock-management protocol).
- Model pinned to `openai-codex/gpt-5.3-codex`.
- Scope: hide counter value on canvas + Inspector editing for Start/Step/Mode.

-----
**Date/Time:** 2026-03-18 01:34 CET
**Task Executed:** P1-5 Counter Refinement verified (P1 COMPLETE)
**Files Modified/Created:** `app/page.tsx`, `src/canvas/customBlockNode.tsx`, `TASK_QUEUE.md`, `CHANGELOG.md`
**Notes/Bugs:**
- Counter node now hides live numeric value on canvas; acts as background source.
- Added Inspector editing for Counter Start/Step/Mode (desktop + mobile inspector paths).
- Inspector edits patch node data safely and feed existing graph->runtime synchronization.
- Validation re-run in main session: `npm run lint` ✅, `npm run build` ✅.
- All P1 tasks (P1-1..P1-5) complete and ready for commit/push.

-----
**Date/Time:** 2026-03-18 09:12 CET
**Task Executed:** P2-1 Aesthetic Shift initiated and implemented
**Files Modified/Created:** `src/canvas/customBlockNode.tsx`, `app/page.tsx`, `TASK_QUEUE.md`, `CHANGELOG.md`
**Notes/Bugs:**
- Applied industrial palette: source blocks orange (#f97316), sink blocks light blue (#0ea5e9).
- Counter block redesigned to compact icon-only square ("123") with subtext removed.
- Updated library block styling to reflect source/sink color semantics.

-----
**Date/Time:** 2026-03-18 09:15 CET
**Task Executed:** P2-2 Connectivity & interaction hardening
**Files Modified/Created:** `src/canvas/customBlockNode.tsx`, `src/canvas/edgeDefaults.ts`, `app/page.tsx`, `CHANGELOG.md`
**Notes/Bugs:**
- Enlarged connection handles and hover-scale feedback for easier latching.
- Increased edge interaction corridor (`interactionWidth`) for easier edge targeting.
- Added direct edge deletion path via existing Delete/Backspace flow and toolbar Delete action.

-----
**Date/Time:** 2026-03-18 09:18 CET
**Task Executed:** P2-3 Scope modal oscilloscope overhaul
**Files Modified/Created:** `src/simulation/blocks/scopeBlock.tsx`, `CHANGELOG.md`
**Notes/Bugs:**
- Converted modal to solid-background standalone window style.
- Added resizable container behavior for desktop workflow.
- Added auto-scroll follow mode on X-axis with Brush zoom + "Follow latest" reset.
- Preserved double-click launch flow and measurement readout (cursor t/y).

-----
**Date/Time:** 2026-03-18 09:20 CET
**Task Executed:** P2-4 Final validation and deployment
**Files Modified/Created:** `TASK_QUEUE.md`, `CHANGELOG.md`
**Notes/Bugs:**
- Validation gates passed in main session:
  - `npm run lint` ✅
  - `npm run build` ✅
- Ready for commit + push to `origin/master`.

-----
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

-----
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
