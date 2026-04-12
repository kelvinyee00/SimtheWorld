import { SimulationBlockDefinition, SignalValue } from "@/src/simulation/types";

/**
 * Dense (Linear) Layer block (P13-2).
 *
 * Performs y = Wx + b.
 * Expects vector input 'in' and produces vector output 'default'.
 */
export const NN_DENSE_BLOCK_TYPE = "nn-dense" as const;

export const NnDenseBlock: SimulationBlockDefinition = {
  type: NN_DENSE_BLOCK_TYPE,
  inputPortTypes: { in: "vector", default: "vector" },
  outputPortTypes: { default: "vector" },
  step: ({ params, inputs }) => {
    const weights = (params.weights as number[][] | null) || null;
    const bias = (params.bias as number[] | null) || null;
    const u = inputs.in ?? inputs.default ?? null;

    if (u === null) return { outputs: { default: null } };
    if (!Array.isArray(u)) return { outputs: { default: null } };

    // Identity if no weights/bias
    if (weights === null && bias === null) {
      return { outputs: { default: u as SignalValue } };
    }

    const finalWeights = weights || [[1]];
    const finalBias = bias || [0];

    // Filter to only numeric values
    const numericU: number[] = [];
    for (const v of u) {
      if (typeof v === "number" && Number.isFinite(v)) {
        numericU.push(v);
      }
    }
    
    const result: number[] = [];
    for (let i = 0; i < finalWeights.length; i++) {
      let sum = finalBias[i] || 0;
      for (let j = 0; j < numericU.length; j++) {
        sum += (finalWeights[i][j] || 0) * numericU[j];
      }
      result.push(sum);
    }
    return { outputs: { default: result as SignalValue } };
  },
};

/**
 * Activation Function block (P13-2).
 *
 * Supports ReLU, Sigmoid, Tanh.
 */
export const NN_ACTIVATION_BLOCK_TYPE = "nn-activation" as const;

function relu(v: number) {
  return Math.max(0, v);
}

function sigmoid(v: number) {
  return 1 / (1 + Math.exp(-v));
}

function tanh(v: number) {
  return Math.tanh(v);
}

export const NnActivationBlock: SimulationBlockDefinition = {
  type: NN_ACTIVATION_BLOCK_TYPE,
  inputPortTypes: { in: "vector", default: "vector" },
  outputPortTypes: { default: "vector" },
  step: ({ params, inputs }) => {
    const fn = params.activation || "relu";
    const u = inputs.in ?? inputs.default ?? null;

    if (u === null) return { outputs: { default: null } };

    const apply = (val: number | boolean | string | number[] | null): number => {
      if (typeof val !== "number" || !Number.isFinite(val)) return 0;
      if (fn === "sigmoid") return sigmoid(val);
      if (fn === "tanh") return tanh(val);
      return relu(val);
    };

    if (Array.isArray(u)) {
      const result: number[] = [];
      for (const v of u) {
        result.push(apply(v));
      }
      return { outputs: { default: result as SignalValue } };
    }
    return { outputs: { default: [apply(u as any)] as SignalValue } };
  },
};
