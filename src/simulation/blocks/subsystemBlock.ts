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
 * Subsystem block (P4-3 foundation, extended in P6-3 for masked multi-I/O interfaces).
 *
 * Behavior:
 * - Encapsulates a nested SimulationGraph.
 * - Persists internal runtime snapshot as node-local state.
 * - Maps external subsystem inputs to internal Inport states.
 * - Maps internal Outport outputs back to external subsystem outputs.
 *
 * P6-3 masking extension:
 * - Optional `mask.inputs[]` / `mask.outputs[]` define explicit external handle aliases.
 * - Optional `mask.parameters` enables parameterized nested graph values:
 *   node data string values prefixed with `$` are resolved against mask parameters.
 */
export const SUBSYSTEM_BLOCK_TYPE = "subsystem" as const;

interface SubsystemState {
  internalSnapshot: SimulationRuntimeSnapshot;
}

interface SubsystemMask {
  inputs: string[];
  outputs: string[];
  parameters: Record<string, unknown>;
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
  if (Array.isArray(value)) {
    const numeric = value.filter(
      (entry): entry is number => typeof entry === "number" && Number.isFinite(entry)
    );
    return numeric;
  }
  return null;
}

function sanitizeHandleName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

function parseSubsystemMask(rawMask: unknown): SubsystemMask {
  if (typeof rawMask !== "object" || rawMask === null) {
    return { inputs: [], outputs: [], parameters: {} };
  }

  const candidate = rawMask as Record<string, unknown>;

  const inputs = Array.isArray(candidate.inputs)
    ? candidate.inputs
        .map((entry) => sanitizeHandleName(entry))
        .filter((entry): entry is string => typeof entry === "string")
    : [];

  const outputs = Array.isArray(candidate.outputs)
    ? candidate.outputs
        .map((entry) => sanitizeHandleName(entry))
        .filter((entry): entry is string => typeof entry === "string")
    : [];

  const parameters =
    typeof candidate.parameters === "object" && candidate.parameters !== null
      ? (candidate.parameters as Record<string, unknown>)
      : {};

  return {
    inputs,
    outputs,
    parameters,
  };
}

function resolveMaskedValue(
  value: unknown,
  parameters: Record<string, unknown>
): unknown {
  if (typeof value !== "string") {
    return value;
  }

  if (!value.startsWith("$")) {
    return value;
  }

  const key = value.slice(1).trim();
  if (key.length === 0) {
    return value;
  }

  return key in parameters ? parameters[key] : value;
}

function applyMaskParameters(
  graph: SimulationGraph,
  parameters: Record<string, unknown>
): SimulationGraph {
  if (Object.keys(parameters).length === 0) {
    return graph;
  }

  return {
    nodes: graph.nodes.map((node) => {
      const rawData = (node.data ?? {}) as Record<string, unknown>;
      const nextData = Object.fromEntries(
        Object.entries(rawData).map(([key, value]) => [
          key,
          resolveMaskedValue(value, parameters),
        ])
      );

      return {
        ...node,
        data: nextData,
      };
    }),
    edges: graph.edges,
  };
}

export const SubsystemBlock: SimulationBlockDefinition = {
  type: SUBSYSTEM_BLOCK_TYPE,
  inputPortTypes: {
    default: "any",
    in1: "any",
    in2: "any",
    in3: "any",
    in4: "any",
    in5: "any",
    in6: "any",
    in7: "any",
    in8: "any",
  },
  outputPortTypes: {
    default: "any",
    out1: "any",
    out2: "any",
    out3: "any",
    out4: "any",
    out5: "any",
    out6: "any",
    out7: "any",
    out8: "any",
  },

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
    const mask = parseSubsystemMask(params.mask);
    const runtimeGraph = applyMaskParameters(internalGraph, mask.parameters);
    const state = toSubsystemState(previousState);

    let snapshot =
      state?.internalSnapshot ??
      createInitialSnapshot({
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
      graph: runtimeGraph,
      type: INPORT_BLOCK_TYPE,
    });

    for (let index = 0; index < inportIds.length; index += 1) {
      const nodeId = inportIds[index];
      const node = runtimeGraph.nodes.find((candidate) => candidate.id === nodeId);
      if (!node) {
        continue;
      }

      const label = getInterfaceLabel({ rawData: node.data, fallback: `in${index + 1}` });
      const maskedHandle = sanitizeHandleName(mask.inputs[index]);

      const handleCandidates = [
        maskedHandle,
        label,
        `in${index + 1}`,
        index === 0 ? "default" : null,
      ]
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.toLowerCase());

      let resolved: SignalValue | undefined;
      for (const handle of handleCandidates) {
        resolved = inputLookup.get(handle);
        if (typeof resolved !== "undefined") {
          break;
        }
      }

      nextInternalState[node.id] = toSignalOrNull(resolved);
    }

    snapshot = {
      ...snapshot,
      nodeInternalState: nextInternalState,
      status: "running",
    };

    const resultSnapshot = stepSimulation({
      graph: runtimeGraph,
      registry,
      snapshot,
    });

    const externalOutputs: Record<string, SignalValue> = {};
    const outportIds = getSortedInterfaceNodeIds({
      graph: runtimeGraph,
      type: OUTPORT_BLOCK_TYPE,
    });

    for (let index = 0; index < outportIds.length; index += 1) {
      const nodeId = outportIds[index];
      const node = runtimeGraph.nodes.find((candidate) => candidate.id === nodeId);
      if (!node) {
        continue;
      }

      const label = getInterfaceLabel({ rawData: node.data, fallback: `out${index + 1}` });
      const maskedHandle = sanitizeHandleName(mask.outputs[index]);
      const fallbackHandle = `out${index + 1}`;

      const nodeOutputs = resultSnapshot.nodeOutputs[node.id] ?? {};
      const value = toSignalOrNull(nodeOutputs.default ?? null);

      externalOutputs[label] = value;
      externalOutputs[fallbackHandle] = value;
      if (maskedHandle) {
        externalOutputs[maskedHandle] = value;
      }

      if (index === 0 || label.toLowerCase() === "default" || maskedHandle === "default") {
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
