import { getTopologicalOrder } from "./topology";
import {
  BlockRegistry,
  SignalValue,
  SimulationGraph,
  SimulationRuntimeSnapshot,
} from "./types";

/**
 * Build an initial runtime snapshot with validated timing controls.
 */
export function createInitialSnapshot(params: {
  simulationTimeMs: number;
  stepTimeMs: number;
}): SimulationRuntimeSnapshot {
  const simulationTimeMs = sanitizeMs(params.simulationTimeMs, 10_000);
  const stepTimeMs = sanitizeMs(params.stepTimeMs, 100);

  return {
    status: "idle",
    tick: 0,
    timeMs: 0,
    simulationTimeMs,
    stepTimeMs,
    nodeOutputs: {},
    nodeInternalState: {},
  };
}

/**
 * Execute exactly one deterministic simulation tick.
 *
 * Critical design intent:
 * - Tick stepping is a pure function with no timers and no global mutable state.
 * - This allows deterministic replay, offline unit testing, and future acceleration
 *   strategies (batch stepping, workers, and server-side simulation) without changing
 *   block semantics.
 *
 * Iteration-2 scalability path:
 * - Introduce execution partitions (independent subgraphs) and evaluate them in parallel,
 *   then merge outputs at synchronization barriers per tick.
 */
export function stepSimulation(params: {
  graph: SimulationGraph;
  registry: BlockRegistry;
  snapshot: SimulationRuntimeSnapshot;
}): SimulationRuntimeSnapshot {
  const { graph, registry, snapshot } = params;

  if (snapshot.status === "completed") {
    return snapshot;
  }

  if (snapshot.timeMs >= snapshot.simulationTimeMs) {
    return {
      ...snapshot,
      status: "completed",
      timeMs: snapshot.simulationTimeMs,
    };
  }

  const executionOrder = getTopologicalOrder(graph);
  const nextOutputs: SimulationRuntimeSnapshot["nodeOutputs"] = {
    ...snapshot.nodeOutputs,
  };
  const nextInternalState: SimulationRuntimeSnapshot["nodeInternalState"] = {
    ...snapshot.nodeInternalState,
  };

  for (const nodeId of executionOrder) {
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node) {
      continue;
    }

    const definition = registry[node.type];
    if (!definition) {
      throw new Error(`Missing block definition for type '${node.type}'.`);
    }

    const inputs = collectInputs({
      nodeId,
      graph,
      outputs: nextOutputs,
    });

    const previousState =
      nextInternalState[node.id] ?? definition.initialize?.(node.data ?? {});

    const result = definition.step({
      tick: snapshot.tick,
      timeMs: snapshot.timeMs,
      stepTimeMs: snapshot.stepTimeMs,
      nodeId: node.id,
      params: node.data ?? {},
      inputs,
      previousState,
    });

    nextOutputs[node.id] = result.outputs;
    if (typeof result.nextState !== "undefined") {
      nextInternalState[node.id] = result.nextState;
    }
  }

  const advancedTime = snapshot.timeMs + snapshot.stepTimeMs;
  const clampedTime = Math.min(advancedTime, snapshot.simulationTimeMs);
  const isComplete = clampedTime >= snapshot.simulationTimeMs;

  return {
    ...snapshot,
    status: isComplete ? "completed" : snapshot.status,
    tick: snapshot.tick + 1,
    timeMs: clampedTime,
    nodeOutputs: nextOutputs,
    nodeInternalState: nextInternalState,
    error: undefined,
  };
}

function sanitizeMs(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

function collectInputs(params: {
  nodeId: string;
  graph: SimulationGraph;
  outputs: Record<string, Record<string, SignalValue>>;
}): Record<string, SignalValue> {
  const { nodeId, graph, outputs } = params;

  const inputValues: Record<string, SignalValue> = {};

  for (const edge of graph.edges) {
    if (edge.target !== nodeId) {
      continue;
    }

    const sourceOutputs = outputs[edge.source] ?? {};
    const sourceKey = edge.sourceHandle ?? "default";
    const targetKey = edge.targetHandle ?? "default";
    inputValues[targetKey] = sourceOutputs[sourceKey] ?? null;
  }

  return inputValues;
}
