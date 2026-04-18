import { SimulationBlockDefinition } from "@/src/simulation/types";

export const SCOPE_3D_BLOCK_TYPE = "scope-3d" as const;

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Scope3DState {
  samples: Point3D[];
}

export const Scope3DBlock: SimulationBlockDefinition = {
  type: SCOPE_3D_BLOCK_TYPE,
  inputPortTypes: { x: "number", y: "number", z: "number" },
  outputPortTypes: {},
  initialize: () => ({
    samples: [],
  } satisfies Scope3DState),
  step: ({ params, inputs, previousState }) => {
    const maxPoints = typeof params.maxPoints === "number" ? params.maxPoints : 500;
    const state = (previousState as Scope3DState) || { samples: [] };
    
    const x = typeof inputs.x === "number" ? inputs.x : 0;
    const y = typeof inputs.y === "number" ? inputs.y : 0;
    const z = typeof inputs.z === "number" ? inputs.z : 0;
    
    const nextSamples = [...state.samples, { x, y, z }].slice(-maxPoints);
    
    return {
      outputs: {},
      nextState: {
        samples: nextSamples,
      } satisfies Scope3DState,
    };
  },
};
