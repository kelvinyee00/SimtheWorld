# TASK_QUEUE.md — Mobile-Reactive Simulink Web Environment

## Execution Mode
- P1 tasks focus on "Simulink Copycat" refinement.
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

## P1 Queue (Simulink Copycat Refinement)
- [x] P1-1 Block Library Sidebar
- [x] P1-2 Advanced Simulation Controls
  - Add numeric inputs for 'Stop Time' and 'Step Time (Ts)' to the toolbar.
  - Bind these inputs to the Zustand runtime store.
  - Ensure simulation timing logic updates dynamically based on these inputs.

- [x] P1-3 Matlab Aesthetics & Grid
  - Update canvas background to light gray with a persistent dot grid.
  - Style block nodes with 3D-effect shadow borders and white backgrounds.
  - Ensure all connections use the `straight` edge type by default.

- [x] P1-4 Scope Interactive Modal
  - Convert the Scope block on the canvas to a simple icon.
  - Implement a double-click handler on the Scope node to open a full-screen modal.
  - Within the modal, implement advanced charting via Recharts (zoom, pan, cursor tracking).

- [x] P1-5 Counter Refinement
  - Update Counter block UI to hide the live numeric value (logic runs in background).
  - Add basic property editing in the Inspector (Start, Step, Mode).

## Completed
- [x] P0-1 Project scaffold
- [x] P0-2 Simulation core engine
- [x] P0-3 Block system foundation
- [x] P0-4 Visualization blocks
- [x] P0-5 Canvas + mobile interaction
- [x] P0-6 End-to-end Counter demo + validation
- [x] P1-1 Block Library Sidebar verified (DnD + deletion implemented).

- [x] P1-2 Advanced Simulation Controls verified (Stop Time/Ts bound to runtime scheduler).

- [x] P1-3 Matlab Aesthetics & Grid verified (gray dot-grid + 3D white blocks + straight edge enforcement).

- [x] P1-4 Scope Interactive Modal verified (icon scope + double-click modal + zoom/cursor/measurement).

- [x] P1-5 Counter Refinement verified (counter value hidden + inspector Start/Step/Mode editing).
