# P4_PLAN.md — Web-Simulink Iteration 4 Execution Plan

## Iteration Name
**P4: Hierarchical Modeling, Multi-Rate Runtime, and Production Hardening**

## Objective
Build on the completed P3 foundation by introducing **subsystems**, **multi-rate simulation support**, and a stronger **quality/reliability envelope** suitable for larger industrial models while preserving P1/P2 interaction quality and styling.

## Constraints (Carry-Forward)
- Keep existing P1/P2 UX stable (industrial palette, straight edges, touch-first behavior).
- Preserve deterministic simulation behavior.
- One active worker/session per repository at a time (lock-prevention protocol).
- Keep high-density technical comments in engine, block interfaces, and state management.
- Validate with `npm run lint` and `npm run build` at every milestone.

---

## P4 Work Breakdown

### P4-1 — Regression Safety Net (Engine + Canvas)
**Scope**
- Add deterministic tests for engine stepping and cycle handling.
- Add schema/validation tests for model import/export (v2 + v1 migration).
- Add minimal UI smoke tests for core flows (add block, connect, run, delete, export).

**Deliverables**
- Test harness under `src/simulation/__tests__` and persistence tests for model/To File paths.
- Test scripts in package configuration (non-blocking for dev, blocking in CI/release gate).

**Acceptance Criteria**
- Deterministic engine scenarios pass consistently (same outputs for same graph + timing).
- Validation failures are covered by tests (unknown block, invalid handles, unsupported cycles).
- Model persistence round-trip tests pass (export -> parse -> import).

**Validation Gate**
- `npm run lint` ✅
- `npm run build` ✅
- `npm run test` (or equivalent added script) ✅

---

### P4-2 — Signal Type System v1 (Number/Boolean)
**Scope**
- Introduce explicit signal typing metadata at block ports.
- Add connection-time and run-time type checks.
- Support two initial signal domains: `number` and `boolean`.

**Deliverables**
- Port type descriptors in block definitions.
- Validation extension for incompatible wire connections.
- Initial boolean-capable blocks (e.g., Compare, Switch) with typed ports.

**Acceptance Criteria**
- Invalid connections (e.g., boolean -> numeric-only port) are blocked with clear diagnostics.
- Existing numeric-only P0–P3 models continue to run unchanged.
- Type mismatch errors appear in runtime/UI status panel with actionable wording.

**Validation Gate**
- `npm run lint` ✅
- `npm run build` ✅
- Typed-connection test matrix ✅

---

### P4-3 — Subsystem Block (Hierarchical Modeling v1)
**Scope**
- Add a Subsystem block supporting nested node/edge graphs.
- Implement open/edit flow for subsystem internals.
- Introduce Inport/Outport mapping between parent and child graph.

**Deliverables**
- Subsystem model schema extension (nested graphs).
- Editor navigation between root canvas and subsystem canvas.
- Parent-child signal mapping and deterministic execution order.

**Acceptance Criteria**
- User can create a subsystem, move internal blocks into it, and run end-to-end simulation.
- Subsystem outputs are reproducible and match equivalent flattened graph behavior.
- Model export/import preserves subsystem hierarchy and wiring.

**Validation Gate**
- `npm run lint` ✅
- `npm run build` ✅
- Subsystem round-trip + execution parity tests ✅

---

### P4-4 — Multi-Rate Scheduler v1
**Scope**
- Add per-block sample time (`Ts`) with base-rate coordination.
- Execute eligible nodes only on scheduled ticks.
- Preserve deterministic behavior and existing single-rate compatibility.

**Deliverables**
- Scheduler enhancements for multi-rate tick eligibility.
- Runtime diagnostics for invalid sample-time configs.
- Inspector support for per-block `Ts` editing where applicable.

**Acceptance Criteria**
- Mixed-rate models execute as expected (fast/slow blocks update on correct ticks).
- Single-rate legacy models maintain identical behavior to pre-P4 runtime.
- Validation catches non-integer rate relationships (for v1 constraints).

**Validation Gate**
- `npm run lint` ✅
- `npm run build` ✅
- Multi-rate deterministic test vectors ✅

---

### P4-5 — Performance + Observability Hardening
**Scope**
- Add runtime instrumentation (step duration, dropped frames, queue lag).
- Add optional scope decimation/render throttling controls for large data streams.
- Improve large-model canvas responsiveness (memoization/selective updates).

**Deliverables**
- Lightweight performance panel or diagnostics section.
- Scope render policy controls for high-frequency runs.
- Documented performance tuning knobs and defaults.

**Acceptance Criteria**
- Large model interactions remain usable on target devices.
- Scope remains responsive under high sample density with bounded memory usage.
- Instrumentation can identify bottlenecks during test runs.

**Validation Gate**
- `npm run lint` ✅
- `npm run build` ✅
- Performance smoke scenarios recorded in changelog ✅

---

### P4-6 — Final Stabilization, Documentation, and Release Push
**Scope**
- Consolidate all P4 docs and queue/changelog updates.
- Run full integrated verification.
- Push release-quality P4 branch state to `origin/master`.

**Deliverables**
- Updated `ARCHITECTURE.md`, `TASK_QUEUE.md`, `CHANGELOG.md`.
- Final P4 verification summary with known limitations and next-phase recommendations.

**Acceptance Criteria**
- No lint/build errors.
- All P4 acceptance criteria marked complete.
- Repo is clean, commits are structured by milestone, and remote is up to date.

**Validation Gate**
- `npm run lint` ✅
- `npm run build` ✅
- Final integrated scenario checklist ✅
- Push to `origin/master` ✅

---

## Release/Commit Strategy (P4)
- Commit after each major task milestone (P4-1, P4-2, …).
- Push after each major milestone or at latest on P4-6 completion.
- Commit messages follow format:
  - `P4-1: ...`
  - `P4-2: ...`
  - etc.

## Risks & Mitigations
- **Risk:** Subsystem + multi-rate complexity destabilizes runtime.
  - **Mitigation:** deliver in strict sequence (tests first, then typing, then hierarchy, then multi-rate).
- **Risk:** UI regression from expanded features.
  - **Mitigation:** preserve P1/P2 styling contracts and add UI smoke checks in P4-1.
- **Risk:** Session lock/retry delays during long runs.
  - **Mitigation:** serialized execution, bounded task scope, milestone pushes.

## Proposed Start Order
1. P4-1 Regression Safety Net
2. P4-2 Signal Type System
3. P4-3 Subsystem Block
4. P4-4 Multi-Rate Scheduler
5. P4-5 Performance Hardening
6. P4-6 Final Stabilization + Push
