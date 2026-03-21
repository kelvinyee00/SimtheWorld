import { SimulationBlockDefinition, SignalValue } from "@/src/simulation/types";

/**
 * Sum block (P3-1 multi-input math primitive).
 *
 * Routing behavior:
 * - Consumes every finite numeric input available on the node.
 * - Supports explicit handles (`in1`, `in2`, ...) and engine-synthesized duplicate keys
 *   (e.g., `default__2`) when multiple wires target the same handle.
 * - Emits arithmetic sum on `default`, or `null` if no numeric input is present.
 */
export const SUM_BLOCK_TYPE = "sum" as const;

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

export const SumBlock: SimulationBlockDefinition = {
  type: SUM_BLOCK_TYPE,
  inputPortTypes: { in1: "number", in2: "number", default: "number" },
  outputPortTypes: { default: "number" },
  step: ({ inputs }) => {
    const values = collectNumericInputs(inputs);
    const summed = values.reduce((acc, current) => acc + current, 0);

    return {
      outputs: {
        default: values.length === 0 ? null : summed,
      },
    };
  },
};
