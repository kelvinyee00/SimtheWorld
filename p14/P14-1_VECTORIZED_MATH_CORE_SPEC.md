# P14-1 Vectorized Math Core ("Tensor" Update) Specification

**Phase:** P14 (Engineering Excellence & Intelligent Inference)  
**Task:** P14-1 Vectorized Math Core  
**Status:** In Specification  
**Created:** 2026-04-06

---

## 1. Overview

The Vectorized Math Core is a foundational upgrade to the simulation engine's data handling. By moving from standard JavaScript arrays to optimized TypedArrays (Float64Array), we enable:

- **High-Performance Inference:** Necessary for P14-3 ONNX integration.
- **Headless Efficiency:** Reduces GC pressure and memory overhead for P14-2 CLI driver.
- **Deterministic Acceleration:** Faster matrix operations (Sum, Product, Gain) while maintaining strict reproducibility.

---

## 2. Technical Requirements

### 2.1 Unified Tensor Representation

A new `Tensor` class or interface will be introduced to handle multi-dimensional numeric data.

- **Storage:** Use `Float64Array` for high precision.
- **Metadata:** Track `shape` (e.g., `[rows, cols]`), `stride`, and `offset`.
- **Immutability:** Tensors used in simulation steps should be treated as immutable to preserve the engine's snapshot-based determinism.

### 2.2 Core Math Operations

The core must provide optimized implementations for:

| Operation | Description | Optimization Target |
|-----------|-------------|---------------------|
| **Element-wise** | Add, Sub, Mul, Div, Scale | Loop unrolling, SIMD (where available via browser/node) |
| **Linear Algebra** | Dot Product, Matrix Multiply | BLAS-like performance (cache-aware loops) |
| **Reductions** | Sum, Mean, Min, Max | Single-pass traversal |
| **Transformations** | Transpose, Reshape, Slice | Zero-copy views (manipulating stride/offset) |

### 2.3 Memory Management (Pool)

To avoid frequent allocations/deallocations during the simulation loop:

- **Tensor Pool:** Pre-allocate buffers for common shapes.
- **Buffer Reuse:** Provide a mechanism to return buffers to the pool after a tick completes.

### 2.4 Integration with `SignalValue`

Update `src/simulation/types.ts` to include the `Tensor` type:

```typescript
export type SignalValue = 
  | number 
  | boolean 
  | string 
  | number[] 
  | number[][] 
  | Tensor // New addition
  | null;
```

Provide utility functions for transparent conversion:
- `toTensor(v: SignalValue): Tensor`
- `fromTensor(t: Tensor): number[] | number[][]` (for UI rendering/serialization)

---

## 3. Implementation Phases

| Phase | Scope | Deliverable |
|-------|-------|-------------|
| **P14-1a** | Tensor Foundation | `Tensor` class with `Float64Array` storage and basic indexing |
| **P14-1b** | Optimized Operators | Implementation of Add, Sub, Mul, and Matrix Product |
| **P14-1c** | Block Migration | Update `Sum`, `Gain`, `Product`, and `MatrixProduct` blocks to use Tensors |
| **P14-1d** | Benchmarking | Performance comparison against standard array implementation |

---

## 4. Testing Strategy

### Unit Tests
- Tensor creation and indexing (1D, 2D, ND).
- Correctness of all math operations against naive JS implementations.
- Edge cases: Empty tensors, shape mismatches, broadcast operations.

### Performance Tests (Vitest Bench)
- Large matrix multiplication (e.g., 512x512).
- Batch signal processing (1M samples).
- Memory leak detection (monitoring heap size over 100k ticks).

---

## 5. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| API Breaking Changes | Existing blocks fail | Provide a compatibility layer/auto-conversion in `step` context |
| Complexity Overhead | Slower development | Start with a minimal subset of operations; document the Tensor API clearly |
| WASM vs JS Performance | Missed targets | Evaluate AssemblyScript or Rust/WASM if JS + TypedArrays isn't fast enough for ONNX |

---

## 6. References

- [MDN Typed Arrays](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Typed_arrays)
- [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)
- P12-2 Matrix Product implementation (`src/simulation/blocks/matrixProductBlock.ts`)

---

**Next Step:** Implement P14-1a Tensor Foundation.
