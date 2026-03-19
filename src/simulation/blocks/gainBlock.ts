import { SimulationBlockDefinition, SignalValue } from "@/src/simulation/types";

/**
 * Gain block (P3-1 math routing primitive).
 *
 * Behavior contract:
 * - Reads one effective numeric input.
 * - Emits `input * gain` on `default` output.
 * - Emits `null` when no finite numeric input is available.
 *
 * Input selection policy (deterministic):
 * 1) Prefer handle `in`.
 * 2) Fallback to `default`.
 * 3) Fallback to first finite numeric value in lexical key order.
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

function readPrimaryInput(inputs: Record<string, SignalValue>): number | null {
  const direct = inputs.in ?? inputs.default;
  if (typeof direct === "number" && Number.isFinite(direct)) {
    return direct;
  }

  const keys = Object.keys(inputs).sort((a, b) => a.localeCompare(b));
  for (const key of keys) {
    const value = inputs[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

export const GainBlock: SimulationBlockDefinition = {
  type: GAIN_BLOCK_TYPE,
  step: ({ params, inputs }) => {
    const parsed = parseGainParams(params);
    const input = readPrimaryInput(inputs);

    return {
      outputs: {
        default: input === null ? null : input * parsed.gain,
      },
    };
  },
};
