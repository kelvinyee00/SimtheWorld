import { SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * P11-2: Interactive Source Blocks
 * 
 * Design Philosophy:
 * - Sources that represent external human input (Hardware-in-the-loop / User-in-the-loop).
 * - Values are pushed from the UI layer to node parameters.
 * - The simulation block simply emits the current parameter value.
 */

// --- KNOB BLOCK ---
export const KNOB_BLOCK_TYPE = "knob" as const;

export const KnobBlock: SimulationBlockDefinition = {
  type: KNOB_BLOCK_TYPE,
  inputPortTypes: {},
  outputPortTypes: { default: "number" },
  initialize: (params) => {
    const value = typeof params.value === "number" ? params.value : 0;
    return { value };
  },
  step: ({ params }) => {
    const value = typeof params.value === "number" ? params.value : 0;
    return { 
      outputs: { default: value },
      nextState: { value }
    };
  },
};

// --- SLIDER BLOCK ---
export const SLIDER_BLOCK_TYPE = "slider" as const;

export const SliderBlock: SimulationBlockDefinition = {
  type: SLIDER_BLOCK_TYPE,
  inputPortTypes: {},
  outputPortTypes: { default: "number" },
  initialize: (params) => {
    const value = typeof params.value === "number" ? params.value : 0;
    return { value };
  },
  step: ({ params }) => {
    const value = typeof params.value === "number" ? params.value : 0;
    return { 
      outputs: { default: value },
      nextState: { value }
    };
  },
};
