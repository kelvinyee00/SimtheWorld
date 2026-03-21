import { SignalValue, SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * Switch block (P4-2 boolean-controlled numeric selector).
 *
 * Inputs:
 * - `cond`   : boolean selector (true -> inTrue, false -> inFalse)
 * - `inTrue` : numeric branch value when cond=true
 * - `inFalse`: numeric branch value when cond=false
 */
export const SWITCH_BLOCK_TYPE = "switch" as const;

function toBooleanOrNull(value: SignalValue): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function toNumberOrNull(value: SignalValue): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export const SwitchBlock: SimulationBlockDefinition = {
  type: SWITCH_BLOCK_TYPE,
  inputPortTypes: {
    cond: "boolean",
    inTrue: "number",
    inFalse: "number",
    default: "number",
  },
  outputPortTypes: {
    default: "number",
  },
  step: ({ inputs }) => {
    const cond = toBooleanOrNull(inputs.cond ?? null);
    const inTrue = toNumberOrNull(inputs.inTrue ?? inputs.default ?? null);
    const inFalse = toNumberOrNull(inputs.inFalse ?? inputs.default__2 ?? null);

    if (cond === null) {
      return {
        outputs: {
          default: null,
        },
      };
    }

    const selected = cond ? inTrue : inFalse;

    return {
      outputs: {
        default: selected,
      },
    };
  },
};
