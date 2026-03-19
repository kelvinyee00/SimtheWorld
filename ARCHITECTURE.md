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
