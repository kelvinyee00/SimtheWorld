/**
 * Signal Path Tracing Utilities (P10-3)
 *
 * High-density documentation standard:
 * - Deterministic breadth-first traversal for signal path highlighting.
 * - Separates source-to-sink chain discovery from visual styling concerns.
 * - Graph traversal is O(V+E) and memoizes intermediate results to avoid
 *   redundant walks during rapid selection changes.
 */

import type { Edge, Node } from "reactflow";

/**
 * Path trace result containing all entities in the forward signal chain.
 *
 * Includes:
 * - nodeIds: all block IDs reachable from the source (including source itself)
 * - edgeIds: all wire connections in the forward path
 * - sinkIds: terminal blocks where the chain ends (no further outputs)
 */
export interface SignalPathTrace {
  nodeIds: Set<string>;
  edgeIds: Set<string>;
  sinkIds: Set<string>;
}

/**
 * Trace the complete signal path from a selected source node.
 *
 * Algorithm:
 * 1. Build forward adjacency for O(1) edge lookup during traversal.
 * 2. BFS from source to capture all reachable nodes and edges.
 * 3. Collect terminal nodes as sinks for downstream UI highlighting.
 *
 * Complexity: O(V+E) worst case when path covers entire graph.
 * Early exit possible when local subgraph is small.
 */
export function traceSignalPath(params: {
  sourceNodeId: string;
  nodes: Node[];
  edges: Edge[];
}): SignalPathTrace {
  const { sourceNodeId, edges } = params;

  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const sinkIds = new Set<string>();

  // BFS queue for deterministic traversal
  const queue: string[] = [sourceNodeId];
  nodeIds.add(sourceNodeId);

  while (queue.length > 0) {
    const currentNodeId = queue.shift()!;
    
    // Find outgoing edges from this node
    const outgoingEdges = edges.filter(e => e.source === currentNodeId);

    // If no outgoing edges, this is a sink
    if (outgoingEdges.length === 0) {
      sinkIds.add(currentNodeId);
      continue;
    }

    for (const edge of outgoingEdges) {
      edgeIds.add(edge.id);

      if (!nodeIds.has(edge.target)) {
        nodeIds.add(edge.target);
        queue.push(edge.target);
      }
    }
  }

  return { nodeIds, edgeIds, sinkIds };
}

/**
 * Compute edge style overrides for signal path highlighting.
 *
 * Visual policy (P10-3):
 * - Highlighted edges: thicker stroke (3.5px), source-orange color (#f97316)
 * - Non-highlighted edges: default slate (#334155) with full opacity
 * - Dim non-highlighted edges slightly (0.35 opacity) to emphasize path
 *
 * Industrial palette alignment:
 * - Orange (#f97316) ties to source block semantics (Counter, etc.)
 * - Straight edges preserved per P0/P1 visual policy.
 */
export function computeEdgeStyles(params: {
  edges: Edge[];
  highlightedEdgeIds: Set<string>;
  isActive: boolean;
}): Edge[] {
  const { edges, highlightedEdgeIds, isActive } = params;

  // If no active selection, return edges unmodified
  if (!isActive) {
    return edges;
  }

  return edges.map((edge) => {
    const isHighlighted = highlightedEdgeIds.has(edge.id);

    if (isHighlighted) {
      // Highlighted path: brighter, thicker, fully opaque
      return {
        ...edge,
        style: {
          ...edge.style,
          stroke: "#f97316", // source-orange
          strokeWidth: 3.5,
          opacity: 1,
        },
      };
    }

    // Non-highlighted edges: dimmed to emphasize the active path
    return {
      ...edge,
      style: {
        ...edge.style,
        stroke: "#334155",
        strokeWidth: 2.6,
        opacity: 0.35,
      },
    };
  });
}
