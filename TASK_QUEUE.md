# TASK_QUEUE.md — Mobile-Reactive Simulink Web Environment

## Execution Mode
- P6 tasks focus on advanced control and discrete modeling blocks, maintaining P1-P5 stability and deterministic behavior.
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

## P6 Queue (Advanced Control & Discrete Modeling)
- [x] P6-1 PID Controller Block (P/I/D/N parameters + anti-windup clamping)
- [x] P6-2 Discrete Filter Family (Discrete Transfer Fcn + Lead/Lag blocks)
- [ ] P6-3 Multi-Input/Output Subsystem Masking (parameterized interface) [IN PROGRESS]
- [ ] P6-4 Global Signal Bus & GOTO/FROM blocks
- [ ] P6-5 Look-up Table (1D/2D linear interpolation)
- [ ] P6-6 Final Verification + Deployment

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
