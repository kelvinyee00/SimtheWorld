import { SignalValue, SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * PID Controller block (P6-1).
 *
 * Discrete control law (parallel form):
 * - u[k] = Kp*e[k] + I[k] + D[k]
 *
 * Integrator update:
 * - I[k+1] = I[k] + Ki*e[k]*dt
 *
 * Derivative with first-order low-pass filter (N):
 * - rawDerivative = (e[k] - e[k-1]) / dt
 * - dFiltered[k] = dFiltered[k-1] + alpha * (rawDerivative - dFiltered[k-1])
 * - alpha = (N*dt) / (1 + N*dt)
 * - D[k] = Kd * dFiltered[k]
 *
 * Anti-windup strategy (conditional integration + output clamp):
 * - Compute tentative output with updated integrator.
 * - If output saturates and current error would push further into saturation,
 *   freeze integrator for that tick.
 *
 * Ports:
 * - Input  : `in` (or `default`) => control error signal (number)
 * - Output : `default` => controller output (number, saturated if limits configured)
 */
export const PID_BLOCK_TYPE = "pid" as const;

interface PidParams {
  kp: number;
  ki: number;
  kd: number;
  n: number;
  lowerSaturation: number | null;
  upperSaturation: number | null;
}

interface PidState {
  integral: number;
  previousError: number;
  filteredDerivative: number;
}

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toOptionalFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parsePidParams(raw: Record<string, unknown>): PidParams {
  const lowerCandidate = toOptionalFiniteNumber(raw.lowerSaturation);
  const upperCandidate = toOptionalFiniteNumber(raw.upperSaturation);

  const hasFiniteBand =
    lowerCandidate !== null &&
    upperCandidate !== null &&
    lowerCandidate < upperCandidate;

  return {
    kp: toFiniteNumber(raw.kp, 1),
    ki: toFiniteNumber(raw.ki, 0),
    kd: toFiniteNumber(raw.kd, 0),
    n: Math.max(0, toFiniteNumber(raw.n, 10)),
    lowerSaturation: hasFiniteBand ? lowerCandidate : null,
    upperSaturation: hasFiniteBand ? upperCandidate : null,
  };
}

function readErrorInput(inputs: Record<string, SignalValue>): number | null {
  const direct = inputs.in ?? inputs.default;
  if (typeof direct === "number" && Number.isFinite(direct)) {
    return direct;
  }

  const sortedKeys = Object.keys(inputs).sort((a, b) => a.localeCompare(b));
  for (const key of sortedKeys) {
    const candidate = inputs[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }

  return null;
}

function toPidState(previousState: unknown): PidState {
  if (
    typeof previousState === "object" &&
    previousState !== null &&
    "integral" in previousState &&
    "previousError" in previousState &&
    "filteredDerivative" in previousState
  ) {
    const candidate = previousState as Record<string, unknown>;
    return {
      integral: toFiniteNumber(candidate.integral, 0),
      previousError: toFiniteNumber(candidate.previousError, 0),
      filteredDerivative: toFiniteNumber(candidate.filteredDerivative, 0),
    };
  }

  return {
    integral: 0,
    previousError: 0,
    filteredDerivative: 0,
  };
}

function clamp(value: number, lower: number | null, upper: number | null): number {
  if (lower !== null && value < lower) {
    return lower;
  }
  if (upper !== null && value > upper) {
    return upper;
  }
  return value;
}

export const PidBlock: SimulationBlockDefinition = {
  type: PID_BLOCK_TYPE,
  inputPortTypes: { in: "number", default: "number" },
  outputPortTypes: { default: "number" },
  initialize: () => ({
    integral: 0,
    previousError: 0,
    filteredDerivative: 0,
  } satisfies PidState),
  step: ({ params, inputs, previousState, stepTimeMs }) => {
    const parsed = parsePidParams(params);
    const error = readErrorInput(inputs);
    const state = toPidState(previousState);

    if (error === null) {
      return {
        outputs: { default: null },
        nextState: state,
      };
    }

    const dtSeconds = stepTimeMs / 1_000;
    const rawDerivative = dtSeconds > 0 ? (error - state.previousError) / dtSeconds : 0;
    const alpha =
      parsed.n <= 0 || dtSeconds <= 0
        ? 0
        : (parsed.n * dtSeconds) / (1 + parsed.n * dtSeconds);
    const filteredDerivative =
      state.filteredDerivative + alpha * (rawDerivative - state.filteredDerivative);

    const proportionalTerm = parsed.kp * error;
    const derivativeTerm = parsed.kd * filteredDerivative;

    const tentativeIntegral = state.integral + parsed.ki * error * dtSeconds;
    const tentativeUnclampedOutput = proportionalTerm + tentativeIntegral + derivativeTerm;

    const hasSaturation =
      parsed.lowerSaturation !== null && parsed.upperSaturation !== null;

    let integrated = tentativeIntegral;
    let output = tentativeUnclampedOutput;

    if (hasSaturation) {
      const saturated = clamp(
        tentativeUnclampedOutput,
        parsed.lowerSaturation,
        parsed.upperSaturation
      );

      const hitUpper =
        parsed.upperSaturation !== null && tentativeUnclampedOutput > parsed.upperSaturation;
      const hitLower =
        parsed.lowerSaturation !== null && tentativeUnclampedOutput < parsed.lowerSaturation;

      const pushesFurtherPositive = hitUpper && error > 0;
      const pushesFurtherNegative = hitLower && error < 0;

      if (pushesFurtherPositive || pushesFurtherNegative) {
        integrated = state.integral;
      }

      // Output remains saturated even when integrator update is conditionally rejected.
      // This preserves actuator-limited command behavior while preventing additional windup.
      output = saturated;
    }

    return {
      outputs: {
        default: output,
      },
      nextState: {
        integral: integrated,
        previousError: error,
        filteredDerivative,
      } satisfies PidState,
    };
  },
};
