import { SignalValue, SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * Discrete Transfer Function block (P6-2).
 *
 * Difference equation (generic causal IIR/FIR form):
 *   y[k] = (1/a0) * ( Σ(b_i * u[k-i]) - Σ(a_j * y[k-j]) ), j starts at 1
 *
 * Parameters:
 * - numerator: number[]  (b0..bm)
 * - denominator: number[] (a0..an), a0 must be finite and non-zero
 *
 * Determinism and safety notes:
 * - Histories are node-local state, updated exactly once per tick.
 * - Invalid params are normalized to identity transfer: numerator=[1], denominator=[1].
 * - Non-finite input samples are treated as 0 to avoid NaN propagation.
 */
export const DISCRETE_TRANSFER_FCN_BLOCK_TYPE = "discrete-transfer-fcn" as const;

interface DiscreteTransferParams {
  numerator: number[];
  denominator: number[];
}

interface DiscreteTransferState {
  inputHistory: number[];
  outputHistory: number[];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeCoefficients(raw: unknown, fallback: number[]): number[] {
  if (!Array.isArray(raw)) {
    return fallback;
  }

  const normalized = raw.filter(isFiniteNumber);
  return normalized.length > 0 ? normalized : fallback;
}

function parseParams(raw: Record<string, unknown>): DiscreteTransferParams {
  const numerator = normalizeCoefficients(raw.numerator, [1]);
  const denominator = normalizeCoefficients(raw.denominator, [1]);

  const a0 = denominator[0] ?? 1;
  if (!Number.isFinite(a0) || a0 === 0) {
    return {
      numerator: [1],
      denominator: [1],
    };
  }

  return {
    numerator,
    denominator,
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

function toState(
  previousState: unknown,
  requiredInputHistoryLength: number,
  requiredOutputHistoryLength: number
): DiscreteTransferState {
  if (
    typeof previousState === "object" &&
    previousState !== null &&
    "inputHistory" in previousState &&
    "outputHistory" in previousState &&
    Array.isArray((previousState as { inputHistory?: unknown }).inputHistory) &&
    Array.isArray((previousState as { outputHistory?: unknown }).outputHistory)
  ) {
    const candidate = previousState as {
      inputHistory: unknown[];
      outputHistory: unknown[];
    };

    const inputHistory = candidate.inputHistory
      .filter(isFiniteNumber)
      .slice(0, requiredInputHistoryLength);
    const outputHistory = candidate.outputHistory
      .filter(isFiniteNumber)
      .slice(0, requiredOutputHistoryLength);

    while (inputHistory.length < requiredInputHistoryLength) {
      inputHistory.push(0);
    }
    while (outputHistory.length < requiredOutputHistoryLength) {
      outputHistory.push(0);
    }

    return {
      inputHistory,
      outputHistory,
    };
  }

  return {
    inputHistory: new Array(requiredInputHistoryLength).fill(0),
    outputHistory: new Array(requiredOutputHistoryLength).fill(0),
  };
}

export const DiscreteTransferFcnBlock: SimulationBlockDefinition = {
  type: DISCRETE_TRANSFER_FCN_BLOCK_TYPE,
  inputPortTypes: { in: "number", default: "number" },
  outputPortTypes: { default: "number" },
  initialize: () => ({
    inputHistory: [0],
    outputHistory: [0],
  } satisfies DiscreteTransferState),
  step: ({ params, inputs, previousState }) => {
    const parsed = parseParams(params);
    const inputOrder = parsed.numerator.length;
    const outputOrder = Math.max(0, parsed.denominator.length - 1);

    const state = toState(previousState, inputOrder, outputOrder);
    const sample = readInputValue(inputs);

    const nextInputHistory = [sample, ...state.inputHistory].slice(0, inputOrder);

    const bTerms = parsed.numerator.reduce((acc, coefficient, index) => {
      const u = nextInputHistory[index] ?? 0;
      return acc + coefficient * u;
    }, 0);

    const aTerms = parsed.denominator.slice(1).reduce((acc, coefficient, index) => {
      const yDelayed = state.outputHistory[index] ?? 0;
      return acc + coefficient * yDelayed;
    }, 0);

    const a0 = parsed.denominator[0] ?? 1;
    const output = (bTerms - aTerms) / a0;

    const nextOutputHistory = [output, ...state.outputHistory].slice(0, outputOrder);

    return {
      outputs: {
        default: Number.isFinite(output) ? output : 0,
      },
      nextState: {
        inputHistory: nextInputHistory,
        outputHistory: nextOutputHistory,
      } satisfies DiscreteTransferState,
    };
  },
};
