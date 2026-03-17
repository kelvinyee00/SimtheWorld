import { SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * Counter block (P0-3 foundation block).
 *
 * Behavioral contract:
 * - Owns a deterministic scalar internal state.
 * - Emits current state as `default` output each tick.
 * - Advances internal state by `step` after emission.
 * - Direction is controlled by `mode` (`inc` | `dec`).
 *
 * Parameter schema (runtime-narrowed for P0):
 * - `start`: number (fallback: 0)
 * - `step`: number (fallback: 1)
 * - `mode`: "inc" | "dec" (fallback: "inc")
 *
 * Determinism notes:
 * - Step function is pure with respect to provided context.
 * - No external timers, global mutable references, or random sources.
 * - Identical context sequence always produces identical outputs/state.
 */
export const COUNTER_BLOCK_TYPE = "counter" as const;

type CounterMode = "inc" | "dec";

interface CounterParams {
  start: number;
  step: number;
  mode: CounterMode;
}

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseCounterParams(raw: Record<string, unknown>): CounterParams {
  const start = toFiniteNumber(raw.start, 0);
  const step = toFiniteNumber(raw.step, 1);
  const mode: CounterMode = raw.mode === "dec" ? "dec" : "inc";

  return { start, step, mode };
}

function resolvePreviousState(previousState: unknown, fallback: number): number {
  return typeof previousState === "number" && Number.isFinite(previousState)
    ? previousState
    : fallback;
}

export const CounterBlock: SimulationBlockDefinition = {
  type: COUNTER_BLOCK_TYPE,

  /**
   * Initializes deterministic internal state from `start`.
   */
  initialize: (params) => {
    const parsed = parseCounterParams(params);
    return parsed.start;
  },

  /**
   * Tick transition:
   * 1) emit current state
   * 2) compute next state via mode-adjusted step
   */
  step: ({ params, previousState }) => {
    const parsed = parseCounterParams(params);
    const current = resolvePreviousState(previousState, parsed.start);
    const delta = parsed.mode === "dec" ? -parsed.step : parsed.step;
    const next = current + delta;

    return {
      outputs: {
        default: current,
      },
      nextState: next,
    };
  },
};
