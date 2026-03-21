import { SignalValue, SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * Inport block (P4-3 subsystem internals).
 *
 * External subsystem wrapper injects values into Inport node state before internal stepping.
 * This block then emits that latched value on `default` output.
 */
export const INPORT_BLOCK_TYPE = "inport" as const;

function toSignalOrNull(value: unknown): SignalValue {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return null;
}

export const InportBlock: SimulationBlockDefinition = {
  type: INPORT_BLOCK_TYPE,
  outputPortTypes: { default: "any" },
  initialize: () => null,
  step: ({ previousState }) => {
    const current = toSignalOrNull(previousState);
    return {
      outputs: { default: current },
      nextState: current,
    };
  },
};
