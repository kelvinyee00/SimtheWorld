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

interface StateMachineLoweringContext {
  nodeIndex: number;
  incomingEdges: CodegenIREdge[];
  nodeIdToIndex: Map<string, number>;
}

const SUPPORTED_BLOCK_TYPES = new Set<string>([
  "counter",
  "gain",
  "sum",
  "product",
  "truthTable",
  "stateMachine",
  "inport",
  "outport",
]);

function getInterfaceLabel(rawData: unknown, fallback: string): string {
  const candidate =
    typeof (rawData as Record<string, unknown> | undefined)?.label === "string"
      ? ((rawData as Record<string, unknown>).label as string).trim()
      : "";
  return candidate.length > 0 ? candidate : fallback;
}

function getSortedInterfaceNodeIds(graph: SimulationGraph, type: string): string[] {
  return graph.nodes
    .filter((node) => node.type === type)
    .map((node) => node.id)
    .sort((left, right) => left.localeCompare(right));
}

/**
 * Recursively flattens a hierarchical graph into a single flat set of nodes and edges.
 * Stitches subsystem boundaries by remapping external edges directly to internal ports.
 */
function flattenGraph(params: {
  graph: SimulationGraph;
  path: string[];
  nodeList: SimulationNode[];
  edgeList: SimulationEdge[];
}): void {
  const { graph, path, nodeList, edgeList } = params;
  const prefix = path.length > 0 ? path.join("_") + "_" : "";

  // 1. Collect all non-subsystem nodes and recurse into subsystems
  graph.nodes.forEach((node) => {
    if (node.type === "subsystem") {
      const subGraph = (node.data?.graph as SimulationGraph) ?? { nodes: [], edges: [] };
      flattenGraph({
        graph: subGraph,
        path: [...path, node.id],
        nodeList,
        edgeList,
      });
    } else {
      nodeList.push({
        ...node,
        id: prefix + node.id,
      });
    }
  });

  // 2. Map all edges, resolving subsystem boundaries
  graph.edges.forEach((edge) => {
    const sourceNode = graph.nodes.find((n) => n.id === edge.source);
    const targetNode = graph.nodes.find((n) => n.id === edge.target);

    let remappedSource = prefix + edge.source;
    let remappedSourceHandle = edge.sourceHandle ?? "default";
    let remappedTarget = prefix + edge.target;
    let remappedTargetHandle = edge.targetHandle ?? "default";

    // If source is a subsystem, find the internal outport
    if (sourceNode?.type === "subsystem") {
      const subGraph = (sourceNode.data?.graph as SimulationGraph) ?? { nodes: [], edges: [] };
      const outportIds = getSortedInterfaceNodeIds(subGraph, "outport");
      const handle = (edge.sourceHandle ?? "default").toLowerCase();

      let matchedPortId: string | undefined;
      for (let i = 0; i < outportIds.length; i++) {
        const portNode = subGraph.nodes.find((n) => n.id === outportIds[i])!;
        const label = getInterfaceLabel(portNode.data, `out${i + 1}`).toLowerCase();
        if (
          label === handle ||
          `out${i + 1}` === handle ||
          (i === 0 && handle === "default")
        ) {
          matchedPortId = outportIds[i];
          break;
        }
      }

      if (matchedPortId) {
        remappedSource = prefix + sourceNode.id + "_" + matchedPortId;
        remappedSourceHandle = "default";
      }
    }

    // If target is a subsystem, find the internal inport
    if (targetNode?.type === "subsystem") {
      const subGraph = (targetNode.data?.graph as SimulationGraph) ?? { nodes: [], edges: [] };
      const inportIds = getSortedInterfaceNodeIds(subGraph, "inport");
      const handle = (edge.targetHandle ?? "default").toLowerCase();

      let matchedPortId: string | undefined;
      for (let i = 0; i < inportIds.length; i++) {
        const portNode = subGraph.nodes.find((n) => n.id === inportIds[i])!;
        const label = getInterfaceLabel(portNode.data, `in${i + 1}`).toLowerCase();
        if (
          label === handle ||
          `in${i + 1}` === handle ||
          (i === 0 && handle === "default")
        ) {
          matchedPortId = inportIds[i];
          break;
        }
      }

      if (matchedPortId) {
        remappedTarget = prefix + targetNode.id + "_" + matchedPortId;
        remappedTargetHandle = "default";
      }
    }

    edgeList.push({
      id: prefix + edge.id,
      source: remappedSource,
      sourceHandle: remappedSourceHandle,
      target: remappedTarget,
      targetHandle: remappedTargetHandle,
    });
  });
}

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

function toStateMachineInputExpression(params: {
  handle: string;
  context: StateMachineLoweringContext;
}): string {
  const { handle, context } = params;
  return resolveInputExpression({
    incomingEdges: context.incomingEdges,
    nodeIdToIndex: context.nodeIdToIndex,
    handle,
  });
}

function parseNumericOperand(params: {
  raw: string;
  context: StateMachineLoweringContext;
}): { expression: string; supported: boolean } {
  const { raw, context } = params;
  const token = raw.trim();

  if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(token)) {
    return { expression: toCNumberLiteral(Number(token)), supported: true };
  }

  const inputMatch = token.match(/^inputs\.([A-Za-z_][A-Za-z0-9_]*)$/);
  if (inputMatch) {
    return {
      expression: toStateMachineInputExpression({ handle: inputMatch[1], context }),
      supported: true,
    };
  }

  const memoryMatch = token.match(/^memory\.slot([0-3])$/);
  if (memoryMatch) {
    const slot = Number(memoryMatch[1]);
    const memoryIndex = context.nodeIndex * 4 + slot;
    return { expression: `state->node_internal_state[${memoryIndex}]`, supported: true };
  }

  return { expression: "0.0", supported: false };
}

function toStateMachineGuardCondition(params: {
  guardExpr: string | undefined;
  context: StateMachineLoweringContext;
}): { condition: string; note?: string } {
  const { guardExpr, context } = params;
  if (!guardExpr) {
    return { condition: "1" };
  }

  const trimmed = guardExpr.trim();
  const normalized = trimmed.toLowerCase();
  if (normalized === "true") {
    return { condition: "1" };
  }

  if (normalized === "false") {
    return { condition: "0" };
  }

  const booleanCheckMatch = trimmed.match(/^(!)?\s*inputs\.([A-Za-z_][A-Za-z0-9_]*)$/);
  if (booleanCheckMatch) {
    const operand = toStateMachineInputExpression({
      handle: booleanCheckMatch[2],
      context,
    });
    return {
      condition: booleanCheckMatch[1] ? `(${operand} == 0.0)` : `(${operand} != 0.0)`,
    };
  }

  const comparisonMatch = trimmed.match(/^(.*?)\s*(===|==|!==|!=|<=|>=|<|>)\s*(.*?)$/);
  if (comparisonMatch) {
    const left = parseNumericOperand({ raw: comparisonMatch[1], context });
    const rightRaw = comparisonMatch[3].trim();
    const rightNormalized = rightRaw.toLowerCase();

    if (rightNormalized === "true" || rightNormalized === "false") {
      if (left.supported) {
        const truthy = rightNormalized === "true";
        if (comparisonMatch[2] === "==" || comparisonMatch[2] === "===") {
          return { condition: truthy ? `(${left.expression} != 0.0)` : `(${left.expression} == 0.0)` };
        }

        if (comparisonMatch[2] === "!=" || comparisonMatch[2] === "!==") {
          return { condition: truthy ? `(${left.expression} == 0.0)` : `(${left.expression} != 0.0)` };
        }
      }
    } else {
      const right = parseNumericOperand({ raw: rightRaw, context });
      if (left.supported && right.supported) {
        const operator =
          comparisonMatch[2] === "===" ? "==" : comparisonMatch[2] === "!==" ? "!=" : comparisonMatch[2];
        return {
          condition: `(${left.expression} ${operator} ${right.expression})`,
        };
      }
    }
  }

  return {
    condition: "0",
    note: `guardExpr fallback (unsupported subset) (${guardExpr})`,
  };
}

function toStateMachineActionLines(params: {
  actionExpr: string | undefined;
  transitionIndex: number;
  nodeIndex: number;
}): string[] {
  const { actionExpr, transitionIndex, nodeIndex } = params;
  if (!actionExpr) {
    return [];
  }

  const trimmed = actionExpr.trim();
  const outputAssignment = trimmed.match(
    /^outputs?\.(?:out|default)\s*=\s*([+-]?(?:\d+\.?\d*|\.\d+|true|false))$/i
  );
  if (outputAssignment) {
    const valueRaw = outputAssignment[1].toLowerCase();
    if (valueRaw === "true" || valueRaw === "false") {
      return [`    state->node_outputs[${nodeIndex}] = ${valueRaw === "true" ? "1.0" : "0.0"};`];
    }

    return [`    state->node_outputs[${nodeIndex}] = ${toCNumberLiteral(Number(outputAssignment[1]))};`];
  }

  const memoryAssignment = trimmed.match(
    /^memory\.slot([0-3])\s*=\s*([+-]?(?:\d+\.?\d*|\.\d+|true|false))$/i
  );
  if (memoryAssignment) {
    const slot = Number(memoryAssignment[1]);
    const memoryIndex = nodeIndex * 4 + slot;
    const valueRaw = memoryAssignment[2].toLowerCase();
    if (valueRaw === "true" || valueRaw === "false") {
      return [
        `    state->node_internal_state[${memoryIndex}] = ${valueRaw === "true" ? "1.0" : "0.0"};`,
      ];
    }

    return [`    state->node_internal_state[${memoryIndex}] = ${toCNumberLiteral(Number(memoryAssignment[2]))};`];
  }

  return [`    /* transition[${transitionIndex}] actionExpr fallback (unsupported subset) (${actionExpr}) */`];
}

function emitStateMachineCode(params: {
  sourceLines: string[];
  nodeIndex: number;
  nodeParams: Record<string, unknown>;
  incomingEdges: CodegenIREdge[];
  nodeIdToIndex: Map<string, number>;
}): void {
  const { sourceLines, nodeIndex, nodeParams, incomingEdges, nodeIdToIndex } = params;
  const definition = normalizeStateMachineDefinition(nodeParams);
  const loweringContext: StateMachineLoweringContext = {
    nodeIndex,
    incomingEdges,
    nodeIdToIndex,
  };
  const representativeEventInput =
    definition.transitions.find((transition) => transition.event)?.eventInput ?? "in";

  sourceLines.push("  /* State Machine logic emitted (state-index skeleton) */");
  sourceLines.push(`  int sm_prev_state_${nodeIndex} = state->state_machine_active_state[${nodeIndex}];`);
  sourceLines.push(`  int sm_next_state_${nodeIndex} = sm_prev_state_${nodeIndex};`);
  sourceLines.push(`  int sm_transition_fired_${nodeIndex} = 0;`);
  sourceLines.push(`  double sm_prev_elapsed_ms_${nodeIndex} = state->state_machine_elapsed_ms[${nodeIndex}];`);
  sourceLines.push(
    `  double sm_event_signal_${nodeIndex} = ${toStateMachineInputExpression({ handle: representativeEventInput, context: loweringContext })};`
  );
  sourceLines.push(`  double sm_prev_event_signal_${nodeIndex} = state->state_machine_prev_event_input[${nodeIndex}];`);

  if (definition.transitions.length === 0) {
    sourceLines.push(`  state->node_outputs[${nodeIndex}] = 0.0;`);
    sourceLines.push(`  state->state_machine_active_state[${nodeIndex}] = sm_next_state_${nodeIndex};`);
    sourceLines.push(`  state->state_machine_elapsed_ms[${nodeIndex}] = sm_prev_elapsed_ms_${nodeIndex} + step_ms;`);
    sourceLines.push(`  state->state_machine_prev_event_input[${nodeIndex}] = sm_event_signal_${nodeIndex};`);
    return;
  }

  definition.transitions.forEach((transition, transitionIndex) => {
    const { condition: guardCondition, note } = toStateMachineGuardCondition({
      guardExpr: transition.guardExpr,
      context: loweringContext,
    });
    const conditions = [
      `!sm_transition_fired_${nodeIndex}`,
      `sm_prev_state_${nodeIndex} == ${transition.fromIndex}`,
      guardCondition,
    ];

    if (typeof transition.afterMs === "number") {
      conditions.push(`(sm_prev_elapsed_ms_${nodeIndex} >= ${toCNumberLiteral(transition.afterMs)})`);
    }

    if (transition.event) {
      const eventInput = transition.eventInput ?? "in";
      if (eventInput !== representativeEventInput) {
        conditions.push("0");
        sourceLines.push(
          `  /* transition[${transitionIndex}] event input ${eventInput} unsupported in v2 (representative input=${representativeEventInput}) */`
        );
      } else {
        conditions.push(
          transition.event === "rising"
            ? `(sm_prev_event_signal_${nodeIndex} <= 0.0 && sm_event_signal_${nodeIndex} > 0.0)`
            : `(sm_prev_event_signal_${nodeIndex} > 0.0 && sm_event_signal_${nodeIndex} <= 0.0)`
        );
      }
    }

    if (note) {
      sourceLines.push(`  /* transition[${transitionIndex}] ${note} */`);
    }

    sourceLines.push(`  if (${conditions.join(" && ")}) {`);
    const actionLines = toStateMachineActionLines({
      actionExpr: transition.actionExpr,
      transitionIndex,
      nodeIndex,
    });
    actionLines.forEach((line) => sourceLines.push(line));
    sourceLines.push(`    sm_next_state_${nodeIndex} = ${transition.toIndex};`);
    sourceLines.push(`    sm_transition_fired_${nodeIndex} = 1;`);
    if (typeof transition.output !== "undefined") {
      sourceLines.push(`    state->node_outputs[${nodeIndex}] = ${toCOutputLiteral(transition.output)};`);
    }
    sourceLines.push("  }");
  });

  sourceLines.push(`  if (!sm_transition_fired_${nodeIndex}) {`);
  sourceLines.push(`    state->node_outputs[${nodeIndex}] = 0.0;`);
  sourceLines.push("  }");
  sourceLines.push(`  state->state_machine_active_state[${nodeIndex}] = sm_next_state_${nodeIndex};`);
  sourceLines.push(
    `  state->state_machine_elapsed_ms[${nodeIndex}] = (sm_next_state_${nodeIndex} != sm_prev_state_${nodeIndex}) ? 0.0 : (sm_prev_elapsed_ms_${nodeIndex} + step_ms);`
  );
  sourceLines.push(`  state->state_machine_prev_event_input[${nodeIndex}] = sm_event_signal_${nodeIndex};`);
  sourceLines.push(
    `  /* states: ${definition.states.map((state, index) => `${index}:${state}`).join(", ")} */`
  );
}

export function buildCodegenIR(params: {
  modelName: string;
  graph: SimulationGraph;
}): CodegenIR {
  const modelName = sanitizeModelName(params.modelName);
  
  const flattenedNodes: SimulationNode[] = [];
  const flattenedEdges: SimulationEdge[] = [];
  flattenGraph({
    graph: params.graph,
    path: [],
    nodeList: flattenedNodes,
    edgeList: flattenedEdges,
  });

  const nodes = flattenedNodes
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((node, index) => normalizeNode(node, index));

  const edges = flattenedEdges
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
    executionOrder = getTopologicalOrder({ nodes: flattenedNodes, edges: flattenedEdges });
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
    "  double state_machine_elapsed_ms[256];",
    "  double state_machine_prev_event_input[256];",
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
    "    state->state_machine_elapsed_ms[i] = 0.0;",
    "    state->state_machine_prev_event_input[i] = 0.0;",
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
  sourceLines.push("  double step_ms = step_time_sec > 0.0 ? step_time_sec * 1000.0 : 0.0;");
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
          incomingEdges,
          nodeIdToIndex,
        });
        break;
      }
      case "inport":
      case "outport": {
        const sourceExpression =
          incomingEdges.length > 0
            ? resolveInputExpression({
                incomingEdges,
                nodeIdToIndex,
                handle: incomingEdges[0].targetHandle,
              })
            : "0.0";
        sourceLines.push(`  state->node_outputs[${nodeIndex}] = ${sourceExpression};`);
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
