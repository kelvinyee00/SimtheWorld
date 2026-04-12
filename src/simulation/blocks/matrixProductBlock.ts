import { SignalValue, SimulationBlockDefinition } from "@/src/simulation/types";
import { Tensor, matmul, isTensor, scale } from "@/src/core";

/**
 * Matrix Product block (P14-1c Tensor Update).
 * 
 * Contract:
 * - Performs matrix multiplication (A * B).
 * - Supports Tensor multiplication via optimized core.
 * - Supports broadcasting scalar * matrix/tensor.
 * - Maintains backward compatibility for nested arrays.
 */
export const MATRIX_PRODUCT_BLOCK_TYPE = "matrixProduct" as const;

function isMatrix(v: SignalValue): v is number[][] {
  return Array.isArray(v) && v.length > 0 && Array.isArray(v[0]);
}

function isVector(v: SignalValue): v is number[] {
  return Array.isArray(v) && v.length > 0 && typeof v[0] === "number";
}

export const MatrixProductBlock: SimulationBlockDefinition = {
  type: MATRIX_PRODUCT_BLOCK_TYPE,
  inputPortTypes: {
    a: "any",
    b: "any",
  },
  outputPortTypes: {
    default: "any",
  },
  step: ({ inputs }) => {
    const a = inputs.a ?? null;
    const b = inputs.b ?? null;

    if (a === null || b === null) return { outputs: { default: null } };

    // --- Tensor Handling (P14-1c) ---
    if (isTensor(a) && isTensor(b)) {
      try {
        return { outputs: { default: matmul(a, b) } };
      } catch (e) {
        return { outputs: { default: null } };
      }
    }

    if (typeof a === "number" && isTensor(b)) {
      return { outputs: { default: scale(b, a) } };
    }

    if (isTensor(a) && typeof b === "number") {
      return { outputs: { default: scale(a, b) } };
    }

    // --- Legacy Array Handling ---
    
    // Scalar * Any (Broadcast)
    if (typeof a === "number") {
      if (typeof b === "number") return { outputs: { default: a * b } };
      if (isVector(b)) return { outputs: { default: b.map(v => a * v) } };
      if (isMatrix(b)) return { outputs: { default: b.map(row => row.map(v => a * v)) } };
    }

    // Matrix Multiplication (Naive Legacy)
    if (isMatrix(a) && isMatrix(b)) {
      const rowsA = a.length;
      const colsA = a[0].length;
      const rowsB = b.length;
      const colsB = b[0].length;

      if (colsA !== rowsB) return { outputs: { default: null } };

      const result: number[][] = Array.from({ length: rowsA }, () => Array(colsB).fill(0));
      for (let i = 0; i < rowsA; i++) {
        for (let j = 0; j < colsB; j++) {
          for (let k = 0; k < colsA; k++) {
            result[i][j] += a[i][k] * b[k][j];
          }
        }
      }
      return { outputs: { default: result } };
    }

    return { outputs: { default: null } };
  },
};
