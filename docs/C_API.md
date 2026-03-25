# C Codegen & SIL API Reference (web-simulink)

This page documents the generated C interface and the TypeScript codegen/SIL utilities used in P8/P9.

## 1) Generated C Runtime API

Artifacts produced by codegen include:
- `<model>.h`
- `<model>.c`
- `<model>.ir.json`

### Header contract
Generated header contains:

```c
typedef struct <model>_state {
  double node_outputs[256];
  double node_internal_state[256];
  int state_machine_active_state[256];
  double state_machine_elapsed_ms[256];
  double state_machine_prev_event_input[256];
} <model>_state;

void <model>_init(<model>_state* state);
void <model>_step(<model>_state* state, double step_time_sec);
```

### Semantics
- `*_init` zero-initializes generated runtime state and applies block-specific initial values.
- `*_step` executes deterministic node order from lowered IR.
- Current generated executable subset includes:
  - `counter`, `gain`, `sum`, `product`, `truthTable`, `stateMachine`.
- State-machine constrained memory writes (`memory.slot0..slot3`) are currently mapped into deterministic offsets of `node_internal_state`.

---

## 2) TypeScript Codegen API

## `src/codegen/cCodegen.ts`

### `buildCodegenIR({ modelName, graph })`
Builds deterministic IR:
- sorted nodes/edges,
- execution order,
- unsupported block list.

### `generateAnsiCArtifacts({ modelName, graph })`
Returns:
- `ir`
- `headerSource`
- `sourceSource`

### State-machine lowering status (v2)
Implemented deterministic subset:
- state index normalization
- transition-order single-fire skeleton
- safe guard subset lowering:
  - literals `true/false`
  - `inputs.<handle>`, `!inputs.<handle>`
  - comparison forms (`===`, `==`, `!==`, `!=`, `<`, `<=`, `>`, `>=`) with numeric/boolean literals
  - `memory.slot0..slot3` reads
- temporal/event gate lowering:
  - `afterMs`
  - rising/falling edge checks using generated previous-event state
- constrained action lowering:
  - `outputs.default` / `output.out` literal assignment
  - `memory.slot0..slot3` literal writes

Unsupported forms are emitted with explicit fallback comments to preserve deterministic behavior.

---

## 3) Artifact Package API

## `src/codegen/artifactPackage.ts`

### `buildCodegenArtifactPackage({ modelName, graph })`
Builds envelope:
- `files[]`: `.h`, `.c`, `.ir.json`
- `manifest`:
  - algorithm: `fnv1a32`
  - per-file checksum + byte size
  - package checksum over normalized manifest entries
- `metadata`:
  - schemaVersion
  - modelName
  - node/edge counts
  - unsupported block types
  - deterministic generation marker

### `serializeCodegenArtifactPackage(pkg)`
Returns stable JSON serialization of package envelope.

---

## 4) SIL Equivalence API

## `src/codegen/silHarness.ts`

### `runSilEquivalence(...)`
Compares runtime trace vs generated trace.

Inputs:
- `modelName`, `graph`, `registry`, `ticks`
- optional: `probes`, `stepTimeMs`, `simulationTimeMs`, `epsilon`, `strictMode`

Output includes:
- `pass`
- `mismatches[]`
- `runtimeTrace[]`
- `generatedTrace[]`
- `unsupportedBlockTypes[]`
- structured `report`

### Strict mode
- `strictMode: "unsupported-fail"` fails run when unsupported blocks exist even if trace values match.

### Determinism notes
- probe list is normalized (sorted by `nodeId`, then `handle`) before trace generation/reporting.
- mismatch comparison is epsilon-based for numeric values and exact for discrete/string/boolean values.

### `serializeSilReport(report)`
Exports structured SIL report JSON for CI/regression artifacting.

---

## 5) Practical Workflow

1. Build artifacts:
   - call `buildCodegenArtifactPackage(...)`
2. Persist package or export JSON envelope.
3. Run SIL:
   - call `runSilEquivalence(...)`
   - optional strict mode for unsupported-block gating.
4. For release gates, require:
   - tests, lint, build,
   - SIL report pass for target supported models.
