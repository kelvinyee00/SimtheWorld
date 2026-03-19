# TASK_QUEUE.md — Mobile-Reactive Simulink Web Environment

## Execution Mode
- P2 tasks prioritize UI/UX and industrial refinement.
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
- [ ] P3-2 Signal Logging & Export
  - Add "To File" block for CSV/JSON export of simulation runs.
  - Implement persistent storage for simulation results in IndexedDB.

## Completed
- [x] P0 Initial Prototype complete.
- [x] P1 Simulink Refinement complete.
- [x] P2 Industrial UI/UX refinement complete.
