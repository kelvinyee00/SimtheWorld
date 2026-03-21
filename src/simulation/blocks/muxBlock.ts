import { SignalValue, SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * Mux block (P5-3 vector signal v1).
 *
 * Contract:
 * - Merges scalar numeric inputs into a fixed-size numeric vector payload.
 * - v1 shape is two channels `[in1, in2]`.
 */
export const MUX_BLOCK_TYPE = "mux" as const;

function toNumberOrNull(value: SignalValue): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export const MuxBlock: SimulationBlockDefinition = {
  type: MUX_BLOCK_TYPE,
  inputPortTypes: {
    default: "number",
    in1: "number",
    in2: "number",
  },
  outputPortTypes: {
    default: "vector",
  },
  step: ({ inputs }) => {
    const in1 = toNumberOrNull(inputs.in1 ?? inputs.default ?? null);
    const in2 = toNumberOrNull(inputs.in2 ?? inputs.default__2 ?? null);

    return {
      outputs: {
        default: [in1 ?? 0, in2 ?? 0],
      },
    };
  },
};
