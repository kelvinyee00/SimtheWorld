import { COUNTER_BLOCK_TYPE } from "@/src/simulation/blocks/counterBlock";
import { DISPLAY_BLOCK_TYPE } from "@/src/simulation/blocks/displayBlock";
import { GAIN_BLOCK_TYPE } from "@/src/simulation/blocks/gainBlock";
import { INTEGRATOR_BLOCK_TYPE } from "@/src/simulation/blocks/integratorBlock";
import { PRODUCT_BLOCK_TYPE } from "@/src/simulation/blocks/productBlock";
import { SCOPE_BLOCK_TYPE } from "@/src/simulation/blocks/scopeBlock";
import { SUM_BLOCK_TYPE } from "@/src/simulation/blocks/sumBlock";
import { TO_FILE_BLOCK_TYPE } from "@/src/simulation/blocks/toFileBlock";
import { UNIT_DELAY_BLOCK_TYPE } from "@/src/simulation/blocks/unitDelayBlock";
import { getTopologicalOrder } from "@/src/simulation/topology";
import { BlockRegistry, SimulationGraph } from "@/src/simulation/types";

export interface GraphValidationIssue {
  code:
    | "UNKNOWN_BLOCK_TYPE"
    | "INVALID_EDGE_ENDPOINT"
    | "INVALID_SOURCE_HANDLE"
    | "INVALID_TARGET_HANDLE"
    | "TARGET_HAS_NO_INPUT_PORTS"
    | "UNSUPPORTED_CYCLE";
  message: string;
  nodeId?: string;
  edgeId?: string;
}

function getAllowedTargetHandles(type: string): string[] {
  switch (type) {
    case DISPLAY_BLOCK_TYPE:
    case SCOPE_BLOCK_TYPE:
      return ["default"];
    case GAIN_BLOCK_TYPE:
      return ["in", "default"];
    case SUM_BLOCK_TYPE:
    case PRODUCT_BLOCK_TYPE:
      return ["in1", "in2", "default"];
    case INTEGRATOR_BLOCK_TYPE:
    case UNIT_DELAY_BLOCK_TYPE:
      return ["in", "default"];
    case TO_FILE_BLOCK_TYPE:
      return ["default", "in"];
    case COUNTER_BLOCK_TYPE:
      return [];
    default:
      return ["default"];
  }
}

/**
 * Pre-run graph validation gate for P3-4.
 *
 * Guarantees:
 * - Unknown block types are rejected before scheduler start.
 * - Handle mismatches produce deterministic actionable diagnostics.
 * - Unsupported algebraic cycles fail fast with explicit guidance.
 */
export function validateSimulationGraph(params: {
  graph: SimulationGraph;
  registry: BlockRegistry;
}): GraphValidationIssue[] {
  const { graph, registry } = params;
  const issues: GraphValidationIssue[] = [];

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

  for (const node of graph.nodes) {
    if (!registry[node.type]) {
      issues.push({
        code: "UNKNOWN_BLOCK_TYPE",
        nodeId: node.id,
        message: `Node '${node.id}' references unknown block type '${node.type}'.`,
      });
    }
  }

  for (const edge of graph.edges) {
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);

    if (!sourceNode || !targetNode) {
      issues.push({
        code: "INVALID_EDGE_ENDPOINT",
        edgeId: edge.id,
        message: `Edge '${edge.id}' references missing source/target node(s).`,
      });
      continue;
    }

    const sourceHandle = edge.sourceHandle ?? "default";
    if (sourceHandle !== "default") {
      issues.push({
        code: "INVALID_SOURCE_HANDLE",
        edgeId: edge.id,
        message: `Edge '${edge.id}' uses unsupported source handle '${sourceHandle}'.`,
      });
    }

    const targetHandle = edge.targetHandle ?? "default";
    const allowedTargets = getAllowedTargetHandles(targetNode.type);

    if (allowedTargets.length === 0) {
      issues.push({
        code: "TARGET_HAS_NO_INPUT_PORTS",
        edgeId: edge.id,
        nodeId: targetNode.id,
        message: `Edge '${edge.id}' targets '${targetNode.id}', but block type '${targetNode.type}' has no input ports.`,
      });
      continue;
    }

    if (!allowedTargets.includes(targetHandle)) {
      issues.push({
        code: "INVALID_TARGET_HANDLE",
        edgeId: edge.id,
        nodeId: targetNode.id,
        message: `Edge '${edge.id}' targets invalid handle '${targetHandle}' on '${targetNode.id}'. Allowed: ${allowedTargets.join(
          ", "
        )}.`,
      });
    }
  }

  if (issues.some((issue) => issue.code === "INVALID_EDGE_ENDPOINT")) {
    return issues;
  }

  const feedbackSourceNodeIds = new Set(
    graph.nodes
      .filter((node) => registry[node.type]?.breaksAlgebraicLoop === true)
      .map((node) => node.id)
  );

  try {
    getTopologicalOrder(graph, { feedbackSourceNodeIds });
  } catch (error) {
    issues.push({
      code: "UNSUPPORTED_CYCLE",
      message:
        error instanceof Error
          ? error.message
          : "Graph contains unsupported cycle; insert Unit Delay/Integrator blocks.",
    });
  }

  return issues;
}

export function formatGraphValidationIssues(issues: GraphValidationIssue[]): string {
  if (issues.length === 0) {
    return "";
  }

  const header = `Graph validation failed (${issues.length} issue${issues.length === 1 ? "" : "s"}).`;
  const body = issues
    .slice(0, 5)
    .map((issue, index) => `${index + 1}. ${issue.message}`)
    .join(" ");

  if (issues.length <= 5) {
    return `${header} ${body}`;
  }

  return `${header} ${body} (+${issues.length - 5} more).`;
}
