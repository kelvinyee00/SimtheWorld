import { stepSimulation, createInitialSnapshot } from "@/src/simulation/engine";
import {
  SignalValue,
  SimulationBlockDefinition,
  SimulationGraph,
  SimulationRuntimeSnapshot,
} from "@/src/simulation/types";
import { INPORT_BLOCK_TYPE } from "./inportBlock";
import { OUTPORT_BLOCK_TYPE } from "./outportBlock";

/**
 * Subsystem block (P4-3 hierarchical modeling foundation, refined in P5-2).
 *
 * Behavior:
 * - Encapsulates a nested SimulationGraph.
 * - Manages its own internal SimulationRuntimeSnapshot as persistent node state.
 * - Inport nodes in the nested graph receive values from the subsystem's external inputs.
 * - Outport nodes in the nested graph provide values to the subsystem's external outputs.
 *
 * P5-2 mapping refinements:
 * - Inport/Outport label handling is now normalized (trimmed, deterministic fallback names).
 * - Interface node traversal is deterministic (stable id sort).
 * - Output labels are addressable via `sourceHandle` from parent edges.
 */
export const SUBSYSTEM_BLOCK_TYPE = "subsystem" as const;

interface SubsystemState {
  internalSnapshot: SimulationRuntimeSnapshot;
}

function coerceInternalGraph(raw: unknown): SimulationGraph {
  if (
    typeof raw === "object" &&
    raw !== null &&
    "nodes" in raw &&
    "edges" in raw &&
    Array.isArray((raw as { nodes?: unknown }).nodes) &&
    Array.isArray((raw as { edges?: unknown }).edges)
  ) {
    return raw as SimulationGraph;
  }

  return { nodes: [], edges: [] };
}

function toSubsystemState(previousState: unknown): SubsystemState | null {
  if (
    typeof previousState === "object" &&
    previousState !== null &&
    "internalSnapshot" in previousState
  ) {
    return previousState as SubsystemState;
  }
  return null;
}

function toSignalOrNull(value: unknown): SignalValue {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return null;
}

function getInterfaceLabel(params: {
  rawData: unknown;
  fallback: string;
}): string {
  const { rawData, fallback } = params;
  const candidate =
    typeof (rawData as Record<string, unknown> | undefined)?.label === "string"
      ? ((rawData as Record<string, unknown>).label as string).trim()
      : "";

  return candidate.length > 0 ? candidate : fallback;
}

function getSortedInterfaceNodeIds(params: {
  graph: SimulationGraph;
  type: string;
}): string[] {
  const { graph, type } = params;
  return graph.nodes
    .filter((node) => node.type === type)
    .map((node) => node.id)
    .sort((left, right) => left.localeCompare(right));
}

export const SubsystemBlock: SimulationBlockDefinition = {
  type: SUBSYSTEM_BLOCK_TYPE,
  inputPortTypes: { default: "any", in1: "any", in2: "any" },
  outputPortTypes: { default: "any" },

  initialize: () => {
    return {
      internalSnapshot: createInitialSnapshot({
        simulationTimeMs: 1_000_000,
        stepTimeMs: 100,
      }),
    } satisfies SubsystemState;
  },

  step: ({ stepTimeMs, params, previousState, inputs, registry }) => {
    const internalGraph = coerceInternalGraph(params.graph);
    const state = toSubsystemState(previousState);

    let snapshot = state?.internalSnapshot ?? createInitialSnapshot({
      simulationTimeMs: 1_000_000,
      stepTimeMs,
    });

    snapshot.stepTimeMs = stepTimeMs;

    const nextInternalState = { ...snapshot.nodeInternalState };

    const inputLookup = new Map<string, SignalValue>();
    for (const [key, rawValue] of Object.entries(inputs)) {
      inputLookup.set(key.toLowerCase(), toSignalOrNull(rawValue));
    }

    const inportIds = getSortedInterfaceNodeIds({
      graph: internalGraph,
      type: INPORT_BLOCK_TYPE,
    });

    for (let index = 0; index < inportIds.length; index += 1) {
      const nodeId = inportIds[index];
      const node = internalGraph.nodes.find((candidate) => candidate.id === nodeId);
      if (!node) {
        continue;
      }

      const label = getInterfaceLabel({ rawData: node.data, fallback: `in${index + 1}` });
      let resolved = inputLookup.get(label.toLowerCase());

      if (typeof resolved === "undefined") {
        const fallbackKey = index === 0 ? "default" : `in${index + 1}`;
        resolved = inputLookup.get(fallbackKey.toLowerCase());
      }

      nextInternalState[node.id] = toSignalOrNull(resolved);
    }

    snapshot = {
      ...snapshot,
      nodeInternalState: nextInternalState,
      status: "running",
    };

    const resultSnapshot = stepSimulation({
      graph: internalGraph,
      registry,
      snapshot,
    });

    const externalOutputs: Record<string, SignalValue> = {};
    const outportIds = getSortedInterfaceNodeIds({
      graph: internalGraph,
      type: OUTPORT_BLOCK_TYPE,
    });

    for (let index = 0; index < outportIds.length; index += 1) {
      const nodeId = outportIds[index];
      const node = internalGraph.nodes.find((candidate) => candidate.id === nodeId);
      if (!node) {
        continue;
      }

      const label = getInterfaceLabel({ rawData: node.data, fallback: `out${index + 1}` });
      const nodeOutputs = resultSnapshot.nodeOutputs[node.id] ?? {};
      const value = toSignalOrNull(nodeOutputs.default ?? null);

      externalOutputs[label] = value;
      if (index === 0 || label.toLowerCase() === "default") {
        externalOutputs.default = value;
      }
    }

    return {
      outputs: externalOutputs,
      nextState: {
        internalSnapshot: resultSnapshot,
      } satisfies SubsystemState,
    };
  },
};
