# TASK_QUEUE.md — Mobile-Reactive Simulink Web Environment

## Execution Mode
- P10 planning targets hierarchical codegen, model navigation ergonomics, and expression-based parameterization while preserving P1-P9 stability.
- One sub-agent at a time for this repo (lock prevention).
- Validate each task before marking complete.

## STRICT SUB-AGENT DIRECTIVE (must be passed verbatim)
"You are a temporary coding worker.
1. Work ONLY in ~/code/web-simulink.
2. Execute only your assigned task scope.
3. Keep changes minimal, typed, and production-safe.
4. Run relevant validation commands and report exact outputs.
5. Do NOT commit.
6. Return summary, files changed, validation, and risks."



## P10 Queue (Hierarchical Codegen & Advanced UI)
- [x] P10-1 Hierarchical C-Code Generation (recursive subsystem lowering)
- [x] P10-2 Model Search & Navigator (sidebar block search + zoom)
- [x] P10-3 Signal Path Highlighting (visual chain tracing)
- [x] P10-4 Block Parameter Expressions (arithmetic in numeric fields)
- [x] P10-5 Final Verification + Deployment

## P9 Queue (State-Machine Codegen Parity & Delivery Tooling)
- [x] P9-1 State Machine C-Code Lowering v2 (complex guard/action expressions + temporal/event gates)
- [x] P9-2 SIL Equivalence for State Machines (trace comparison for temporal transitions)
- [x] P9-3 CLI Codegen Driver (standalone CLI for generating artifacts from .json models)
- [x] P9-4 Documentation / Wiki (Markdown docs for all block types and C API)
- [x] P9-5 Final Verification + Deployment

## P8 Queue (Codegen Fidelity & Verification Hardening)
- [x] P8-1 Truth Table C-Code Lowering v1 (non-stub branch emission)
- [x] P8-2 State Machine C-Code Lowering v1 (state index + transition skeleton)
- [x] P8-3 Artifact Package Manifests (checksums + metadata envelope)
- [x] P8-4 SIL Strict Mode (unsupported-block fail gates + trace report export)
- [x] P8-5 Final Verification + Deployment

## P7 Queue (Logic State Machines & Code Generation)
- [x] P7-1 State Machine Block v1 (states, transitions, guard/action expressions)
- [x] P7-2 Temporal/Event Semantics (after/edge events + deterministic event queue)
- [x] P7-3 Truth Table / Logic Table Block (combinational decision modeling)
- [x] P7-4 C Code Generation Pipeline v1 (graph IR -> ANSI C subset)
- [x] P7-5 SIL Equivalence Harness (generated C trace vs runtime trace)
- [x] P7-6 Final Verification + Deployment

## P6 Queue (Advanced Control & Discrete Modeling)
- [x] P6-1 PID Controller Block (P/I/D/N parameters + anti-windup clamping)
- [x] P6-2 Discrete Filter Family (Discrete Transfer Fcn + Lead/Lag blocks)
- [x] P6-3 Multi-Input/Output Subsystem Masking (parameterized interface)
- [x] P6-4 Global Signal Bus & GOTO/FROM blocks
- [x] P6-5 Look-up Table (1D/2D linear interpolation)
- [x] P6-6 Final Verification + Deployment

## P5 Queue (Scalability, Debuggability & Modeling Ergonomics)
- [x] P5-1 Deterministic Conformance Expansion (nested + multi-rate + typed stress tests)
- [x] P5-2 Subsystem UX v2 (I/O mapping guardrails + editor ergonomics)
- [x] P5-3 Vector Signal System v1 (vector ports + Mux/Demux blocks)
- [x] P5-4 Runtime Trace & Debug Panel (tick-level probes and event timeline)
- [x] P5-5 Persistence v3 + Migration Path (hierarchy/vector metadata compatibility)
- [x] P5-6 Final Verification + Deployment

## P4 Queue (Hierarchical & Multi-Rate)
- [x] P4-1 Regression Safety Net (Engine + Canvas)
- [x] P4-2 Signal Type System v1 (Number/Boolean)
- [x] P4-3 Subsystem Block (Hierarchical Modeling v1)
- [x] P4-4 Multi-Rate Scheduler v1
- [x] P4-5 Performance + Observability Hardening
- [x] P4-6 Final Verification + Deployment

## P3 Queue (Advanced Simulation Features)
- [x] P3-1 Signal Routing Logic
- [x] P3-2 Signal Logging & Export
- [x] P3-3 Integrator + Delay Blocks (cycle-safe foundation)
- [x] P3-4 Graph Validation & Signal-Type Guardrails
- [x] P3-5 Model Persistence v2
- [x] P3-6 Final Verification + Deployment

## Completed
- [x] P0 Initial Prototype complete.
- [x] P1 Simulink Refinement complete.
- [x] P2 Industrial UI/UX refinement complete.
- [x] P3 Advanced simulation phase complete.
- [x] P4 Hierarchical & Multi-Rate phase complete.
- [x] P5 Kickoff and priorities formalized.
- [x] P5 Scalability, Debuggability & Modeling phase complete.


## Phase Closeout
- [x] P6 Advanced Control & Discrete Modeling phase complete.

- [x] P7 Logic State Machines & Code Generation phase complete.

- [x] P8 Codegen Fidelity & Verification Hardening phase complete.

- [x] P9 State-Machine Codegen Parity & Delivery Tooling phase complete.

- [x] P10 Hierarchical Codegen & Advanced UI phase complete.\n\n## P11 Queue (Interactive Dashboard & Real-time Tuning)\n- [x] P11-1 Dashboard Sink Blocks (Gauge & Lamp)\n- [x] P11-2 Interactive Source Blocks (Knob & Slider)\n- [ ] P11-3 Engine Wall-clock Sync (Real-time mode) [IN PROGRESS]\n- [ ] P11-4 Live Edge Probing (Value tooltips)\n- [ ] P11-5 Final Verification + Deployment
