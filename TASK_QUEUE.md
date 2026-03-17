# TASK_QUEUE.md — Mobile-Reactive Simulink Web Environment

## Execution Mode
- P0/P1 tasks are isolated and implementation-ready.
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

## P1 Queue (Iteration 1: Simulink Refinement)
- [ ] P1-1 Block Library & Drag-and-Drop
  - Implement a sidebar 'Block Library' (Counter, Display, Scope).
  - Enable React Flow drag-and-drop from sidebar to canvas.
  - Implement block deletion (Backspace/Delete keys).

- [ ] P1-2 Simulation Control Panel
  - Add 'Stop Time' and 'Step Time (Ts)' numeric inputs to the `SimulationToolbar`.
  - Update `SimulationRuntimeStore` to reflect these values in real-time.
  - Add a 'Play/Stop' button with Simulation Time indicator.

- [ ] P1-3 Matlab Simulink Aesthetics
  - Update CSS/Tailwind to match classic Simulink gray/white/blue color palette.
  - Apply 3D-effect borders to blocks and dot-grid to the background.
  - Ensure all connections use `straight` edge type.

- [ ] P1-4 Functional Logic & Scope Modal
  - Remove current value display from `CounterBlock`.
  - Implement `onDoubleClick` for `ScopeBlock` to open an interactive modal.
  - The Scope Modal must include: Recharts with zoom/pan, cursors, and data measurement tools.

- [ ] P1-5 Final Validation & Performance Check
  - E2E test: Drag Counter → Drag Display → Connect → Set Step Time (0.01) → Run.
  - Validate mobile responsiveness of the new Modal and Sidebar.
  - Ensure the simulation speed correctly reflects the Step Time parameter.

## Completed
- [x] P0-1 Project scaffold verified.
- [x] P0-2 Simulation core engine verified.
- [x] P0-3 Block system foundation verified.
- [x] P0-4 Visualization blocks verified.
- [x] P0-5 Canvas + mobile interaction verified.
- [x] P0-6 End-to-end Counter demo + validation verified.
