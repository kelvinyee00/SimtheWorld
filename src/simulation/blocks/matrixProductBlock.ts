import { SignalValue, SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * Matrix Product block (P12-2 extension).
 * 
 * Contract:
 * - Performs matrix multiplication (A * B).
 * - Supports broadcasting scalar * matrix.
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

    // Scalar * Any (Broadcast)
    if (typeof a === "number") {
      if (typeof b === "number") return { outputs: { default: a * b } };
      if (isVector(b)) return { outputs: { default: b.map(v => a * v) } };
      if (isMatrix(b)) return { outputs: { default: b.map(row => row.map(v => a * v)) } };
    }

    // Matrix Multiplication (Naive)
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
