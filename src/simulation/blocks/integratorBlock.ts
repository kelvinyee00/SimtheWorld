import { SignalValue, SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * Discrete-time Integrator block (P3-3).
 *
 * Equation (forward Euler):
 * - y[k]   = x[k]
 * - x[k+1] = x[k] + u[k] * dt
 *
 * Where:
 * - `x` is internal state (accumulator)
 * - `u` is resolved numeric input signal
 * - `dt` is simulation step time in seconds
 *
 * Algebraic-loop semantics:
 * - Output depends only on previous internal state (`x[k]`), not current tick input.
 * - Therefore this block can break algebraic loops when used in feedback paths.
 */
export const INTEGRATOR_BLOCK_TYPE = "integrator" as const;

interface IntegratorParams {
  initialCondition: number;
}

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseIntegratorParams(raw: Record<string, unknown>): IntegratorParams {
  return {
    initialCondition: toFiniteNumber(raw.initialCondition, 0),
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

export const IntegratorBlock: SimulationBlockDefinition = {
  type: INTEGRATOR_BLOCK_TYPE,
  breaksAlgebraicLoop: true,
  initialize: (params) => parseIntegratorParams(params).initialCondition,
  step: ({ params, previousState, stepTimeMs, inputs }) => {
    const parsed = parseIntegratorParams(params);
    const current = resolvePreviousState(previousState, parsed.initialCondition);
    const input = readInputValue(inputs);

    const dtSeconds = stepTimeMs / 1_000;
    const next = input === null ? current : current + input * dtSeconds;

    return {
      outputs: {
        default: current,
      },
      nextState: next,
    };
  },
};
