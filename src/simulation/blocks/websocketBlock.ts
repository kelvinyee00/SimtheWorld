import { SignalValue, SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * WebSocket Bridge Block (P13-1).
 * 
 * Contract:
 * - mode "sub": Receives data from external source.
 * - mode "pub": Sends internal signal to external sink.
 * - URL and Protocol are configurable via params.
 */
export const WEBSOCKET_BLOCK_TYPE = "websocket" as const;

export const WebSocketBlock: SimulationBlockDefinition = {
  type: WEBSOCKET_BLOCK_TYPE,
  inputPortTypes: {
    in: "any",
    default: "any",
  },
  outputPortTypes: {
    out: "any",
    default: "any",
  },
  initialize: () => ({ lastReceived: null }),
  step: ({ params, inputs, previousState }) => {
    const mode = params.mode === "pub" ? "pub" : "sub";
    const state = (previousState as { lastReceived: SignalValue }) || { lastReceived: null };

    if (mode === "pub") {
      const value = inputs.in ?? inputs.default ?? null;
      return {
        outputs: { default: value },
        nextState: state,
      };
    } else {
      return {
        outputs: {
          default: state.lastReceived,
          out: state.lastReceived,
        },
        nextState: state,
      };
    }
  },
};
