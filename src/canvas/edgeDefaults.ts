import type { DefaultEdgeOptions } from "reactflow";

/**
 * Global edge styling policy for the block-diagram canvas.
 *
 * Product Owner directive:
 * - All connections must render as straight lines (no curved/crooked edges).
 *
 * Integration contract:
 * - P0-5 ReactFlow canvas must pass this object via `defaultEdgeOptions`.
 * - Any ad-hoc edge creation should inherit this policy unless a future
 *   product requirement explicitly introduces alternative edge types.
 */
export const DEFAULT_EDGE_OPTIONS: DefaultEdgeOptions = {
  type: "straight",
};
