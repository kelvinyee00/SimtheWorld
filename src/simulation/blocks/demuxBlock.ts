import { SignalValue, SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * Demux block (P5-3 vector signal v1).
 *
 * Contract:
 * - Splits vector payload into scalar outputs.
 * - v1 supports two scalar channels exposed as `out1` and `out2`.
 * - `default` mirrors `out1` for backward compatibility with edges lacking sourceHandle.
 */
export const DEMUX_BLOCK_TYPE = "demux" as const;

function toNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toVector(value: SignalValue): number[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value
    .map((entry) => toNumberOrNull(entry))
    .filter((entry): entry is number => typeof entry === "number");
}

export const DemuxBlock: SimulationBlockDefinition = {
  type: DEMUX_BLOCK_TYPE,
  inputPortTypes: {
    default: "vector",
    in: "vector",
  },
  outputPortTypes: {
    default: "number",
    out1: "number",
    out2: "number",
  },
  step: ({ inputs }) => {
    const vector = toVector(inputs.in ?? inputs.default ?? null) ?? [];

    const out1 = toNumberOrNull(vector[0] ?? null);
    const out2 = toNumberOrNull(vector[1] ?? null);

    return {
      outputs: {
        default: out1,
        out1,
        out2,
      },
    };
  },
};
