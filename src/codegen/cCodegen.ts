import { SimulationEdge, SimulationGraph, SimulationNode } from "@/src/simulation/types";
import { getTopologicalOrder } from "@/src/simulation/topology";

export interface CodegenIRNode {
  id: string;
  type: string;
  index: number;
  params: Record<string, unknown>;
}

export interface CodegenIREdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
}

export interface CodegenIR {
  modelName: string;
  nodes: CodegenIRNode[];
  edges: CodegenIREdge[];
  executionOrder: string[];
  unsupportedBlockTypes: string[];
}

export interface CodegenArtifacts {
  ir: CodegenIR;
  headerSource: string;
  sourceSource: string;
}

const SUPPORTED_BLOCK_TYPES = new Set<string>([
  "counter",
  "gain",
  "sum",
  "product",
  "truthTable",
  "stateMachine",
]);

function sanitizeModelName(value: string): string {
  const trimmed = value.trim();
  const safe = trimmed.replace(/[^A-Za-z0-9_]/g, "_");
  return safe.length > 0 ? safe : "web_simulink_model";
}

function normalizeNode(node: SimulationNode, index: number): CodegenIRNode {
  return {
    id: node.id,
    type: node.type,
    index,
    params: (node.data as Record<string, unknown> | undefined) ?? {},
  };
}

function normalizeEdge(edge: SimulationEdge): CodegenIREdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? "default",
    targetHandle: edge.targetHandle ?? "default",
  };
}

export function buildCodegenIR(params: {
  modelName: string;
  graph: SimulationGraph;
}): CodegenIR {
  const modelName = sanitizeModelName(params.modelName);

  const nodes = params.graph.nodes
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((node, index) => normalizeNode(node, index));

  const edges = params.graph.edges
    .slice()
    .sort((left, right) => {
      const sourceCompare = left.source.localeCompare(right.source);
      if (sourceCompare !== 0) return sourceCompare;
      const targetCompare = left.target.localeCompare(right.target);
      if (targetCompare !== 0) return targetCompare;
      return (left.id).localeCompare(right.id);
    })
    .map((edge) => normalizeEdge(edge));

  let executionOrder: string[] = [];
  try {
    executionOrder = getTopologicalOrder(params.graph);
  } catch {
    executionOrder = nodes.map(n => n.id);
  }

  const unsupportedBlockTypes = Array.from(
    new Set(
      nodes
        .map((node) => node.type)
        .filter((type) => !SUPPORTED_BLOCK_TYPES.has(type))
    )
  ).sort((left, right) => left.localeCompare(right));

  return {
    modelName,
    nodes,
    edges,
    executionOrder,
    unsupportedBlockTypes,
  };
}

export function generateAnsiCArtifacts(params: {
  modelName: string;
  graph: SimulationGraph;
}): CodegenArtifacts {
  const ir = buildCodegenIR(params);
  const { modelName, nodes, edges, executionOrder, unsupportedBlockTypes } = ir;
  const guardName = `${modelName.toUpperCase()}_H`;

  const headerSource = [
    `#ifndef ${guardName}`,
    `#define ${guardName}`,
    "",
    "#include <stdbool.h>",
    "#include <stddef.h>",
    "",
    `typedef struct ${modelName}_state {`,
    "  double node_outputs[256];",
    "  double node_internal_state[256];",
    "  int state_machine_active_state[256];",
    `} ${modelName}_state;`,
    "",
    `void ${modelName}_init(${modelName}_state* state);`,
    `void ${modelName}_step(${modelName}_state* state, double step_time_sec);`,
    "",
    `#endif /* ${guardName} */`,
    "",
  ].join("\n");

  const sourceLines: string[] = [
    `#include \"${modelName}.h\"`,
    "",
    `void ${modelName}_init(${modelName}_state* state) {`,
    "  if (state == NULL) return;",
    "  for (int i = 0; i < 256; i++) {",
    "    state->node_outputs[i] = 0.0;",
    "    state->node_internal_state[i] = 0.0;",
    "    state->state_machine_active_state[i] = 0;",
    "  }",
  ];

  nodes.forEach((node, idx) => {
    if (node.type === "counter") {
      const start = (node.params.start as number) || 0;
      sourceLines.push(`  state->node_internal_state[${idx}] = ${start.toFixed(4)};`);
    }
  });

  sourceLines.push("}");
  sourceLines.push("");
  sourceLines.push(`void ${modelName}_step(${modelName}_state* state, double step_time_sec) {`);
  sourceLines.push("  if (state == NULL) return;");
  sourceLines.push("  (void)step_time_sec;");
  sourceLines.push("");

  if (unsupportedBlockTypes.length > 0) {
    sourceLines.push(`  /* unsupported block types: ${unsupportedBlockTypes.join(", ")} */`);
  }

  const nodeIdToIndex = new Map(nodes.map((n, i) => [n.id, i]));

  executionOrder.forEach((nodeId) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const idx = nodeIdToIndex.get(nodeId)!;
    sourceLines.push(`  /* node[${idx}] id=${node.id} type=${node.type} */`);

    if (!SUPPORTED_BLOCK_TYPES.has(node.type)) {
       sourceLines.push(`  /* skipping generation for unsupported block type ${node.type} */`);
       sourceLines.push("");
       return;
    }

    const incomingEdges = edges.filter(e => e.target === nodeId);

    switch (node.type) {
      case "gain": {
        const gain = (node.params.gain as number) || 1;
        const srcEdge = incomingEdges[0];
        const inputStr = srcEdge 
          ? `state->node_outputs[${nodeIdToIndex.get(srcEdge.source)}]`
          : "0.0";
        sourceLines.push(`  state->node_outputs[${idx}] = ${inputStr} * ${gain.toFixed(4)};`);
        break;
      }
      case "sum": {
        const inputs = incomingEdges.map(e => `state->node_outputs[${nodeIdToIndex.get(e.source)}]`);
        const expr = inputs.length > 0 ? inputs.join(" + ") : "0.0";
        sourceLines.push(`  state->node_outputs[${idx}] = ${expr};`);
        break;
      }
      case "product": {
        const inputs = incomingEdges.map(e => `state->node_outputs[${nodeIdToIndex.get(e.source)}]`);
        const expr = inputs.length > 0 ? inputs.join(" * ") : "0.0";
        sourceLines.push(`  state->node_outputs[${idx}] = ${expr};`);
        break;
      }
      case "counter": {
        const step = (node.params.step as number) || 1;
        const isDec = node.params.mode === "dec";
        sourceLines.push(`  state->node_outputs[${idx}] = state->node_internal_state[${idx}];`);
        sourceLines.push(`  state->node_internal_state[${idx}] += ${isDec ? "-" : ""}${step.toFixed(4)};`);
        break;
      }
      case "truthTable":
        sourceLines.push(`  /* Truth Table logic stub */`);
        sourceLines.push(`  state->node_outputs[${idx}] = 0.0;`);
        break;
      case "stateMachine":
        sourceLines.push(`  /* State Machine logic stub */`);
        sourceLines.push(`  state->node_outputs[${idx}] = 0.0;`);
        break;
    }
    sourceLines.push("");
  });

  sourceLines.push("}");
  sourceLines.push("");

  return {
    ir,
    headerSource,
    sourceSource: sourceLines.join("\n"),
  };
}
