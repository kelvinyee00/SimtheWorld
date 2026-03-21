import { SignalValue, SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * Outport block (P4-3 subsystem internals).
 *
 * Captures the selected internal signal and re-exposes it on `default` output so the
 * subsystem wrapper can export named ports back to the parent graph.
 */
export const OUTPORT_BLOCK_TYPE = "outport" as const;

function normalizeSignal(value: SignalValue): SignalValue {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return null;
}

export const OutportBlock: SimulationBlockDefinition = {
  type: OUTPORT_BLOCK_TYPE,
  inputPortTypes: { default: "any", in: "any" },
  outputPortTypes: { default: "any" },
  initialize: () => null,
  step: ({ inputs }) => {
    const next = normalizeSignal(inputs.default ?? inputs.in ?? null);
    return {
      outputs: { default: next },
      nextState: next,
    };
  },
};
