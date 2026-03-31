# ARCHITECTURE.md — Mobile-Reactive Simulink Web Environment

## 1) Project Objective
Build a web-based block-diagram simulation platform (Simulink-like) optimized for mobile responsiveness.

### First Functional Use Case (P0)
A runnable **Counter model** with:
- Adjustable **Simulation Time**
- Adjustable **Step Time**
- **Counter** block (increment/decrement logic)
- **Display** block (real-time numeric value)
- **Scope** block (time-series graph)

---

## 2) Recommended Tech Stack
- **Framework:** Next.js 15 + TypeScript
- **UI:** React + Tailwind CSS (mobile-first)
- **Block Canvas:** React Flow (touch-friendly node/edge editing)
- **State Management:** Zustand (graph state + simulation runtime state)
- **Charting (Scope):** Recharts (lightweight, mobile-friendly)
- **Validation:** Zod (graph/model schema validation)

Rationale:
- Next.js provides fast iteration and deploy flexibility.
- React Flow accelerates node-based editor development.
- Zustand keeps simulation and canvas state predictable without heavy boilerplate.

---

## 3) System Architecture

### A. Presentation Layer (Mobile-first)
- `CanvasView` (React Flow) for block placement and wiring
- `SimulationToolbar` for Run/Pause/Reset + time controls
- `InspectorPanel` for selected block parameters
- Responsive layout:
  - Mobile: bottom-sheet inspector + compact toolbar
  - Desktop: sidebar inspector + full toolbar

### B. Simulation Runtime Layer
- Discrete-time scheduler:
  - Inputs: `stepTimeMs`, `simulationTimeMs`
  - Loop: fixed-step tick progression
- Execution model:
  - Topological evaluation per tick (for acyclic graph)
  - Value propagation through edges
- Runtime controls:
  - `idle` | `running` | `paused` | `completed`

### C. Block Plugin Layer
Each block implements a common interface:
- `id`, `type`, `inputs`, `outputs`, `params`
- `initialize(state)`
- `step(context): output`

P0 block specs:
1. **CounterBlock**
   - Params: `start`, `step`, `mode` (`inc` | `dec`)
   - Output: numeric current value
2. **DisplayBlock**
   - Input: numeric signal
   - UI render: live value card
3. **ScopeBlock**
   - Input: numeric signal
   - Buffer: time-series array with windowing for performance
   - UI render: line chart

### D. Model Persistence (P0 minimal)
- In-memory model state + optional localStorage autosave
- JSON model schema for future import/export

---

## 4) Data & Execution Model
- Graph = `{ nodes, edges }`
- Runtime state = `{ time, tick, nodeOutputs, scopeBuffers, status }`
- Tick semantics:
  1. Resolve execution order
  2. Evaluate each node
  3. Propagate outputs
  4. Update UI subscribers

Constraints for P0:
- Support acyclic graphs only
- Single-rate simulation only

---

## 5) Non-Functional Requirements
- Smooth touch interactions on mobile (drag, pan, zoom)
- Deterministic tick behavior for repeatable outputs
- Scope rendering stable at small step times (throttled chart updates)
- Clear error handling for invalid wiring

---

## 6) P0 Acceptance Criteria
- User can place/connect Counter → Display and Counter → Scope
- User can set Simulation Time and Step Time
- Simulation runs and updates Display + Scope in real time
- Works on mobile viewport with touch-friendly controls
- No blocking runtime errors under normal P0 flow

---

## 7) Risks & Mitigations
- **Risk:** UI jank at high-frequency ticks
  - **Mitigation:** decouple internal tick rate from chart repaint rate
- **Risk:** Inconsistent execution order
  - **Mitigation:** deterministic topological sort + model validation
- **Risk:** Mobile usability regression
  - **Mitigation:** explicit mobile interaction testing for each P0 milestone

---

## 8) Post-P0 Expansion Path
- Additional blocks (Gain, Sum, Integrator, Logic)
- Multi-rate simulation
- Cycle handling with delay/memory blocks
- Model import/export and collaboration features

## Concurrency & Lock Management (Internal Directive)
- **Session Locking:** The 'session file locked' error occurs when a message is sent to a session that is already processing a turn.
- **Inter-Agent Protocol:** When the Router (Anton) messages Matrix while Matrix is waiting on a long-running sub-agent or Codex turn, a lock conflict occurs.
- **Mitigation:**
  1. Matrix must ensure sub-agents are spawned in isolated sessions (unique labels).
  2. Matrix should use asynchronous patterns where possible.
  3. If a model (Codex) times out, Matrix must acknowledge that the session lock may persist for several seconds and avoid immediate self-retries that could collide.
  4. The Router (Anton) will implement a "Check-Busy" protocol before messaging Matrix.

## Iteration 1: The "Simulink Copycat" Refinement (P1)

### 1) Aesthetics (Matlab Style)
- **Background:** Classic light gray canvas with dot grid.
- **Blocks:** 3D-effect shadow borders, white backgrounds, and block-specific labeling/icons that mimic the 2024 Matlab Simulink look.

### 2) Editor Interactivity
- **Block Library:** A draggable sidebar containing the three basic blocks (Counter, Display, Scope).
- **CRUD Operations:** Full support for dragging blocks onto the canvas, deleting selected blocks, and manual wiring.
- **Straight Edges:** Enforce straight-line connections for all wires.

### 3) Simulation Controls
- **Toolbar Parameters:** Numeric inputs for 'Simulation Time' and 'Step Time' directly in the top bar.
- **Speed Control:** Ability to change simulation parameters mid-run or before starting.

### 4) Functional Refinements
- **Counter:** Hide internal value; logic runs in background.
- **Scope (Interactive Modal):** The block on the canvas is a simple icon. Double-click opens a high-fidelity modal window with interactive charting (zoom, pan, cursors, measurement tools).


## Iteration 2: UI/UX Precision & Industrial Refinement (P2)

### 1) Aesthetic Overhaul (Color & Iconography)
- **Palette Shift:** Migrate block colors to an industrial palette: **Orange (#f97316)** for sources (Counter) and **Light Blue (#0ea5e9)** for sinks/processing.
- **Iconic Blocks:** Replace text-heavy blocks with compact, icon-only representations. The Counter block should be a small square with a "123" or "Σ" icon.

### 2) Interaction & Connectivity
- **Enhanced Handles:** Increase the visual and hit-box size of connection dots (handles). Implement a hover scale-up effect to ensure easy "latching" for users.
- **Edge Deletion:** Explicitly enable the selection and deletion of connection lines (edges).

### 3) Scope Modal (The "Oscilloscope" Window)
- **Visuals:** Solid, high-contrast background (no transparency).
- **Responsive Window:** Resizable/adaptive modal container that feels like a standalone window.
- **Real-time Following:** Implement "Auto-scroll" logic on the X-axis (time) so the graph follows the latest data point once the buffer exceeds the visible window.


## Iteration 3: Advanced Signal Routing (P3)

### 1) Math Block Family
- Added deterministic scalar math operators:
  - **Gain** (`y = k * u`)
  - **Sum** (`y = Σu_i`)
  - **Product** (`y = Πu_i`)
- Output convention remains `default` for compatibility with existing wiring and sink blocks.

### 2) Multi-Input Routing Contract (Engine)
- Input collection for each node now:
  1. Filters incoming edges by target node.
  2. Sorts by `(targetHandle, sourceId, sourceHandle, edgeId)` for deterministic ordering.
  3. Preserves duplicate fan-in to the same target handle by key synthesis:
     - First value keeps the base key (`in1`, `default`, ...)
     - Additional values become `<base>__2`, `<base>__3`, ...
- This prevents silent overwrites in fan-in topologies and enables robust multi-signal blocks.

### 3) Canvas Integration & UX
- Library now includes Gain/Sum/Product entries.
- Sum/Product nodes expose two explicit left-side input handles (`in1`, `in2`) and one right-side output handle (`default`).
- Gain exposes one left-side input handle (`in`) and one right-side output handle (`default`).
- Industrial visual language retained:
  - Counter remains source orange (#f97316)
  - Routing/processing/sink nodes remain sink blue (#0ea5e9)

### 4) Signal Logging & Export Contract (P3-2)
- Added **To File** sink block with deterministic sample buffering in node-local runtime state.
- Supported export encodings:
  - **JSON**: structured tick/time/value-handle payload.
  - **CSV**: tabular header (`tick,timeMs,<handle...>`) for spreadsheet workflows.
- Kept simulation engine pure:
  - No file or IndexedDB side effects inside `step()`.
  - Export/persistence is orchestrated by client UI after run completion.

### 5) Persistent Run Archive (IndexedDB)
- Browser persistence adapter stores run exports in IndexedDB object store:
  - DB: `web-simulink`
  - Store: `simulationRunExports`
  - Indexed field: `createdAtMs`
- Persist-on-complete policy:
  - On transition to completed runtime state, each To File node writes one archival record.
  - Duplicate completion writes are guarded by a completion signature (`tick:timeMs`).
- Inspector supports ad-hoc immediate download of latest captured run for selected To File node.

### 6) Integrator + Unit Delay (P3-3 cycle-safe foundation)
- Added stateful feedback blocks:
  - **Integrator** (forward-Euler discrete accumulator)
  - **Unit Delay** (`z^-1` memory element)
- Extended block-definition contract with `breaksAlgebraicLoop` metadata.
- Scheduler now computes topological order with feedback-edge relaxation:
  - Outgoing edges from loop-breaking blocks are excluded from same-tick dependency indegree.
  - Enables deterministic execution of feedback models that include memory/delay elements.
- Unsupported pure algebraic cycles still fail fast with actionable guidance.

### 7) Graph Validation Gate (P3-4)
- Added pre-run validation pass before scheduler activation.
- Guardrails now detect and report:
  - Unknown block types
  - Invalid edge endpoints (missing source/target)
  - Invalid source/target handle usage
  - Illegal wiring into blocks without input ports
  - Unsupported algebraic cycles
- Validation errors are surfaced in runtime status UI as actionable diagnostics.

### 8) Model Persistence v2 (P3-5)
- Added schema-versioned model document pipeline (`schemaVersion: 2`).
- Persisted payload includes:
  - Node set (`id`, `type`, `position`, `data`)
  - Edge set (`id`, endpoints, handles, edge type)
  - Timing (`simulationTimeMs`, `stepTimeMs`)
  - Metadata (`app`, `savedAtMs`)
- Added compatibility migration path for legacy v1 model shape.
- Added local autosave/load path using browser `localStorage` for model continuity between sessions.
- Added user-triggered export/import controls in UI without altering runtime determinism.


### 9) Signal Type System v1 (P4-2)
- Extended core signal domain to include `number | boolean | null`.
- Added typed port metadata (`inputPortTypes`, `outputPortTypes`) to block definitions.
- Added boolean processing blocks:
  - **Compare** (numeric comparison -> boolean output)
  - **Switch** (boolean condition selects numeric branch)
- Added connection-time and run-time type guardrails via graph validation:
  - invalid handle/source checks
  - incompatible signal type checks (e.g., number -> boolean `cond`)
- Preserved compatibility for existing numeric P0-P3 models.


### 10) Subsystem Block (P4-3)
- Added hierarchical modeling foundation via a new **Subsystem** block.
- Added internal interface primitives:
  - **Inport** block (inject external subsystem inputs into nested graph)
  - **Outport** block (export nested graph outputs back to parent graph)
- Added subsystem editor modal:
  - dedicated React Flow canvas for nested graph editing
  - internal block library includes Inport/Outport and processing blocks
- Added recursive validation path for nested subsystem graphs.
- Added deterministic subsystem execution test coverage.

### 11) Multi-Rate Scheduler v1 (P4-4)
- Added per-node sample-time support (`sampleTimeMs` node param).
- Engine now evaluates each node only on eligible ticks:
  - node steps at `tick % (sampleTimeMs / baseStepTimeMs) === 0`
  - unstepped nodes retain previous outputs/state for deterministic hold behavior
- Added validation guardrails for sample-time contracts:
  - `sampleTimeMs` must be positive
  - `sampleTimeMs` must be `>=` base step
  - `sampleTimeMs` must be an integer multiple of base step
- Added inspector controls for node-level sample-time configuration.

### 12) Performance + Observability Hardening (P4-5)
- Added runtime performance metrics in store:
  - last-step duration
  - average-step duration
  - peak-step duration
  - estimated step rate (Hz)
- Exposed metrics in sidebar diagnostics for operator visibility.
- Added scope render decimation mode:
  - optional point decimation for high-density traces
  - rendered-point ratio telemetry shown in modal footer
- Preserved deterministic engine semantics while improving UI scalability for dense runs.

### 13) Deterministic Conformance Expansion (P5-1)
- Extended deterministic regression coverage across nested + multi-rate interactions.
- Added subsystem multi-rate hold-behavior tests to protect scheduler + hierarchy composition semantics.
- Added recursive validation tests for nested sample-time violations.

### 14) Subsystem UX v2 (P5-2)
- Added subsystem interface quality guardrails (editor + validator):
  - empty Inport/Outport labels are rejected
  - duplicate labels are rejected case-insensitively
- Added deterministic subsystem I/O mapping refinements:
  - stable sorted interface traversal by node id
  - normalized label mapping for Inport input resolution
  - Outport labels exposed as addressable source handles for parent graph wiring
- Added subsystem editor ergonomics:
  - quick-add buttons for Inport/Outport
  - auto-sequential default labels (`in1`, `in2`, `out1`, ...)
  - one-click normalization of I/O labels
  - interface summary panel with connection counts

### 15) Vector Signal System v1 (P5-3)
- Extended signal type lattice with `vector` domain support.
- Extended runtime signal payload with vector values (`number[]`) while preserving scalar/boolean compatibility.
- Added vector-processing blocks:
  - **Mux**: combines scalar channels into vector output (`[in1, in2]`)
  - **Demux**: splits vector input into scalar outputs (`out1`, `out2`)
- Added typed-wire compatibility guardrails for vector domain:
  - vector-to-number direct wiring now fails validation
  - vector-to-vector wiring accepted (`Mux -> Demux`)
- Added canvas + subsystem-editor integration for Mux/Demux block instantiation and wiring.


### 16) Runtime Trace & Debug Panel (P5-4)
- Added tick-level execution instrumentation in the Zustand runtime store.
- Introduced `RuntimeTraceEvent` to capture tick index, simulation time, execution duration, and status notes.
- Added sidebar summary for rapid "pulse" monitoring of the engine.
- Implemented a full-fidelity "Simulation Trace" modal providing a tabular historical view of all engine events (last 120 ticks).

### 17) Model Persistence v3 (P5-5)
- Upgraded model schema to version 3 to include enhanced metadata (model name, description).
- Implemented a robust migration layer that transparently promotes v1 and v2 models to v3 on load.
- Added localStorage cross-key fallback to ensure seamless user transition between schema generations.

### 18) Advanced Control & Discrete Modeling (P6)
- Added closed-loop control and discrete filter primitives:
  - **PID** with anti-windup clamping and derivative filter coefficient `N`
  - **Discrete Transfer Fcn** via deterministic difference-equation stepping
  - **Lead/Lag** with Tustin discretization and static-gain fallback
- Added subsystem mask contracts for multi-I/O parameterized interfaces:
  - `mask.inputs`, `mask.outputs`, `mask.parameters`
  - dynamic handle rendering + validation for masked alias wiring
  - nested block parameter substitution via `$parameterName`
- Added global signal bus blocks:
  - **GOTO/FROM** with deterministic same-tick ordering via virtual execution dependencies
- Added lookup tables:
  - **LUT 1D** linear interpolation + clamp
  - **LUT 2D** bilinear interpolation + clamp
- Regression safety maintained through expanded deterministic test suite.

### 19) Iteration 7 Roadmap — Logic State Machines + Code Generation (P7)

#### 19.1 State-Oriented Modeling Layer
- Introduce **State Machine Block v1** with explicit state set, transition list, guard predicates, and transition actions.
- Deterministic contract:
  - one transition firing policy per tick/event step,
  - stable transition priority resolution,
  - reproducible state entry/exit action ordering.

#### 19.2 Temporal/Event Semantics
- Add deterministic event queue and temporal operators:
  - edge events (`rising`, `falling`),
  - time-qualified triggers (`after(t)`),
  - optional event broadcast scope controls.
- Ensure compatibility with multi-rate base scheduler without introducing non-deterministic races.

#### 19.3 Logic Table Authoring
- Add **Truth Table / Logic Table** block for combinational decision models.
- Support explicit boolean input mapping, row priority, and default/fallback rows.
- Integrate with existing typed-signal validation (`number|boolean|vector`) and subsystem nesting.

#### 19.4 Code Generation Path (C subset)
- Add graph-lowering pass to a typed intermediate representation (IR).
- Add **C backend v1** for a deterministic executable subset:
  - arithmetic, compare/switch, delays, PID/discrete primitives, LUTs,
  - state machine step function emission.
- Emit build-ready artifact package (`.c/.h`, model metadata, checksum).

#### 19.5 SIL Equivalence + Verification
- Add Software-in-the-Loop harness comparing runtime trace vs generated C trace.
- Define acceptance thresholds for numeric tolerance and exact match domains.
- Keep release gate unchanged: `npm run test`, `npm run lint`, `npm run build` + SIL equivalence pass for generated models.

### 20) Iteration 8 Roadmap — Codegen Fidelity & Verification Hardening (P8)

#### 20.1 Truth Table C Lowering
- Replace Truth Table backend stubs with deterministic branch emission in generated C.
- Preserve row-priority semantics and fallback output behavior from runtime block semantics.
- Restrict v1 lowering to numeric/boolean condition domains with explicit comments for unsupported domains.

#### 20.2 State Machine C Lowering
- Introduce deterministic state-index encoding and transition skeleton emission.
- Keep ordering identical to runtime transition priority (list order) and preserve event/temporal extensibility.
- Add generated-state memory slots for future action/guard lowering.

#### 20.3 Artifact Packaging
- Add deterministic model artifact envelope:
  - generated `.c/.h`,
  - normalized IR JSON,
  - checksum manifest and metadata.
- Ensure package is reproducible for identical model graphs.

#### 20.4 SIL Strict Verification Mode
- Add strict-mode gates that fail equivalence when unsupported block types are present.
- Add structured mismatch reporting for CI-style regression consumption.
- Keep epsilon-based numeric tolerance for supported floating-point paths.

#### 20.5 P8 Release Gate
- Required checks before closeout:
  - `npm run test`
  - `npm run lint`
  - `npm run build`
  - SIL strict pass on supported reference models.

### 21) P8 Implementation Outcome (Codegen Fidelity & Verification Hardening)
- Truth Table backend lowering now emits deterministic C branch logic (`if/else if/else`) with row-priority semantics and numeric-tolerance equality checks.
- State Machine backend lowering now emits deterministic state-index transition skeletons with single-fire gating and ordered transition traversal.
- Added deterministic artifact package envelope for codegen outputs:
  - source/header/IR files,
  - reproducible checksum manifest,
  - metadata envelope for downstream tooling.
- Added SIL strict mode and report export:
  - strict unsupported-block failure gate,
  - structured mismatch report payload and JSON serialization.

### 22) Iteration 9 Roadmap — State-Machine Parity + Delivery Tooling (P9)

#### 22.1 State Machine C Lowering v2
- Extend state-machine backend from skeleton to semantic lowering:
  - richer guard expression subset (numeric/boolean comparisons and conjunctions),
  - action-expression lowering path for deterministic memory/state writes,
  - temporal/event gate lowering (`afterMs`, edge-event conditions).
- Preserve deterministic transition priority (list order, first fire).

#### 22.2 SIL Equivalence for Temporal State Machines
- Add dedicated SIL scenarios for state-machine temporal/event transitions.
- Compare state/output traces across runtime and generated backend for:
  - timed transitions,
  - rising/falling event gates,
  - guarded transitions with action side effects.
- Add tolerance policy for numeric domains and exact matching for discrete state transitions.

#### 22.3 Standalone Codegen CLI Driver
- Add command-line entrypoint to generate artifacts from model JSON files.
- Expected workflow:
  - input: model JSON path,
  - output: artifact package (`.c`, `.h`, `.ir.json`, manifest/metadata),
  - deterministic exit codes for CI automation.

#### 22.4 Documentation / Wiki Coverage
- Add markdown documentation for:
  - block catalog (including Truth Table, State Machine, PID, LUT, GOTO/FROM),
  - codegen IR and generated C API,
  - SIL workflow and strict mode behavior,
  - CLI usage examples.

#### 22.5 P9 Release Gate
- Final closeout requires:
  - `npm run test`
  - `npm run lint`
  - `npm run build`
  - state-machine SIL parity suite green,
  - CLI driver smoke verification.

### 23) Iteration 10 Roadmap — Hierarchical Codegen & Advanced UI (P10)

#### 23.1 Hierarchical C-Code Generation
- Upgrade the codegen pipeline to support recursive lowering of **Subsystem** blocks.
- Map internal Inport/Outport signals to generated state buffers or local evaluation slots.
- Ensure deterministic execution order across the hierarchy mirrors the runtime engine's behavior.

#### 23.2 Model Search & Navigator
- Implement a searchable block list in the UI sidebar.
- Allow users to filter by label, block type, or ID.
- Add "Zoom to Node" interaction to quickly locate entities in large models.

#### 23.3 Signal Path Highlighting
- Add visual feedback for signal propagation chains.
- Selecting a node or edge should highlight all connected upstream/downstream paths.
- Enhances observability for complex routing topologies (Mux/Demux, GOTO/FROM).

#### 23.4 Block Parameter Expressions
- Extend numeric parameter fields (e.g., Gain, PID coefficients) to support arithmetic expressions.
- Support resolution against Subsystem mask parameters.
- Re-use the hardened expression parser for safe evaluation.

#### 23.5 P10 Release Gate
- Full validation sweep:
  - `npm run test`
  - `npm run lint`
  - `npm run build`
  - Hierarchical SIL verification.

### 24) Interaction & Dashboards (P11)

#### 24.1 Dashboard Sink Blocks
- Added **Gauge** and **Lamp** blocks for rich visual feedback.
- Gauge: Linear visualization of numeric values within [min, max] range.
- Lamp: Boolean/numeric status indicator with configurable color mappings.

#### 24.2 Interactive Source Blocks
- Added **Knob** and **Slider** blocks for real-time parameter injection.
- Direct canvas interaction updates node internal state, which is consumed by the engine in the next tick.
- Enables "Human-in-the-loop" tuning and manual setpoint control.

#### 24.3 Real-time Wall-clock Sync
- Introduced **Real-time execution mode** in the simulation scheduler.
- Dynamically calculates tick delays to align simulation time with real-world time.
- Prevents simulation "speeding" on low-complexity models while maintaining deterministic logic.

#### 24.4 Live Edge Probing
- Implemented hover-sensitive **Value Tooltips** on all canvas edges.
- Tooltips subscribe to live output data from the source block.
- Provides immediate observability of signal values without adding explicit Display blocks.

### 25) Iteration 12 Roadmap — Performance & Advanced Extensions (P12)

#### 25.1 Batch Evaluation & Worker Threading
- Offload simulation `step()` loop to a dedicated Web Worker to prevent main-thread jank.
- Implement batch stepping where multiple ticks are computed before syncing state to UI.
- Use `SharedArrayBuffer` for high-frequency signal data transfer if environment supports it.

#### 25.2 Advanced Visualization
- Introduce **3D Scope** for multi-variable state-space trajectory visualization.
- Add **Spectrum Analyzer** sink for real-time FFT frequency domain analysis.
- Enhance Scope modal with persistent measurement cursors and data export (CSV/JSON).

#### 25.3 Custom Block Subsystem Library
- Enable users to save a configured Subsystem as a reusable block in the Library.
- Implement a persistence layer for user-defined block definitions.
- Support versioning and metadata for custom library components.

#### 25.4 Python Bridge
- Integrate **Pyodide** to allow Python-based block logic within the web environment.
- Map TypeScript `SignalValue` types to Python equivalents.
- Enable high-level algorithmic modeling using NumPy/SciPy within custom blocks.

#### 25.5 P12 Release Gate
- Performance benchmarks: Verify 10x throughput improvement via batch mode.
- Verification: Full test coverage for Python bridge and new visualization sinks.
- Stability: Regression suite pass (105+ tests).
