
import { SimulationBlockDefinition } from "@/src/simulation/types";

export const RIGID_BODY_SINK_BLOCK_TYPE = "rigid-body-sink" as const;

export interface RigidBodySinkState {
  position: [number, number, number];
  rotation: [number, number, number, number]; // Quaternion [x, y, z, w]
}

export const RigidBodySinkBlock: SimulationBlockDefinition = {
  type: RIGID_BODY_SINK_BLOCK_TYPE,
  inputPortTypes: {
    pos: "vector",
    rot: "vector",
  },
  outputPortTypes: {},
  initialize: () => ({
    position: [0, 0, 0],
    rotation: [0, 0, 0, 1],
  } satisfies RigidBodySinkState),
  step: ({ inputs, previousState }) => {
    const prevState = (previousState as RigidBodySinkState) || {
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
    };

    let nextPos = prevState.position;
    if (Array.isArray(inputs.pos) && inputs.pos.length === 3) {
      nextPos = [inputs.pos[0] as number, inputs.pos[1] as number, inputs.pos[2] as number];
    }

    let nextRot = prevState.rotation;
    if (Array.isArray(inputs.rot) && inputs.rot.length === 4) {
      nextRot = [inputs.rot[0] as number, inputs.rot[1] as number, inputs.rot[2] as number, inputs.rot[3] as number];
    }

    return {
      outputs: {},
      nextState: {
        position: nextPos,
        rotation: nextRot,
      } satisfies RigidBodySinkState,
    };
  },
};
