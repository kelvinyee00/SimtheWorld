import type { DefaultEdgeOptions } from "reactflow";

/**
 * Global edge styling + interaction policy for the block-diagram canvas.
 *
 * Product directives:
 * - All connections must render as straight lines.
 * - Wires must remain easy to click/select/delete in dense diagrams.
 *
 * Interaction notes:
 * - `interactionWidth` inflates the invisible hit corridor around the line so users can
 *   reliably target edges even on touch devices or small screens.
 */
export const DEFAULT_EDGE_OPTIONS: DefaultEdgeOptions = {
  type: "straight",
  interactionWidth: 42,
  style: {
    stroke: "#334155",
    strokeWidth: 2.6,
  },
};
