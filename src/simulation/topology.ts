import { SimulationGraph } from "./types";

/**
 * Deterministic topological sort for acyclic graphs (Kahn variant).
 *
 * Why deterministic?
 * - Multiple valid topological orders can exist for a DAG.
 * - If we allow order to depend on hash-map iteration or insertion side-effects,
 *   simulation output can differ between environments/runs.
 *
 * Determinism rule:
 * - Whenever multiple nodes have indegree 0, process them in lexical id order.
 *
 * Iteration-2 scalability path:
 * - Replace lexical ordering with a stable priority tuple
 *   (subsystemDepth, userPriority, lexicalId) if subsystem scheduling is introduced.
 */
export function getTopologicalOrder(graph: SimulationGraph): string[] {
  const indegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of graph.nodes) {
    indegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of graph.edges) {
    if (!indegree.has(edge.source) || !indegree.has(edge.target)) {
      throw new Error(
        `Invalid edge '${edge.id}': source/target missing from graph nodes.`
      );
    }

    adjacency.get(edge.source)?.push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  for (const [, neighbors] of adjacency) {
    neighbors.sort((a, b) => a.localeCompare(b));
  }

  const queue = [...indegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([id]) => id)
    .sort((a, b) => a.localeCompare(b));

  const ordered: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    ordered.push(current);

    const neighbors = adjacency.get(current) ?? [];
    for (const next of neighbors) {
      const updated = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, updated);
      if (updated === 0) {
        queue.push(next);
        queue.sort((a, b) => a.localeCompare(b));
      }
    }
  }

  if (ordered.length !== graph.nodes.length) {
    throw new Error(
      "Graph contains a cycle. P0 runtime supports acyclic graphs only."
    );
  }

  return ordered;
}
