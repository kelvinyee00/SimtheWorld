import { SimulationBlockDefinition, SignalValue } from "@/src/simulation/types";
import { Tensor, scale } from "@/src/core";

/**
 * Gain block (P14-1c Tensor Update).
 *
 * Enhanced behavior:
 * - Handles both scalar numbers and Tensors.
 * - For Tensor inputs, scales each element by the gain factor.
 * - Maintains backward compatibility with scalar-only workflows.
 */

export const GAIN_BLOCK_TYPE = "gain" as const;

interface GainParams {
  gain: number;
}

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseGainParams(raw: Record<string, unknown>): GainParams {
  return {
    gain: toFiniteNumber(raw.gain, 1),
  };
}

function readPrimaryInput(inputs: Record<string, SignalValue>): SignalValue | null {
  const direct = inputs.in ?? inputs.default;
  if (direct === null || direct === undefined) {
    return null;
  }
  // Handle scalar numbers
  if (typeof direct === "number" && Number.isFinite(direct)) {
    return direct;
  }
  // Handle Tensors
  if (direct instanceof Tensor) {
    return direct;
  }
  // Fallback: search for first valid numeric input
  const keys = Object.keys(inputs).sort((a, b) => a.localeCompare(b));
  for (const key of keys) {
    const value = inputs[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (value instanceof Tensor) {
      return value;
    }
  }
  return null;
}

export const GainBlock: SimulationBlockDefinition = {
  type: GAIN_BLOCK_TYPE,
  inputPortTypes: { in: "number", default: "number" },
  outputPortTypes: { default: "number" },
  step: ({ params, inputs }) => {
    const parsed = parseGainParams(params);
    const input = readPrimaryInput(inputs);

    if (input === null) {
      return { outputs: { default: null } };
    }

    // Handle Tensor input
    if (input instanceof Tensor) {
      const scaled = scale(input, parsed.gain);
      return { outputs: { default: scaled } };
    }

    // Handle scalar input
    return { outputs: { default: input * parsed.gain } };
  },
};

/**
 * Tensor-enabled Gain block variant.
 * Explicitly accepts and outputs Tensors.
 */
export const TensorGainBlock: SimulationBlockDefinition = {
  type: "tensorGain" as const,
  inputPortTypes: { default: "tensor" },
  outputPortTypes: { default: "tensor" },
  step: ({ params, inputs }) => {
    const parsed = parseGainParams(params);
    const input = inputs.default;

    if (!(input instanceof Tensor)) {
      return { outputs: { default: null } };
    }

    const scaled = scale(input, parsed.gain);
    return { outputs: { default: scaled } };
  },
};
