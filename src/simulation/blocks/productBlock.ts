import { SimulationBlockDefinition, SignalValue } from "@/src/simulation/types";
import { Tensor, mul } from "@/src/core";

/**
 * Product block (P14-1c Tensor Update).
 *
 * Enhanced behavior:
 * - Handles both scalar numbers and Tensors.
 * - For Tensor inputs, performs element-wise multiplication.
 * - Maintains backward compatibility with scalar-only workflows.
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

export const ProductBlock: SimulationBlockDefinition = {
  type: PRODUCT_BLOCK_TYPE,
  inputPortTypes: { in1: "number", in2: "number", default: "number" },
  outputPortTypes: { default: "number" },
  step: ({ inputs }) => {
    const numericValues = collectNumericInputs(inputs);
    const tensorValues = collectTensorInputs(inputs);

    // Handle scalar multiplication
    let scalarProduct = numericValues.reduce((acc, current) => acc * current, 1);

    // Handle tensor multiplication (element-wise)
    let resultTensor: Tensor | null = null;
    for (const tensor of tensorValues) {
      if (resultTensor === null) {
        resultTensor = tensor;
      } else {
        resultTensor = mul(resultTensor, tensor);
      }
    }

    const hasNumeric = numericValues.length > 0;
    const hasTensor = tensorValues.length > 0;

    // Return appropriate type
    if (hasTensor && hasNumeric) {
      // If we have both, multiply scalar into the tensor
      if (resultTensor) {
        const scaled = resultTensor.data.map(v => v * scalarProduct);
        return { outputs: { default: new Tensor(new Float64Array(scaled), resultTensor.shape) } };
      }
      return { outputs: { default: scalarProduct } };
    }

    if (hasTensor) {
      return { outputs: { default: resultTensor } };
    }

    if (hasNumeric) {
      return { outputs: { default: scalarProduct } };
    }

    return { outputs: { default: null } };
  },
};

/**
 * Tensor-enabled Product block variant.
 * Performs element-wise multiplication of Tensors.
 */
export const TensorProductBlock: SimulationBlockDefinition = {
  type: "tensorProduct" as const,
  inputPortTypes: { in1: "tensor", in2: "tensor", default: "tensor" },
  outputPortTypes: { default: "tensor" },
  step: ({ inputs }) => {
    const tensorValues = collectTensorInputs(inputs);
    if (tensorValues.length === 0) {
      return { outputs: { default: null } };
    }

    if (tensorValues.length === 1) {
      return { outputs: { default: tensorValues[0] } };
    }

    // Multiply all tensors element-wise
    let result = tensorValues[0];
    for (let i = 1; i < tensorValues.length; i++) {
      result = mul(result, tensorValues[i]);
    }

    return { outputs: { default: result } };
  },
};
