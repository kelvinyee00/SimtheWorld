import { SignalValue, SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * 1D Lookup Table block (P6-5).
 */
export const LUT_1D_BLOCK_TYPE = "lut-1d" as const;

/**
 * 2D Lookup Table block (P6-5).
 */
export const LUT_2D_BLOCK_TYPE = "lut-2d" as const;

function isFiniteNumber(val: unknown): val is number {
  return typeof val === "number" && Number.isFinite(val);
}

function normalizeVector(raw: unknown, fallback: number[]): number[] {
  if (!Array.isArray(raw)) return fallback;
  const filtered = raw.filter(isFiniteNumber);
  return filtered.length > 0 ? filtered : fallback;
}

function normalizeMatrix(raw: unknown, rows: number, cols: number): number[][] {
  if (!Array.isArray(raw)) {
    return new Array(rows).fill(0).map(() => new Array(cols).fill(0));
  }

  const matrix: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const row = Array.isArray(raw[r]) ? (raw[r] as unknown[]).filter(isFiniteNumber) : [];
    while (row.length < cols) row.push(0);
    matrix.push(row.slice(0, cols));
  }
  return matrix;
}

function lerp(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x1 === x0) return y0;
  return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
}

function interpolate1D(x: number, bp: number[], table: number[]): number {
  if (x <= bp[0]) return table[0];
  if (x >= bp[bp.length - 1]) return table[table.length - 1];

  for (let i = 0; i < bp.length - 1; i++) {
    if (x >= bp[i] && x <= bp[i + 1]) {
      return lerp(x, bp[i], bp[i + 1], table[i], table[i + 1]);
    }
  }
  return table[0];
}

function readInput(inputs: Record<string, SignalValue>, handle: string, fallbackHandle: string): number | null {
  const val = inputs[handle] ?? inputs[fallbackHandle];
  return typeof val === "number" && Number.isFinite(val) ? val : null;
}

export const Lut1DBlock: SimulationBlockDefinition = {
  type: LUT_1D_BLOCK_TYPE,
  inputPortTypes: { in: "number", default: "number" },
  outputPortTypes: { default: "number" },
  step: ({ params, inputs }) => {
    const bp = normalizeVector(params.breakpointsX, [0, 1]);
    const table = normalizeVector(params.tableData, [0, 1]);
    const u = readInput(inputs, "in", "default");

    if (u === null || bp.length < 2 || bp.length !== table.length) {
      return { outputs: { default: u === null ? null : (table[0] ?? 0) } };
    }

    return {
      outputs: {
        default: interpolate1D(u, bp, table),
      },
    };
  },
};

export const Lut2DBlock: SimulationBlockDefinition = {
  type: LUT_2D_BLOCK_TYPE,
  inputPortTypes: { in1: "number", in2: "number" },
  outputPortTypes: { default: "number" },
  step: ({ params, inputs }) => {
    const bpX = normalizeVector(params.breakpointsX, [0, 1]);
    const bpY = normalizeVector(params.breakpointsY, [0, 1]);
    const table = normalizeMatrix(params.tableData, bpY.length, bpX.length);

    const u1 = readInput(inputs, "in1", "in1");
    const u2 = readInput(inputs, "in2", "in2");

    if (u1 === null || u2 === null || bpX.length < 2 || bpY.length < 2) {
      return { outputs: { default: 0 } };
    }

    // Clamping
    const x = Math.max(bpX[0], Math.min(bpX[bpX.length - 1], u1));
    const y = Math.max(bpY[0], Math.min(bpY[bpY.length - 1], u2));

    // Find indices
    let ix = 0;
    for (let i = 0; i < bpX.length - 1; i++) {
      if (x >= bpX[i] && x <= bpX[i + 1]) {
        ix = i;
        break;
      }
    }
    let iy = 0;
    for (let j = 0; j < bpY.length - 1; j++) {
      if (y >= bpY[j] && y <= bpY[j + 1]) {
        iy = j;
        break;
      }
    }

    // Bilinear interpolation
    const q11 = table[iy][ix];
    const q21 = table[iy][ix + 1];
    const q12 = table[iy + 1][ix];
    const q22 = table[iy + 1][ix + 1];

    const fxy1 = lerp(x, bpX[ix], bpX[ix + 1], q11, q21);
    const fxy2 = lerp(x, bpX[ix], bpX[ix + 1], q12, q22);

    const result = lerp(y, bpY[iy], bpY[iy + 1], fxy1, fxy2);

    return {
      outputs: {
        default: result,
      },
    };
  },
};
