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

## P2 Queue (Iteration 2: Industrial Refinement)
- [x] P2-1 Aesthetic Shift (Orange/Blue & Icons)
  - Counter block moved to industrial orange (#f97316); sink blocks themed light blue (#0ea5e9).
  - Counter redesigned as compact icon block ("123") with no descriptive subtext.

- [x] P2-2 Connectivity & Interaction
  - Connection handles enlarged with larger visual targets and hover-scale feedback.
  - Edge interaction width increased and direct edge deletion enabled (Delete/Backspace + UI button).

- [x] P2-3 Scope Modal Overhaul (The "Oscilloscope" Window)
  - Scope modal converted to solid, non-transparent window styling.
  - Resizable standalone window behavior implemented.
  - Auto-scroll X-axis follow mode implemented with manual zoom override and "Follow latest" recovery.

- [x] P2-4 Final Validation & Deployment
  - Validation completed: `npm run lint` ✅, `npm run build` ✅.
  - Commit + push completed to `origin/master`.

## Completed
- [x] P0 Initial Prototype complete.
- [x] P1 Simulink Refinement complete.
- [x] P2 Industrial UI/UX refinement complete.
