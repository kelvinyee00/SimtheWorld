# Block Types Reference (web-simulink)

This document describes all runtime block types currently registered in `DEFAULT_BLOCK_REGISTRY`.

## Signal Domains
- `number`
- `boolean`
- `string` (used by state-machine state output)
- `vector` (`number[]`)
- `any`

---

## 1) Source / Sink Basics

### `counter`
- **Purpose:** deterministic numeric source.
- **Params:** `start`, `step`, `mode: "inc" | "dec"`.
- **Outputs:** `default:number`.

### `display`
- **Purpose:** terminal numeric sink showing latest value.
- **Inputs:** `default:number` (fallback `in:number`).
- **Outputs:** none.

### `scope`
- **Purpose:** terminal numeric sink with buffered time-series.
- **Params:** `maxPoints` (bounded).
- **Inputs:** `default:number` (fallback `in:number`).
- **Outputs:** none.

### `to-file`
- **Purpose:** deterministic sampled sink for export workflows.
- **Params:** `format: "json" | "csv"`, `fileName`, `maxRows`.
- **Inputs:** numeric handles (`default`, `in`, `in1`, `in2`, ...).
- **Outputs:** none.

---

## 2) Math / Logic Routing

### `gain`
- **Purpose:** scalar multiply.
- **Params:** `gain`.
- **Inputs:** `in:number` or `default:number`.
- **Outputs:** `default:number`.

### `sum`
- **Purpose:** adds all finite numeric inputs.
- **Inputs:** `in1`, `in2`, `default` (+ duplicate fan-in synthesized keys).
- **Outputs:** `default:number | null`.

### `product`
- **Purpose:** multiplies all finite numeric inputs.
- **Inputs:** `in1`, `in2`, `default` (+ duplicate fan-in synthesized keys).
- **Outputs:** `default:number | null`.

### `compare`
- **Purpose:** numeric comparator to boolean.
- **Params:** `operator: gt | gte | lt | lte | eq | neq`.
- **Inputs:** `in1:number`, `in2:number`.
- **Outputs:** `default:boolean`.

### `switch`
- **Purpose:** boolean-controlled numeric selector.
- **Inputs:** `cond:boolean`, `inTrue:number`, `inFalse:number`.
- **Outputs:** `default:number`.

### `truthTable`
- **Purpose:** combinational decision table with row priority.
- **Params:**
  - `inputHandles:string[]`
  - `rows: { when: Record<string, number|boolean|string>, output: number|boolean }[]`
  - `elseOutput: number|boolean|null`
- **Outputs:**
  - `default:any` (selected row output or else)
  - `row:number|null` (matched row index)

---

## 3) Dynamic / Control Blocks

### `integrator`
- **Purpose:** forward-Euler discrete integrator.
- **Params:** `initialCondition`.
- **Inputs:** `in:number`.
- **Outputs:** `default:number`.
- **Loop behavior:** breaks algebraic loops.

### `unit-delay`
- **Purpose:** one-sample delay (`z^-1`).
- **Params:** `initialValue`.
- **Inputs:** `in:number`.
- **Outputs:** `default:number`.
- **Loop behavior:** breaks algebraic loops.

### `pid`
- **Purpose:** PID with derivative filter and anti-windup.
- **Params:** `kp`, `ki`, `kd`, `n`, `lowerSaturation`, `upperSaturation`.
- **Inputs:** `in:number`.
- **Outputs:** `default:number`.

### `discrete-transfer-fcn`
- **Purpose:** generic discrete transfer-function (difference equation).
- **Params:** `numerator:number[]`, `denominator:number[]`.
- **Inputs:** `in:number`.
- **Outputs:** `default:number`.

### `lead-lag`
- **Purpose:** lead/lag compensator (Tustin-discretized).
- **Params:** `gain`, `leadTimeConstantSec`, `lagTimeConstantSec`.
- **Inputs:** `in:number`.
- **Outputs:** `default:number`.

### `stateMachine`
- **Purpose:** deterministic state/transition controller.
- **Params:**
  - `initialState:string`
  - `states:string[]`
  - `transitions[]` with fields:
    `from`, `to`, `guardExpr?`, `actionExpr?`, `output?`, `afterMs?`, `event?`, `eventInput?`
- **Outputs:**
  - `default:any` (transition output if emitted)
  - `state:any` (current state label)

---

## 4) Vector / Bus Routing

### `mux`
- **Purpose:** combine scalars into vector.
- **Inputs:** `in1:number`, `in2:number`.
- **Outputs:** `default:vector`.

### `demux`
- **Purpose:** split vector into scalars.
- **Inputs:** `in:vector`.
- **Outputs:** `out1:number`, `out2:number`, `default` mirrors `out1`.

### `goto`
- **Purpose:** write signal to global bus by tag.
- **Params:** `tag`.
- **Inputs:** `in:any`.
- **Outputs:** `default:any` (mirrors input).

### `from`
- **Purpose:** read signal from global bus by tag.
- **Params:** `tag`.
- **Outputs:** `default:any`.

---

## 5) Lookup Tables

### `lut-1d`
- **Purpose:** 1D interpolation with clamping.
- **Params:** `breakpointsX:number[]`, `tableData:number[]`.
- **Inputs:** `in:number`.
- **Outputs:** `default:number`.

### `lut-2d`
- **Purpose:** 2D bilinear interpolation with clamping.
- **Params:** `breakpointsX:number[]`, `breakpointsY:number[]`, `tableData:number[][]`.
- **Inputs:** `in1:number`, `in2:number`.
- **Outputs:** `default:number`.

---

## 6) Hierarchy / Subsystem Internals

### `subsystem`
- **Purpose:** nested graph execution with deterministic interface mapping.
- **Params:**
  - `graph: SimulationGraph`
  - `mask?: { inputs:string[], outputs:string[], parameters:Record<string,unknown> }`
- **Inputs/Outputs:** multi-handle (`in1..in8`, `out1..out8`) + aliases via mask.

### `inport` *(subsystem-internal)*
- **Purpose:** internal ingress from parent subsystem wrapper.
- **Outputs:** `default:any`.

### `outport` *(subsystem-internal)*
- **Purpose:** internal egress to parent subsystem wrapper.
- **Inputs:** `in:any` / `default:any`.
- **Outputs:** `default:any`.

---

## Notes
- Block behavior is deterministic by design: stable input ordering, pure per-tick stepping, explicit node-local state.
- Connection/type rules are enforced by graph validation before runtime.
