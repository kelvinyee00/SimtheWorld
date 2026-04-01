import { SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * 3D Scope Sink Block (P12-2).
 */
export const SCOPE_3D_BLOCK_TYPE = "scope3d" as const;

export const Scope3DBlock: SimulationBlockDefinition = {
  type: SCOPE_3D_BLOCK_TYPE,
  inputPortTypes: {
    x: "number",
    y: "number",
    z: "number",
  },
  outputPortTypes: {},
  initialize: () => ({ buffer: [] }),
  step: ({ inputs, previousState }) => {
    const x = typeof inputs.x === "number" ? inputs.x : 0;
    const y = typeof inputs.y === "number" ? inputs.y : 0;
    const z = typeof inputs.z === "number" ? inputs.z : 0;
    
    const buffer = [...((previousState as { buffer: { x: number; y: number; z: number }[] })?.buffer || []), { x, y, z }].slice(-1000);
    return { outputs: {}, nextState: { buffer } };
  },
};
