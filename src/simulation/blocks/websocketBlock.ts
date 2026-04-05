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
  inputPortTypes: { in: "any", default: "any" },
  outputPortTypes: { out: "any", default: "any" },
  initialize: () => ({ lastReceived: null as SignalValue }),
  step: ({ params, inputs, previousState }) => {
    const mode = params.mode === "pub" ? "pub" : "sub";
    const state = { lastReceived: (previousState as { lastReceived: SignalValue })?.lastReceived ?? null };
    
    if (mode === "pub") {
      const value = inputs.in ?? inputs.default ?? null;
      // Both outputs receive the same value in pub mode
      return {
        outputs: { default: value, out: value },
        nextState: state,
      };
    } else {
      // Sub mode emits last received value on both outputs
      const val = state.lastReceived;
      return {
        outputs: { default: val, out: val },
        nextState: state,
      };
    }
  },
};
