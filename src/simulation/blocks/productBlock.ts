import { SimulationBlockDefinition, SignalValue } from "@/src/simulation/types";

/**
 * Product block (P3-1 multi-input math primitive).
 *
 * Routing behavior:
 * - Consumes all finite numeric inputs available on the node.
 * - Emits multiplicative product on `default`.
 * - Emits `null` when no numeric input exists.
 *
 * Determinism note:
 * - Multiplication order follows lexical handle key order to keep evaluation stable
 *   across browser/runtime implementations.
 */
export const PRODUCT_BLOCK_TYPE = "product" as const;

function collectNumericInputs(inputs: Record<string, SignalValue>): number[] {
  const keys = Object.keys(inputs).sort((a, b) => a.localeCompare(b));
  const numeric: number[] = [];

  for (const key of keys) {
    const value = inputs[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      numeric.push(value);
    }
  }

  return numeric;
}

export const ProductBlock: SimulationBlockDefinition = {
  type: PRODUCT_BLOCK_TYPE,
  step: ({ inputs }) => {
    const values = collectNumericInputs(inputs);
    const multiplied = values.reduce((acc, current) => acc * current, 1);

    return {
      outputs: {
        default: values.length === 0 ? null : multiplied,
      },
    };
  },
};
