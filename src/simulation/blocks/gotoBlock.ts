import { SignalValue, SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * GOTO block (P6-4 Global Signal Bus).
 *
 * Writes its input signal into the global signal bus using `tag`.
 * Output mirrors the input on `default` for local observability.
 */
export const GOTO_BLOCK_TYPE = "goto" as const;

function readInputValue(inputs: Record<string, SignalValue>): SignalValue {
  const direct = inputs.in ?? inputs.default;
  if (typeof direct !== "undefined") {
    return direct;
  }

  const keys = Object.keys(inputs).sort((left, right) => left.localeCompare(right));
  for (const key of keys) {
    return inputs[key] ?? null;
  }

  return null;
}

function normalizeTag(raw: unknown): string {
  if (typeof raw !== "string") {
    return "signal";
  }

  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : "signal";
}

export const GotoBlock: SimulationBlockDefinition = {
  type: GOTO_BLOCK_TYPE,
  inputPortTypes: { in: "any", default: "any" },
  outputPortTypes: { default: "any" },
  step: ({ params, inputs, globalSignals }) => {
    const tag = normalizeTag(params.tag);
    const value = readInputValue(inputs);
    globalSignals[tag] = value;

    return {
      outputs: {
        default: value,
      },
    };
  },
};
