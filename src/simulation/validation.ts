import { getTopologicalOrder } from "@/src/simulation/topology";
import {
  BlockRegistry,
  SignalType,
  SimulationEdge,
  SimulationGraph,
  SimulationNode,
} from "@/src/simulation/types";

export interface GraphValidationIssue {
  code:
    | "UNKNOWN_BLOCK_TYPE"
    | "INVALID_EDGE_ENDPOINT"
    | "INVALID_SOURCE_HANDLE"
    | "INVALID_TARGET_HANDLE"
    | "TARGET_HAS_NO_INPUT_PORTS"
    | "INVALID_SIGNAL_TYPE"
    | "INVALID_SAMPLE_TIME"
    | "UNSUPPORTED_CYCLE";
  message: string;
  nodeId?: string;
  edgeId?: string;
}

function normalizeHandleBase(handle: string): string {
  return handle.split("__", 1)[0] ?? handle;
}

function getKnownInputHandles(type: string, registry: BlockRegistry): string[] {
  const definition = registry[type];
  if (!definition?.inputPortTypes) {
    return [];
  }

  return Object.keys(definition.inputPortTypes);
}

function getKnownOutputHandles(type: string, registry: BlockRegistry): string[] {
  const definition = registry[type];
  if (!definition?.outputPortTypes) {
    return ["default"];
  }

  return Object.keys(definition.outputPortTypes);
}

function getInputSignalType(params: {
  type: string;
  handle: string;
  registry: BlockRegistry;
}): SignalType {
  const { type, handle, registry } = params;
  const definition = registry[type];
  const base = normalizeHandleBase(handle);

  if (!definition?.inputPortTypes) {
    return "any";
  }

  return (
    definition.inputPortTypes[base] ??
    definition.inputPortTypes.default ??
    "any"
  );
}

function getOutputSignalType(params: {
  type: string;
  handle: string;
  registry: BlockRegistry;
}): SignalType {
  const { type, handle, registry } = params;
  const definition = registry[type];
  const base = normalizeHandleBase(handle);

  if (!definition?.outputPortTypes) {
    return "any";
  }

  return (
    definition.outputPortTypes[base] ??
    definition.outputPortTypes.default ??
    "any"
  );
}

function areSignalTypesCompatible(source: SignalType, target: SignalType): boolean {
  if (source === "any" || target === "any") {
    return true;
  }
  return source === target;
}

function validateNodeSampleTime(node: SimulationNode): GraphValidationIssue | null {
  const raw = (node.data as Record<string, unknown> | undefined)?.sampleTimeMs;
  if (typeof raw === "undefined") {
    return null;
  }

  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return {
      code: "INVALID_SAMPLE_TIME",
      nodeId: node.id,
      message: `Node '${node.id}' has invalid sampleTimeMs '${String(raw)}'. Expected positive finite number.`,
    };
  }

  return null;
}

export function validateConnectionCandidate(params: {
  graph: SimulationGraph;
  registry: BlockRegistry;
  edge: SimulationEdge;
}): GraphValidationIssue | null {
  const { graph, registry, edge } = params;

  const sourceNode = graph.nodes.find((node) => node.id === edge.source);
  const targetNode = graph.nodes.find((node) => node.id === edge.target);

  if (!sourceNode || !targetNode) {
    return {
      code: "INVALID_EDGE_ENDPOINT",
      edgeId: edge.id,
      message: `Edge '${edge.id}' references missing source/target node(s).`,
    };
  }

  const sourceDefinition = registry[sourceNode.type];
  const targetDefinition = registry[targetNode.type];

  if (!sourceDefinition || !targetDefinition) {
    return null;
  }

  const sourceHandle = edge.sourceHandle ?? "default";
  const sourceHandleBase = normalizeHandleBase(sourceHandle);
  const knownSourceHandles = getKnownOutputHandles(sourceNode.type, registry);
  if (!knownSourceHandles.includes(sourceHandleBase)) {
    return {
      code: "INVALID_SOURCE_HANDLE",
      edgeId: edge.id,
      message: `Edge '${edge.id}' uses unsupported source handle '${sourceHandle}' on '${sourceNode.id}'. Allowed: ${knownSourceHandles.join(
        ", "
      )}.`,
    };
  }

  const targetHandle = edge.targetHandle ?? "default";
  const targetHandleBase = normalizeHandleBase(targetHandle);
  const knownTargetHandles = getKnownInputHandles(targetNode.type, registry);

  if (knownTargetHandles.length === 0) {
    return {
      code: "TARGET_HAS_NO_INPUT_PORTS",
      edgeId: edge.id,
      nodeId: targetNode.id,
      message: `Edge '${edge.id}' targets '${targetNode.id}', but block type '${targetNode.type}' has no input ports.`,
    };
  }

  if (!knownTargetHandles.includes(targetHandleBase)) {
    return {
      code: "INVALID_TARGET_HANDLE",
      edgeId: edge.id,
      nodeId: targetNode.id,
      message: `Edge '${edge.id}' targets invalid handle '${targetHandle}' on '${targetNode.id}'. Allowed: ${knownTargetHandles.join(
        ", "
      )}.`,
    };
  }

  const sourceType = getOutputSignalType({
    type: sourceNode.type,
    handle: sourceHandle,
    registry,
  });
  const targetType = getInputSignalType({
    type: targetNode.type,
    handle: targetHandle,
    registry,
  });

  if (!areSignalTypesCompatible(sourceType, targetType)) {
    return {
      code: "INVALID_SIGNAL_TYPE",
      edgeId: edge.id,
      nodeId: targetNode.id,
      message: `Edge '${edge.id}' has incompatible signal types (${sourceType} -> ${targetType}) for '${sourceNode.id}' -> '${targetNode.id}'.`,
    };
  }

  return null;
}

/**
 * Pre-run graph validation gate for P3-4/P4-2.
 */
export function validateSimulationGraph(params: {
  graph: SimulationGraph;
  registry: BlockRegistry;
}): GraphValidationIssue[] {
  const { graph, registry } = params;
  const issues: GraphValidationIssue[] = [];

  for (const node of graph.nodes) {
    if (!registry[node.type]) {
      issues.push({
        code: "UNKNOWN_BLOCK_TYPE",
        nodeId: node.id,
        message: `Node '${node.id}' references unknown block type '${node.type}'.`,
      });
      continue;
    }

    const sampleTimeIssue = validateNodeSampleTime(node);
    if (sampleTimeIssue) {
      issues.push(sampleTimeIssue);
    }
  }

  for (const edge of graph.edges) {
    const issue = validateConnectionCandidate({
      graph,
      registry,
      edge,
    });

    if (issue) {
      issues.push(issue);
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
