import { SimulationBlockDefinition, SignalValue } from "@/src/simulation/types";
import { Tensor, sum as sumTensor } from "@/src/core";

/**
 * Sum block (P14-1c Tensor Update).
 *
 * Enhanced behavior:
 * - Handles both scalar numbers and Tensors.
 * - For Tensor inputs, sums all elements of each tensor.
 * - Maintains backward compatibility with scalar-only workflows.
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

function collectTensorInputs(inputs: Record<string, SignalValue>): Tensor[] {
  const keys = Object.keys(inputs).sort((a, b) => a.localeCompare(b));
  const tensors: Tensor[] = [];
  for (const key of keys) {
    const value = inputs[key];
    if (value instanceof Tensor) {
      tensors.push(value);
    }
  }
  return tensors;
}

export const SumBlock: SimulationBlockDefinition = {
  type: SUM_BLOCK_TYPE,
  inputPortTypes: { in1: "number", in2: "number", default: "number" },
  outputPortTypes: { default: "number" },
  step: ({ inputs }) => {
    const numericValues = collectNumericInputs(inputs);
    const tensorValues = collectTensorInputs(inputs);

    // Sum scalar values
    let scalarSum = numericValues.reduce((acc, current) => acc + current, 0);

    // Sum tensor values (sum of all elements from each tensor)
    let tensorSumTotal = 0;
    for (const tensor of tensorValues) {
      tensorSumTotal += sumTensor(tensor);
    }

    const totalSum = scalarSum + tensorSumTotal;
    const hasAnyInput = numericValues.length > 0 || tensorValues.length > 0;

    return {
      outputs: {
        default: hasAnyInput ? totalSum : null,
      },
    };
  },
};

/**
 * Tensor-enabled Sum block variant.
 * For models that explicitly use Tensor signals.
 */
export const TensorSumBlock: SimulationBlockDefinition = {
  type: "tensorSum" as const,
  inputPortTypes: { in1: "tensor", in2: "tensor", default: "tensor" },
  outputPortTypes: { default: "number" },
  step: ({ inputs }) => {
    const tensorValues = collectTensorInputs(inputs);
    if (tensorValues.length === 0) {
      return { outputs: { default: null } };
    }

    let total = 0;
    for (const tensor of tensorValues) {
      total += sumTensor(tensor);
    }

    return { outputs: { default: total } };
  },
};
