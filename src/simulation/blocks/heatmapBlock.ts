import { SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * Heatmap Sink Block (P12-4).
 * 
 * Contract:
 * - Accepts a matrix (`number[][]`) as input.
 * - Displays a color-coded heatmap of the matrix values.
 */
export const HEATMAP_BLOCK_TYPE = "heatmap" as const;

export const HeatmapBlock: SimulationBlockDefinition = {
  type: HEATMAP_BLOCK_TYPE,
  inputPortTypes: {
    in: "matrix",
  },
  outputPortTypes: {},
  initialize: () => ({ matrix: null }),
  step: ({ inputs }) => {
    const matrix = inputs.in ?? null;
    return { 
      outputs: {}, 
      nextState: { matrix } 
    };
  },
};
