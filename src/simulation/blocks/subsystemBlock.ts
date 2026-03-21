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
 * Subsystem block (P4-3 hierarchical modeling foundation).
 *
 * Behavior:
 * - Encapsulates a nested SimulationGraph.
 * - Manages its own internal SimulationRuntimeSnapshot as persistent node state.
 * - Inport nodes in the nested graph receive values from the subsystem's external inputs.
 * - Outport nodes in the nested graph provide values to the subsystem's external outputs.
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

export const SubsystemBlock: SimulationBlockDefinition = {
  type: SUBSYSTEM_BLOCK_TYPE,
  inputPortTypes: { default: "any", in1: "any", in2: "any" },
  outputPortTypes: { default: "any" },

  initialize: () => {
    // Subsystem inherits base rate from parent or uses defaults.
    // For P4-3, we assume subsystems run at the same base rate.
    return {
      internalSnapshot: createInitialSnapshot({
        simulationTimeMs: 1_000_000, // Large horizon for internal engine
        stepTimeMs: 100,
      }),
    } satisfies SubsystemState;
  },

  step: ({ stepTimeMs, params, previousState, inputs, registry }) => {
    const internalGraph = coerceInternalGraph(params.graph);
    const state = toSubsystemState(previousState);

    // 1) Reconstruct or resume internal snapshot
    let snapshot = state?.internalSnapshot ?? createInitialSnapshot({
      simulationTimeMs: 1_000_000,
      stepTimeMs,
    });

    // Sync timing just in case parent changed
    snapshot.stepTimeMs = stepTimeMs;

    // 2) Map external inputs to internal Inport block states
    // We match handle name to Inport node label (or id if no label)
    const nextInternalState = { ...snapshot.nodeInternalState };
    
    for (const node of internalGraph.nodes) {
      if (node.type === INPORT_BLOCK_TYPE) {
        const handle = node.data?.label ?? node.id;
        if (typeof handle === "string" && handle in inputs) {
          nextInternalState[node.id] = inputs[handle];
        } else if ("default" in inputs && handle === "Inport") {
            // Fallback for default Inport
            nextInternalState[node.id] = inputs.default;
        }
      }
    }

    snapshot = {
      ...snapshot,
      nodeInternalState: nextInternalState,
      status: "running", // Ensure it steps
    };

    // 3) Execute one tick of the nested graph
    const resultSnapshot = stepSimulation({
      graph: internalGraph,
      registry,
      snapshot,
    });

    // 4) Map internal Outport block outputs to external outputs
    const externalOutputs: Record<string, SignalValue> = {};
    for (const node of internalGraph.nodes) {
      if (node.type === OUTPORT_BLOCK_TYPE) {
        const handle = node.data?.label ?? node.id;
        const nodeOutputs = resultSnapshot.nodeOutputs[node.id] ?? {};
        const val = nodeOutputs.default ?? null;
        
        if (typeof handle === "string") {
            externalOutputs[handle] = val;
            // Also emit on default if it's the first/only outport
            if (Object.keys(externalOutputs).length === 1) {
                externalOutputs.default = val;
            }
        }
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
