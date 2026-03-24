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

interface TruthTableCodegenRow {
  when: Record<string, number | boolean>;
  output: number | boolean;
}

type StateMachineEventType = "rising" | "falling";

interface StateMachineCodegenTransition {
  fromIndex: number;
  toIndex: number;
  output?: number | boolean;
  guardExpr?: string;
  actionExpr?: string;
  afterMs?: number;
  event?: StateMachineEventType;
  eventInput?: string;
}

interface StateMachineCodegenDefinition {
  states: string[];
  initialStateIndex: number;
  transitions: StateMachineCodegenTransition[];
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

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toCNumberLiteral(value: number): string {
  return Number.isFinite(value) ? value.toFixed(6) : "0.0";
}

function toCOutputLiteral(value: unknown): string {
  if (typeof value === "boolean") {
    return value ? "1.0" : "0.0";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return toCNumberLiteral(value);
  }

  return "0.0";
}

function normalizeTruthTableInputHandles(raw: unknown): string[] {
  const seen = new Set<string>();
  if (!Array.isArray(raw)) {
    return ["in1", "in2"];
  }

  const handles = raw
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => {
      if (entry.length === 0) {
        return false;
      }

      const normalized = entry.toLowerCase();
      if (seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    });

  return handles.length > 0 ? handles : ["in1", "in2"];
}

function normalizeTruthTableRows(raw: unknown): TruthTableCodegenRow[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const rows: TruthTableCodegenRow[] = [];

  for (const candidate of raw) {
    if (typeof candidate !== "object" || candidate === null) {
      continue;
    }

    const rowRecord = candidate as Record<string, unknown>;
    const output =
      typeof rowRecord.output === "boolean"
        ? rowRecord.output
        : typeof rowRecord.output === "number" && Number.isFinite(rowRecord.output)
          ? rowRecord.output
          : null;

    if (output === null) {
      continue;
    }

    const whenRaw =
      typeof rowRecord.when === "object" && rowRecord.when !== null
        ? (rowRecord.when as Record<string, unknown>)
        : {};

    const when: Record<string, number | boolean> = {};
    let invalidDomain = false;

    for (const [rawHandle, rawValue] of Object.entries(whenRaw)) {
      const handle = rawHandle.trim();
      if (handle.length === 0) {
        continue;
      }

      if (typeof rawValue === "boolean") {
        when[handle] = rawValue;
        continue;
      }

      if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
        when[handle] = rawValue;
        continue;
      }

      invalidDomain = true;
      break;
    }

    if (invalidDomain) {
      continue;
    }

    rows.push({ when, output });
  }

  return rows;
}

function normalizeTruthTableElseOutput(raw: unknown): number | boolean | null {
  if (typeof raw === "boolean") {
    return raw;
  }

  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }

  return null;
}

function sortIncomingEdges(edges: CodegenIREdge[], targetNodeId: string): CodegenIREdge[] {
  return edges
    .filter((edge) => edge.target === targetNodeId)
    .slice()
    .sort((left, right) => {
      const targetHandleCompare = left.targetHandle.localeCompare(right.targetHandle);
      if (targetHandleCompare !== 0) {
        return targetHandleCompare;
      }

      const sourceCompare = left.source.localeCompare(right.source);
      if (sourceCompare !== 0) {
        return sourceCompare;
      }

      const sourceHandleCompare = left.sourceHandle.localeCompare(right.sourceHandle);
      if (sourceHandleCompare !== 0) {
        return sourceHandleCompare;
      }

      return left.id.localeCompare(right.id);
    });
}

function resolveInputExpression(params: {
  incomingEdges: CodegenIREdge[];
  nodeIdToIndex: Map<string, number>;
  handle: string;
}): string {
  const { incomingEdges, nodeIdToIndex, handle } = params;

  const direct = incomingEdges.find((edge) => edge.targetHandle === handle);
  const fallback =
    handle === "in1"
      ? incomingEdges.find((edge) => edge.targetHandle === "default")
      : undefined;
  const chosen = direct ?? fallback;

  if (!chosen) {
    return "0.0";
  }

  const sourceIndex = nodeIdToIndex.get(chosen.source);
  return typeof sourceIndex === "number" ? `state->node_outputs[${sourceIndex}]` : "0.0";
}

function emitTruthTableCode(params: {
  sourceLines: string[];
  nodeIndex: number;
  nodeParams: Record<string, unknown>;
  incomingEdges: CodegenIREdge[];
  nodeIdToIndex: Map<string, number>;
}): void {
  const { sourceLines, nodeIndex, nodeParams, incomingEdges, nodeIdToIndex } = params;

  const inputHandles = normalizeTruthTableInputHandles(nodeParams.inputHandles);
  const rows = normalizeTruthTableRows(nodeParams.rows);
  const elseOutput = normalizeTruthTableElseOutput(nodeParams.elseOutput);

  const expressionsByHandle = new Map<string, string>();
  for (const handle of inputHandles) {
    expressionsByHandle.set(
      handle,
      resolveInputExpression({
        incomingEdges,
        nodeIdToIndex,
        handle,
      })
    );
  }

  sourceLines.push("  /* Truth Table logic emitted (row-priority) */");

  if (rows.length === 0) {
    sourceLines.push(`  state->node_outputs[${nodeIndex}] = ${toCOutputLiteral(elseOutput)};`);
    return;
  }

  rows.forEach((row, rowIndex) => {
    const clauses = Object.entries(row.when).map(([handle, expected]) => {
      const expression = expressionsByHandle.get(handle) ?? "0.0";
      if (typeof expected === "boolean") {
        return expected ? `(${expression} != 0.0)` : `(${expression} == 0.0)`;
      }

      return `(fabs(${expression} - ${toCNumberLiteral(expected)}) <= 1e-9)`;
    });

    const condition = clauses.length > 0 ? clauses.join(" && ") : "1";
    const prefix = rowIndex === 0 ? "  if" : "  else if";

    sourceLines.push(`${prefix} (${condition}) {`);
    sourceLines.push(`    state->node_outputs[${nodeIndex}] = ${toCOutputLiteral(row.output)};`);
    sourceLines.push("  }");
  });

  sourceLines.push("  else {");
  sourceLines.push(`    state->node_outputs[${nodeIndex}] = ${toCOutputLiteral(elseOutput)};`);
  sourceLines.push("  }");
}

function normalizeStateName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStateMachineDefinition(raw: Record<string, unknown>): StateMachineCodegenDefinition {
  const seen = new Set<string>();
  const declaredStates = Array.isArray(raw.states)
    ? raw.states
        .map((entry) => normalizeStateName(entry))
        .filter((entry): entry is string => {
          if (!entry) {
            return false;
          }

          const normalized = entry.toLowerCase();
          if (seen.has(normalized)) {
            return false;
          }

          seen.add(normalized);
          return true;
        })
    : [];

  const initialStateCandidate = normalizeStateName(raw.initialState);
  const initialState = initialStateCandidate ?? declaredStates[0] ?? "idle";
  const states = declaredStates.includes(initialState)
    ? declaredStates
    : [initialState, ...declaredStates];

  const stateToIndex = new Map(states.map((state, index) => [state, index]));

  const transitions = Array.isArray(raw.transitions)
    ? raw.transitions.reduce<StateMachineCodegenTransition[]>((accumulator, transition) => {
        if (typeof transition !== "object" || transition === null) {
          return accumulator;
        }

        const transitionRecord = transition as Record<string, unknown>;
        const from = normalizeStateName(transitionRecord.from);
        const to = normalizeStateName(transitionRecord.to);
        if (!from || !to) {
          return accumulator;
        }

        const fromIndex = stateToIndex.get(from);
        const toIndex = stateToIndex.get(to);
        if (typeof fromIndex !== "number" || typeof toIndex !== "number") {
          return accumulator;
        }

        const output =
          typeof transitionRecord.output === "boolean"
            ? transitionRecord.output
            : typeof transitionRecord.output === "number" && Number.isFinite(transitionRecord.output)
              ? transitionRecord.output
              : undefined;

        const guardExpr = normalizeStateName(transitionRecord.guardExpr) ?? undefined;
        const actionExpr = normalizeStateName(transitionRecord.actionExpr) ?? undefined;
        const afterMs =
          typeof transitionRecord.afterMs === "number" &&
          Number.isFinite(transitionRecord.afterMs) &&
          transitionRecord.afterMs >= 0
            ? transitionRecord.afterMs
            : undefined;
        const event =
          transitionRecord.event === "rising" || transitionRecord.event === "falling"
            ? transitionRecord.event
            : undefined;
        const eventInput = normalizeStateName(transitionRecord.eventInput) ?? undefined;

        accumulator.push({
          fromIndex,
          toIndex,
          output,
          guardExpr,
          actionExpr,
          afterMs,
          event,
          eventInput,
        });
        return accumulator;
      }, [])
    : [];

  return {
    states,
    initialStateIndex: stateToIndex.get(initialState) ?? 0,
    transitions,
  };
}

function toStateMachineGuardCondition(guardExpr: string | undefined): { condition: string; note?: string } {
  if (!guardExpr) {
    return { condition: "1" };
  }

  const normalized = guardExpr.trim().toLowerCase();
  if (normalized === "true") {
    return { condition: "1" };
  }

  if (normalized === "false") {
    return { condition: "0" };
  }

  return {
    condition: "0",
    note: `guardExpr not lowered in v1 (${guardExpr})`,
  };
}

function emitStateMachineCode(params: {
  sourceLines: string[];
  nodeIndex: number;
  nodeParams: Record<string, unknown>;
}): void {
  const { sourceLines, nodeIndex, nodeParams } = params;
  const definition = normalizeStateMachineDefinition(nodeParams);

  sourceLines.push("  /* State Machine logic emitted (state-index skeleton) */");
  sourceLines.push(`  int sm_prev_state_${nodeIndex} = state->state_machine_active_state[${nodeIndex}];`);
  sourceLines.push(`  int sm_next_state_${nodeIndex} = sm_prev_state_${nodeIndex};`);
  sourceLines.push(`  int sm_transition_fired_${nodeIndex} = 0;`);

  if (definition.transitions.length === 0) {
    sourceLines.push(`  state->node_outputs[${nodeIndex}] = 0.0;`);
    sourceLines.push(`  state->state_machine_active_state[${nodeIndex}] = sm_next_state_${nodeIndex};`);
    return;
  }

  definition.transitions.forEach((transition, transitionIndex) => {
    const { condition: guardCondition, note } = toStateMachineGuardCondition(transition.guardExpr);
    const conditions = [
      `!sm_transition_fired_${nodeIndex}`,
      `sm_prev_state_${nodeIndex} == ${transition.fromIndex}`,
      guardCondition,
    ];

    if (typeof transition.afterMs === "number") {
      conditions.push("0");
      sourceLines.push(
        `  /* transition[${transitionIndex}] afterMs=${toCNumberLiteral(transition.afterMs)} not lowered in v1 */`
      );
    }

    if (transition.event) {
      conditions.push("0");
      sourceLines.push(
        `  /* transition[${transitionIndex}] event=${transition.event} input=${transition.eventInput ?? "in"} not lowered in v1 */`
      );
    }

    if (note) {
      sourceLines.push(`  /* transition[${transitionIndex}] ${note} */`);
    }

    if (transition.actionExpr) {
      sourceLines.push(
        `  /* transition[${transitionIndex}] actionExpr not lowered in v1 (${transition.actionExpr}) */`
      );
    }

    sourceLines.push(`  if (${conditions.join(" && ")}) {`);
    sourceLines.push(`    sm_next_state_${nodeIndex} = ${transition.toIndex};`);
    sourceLines.push(`    sm_transition_fired_${nodeIndex} = 1;`);
    sourceLines.push(`    state->node_outputs[${nodeIndex}] = ${toCOutputLiteral(transition.output)};`);
    sourceLines.push("  }");
  });

  sourceLines.push(`  if (!sm_transition_fired_${nodeIndex}) {`);
  sourceLines.push(`    state->node_outputs[${nodeIndex}] = 0.0;`);
  sourceLines.push("  }");
  sourceLines.push(`  state->state_machine_active_state[${nodeIndex}] = sm_next_state_${nodeIndex};`);
  sourceLines.push(
    `  /* states: ${definition.states.map((state, index) => `${index}:${state}`).join(", ")} */`
  );
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
      if (sourceCompare !== 0) {
        return sourceCompare;
      }

      const targetCompare = left.target.localeCompare(right.target);
      if (targetCompare !== 0) {
        return targetCompare;
      }

      return left.id.localeCompare(right.id);
    })
    .map((edge) => normalizeEdge(edge));

  let executionOrder: string[] = [];
  try {
    executionOrder = getTopologicalOrder(params.graph);
  } catch {
    executionOrder = nodes.map((node) => node.id);
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
    `#include "${modelName}.h"`,
    "#include <math.h>",
    "",
    `void ${modelName}_init(${modelName}_state* state) {`,
    "  if (state == NULL) return;",
    "  for (int i = 0; i < 256; i++) {",
    "    state->node_outputs[i] = 0.0;",
    "    state->node_internal_state[i] = 0.0;",
    "    state->state_machine_active_state[i] = 0;",
    "  }",
  ];

  nodes.forEach((node, index) => {
    if (node.type === "counter") {
      const start = toFiniteNumber(node.params.start, 0);
      sourceLines.push(`  state->node_internal_state[${index}] = ${toCNumberLiteral(start)};`);
      return;
    }

    if (node.type === "stateMachine") {
      const definition = normalizeStateMachineDefinition(node.params);
      sourceLines.push(
        `  state->state_machine_active_state[${index}] = ${definition.initialStateIndex};`
      );
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

  const nodeIdToIndex = new Map(nodes.map((node, index) => [node.id, index]));

  executionOrder.forEach((nodeId) => {
    const node = nodes.find((candidate) => candidate.id === nodeId);
    if (!node) {
      return;
    }

    const nodeIndex = nodeIdToIndex.get(nodeId);
    if (typeof nodeIndex !== "number") {
      return;
    }

    sourceLines.push(`  /* node[${nodeIndex}] id=${node.id} type=${node.type} */`);

    if (!SUPPORTED_BLOCK_TYPES.has(node.type)) {
      sourceLines.push(`  /* skipping generation for unsupported block type ${node.type} */`);
      sourceLines.push("");
      return;
    }

    const incomingEdges = sortIncomingEdges(edges, nodeId);

    switch (node.type) {
      case "gain": {
        const gain = toFiniteNumber(node.params.gain, 1);
        const sourceExpression =
          incomingEdges.length > 0
            ? resolveInputExpression({
                incomingEdges,
                nodeIdToIndex,
                handle: incomingEdges[0].targetHandle,
              })
            : "0.0";
        sourceLines.push(
          `  state->node_outputs[${nodeIndex}] = ${sourceExpression} * ${toCNumberLiteral(gain)};`
        );
        break;
      }

      case "sum": {
        const inputExpressions = incomingEdges.map((edge) => {
          const sourceIndex = nodeIdToIndex.get(edge.source);
          return typeof sourceIndex === "number" ? `state->node_outputs[${sourceIndex}]` : "0.0";
        });
        const expression = inputExpressions.length > 0 ? inputExpressions.join(" + ") : "0.0";
        sourceLines.push(`  state->node_outputs[${nodeIndex}] = ${expression};`);
        break;
      }

      case "product": {
        const inputExpressions = incomingEdges.map((edge) => {
          const sourceIndex = nodeIdToIndex.get(edge.source);
          return typeof sourceIndex === "number" ? `state->node_outputs[${sourceIndex}]` : "0.0";
        });
        const expression = inputExpressions.length > 0 ? inputExpressions.join(" * ") : "0.0";
        sourceLines.push(`  state->node_outputs[${nodeIndex}] = ${expression};`);
        break;
      }

      case "counter": {
        const step = toFiniteNumber(node.params.step, 1);
        const isDecrement = node.params.mode === "dec";
        sourceLines.push(`  state->node_outputs[${nodeIndex}] = state->node_internal_state[${nodeIndex}];`);
        sourceLines.push(
          `  state->node_internal_state[${nodeIndex}] += ${isDecrement ? "-" : ""}${toCNumberLiteral(step)};`
        );
        break;
      }

      case "truthTable": {
        emitTruthTableCode({
          sourceLines,
          nodeIndex,
          nodeParams: node.params,
          incomingEdges,
          nodeIdToIndex,
        });
        break;
      }

      case "stateMachine": {
        emitStateMachineCode({
          sourceLines,
          nodeIndex,
          nodeParams: node.params,
        });
        break;
      }
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
