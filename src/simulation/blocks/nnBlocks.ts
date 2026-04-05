import { SimulationBlockDefinition } from "@/src/simulation/types";

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
    const weights = (params.weights as number[][]) || [[1]];
    const bias = (params.bias as number[]) || [0];
    const u = inputs.in ?? inputs.default ?? null;
    if (!Array.isArray(u)) return { outputs: { default: null } };

    const result: number[] = [];
    for (let i = 0; i < weights.length; i++) {
      let sum = bias[i] || 0;
      for (let j = 0; j < u.length; j++) {
        sum += (weights[i][j] || 0) * u[j];
      }
      result.push(sum);
    }
    return { outputs: { default: result } };
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
  inputPortTypes: { in: "any", default: "any" },
  outputPortTypes: { default: "any" },
  step: ({ params, inputs }) => {
    const fn = params.activation || "relu";
    const u = inputs.in ?? inputs.default ?? null;

    const apply = (val: unknown): number | number[] => {
      if (typeof val !== "number" || !Number.isFinite(val)) return 0;
      if (fn === "sigmoid") return sigmoid(val);
      if (fn === "tanh") return tanh(val);
      return relu(val);
    };

    if (Array.isArray(u)) {
      return { outputs: { default: u.map(apply) } };
    }
    return { outputs: { default: apply(u) } };
  },
};
