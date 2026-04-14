import { SimulationBlockDefinition, BlockStepContext, BlockStepResult } from "@/src/simulation/types";
import { BLEManager } from "@/src/utils/bleManager";

export const HEART_RATE_BLOCK_TYPE = "heart_rate_sensor";
export const BATTERY_LEVEL_BLOCK_TYPE = "battery_level_sensor";

const HEART_RATE_SERVICE = "0000180d-0000-1000-8000-00805f9b34fb";
const HEART_RATE_MEASUREMENT_CHAR = "00002a37-0000-1000-8000-00805f9b34fb";

const BATTERY_SERVICE = "0000180f-0000-1000-8000-00805f9b34fb";
const BATTERY_LEVEL_CHAR = "00002a19-0000-1000-8000-00805f9b34fb";

export interface SpecializedBLEBlockParams {
  deviceId?: string;
}

export interface SpecializedBLEBlockState {
  lastTickValue: number;
  connected: boolean;
}

export const HeartRateBlock: SimulationBlockDefinition = {
  type: HEART_RATE_BLOCK_TYPE,

  initialize: () => ({
    lastTickValue: 0,
    connected: false,
  }),

  outputPortTypes: {
    bpm: "number",
    connected: "boolean",
  },

  step: (context: BlockStepContext): BlockStepResult => {
    const params = context.params as unknown as SpecializedBLEBlockParams;
    const state = (context.previousState as SpecializedBLEBlockState) || HeartRateBlock.initialize!({});
    const bleManager = BLEManager.getInstance();

    if (params.deviceId) {
      const deviceState = bleManager.getDeviceState(params.deviceId);
      if (deviceState) {
        state.connected = deviceState.status === "connected";
        
        if (deviceState.lastValue !== null) {
          const data = new DataView(new Uint8Array(deviceState.lastValue).buffer);
          if (data.byteLength >= 2) {
            const flags = data.getUint8(0);
            const is16Bit = (flags & 0x01) !== 0;
            if (is16Bit) {
              state.lastTickValue = data.getUint16(1, true);
            } else {
              state.lastTickValue = data.getUint8(1);
            }
          }
        }
      }
    }

    return {
      outputs: {
        bpm: state.lastTickValue,
        connected: state.connected,
      },
      nextState: state,
    };
  },
};

export const BatteryLevelBlock: SimulationBlockDefinition = {
  type: BATTERY_LEVEL_BLOCK_TYPE,

  initialize: () => ({
    lastTickValue: 0,
    connected: false,
  }),

  outputPortTypes: {
    level: "number",
    connected: "boolean",
  },

  step: (context: BlockStepContext): BlockStepResult => {
    const params = context.params as unknown as SpecializedBLEBlockParams;
    const state = (context.previousState as SpecializedBLEBlockState) || BatteryLevelBlock.initialize!({});
    const bleManager = BLEManager.getInstance();

    if (params.deviceId) {
      const deviceState = bleManager.getDeviceState(params.deviceId);
      if (deviceState) {
        state.connected = deviceState.status === "connected";
        
        if (deviceState.lastValue !== null && deviceState.lastValue.length > 0) {
          state.lastTickValue = deviceState.lastValue[0];
        }
      }
    }

    return {
      outputs: {
        level: state.lastTickValue,
        connected: state.connected,
      },
      nextState: state,
    };
  },
};
