import { SimulationBlockDefinition, BlockStepContext, BlockStepResult } from "@/src/simulation/types";
import { SensorManager } from "@/src/simulation/sensors/SensorManager";

export const ACCELEROMETER_BLOCK_TYPE = "accelerometer";

export interface AccelerometerState {
  x: number;
  y: number;
  z: number;
  permissionRequested: boolean;
}

export const AccelerometerBlock: SimulationBlockDefinition = {
  type: ACCELEROMETER_BLOCK_TYPE,

  initialize: () => ({
    x: 0,
    y: 0,
    z: 0,
    permissionRequested: false,
  }),

  outputPortTypes: {
    x: "number",
    y: "number",
    z: "number",
  },

  step: (context: BlockStepContext): BlockStepResult => {
    const state = (context.previousState as AccelerometerState) || AccelerometerBlock.initialize!({});
    const sensorManager = SensorManager.getInstance();

    if (!state.permissionRequested && typeof window !== 'undefined') {
        sensorManager.requestDeviceMotionPermission().then(status => {
            if (status === 'granted') {
                window.addEventListener('devicemotion', (event) => {
                    const acc = event.accelerationIncludingGravity || event.acceleration;
                    if (acc) {
                        state.x = acc.x || 0;
                        state.y = acc.y || 0;
                        state.z = acc.z || 0;
                    }
                });
            }
        });
        state.permissionRequested = true;
    }

    return {
      outputs: {
        x: state.x,
        y: state.y,
        z: state.z,
      },
      nextState: state,
    };
  },
};
