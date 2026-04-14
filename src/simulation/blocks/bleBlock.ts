import { SimulationBlockDefinition, BlockStepContext, BlockStepResult, SignalValue } from "@/src/simulation/types";
import { BLEManager } from "@/src/utils/bleManager";

export const BLE_BLOCK_TYPE = "ble_device";

export interface BLEBlockParams {
  deviceId?: string;
  characteristicUUID?: string;
  serviceUUID?: string;
  parsingMode: "raw" | "float32" | "uint8" | "json";
}

export interface BLEBlockState {
  lastTickValue: SignalValue;
  connected: boolean;
  initialized: boolean;
}

export const BLEBlock: SimulationBlockDefinition = {
  type: BLE_BLOCK_TYPE,

  initialize: () => ({
    lastTickValue: 0,
    connected: false,
    initialized: false,
  }),

  outputPortTypes: {
    default: "any",
    connected: "boolean",
  },

  step: (context: BlockStepContext): BlockStepResult => {
    const params = context.params as unknown as BLEBlockParams;
    const state = (context.previousState as BLEBlockState) || BLEBlock.initialize!({});
    const bleManager = BLEManager.getInstance();

    if (params.deviceId) {
      const deviceState = bleManager.getDeviceState(params.deviceId);
      if (deviceState) {
        state.connected = deviceState.status === "connected";
        
        if (deviceState.lastValue !== null) {
          const bytes = deviceState.lastValue;
          const buffer = new Uint8Array(bytes).buffer;
          const dataView = new DataView(buffer);

          switch (params.parsingMode) {
            case "float32":
              state.lastTickValue = dataView.byteLength >= 4 ? dataView.getFloat32(0, true) : state.lastTickValue;
              break;
            case "uint8":
              state.lastTickValue = bytes[0];
              break;
            case "json":
              try {
                const decoder = new TextDecoder();
                state.lastTickValue = JSON.parse(decoder.decode(buffer)) as SignalValue;
              } catch (e) {
                // Keep last value on parse error
              }
              break;
            case "raw":
            default:
              state.lastTickValue = bytes;
              break;
          }
        }
      } else {
        state.connected = false;
      }
    }

    return {
      outputs: {
        default: state.lastTickValue,
        connected: state.connected,
      },
      nextState: state,
    };
  },
};
