import { SignalValue, SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * Unit Delay block (P3-3).
 *
 * Discrete behavior:
 * - y[k]   = x[k]
 * - x[k+1] = u[k] (when finite numeric input exists)
 *
 * Parameter contract:
 * - `initialValue`: fallback output/state before the first valid sample arrives.
 *
 * Algebraic-loop semantics:
 * - Output is previous state, independent of current tick input.
 * - This block is the canonical feedback-loop breaker for cycle-safe scheduling.
 */
export const UNIT_DELAY_BLOCK_TYPE = "unit-delay" as const;

interface UnitDelayParams {
  initialValue: number;
}

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseUnitDelayParams(raw: Record<string, unknown>): UnitDelayParams {
  return {
    initialValue: toFiniteNumber(raw.initialValue, 0),
  };
}

function resolvePreviousState(previousState: unknown, fallback: number): number {
  return typeof previousState === "number" && Number.isFinite(previousState)
    ? previousState
    : fallback;
}

function readInputValue(inputs: Record<string, SignalValue>): number | null {
  const direct = inputs.in ?? inputs.default;
  if (typeof direct === "number" && Number.isFinite(direct)) {
    return direct;
  }

  const keys = Object.keys(inputs).sort((a, b) => a.localeCompare(b));
  for (const key of keys) {
    const candidate = inputs[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }

  return null;
}

export const UnitDelayBlock: SimulationBlockDefinition = {
  type: UNIT_DELAY_BLOCK_TYPE,
  inputPortTypes: { in: "number", default: "number" },
  outputPortTypes: { default: "number" },
  breaksAlgebraicLoop: true,
  initialize: (params) => parseUnitDelayParams(params).initialValue,
  step: ({ params, previousState, inputs }) => {
    const parsed = parseUnitDelayParams(params);
    const current = resolvePreviousState(previousState, parsed.initialValue);
    const input = readInputValue(inputs);

    return {
      outputs: {
        default: current,
      },
      nextState: input === null ? current : input,
    };
  },
};
