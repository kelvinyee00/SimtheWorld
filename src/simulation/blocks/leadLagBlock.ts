import { SignalValue, SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * Lead/Lag block (P6-2).
 *
 * Continuous-time form:
 *   G(s) = K * (Tlead*s + 1) / (Tlag*s + 1)
 *
 * Discretization (Tustin / bilinear transform):
 *   y[k] = (b0*u[k] + b1*u[k-1] - a1*y[k-1]) / a0
 * where
 *   a0 = 2*Tlag + Ts
 *   a1 = Ts - 2*Tlag
 *   b0 = K*(2*Tlead + Ts)
 *   b1 = K*(Ts - 2*Tlead)
 *
 * Fallback behavior:
 * - If Tlag <= 0, block degenerates to static gain: y = K*u
 */
export const LEAD_LAG_BLOCK_TYPE = "lead-lag" as const;

interface LeadLagParams {
  gain: number;
  leadTimeConstantSec: number;
  lagTimeConstantSec: number;
}

interface LeadLagState {
  previousInput: number;
  previousOutput: number;
}

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseParams(raw: Record<string, unknown>): LeadLagParams {
  return {
    gain: toFiniteNumber(raw.gain, 1),
    leadTimeConstantSec: Math.max(0, toFiniteNumber(raw.leadTimeConstantSec, 0)),
    lagTimeConstantSec: Math.max(0, toFiniteNumber(raw.lagTimeConstantSec, 1)),
  };
}

function readInputValue(inputs: Record<string, SignalValue>): number {
  const direct = inputs.in ?? inputs.default;
  if (typeof direct === "number" && Number.isFinite(direct)) {
    return direct;
  }

  const keys = Object.keys(inputs).sort((left, right) => left.localeCompare(right));
  for (const key of keys) {
    const candidate = inputs[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }

  return 0;
}

function toState(previousState: unknown): LeadLagState {
  if (
    typeof previousState === "object" &&
    previousState !== null &&
    "previousInput" in previousState &&
    "previousOutput" in previousState
  ) {
    const candidate = previousState as Record<string, unknown>;
    return {
      previousInput: toFiniteNumber(candidate.previousInput, 0),
      previousOutput: toFiniteNumber(candidate.previousOutput, 0),
    };
  }

  return {
    previousInput: 0,
    previousOutput: 0,
  };
}

export const LeadLagBlock: SimulationBlockDefinition = {
  type: LEAD_LAG_BLOCK_TYPE,
  inputPortTypes: { in: "number", default: "number" },
  outputPortTypes: { default: "number" },
  initialize: () => ({
    previousInput: 0,
    previousOutput: 0,
  } satisfies LeadLagState),
  step: ({ params, inputs, previousState, stepTimeMs }) => {
    const parsed = parseParams(params);
    const state = toState(previousState);
    const input = readInputValue(inputs);

    const ts = Math.max(1e-9, stepTimeMs / 1_000);

    if (parsed.lagTimeConstantSec <= 0) {
      const output = parsed.gain * input;
      return {
        outputs: { default: output },
        nextState: {
          previousInput: input,
          previousOutput: output,
        } satisfies LeadLagState,
      };
    }

    const a0 = 2 * parsed.lagTimeConstantSec + ts;
    const a1 = ts - 2 * parsed.lagTimeConstantSec;
    const b0 = parsed.gain * (2 * parsed.leadTimeConstantSec + ts);
    const b1 = parsed.gain * (ts - 2 * parsed.leadTimeConstantSec);

    const output =
      (b0 * input + b1 * state.previousInput - a1 * state.previousOutput) / a0;

    return {
      outputs: {
        default: Number.isFinite(output) ? output : 0,
      },
      nextState: {
        previousInput: input,
        previousOutput: Number.isFinite(output) ? output : 0,
      } satisfies LeadLagState,
    };
  },
};
