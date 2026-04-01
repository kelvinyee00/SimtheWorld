import { generateAnsiCArtifacts } from "@/src/codegen/cCodegen";
import { COUNTER_BLOCK_TYPE } from "@/src/simulation/blocks/counterBlock";
import { GAIN_BLOCK_TYPE } from "@/src/simulation/blocks/gainBlock";
import { PRODUCT_BLOCK_TYPE } from "@/src/simulation/blocks/productBlock";
import { SUM_BLOCK_TYPE } from "@/src/simulation/blocks/sumBlock";
import {
  StateMachineBlock,
  STATE_MACHINE_BLOCK_TYPE,
} from "@/src/simulation/blocks/stateMachineBlock";
import {
  TruthTableBlock,
  TRUTH_TABLE_BLOCK_TYPE,
} from "@/src/simulation/blocks/truthTableBlock";
import { createInitialSnapshot, stepSimulation } from "@/src/simulation/engine";
import {
  BlockRegistry,
  SignalValue,
  SimulationEdge,
  SimulationGraph,
  SimulationNode,
} from "@/src/simulation/types";
import { getTopologicalOrder } from "@/src/simulation/topology";

export interface SilProbe {
  nodeId: string;
  handle?: string;
}

export interface SilTraceEntry {
  tick: number;
  timeMs: number;
  values: Record<string, SignalValue>;
}

export interface SilMismatch {
  tick: number;
  key: string;
  runtime: SignalValue;
  generated: SignalValue;
}

export type SilStrictMode = "off" | "unsupported-fail";

export interface SilReport {
  modelName: string;
  strictMode: SilStrictMode;
  pass: boolean;
  mismatchCount: number;
  unsupportedBlockTypes: string[];
  epsilon: number;
  probes: SilProbe[];
  failureReason?: string;
  mismatches: SilMismatch[];
}

export interface SilResult {
  pass: boolean;
  strictMode: SilStrictMode;
  failureReason?: string;
  codegen: ReturnType<typeof generateAnsiCArtifacts>;
  runtimeTrace: SilTraceEntry[];
  generatedTrace: SilTraceEntry[];
  mismatches: SilMismatch[];
  unsupportedBlockTypes: string[];
  report: SilReport;
}

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toInputMap(params: {
  nodeId: string;
  edges: SimulationEdge[];
  nodeOutputs: Record<string, Record<string, SignalValue>>;
}): Record<string, SignalValue> {
  const incoming = params.edges
    .filter((edge) => edge.target === params.nodeId)
    .slice()
    .sort((left, right) => {
      const leftTarget = left.targetHandle ?? "default";
      const rightTarget = right.targetHandle ?? "default";
      const targetCompare = leftTarget.localeCompare(rightTarget);
      if (targetCompare !== 0) {
        return targetCompare;
      }

      const sourceCompare = left.source.localeCompare(right.source);
      if (sourceCompare !== 0) {
        return sourceCompare;
      }

      const leftSourceHandle = left.sourceHandle ?? "default";
      const rightSourceHandle = right.sourceHandle ?? "default";
      const sourceHandleCompare = leftSourceHandle.localeCompare(rightSourceHandle);
      if (sourceHandleCompare !== 0) {
        return sourceHandleCompare;
      }

      return left.id.localeCompare(right.id);
    });

  const inputs: Record<string, SignalValue> = {};
  const keyCounters = new Map<string, number>();

  for (const edge of incoming) {
    const outputMap = params.nodeOutputs[edge.source] ?? {};
    const sourceHandle = edge.sourceHandle ?? "default";
    const value = outputMap[sourceHandle] ?? outputMap.default ?? null;
    const baseKey = edge.targetHandle ?? "default";
    const count = keyCounters.get(baseKey) ?? 0;
    const key = count === 0 ? baseKey : `${baseKey}__${count + 1}`;
    keyCounters.set(baseKey, count + 1);
    inputs[key] = value;
  }

  return inputs;
}

function readPrimaryNumericInput(inputs: Record<string, SignalValue>): number | null {
  const direct = inputs.in ?? inputs.default;
  if (typeof direct === "number" && Number.isFinite(direct)) {
    return direct;
  }

  const orderedKeys = Object.keys(inputs).sort((left, right) => left.localeCompare(right));
  for (const key of orderedKeys) {
    const value = inputs[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function collectNumericInputs(inputs: Record<string, SignalValue>): number[] {
  return Object.keys(inputs)
    .sort((left, right) => left.localeCompare(right))
    .map((key) => inputs[key])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function evaluateGeneratedNode(params: {
  node: SimulationNode;
  tick: number;
  timeMs: number;
  stepTimeMs: number;
  inputs: Record<string, SignalValue>;
  previousState: unknown;
}): { outputs: Record<string, SignalValue>; nextState: unknown } {
  const { node, tick, timeMs, stepTimeMs, inputs, previousState } = params;
  const data = (node.data as Record<string, unknown> | undefined) ?? {};

  switch (node.type) {
    case COUNTER_BLOCK_TYPE: {
      const start = toFiniteNumber(data.start, 0);
      const step = toFiniteNumber(data.step, 1);
      const mode = data.mode === "dec" ? "dec" : "inc";
      const current =
        typeof previousState === "number" && Number.isFinite(previousState)
          ? previousState
          : start;
      const delta = mode === "dec" ? -step : step;
      return {
        outputs: { default: current },
        nextState: current + delta,
      };
    }

    case GAIN_BLOCK_TYPE: {
      const gain = toFiniteNumber(data.gain, 1);
      const input = readPrimaryNumericInput(inputs);
      return {
        outputs: { default: input === null ? null : input * gain },
        nextState: previousState,
      };
    }

    case SUM_BLOCK_TYPE: {
      const values = collectNumericInputs(inputs);
      return {
        outputs: {
          default: values.length > 0 ? values.reduce((acc, value) => acc + value, 0) : null,
        },
        nextState: previousState,
      };
    }

    case PRODUCT_BLOCK_TYPE: {
      const values = collectNumericInputs(inputs);
      return {
        outputs: {
          default: values.length > 0 ? values.reduce((acc, value) => acc * value, 1) : null,
        },
        nextState: previousState,
      };
    }

    case TRUTH_TABLE_BLOCK_TYPE: {
      const result = TruthTableBlock.step({
        tick,
        timeMs,
        stepTimeMs,
        nodeId: node.id,
        params: data,
        inputs,
        previousState,
        registry: {},
        globalSignals: {},
      });
      return {
        outputs: result.outputs,
        nextState: result.nextState,
      };
    }

    case STATE_MACHINE_BLOCK_TYPE: {
      const result = StateMachineBlock.step({
        tick,
        timeMs,
        stepTimeMs,
        nodeId: node.id,
        params: data,
        inputs,
        previousState,
        registry: {},
        globalSignals: {},
      });
      return {
        outputs: result.outputs,
        nextState: result.nextState,
      };
    }

    default:
      return {
        outputs: {
          default: null,
        },
        nextState: previousState,
      };
  }
}

function makeProbeKey(probe: SilProbe): string {
  const handle = probe.handle ?? "default";
  return `${probe.nodeId}.${handle}`;
}

function normalizeProbes(probes: SilProbe[]): SilProbe[] {
  return probes
    .map((probe) => ({
      nodeId: probe.nodeId,
      ...(probe.handle ? { handle: probe.handle } : {}),
    }))
    .sort((left, right) => {
      const nodeCompare = left.nodeId.localeCompare(right.nodeId);
      if (nodeCompare !== 0) {
        return nodeCompare;
      }

      const leftHandle = left.handle ?? "default";
      const rightHandle = right.handle ?? "default";
      return leftHandle.localeCompare(rightHandle);
    });
}

function buildTraceEntry(params: {
  tick: number;
  timeMs: number;
  probes: SilProbe[];
  outputs: Record<string, Record<string, SignalValue>>;
}): SilTraceEntry {
  const values: Record<string, SignalValue> = {};

  for (const probe of params.probes) {
    const key = makeProbeKey(probe);
    const handle = probe.handle ?? "default";
    values[key] = params.outputs[probe.nodeId]?.[handle] ?? null;
  }

  return {
    tick: params.tick,
    timeMs: params.timeMs,
    values,
  };
}

function tracesEqual(params: {
  left: SignalValue;
  right: SignalValue;
  epsilon: number;
}): boolean {
  const { left, right, epsilon } = params;
  if (typeof left === "number" && typeof right === "number") {
    return Math.abs(left - right) <= epsilon;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }

    for (let index = 0; index < left.length; index += 1) {
      const l = left[index];
      const r = right[index];
      if (typeof l === "number" && typeof r === "number") {
        if (Math.abs(l - r) > epsilon) {
          return false;
        }
      } else if (Array.isArray(l) && Array.isArray(r)) {
        if (!tracesEqual({ left: l as SignalValue, right: r as SignalValue, epsilon })) {
          return false;
        }
      } else if (l !== r) {
        return false;
      }
    }

    return true;
  }

  return left === right;
}

function runGeneratedTrace(params: {
  graph: SimulationGraph;
  ticks: number;
  stepTimeMs: number;
  simulationTimeMs: number;
  probes: SilProbe[];
}): SilTraceEntry[] {
  const { graph, ticks, stepTimeMs, simulationTimeMs, probes } = params;

  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const executionOrder = getTopologicalOrder(graph, {
    feedbackSourceNodeIds: new Set<string>(),
  });

  let tick = 0;
  let timeMs = 0;
  const nodeOutputs: Record<string, Record<string, SignalValue>> = {};
  const nodeInternalState: Record<string, unknown> = {};
  const trace: SilTraceEntry[] = [];

  while (tick < ticks && timeMs < simulationTimeMs) {
    for (const nodeId of executionOrder) {
      const node = nodesById.get(nodeId);
      if (!node) {
        continue;
      }

      const inputs = toInputMap({
        nodeId,
        edges: graph.edges,
        nodeOutputs,
      });

      const previousState = nodeInternalState[nodeId];
      const stepped = evaluateGeneratedNode({
        node,
        tick,
        timeMs,
        stepTimeMs,
        inputs,
        previousState,
      });

      nodeOutputs[nodeId] = stepped.outputs;
      nodeInternalState[nodeId] =
        typeof stepped.nextState === "undefined" ? previousState : stepped.nextState;
    }

    trace.push(
      buildTraceEntry({
        tick,
        timeMs,
        probes,
        outputs: nodeOutputs,
      })
    );

    tick += 1;
    timeMs += stepTimeMs;
  }

  return trace;
}

function runRuntimeTrace(params: {
  graph: SimulationGraph;
  registry: BlockRegistry;
  ticks: number;
  stepTimeMs: number;
  simulationTimeMs: number;
  probes: SilProbe[];
}): SilTraceEntry[] {
  const { graph, registry, ticks, stepTimeMs, simulationTimeMs, probes } = params;

  let snapshot = createInitialSnapshot({
    stepTimeMs,
    simulationTimeMs,
  });

  const trace: SilTraceEntry[] = [];
  for (let index = 0; index < ticks; index += 1) {
    snapshot = stepSimulation({
      graph,
      registry,
      snapshot,
    });

    trace.push(
      buildTraceEntry({
        tick: snapshot.tick - 1,
        timeMs: snapshot.timeMs - snapshot.stepTimeMs,
        probes,
        outputs: snapshot.nodeOutputs,
      })
    );

    if (snapshot.status === "completed") {
      break;
    }
  }

  return trace;
}

export function serializeSilReport(report: SilReport): string {
  return JSON.stringify(report, null, 2);
}

export function runSilEquivalence(params: {
  modelName: string;
  graph: SimulationGraph;
  registry: BlockRegistry;
  ticks: number;
  probes?: SilProbe[];
  stepTimeMs?: number;
  simulationTimeMs?: number;
  epsilon?: number;
  strictMode?: SilStrictMode;
}): SilResult {
  const {
    modelName,
    graph,
    registry,
    ticks,
    probes = graph.nodes.map((node) => ({ nodeId: node.id })),
    stepTimeMs = 100,
    simulationTimeMs = 10_000,
    epsilon = 1e-9,
    strictMode = "off",
  } = params;

  const normalizedProbes = normalizeProbes(probes);

  const codegen = generateAnsiCArtifacts({ modelName, graph });

  const runtimeTrace = runRuntimeTrace({
    graph,
    registry,
    ticks,
    stepTimeMs,
    simulationTimeMs,
    probes: normalizedProbes,
  });

  const generatedTrace = runGeneratedTrace({
    graph,
    ticks,
    stepTimeMs,
    simulationTimeMs,
    probes: normalizedProbes,
  });

  const mismatches: SilMismatch[] = [];
  const traceLength = Math.min(runtimeTrace.length, generatedTrace.length);

  for (let index = 0; index < traceLength; index += 1) {
    const runtimeEntry = runtimeTrace[index];
    const generatedEntry = generatedTrace[index];

    const keys = new Set<string>([
      ...Object.keys(runtimeEntry.values),
      ...Object.keys(generatedEntry.values),
    ]);

    for (const key of keys) {
      const runtimeValue = runtimeEntry.values[key] ?? null;
      const generatedValue = generatedEntry.values[key] ?? null;

      if (
        !tracesEqual({
          left: runtimeValue,
          right: generatedValue,
          epsilon,
        })
      ) {
        mismatches.push({
          tick: runtimeEntry.tick,
          key,
          runtime: runtimeValue,
          generated: generatedValue,
        });
      }
    }
  }

  const unsupportedBlockTypes = codegen.ir.unsupportedBlockTypes;
  const strictUnsupportedFailure =
    strictMode === "unsupported-fail" && unsupportedBlockTypes.length > 0;

  const failureReason = strictUnsupportedFailure
    ? `Unsupported block types in strict mode: ${unsupportedBlockTypes.join(", ")}`
    : mismatches.length > 0
      ? `Trace mismatches detected: ${mismatches.length}`
      : undefined;

  const pass = mismatches.length === 0 && !strictUnsupportedFailure;

  const report: SilReport = {
    modelName: codegen.ir.modelName,
    strictMode,
    pass,
    mismatchCount: mismatches.length,
    unsupportedBlockTypes,
    epsilon,
    probes: normalizedProbes,
    ...(failureReason ? { failureReason } : {}),
    mismatches,
  };

  return {
    pass,
    strictMode,
    ...(failureReason ? { failureReason } : {}),
    codegen,
    runtimeTrace,
    generatedTrace,
    mismatches,
    unsupportedBlockTypes,
    report,
  };
}
