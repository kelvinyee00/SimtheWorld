import { SimulationBlockDefinition, BlockStepContext, BlockStepResult } from "@/src/simulation/types";
import { SensorManager } from "@/src/simulation/sensors/SensorManager";

export const ORIENTATION_BLOCK_TYPE = "orientation";

export interface OrientationState {
  alpha: number; // Yaw
  beta: number;  // Pitch
  gamma: number; // Roll
  permissionRequested: boolean;
}

export const OrientationBlock: SimulationBlockDefinition = {
  type: ORIENTATION_BLOCK_TYPE,

  initialize: () => ({
    alpha: 0,
    beta: 0,
    gamma: 0,
    permissionRequested: false,
  }),

  outputPortTypes: {
    alpha: "number",
    beta: "number",
    gamma: "number",
  },

  step: (context: BlockStepContext): BlockStepResult => {
    const state = (context.previousState as OrientationState) || OrientationBlock.initialize!({});
    const sensorManager = SensorManager.getInstance();

    if (!state.permissionRequested && typeof window !== 'undefined') {
        sensorManager.requestDeviceOrientationPermission().then(status => {
            if (status === 'granted') {
                window.addEventListener('deviceorientation', (event) => {
                    state.alpha = event.alpha || 0;
                    state.beta = event.beta || 0;
                    state.gamma = event.gamma || 0;
                });
            }
        });
        state.permissionRequested = true;
    }

    return {
      outputs: {
        alpha: state.alpha,
        beta: state.beta,
        gamma: state.gamma,
      },
      nextState: state,
    };
  },
};
