"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  addEdge,
  Background,
  BackgroundVariant,
  Connection,
  Controls,
  Edge,
  MiniMap,
  Node,
  NodeTypes,
  OnConnect,
  Panel,
  ReactFlowInstance,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";

import { CustomBlockNode } from "@/src/canvas/customBlockNode";
import { SubsystemEditorModal } from "@/src/canvas/subsystemEditorModal";
import { DEFAULT_EDGE_OPTIONS } from "@/src/canvas/edgeDefaults";
import { COUNTER_BLOCK_TYPE } from "@/src/simulation/blocks/counterBlock";
import { DISPLAY_BLOCK_TYPE } from "@/src/simulation/blocks/displayBlock";
import { SCOPE_BLOCK_TYPE } from "@/src/simulation/blocks/scopeBlock";
import { GAIN_BLOCK_TYPE } from "@/src/simulation/blocks/gainBlock";
import { SUM_BLOCK_TYPE } from "@/src/simulation/blocks/sumBlock";
import { PRODUCT_BLOCK_TYPE } from "@/src/simulation/blocks/productBlock";
import { INTEGRATOR_BLOCK_TYPE } from "@/src/simulation/blocks/integratorBlock";
import { UNIT_DELAY_BLOCK_TYPE } from "@/src/simulation/blocks/unitDelayBlock";
import {
  COMPARE_BLOCK_TYPE,
  CompareOperator,
} from "@/src/simulation/blocks/compareBlock";
import { SWITCH_BLOCK_TYPE } from "@/src/simulation/blocks/switchBlock";
import { INPORT_BLOCK_TYPE } from "@/src/simulation/blocks/inportBlock";
import { OUTPORT_BLOCK_TYPE } from "@/src/simulation/blocks/outportBlock";
import { SUBSYSTEM_BLOCK_TYPE } from "@/src/simulation/blocks/subsystemBlock";
import { MUX_BLOCK_TYPE } from "@/src/simulation/blocks/muxBlock";
import { DEMUX_BLOCK_TYPE } from "@/src/simulation/blocks/demuxBlock";
import { PID_BLOCK_TYPE } from "@/src/simulation/blocks/pidBlock";
import {
  DISCRETE_TRANSFER_FCN_BLOCK_TYPE,
} from "@/src/simulation/blocks/discreteTransferFcnBlock";
import { LEAD_LAG_BLOCK_TYPE } from "@/src/simulation/blocks/leadLagBlock";
import { GOTO_BLOCK_TYPE } from "@/src/simulation/blocks/gotoBlock";
import { FROM_BLOCK_TYPE } from "@/src/simulation/blocks/fromBlock";
import { LUT_1D_BLOCK_TYPE, LUT_2D_BLOCK_TYPE } from "@/src/simulation/blocks/lutBlock";
import { STATE_MACHINE_BLOCK_TYPE } from "@/src/simulation/blocks/stateMachineBlock";
import {
  buildToFilePayload,
  TO_FILE_BLOCK_TYPE,
  ToFileExportFormat,
  toToFileState,
} from "@/src/simulation/blocks/toFileBlock";
import {
  listRecentSimulationRunRecords,
  PersistedSimulationRunRecord,
  saveSimulationRunRecord,
} from "@/src/persistence/simulationRunStore";
import {
  loadModelFromLocalStorage,
  parseModelDocument,
  saveModelToLocalStorage,
  serializeModelV3,
} from "@/src/persistence/modelPersistence";
import {
  validateConnectionCandidate,
} from "@/src/simulation/validation";
import { useSimulationRuntimeStore } from "@/src/store/simulationRuntimeStore";

/**
 * P0-5 baseline starter graph.
 *
 * Why this exists:
 * - The runtime store initializes with an empty graph.
 * - React Flow canvas needs visible entities so drag/connect/selection can be exercised.
 * - Keeping the seed graph local to the page avoids introducing new global bootstrapping
 *   complexity while still proving the editor-store integration contract.
 */
const INITIAL_NODES: Node[] = [
  {
    id: "counter-1",
    type: COUNTER_BLOCK_TYPE,
    position: { x: 80, y: 220 },
    data: { label: "Counter", start: 0, step: 1, mode: "inc" },
  },
  {
    id: "display-1",
    type: DISPLAY_BLOCK_TYPE,
    position: { x: 420, y: 80 },
    data: { label: "Display" },
  },
  {
    id: "scope-1",
    type: SCOPE_BLOCK_TYPE,
    position: { x: 420, y: 280 },
    data: { label: "Scope", maxPoints: 240 },
  },
];

const INITIAL_EDGES: Edge[] = [
  {
    id: "counter-1->display-1",
    source: "counter-1",
    target: "display-1",
    type: "straight",
  },
  {
    id: "counter-1->scope-1",
    source: "counter-1",
    target: "scope-1",
    type: "straight",
  },
];

const NODE_TYPES: NodeTypes = {
  [COUNTER_BLOCK_TYPE]: CustomBlockNode,
  [DISPLAY_BLOCK_TYPE]: CustomBlockNode,
  [SCOPE_BLOCK_TYPE]: CustomBlockNode,
  [GAIN_BLOCK_TYPE]: CustomBlockNode,
  [SUM_BLOCK_TYPE]: CustomBlockNode,
  [PRODUCT_BLOCK_TYPE]: CustomBlockNode,
  [INTEGRATOR_BLOCK_TYPE]: CustomBlockNode,
  [UNIT_DELAY_BLOCK_TYPE]: CustomBlockNode,
  [COMPARE_BLOCK_TYPE]: CustomBlockNode,
  [SWITCH_BLOCK_TYPE]: CustomBlockNode,
  [TO_FILE_BLOCK_TYPE]: CustomBlockNode,
  [INPORT_BLOCK_TYPE]: CustomBlockNode,
  [OUTPORT_BLOCK_TYPE]: CustomBlockNode,
  [SUBSYSTEM_BLOCK_TYPE]: CustomBlockNode,
  [MUX_BLOCK_TYPE]: CustomBlockNode,
  [DEMUX_BLOCK_TYPE]: CustomBlockNode,
  [PID_BLOCK_TYPE]: CustomBlockNode,
  [DISCRETE_TRANSFER_FCN_BLOCK_TYPE]: CustomBlockNode,
  [LEAD_LAG_BLOCK_TYPE]: CustomBlockNode,
  [GOTO_BLOCK_TYPE]: CustomBlockNode,
  [FROM_BLOCK_TYPE]: CustomBlockNode,
  [LUT_1D_BLOCK_TYPE]: CustomBlockNode,
  [LUT_2D_BLOCK_TYPE]: CustomBlockNode,
  [STATE_MACHINE_BLOCK_TYPE]: CustomBlockNode,
};

/**
 * Sidebar source of truth for blocks the editor can instantiate.
 *
 * High-density documentation standard:
 * - `label` is strictly presentation text used in the library list.
 * - `type` must match simulation block type constants and React Flow node mapping.
 * - Any future library entries should keep this list as the single insertion point.
 */
const LIBRARY_BLOCKS = [
  { label: "Counter", type: COUNTER_BLOCK_TYPE },
  { label: "Gain", type: GAIN_BLOCK_TYPE },
  { label: "Sum", type: SUM_BLOCK_TYPE },
  { label: "Product", type: PRODUCT_BLOCK_TYPE },
  { label: "Mux", type: MUX_BLOCK_TYPE },
  { label: "Demux", type: DEMUX_BLOCK_TYPE },
  { label: "PID", type: PID_BLOCK_TYPE },
  { label: "Discrete Transfer Fcn", type: DISCRETE_TRANSFER_FCN_BLOCK_TYPE },
  { label: "Lead/Lag", type: LEAD_LAG_BLOCK_TYPE },
  { label: "GOTO", type: GOTO_BLOCK_TYPE },
  { label: "FROM", type: FROM_BLOCK_TYPE },
  { label: "LUT 1D", type: LUT_1D_BLOCK_TYPE },
  { label: "LUT 2D", type: LUT_2D_BLOCK_TYPE },
  { label: "State Machine", type: STATE_MACHINE_BLOCK_TYPE },
  { label: "Inport", type: INPORT_BLOCK_TYPE },
  { label: "Outport", type: OUTPORT_BLOCK_TYPE },
  { label: "Subsystem", type: SUBSYSTEM_BLOCK_TYPE },
  { label: "Integrator", type: INTEGRATOR_BLOCK_TYPE },
  { label: "Unit Delay", type: UNIT_DELAY_BLOCK_TYPE },
  { label: "Compare", type: COMPARE_BLOCK_TYPE },
  { label: "Switch", type: SWITCH_BLOCK_TYPE },
  { label: "To File", type: TO_FILE_BLOCK_TYPE },
  { label: "Display", type: DISPLAY_BLOCK_TYPE },
  { label: "Scope", type: SCOPE_BLOCK_TYPE },
] as const;

/**
 * Runtime-safe id generator for newly created edges.
 *
 * We use `crypto.randomUUID` when available to prevent collisions during rapid gesture-based
 * wiring. Fallback keeps deterministic shape for environments without Web Crypto.
 */
function makeEdgeId(source: string, target: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${source}->${target}-${crypto.randomUUID()}`;
  }
  return `${source}->${target}-${Date.now()}`;
}

/**
 * Runtime-safe id generator for newly created nodes.
 */
function makeNodeId(type: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${type}-${crypto.randomUUID()}`;
  }
  return `${type}-${Date.now()}`;
}

/**
 * Canonical default node payloads for drag-created blocks.
 *
 * Why switch here:
 * - Keeps library drag/drop behavior deterministic.
 * - Ensures each created block has required runtime fields from first render.
 */


function deriveSubsystemMaskFromGraph(graph: { nodes: Node[]; edges: Edge[] }): {
  inputs: string[];
  outputs: string[];
} {
  const sanitize = (value: unknown, fallback: string): string => {
    if (typeof value !== "string") {
      return fallback;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  };

  const inports = graph.nodes
    .filter((node) => node.type === INPORT_BLOCK_TYPE)
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((node, index) =>
      sanitize((node.data as Record<string, unknown> | undefined)?.label, `in${index + 1}`)
    );

  const outports = graph.nodes
    .filter((node) => node.type === OUTPORT_BLOCK_TYPE)
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((node, index) =>
      sanitize((node.data as Record<string, unknown> | undefined)?.label, `out${index + 1}`)
    );

  return {
    inputs: inports,
    outputs: outports,
  };
}

function makeNodeData(type: string): Record<string, unknown> {
  switch (type) {
    case COUNTER_BLOCK_TYPE:
      return { label: "Counter", start: 0, step: 1, mode: "inc" };
    case GAIN_BLOCK_TYPE:
      return { label: "Gain", gain: 1 };
    case SUM_BLOCK_TYPE:
      return { label: "Sum" };
    case PRODUCT_BLOCK_TYPE:
      return { label: "Product" };
    case MUX_BLOCK_TYPE:
      return { label: "Mux" };
    case DEMUX_BLOCK_TYPE:
      return { label: "Demux" };
    case PID_BLOCK_TYPE:
      return {
        label: "PID",
        kp: 1,
        ki: 0,
        kd: 0,
        n: 10,
        lowerSaturation: null,
        upperSaturation: null,
      };
    case DISCRETE_TRANSFER_FCN_BLOCK_TYPE:
      return {
        label: "Discrete Transfer Fcn",
        numerator: [1],
        denominator: [1, 0],
      };
    case LEAD_LAG_BLOCK_TYPE:
      return {
        label: "Lead/Lag",
        gain: 1,
        leadTimeConstantSec: 0.1,
        lagTimeConstantSec: 1,
      };
    case GOTO_BLOCK_TYPE:
      return { label: "GOTO", tag: "signal" };
    case FROM_BLOCK_TYPE:
      return { label: "FROM", tag: "signal" };
    case LUT_1D_BLOCK_TYPE:
      return { label: "LUT 1D", breakpointsX: [0, 10], tableData: [0, 100] };
    case LUT_2D_BLOCK_TYPE:
      return { label: "LUT 2D", breakpointsX: [0, 10], breakpointsY: [0, 10], tableData: [[0, 100], [100, 200]] };
    case STATE_MACHINE_BLOCK_TYPE:
      return {
        label: "State Machine",
        initialState: "idle",
        states: ["idle", "active"],
        transitions: [
          { from: "idle", to: "active", event: "rising", eventInput: "in", guardExpr: "inputs.in === true", output: true },
          { from: "active", to: "idle", event: "falling", eventInput: "in", guardExpr: "inputs.in === false", output: false },
        ],
      };
    case INTEGRATOR_BLOCK_TYPE:
      return { label: "Integrator", initialCondition: 0 };
    case UNIT_DELAY_BLOCK_TYPE:
      return { label: "Unit Delay", initialValue: 0 };
    case COMPARE_BLOCK_TYPE:
      return { label: "Compare", operator: "gt" };
    case SWITCH_BLOCK_TYPE:
      return { label: "Switch" };
    case TO_FILE_BLOCK_TYPE:
      return { label: "To File", format: "json", fileName: "simulation-log", maxRows: 2000 };
    case INPORT_BLOCK_TYPE:
      return { label: "Inport" };
    case OUTPORT_BLOCK_TYPE:
      return { label: "Outport" };
    case SUBSYSTEM_BLOCK_TYPE:
      return {
        label: "Subsystem",
        graph: { nodes: [], edges: [] },
        mask: { inputs: ["in1"], outputs: ["out1"], parameters: {} },
      };
    case DISPLAY_BLOCK_TYPE:
      return { label: "Display" };
    case SCOPE_BLOCK_TYPE:
      return { label: "Scope", maxPoints: 240 };
    default:
      return { label: "Block" };
  }
}

type CounterMode = "inc" | "dec";

interface CounterInspectorData {
  start: number;
  step: number;
  mode: CounterMode;
}

interface GainInspectorData {
  gain: number;
}

interface ToFileInspectorData {
  format: ToFileExportFormat;
  fileName: string;
  maxRows: number;
  sampleCount: number;
}

interface IntegratorInspectorData {
  initialCondition: number;
}

interface UnitDelayInspectorData {
  initialValue: number;
}

interface CompareInspectorData {
  operator: CompareOperator;
}

interface PidInspectorData {
  kp: number;
  ki: number;
  kd: number;
  n: number;
  lowerSaturation: number | null;
  upperSaturation: number | null;
}

interface DiscreteTransferInspectorData {
  numerator: number[];
  denominator: number[];
}

interface LeadLagInspectorData {
  gain: number;
  leadTimeConstantSec: number;
  lagTimeConstantSec: number;
}

interface Lut1DInspectorData {
  breakpointsX: number[];
  tableData: number[];
}

interface Lut2DInspectorData {
  breakpointsX: number[];
  breakpointsY: number[];
  tableData: string; // JSON string for matrix
}

interface SubsystemMaskInspectorData {
  inputs: string[];
  outputs: string[];
  parameters: string;
}

interface StateMachineTransitionModel {
  from: string;
  to: string;
  guardExpr?: string;
  actionExpr?: string;
  output?: number | boolean;
  afterMs?: number;
  event?: "rising" | "falling";
  eventInput?: string;
}

interface StateMachineModel {
  initialState: string;
  states: string[];
  transitions: StateMachineTransitionModel[];
}

interface StateMachineInspectorData {
  model: StateMachineModel;
  modelJson: string;
}

const DEFAULT_COUNTER_INSPECTOR_DATA: CounterInspectorData = {
  start: 0,
  step: 1,
  mode: "inc",
};

const DEFAULT_GAIN_INSPECTOR_DATA: GainInspectorData = {
  gain: 1,
};

const DEFAULT_INTEGRATOR_INSPECTOR_DATA: IntegratorInspectorData = {
  initialCondition: 0,
};

const DEFAULT_UNIT_DELAY_INSPECTOR_DATA: UnitDelayInspectorData = {
  initialValue: 0,
};

const DEFAULT_COMPARE_INSPECTOR_DATA: CompareInspectorData = {
  operator: "gt",
};

const DEFAULT_PID_INSPECTOR_DATA: PidInspectorData = {
  kp: 1,
  ki: 0,
  kd: 0,
  n: 10,
  lowerSaturation: null,
  upperSaturation: null,
};

const DEFAULT_DISCRETE_TRANSFER_INSPECTOR_DATA: DiscreteTransferInspectorData = {
  numerator: [1],
  denominator: [1, 0],
};

const DEFAULT_LEAD_LAG_INSPECTOR_DATA: LeadLagInspectorData = {
  gain: 1,
  leadTimeConstantSec: 0.1,
  lagTimeConstantSec: 1,
};

const MS_PER_SECOND = 1_000;
const MIN_TIMING_SECONDS = 0.001;

/**
 * Canvas visual policy (P1-3 Matlab/Simulink-inspired aesthetics).
 *
 * Critical styling directives:
 * - Keep the viewport on a light neutral gray to mirror engineering CAD/block-diagram tools.
 * - Persist a dotted guide grid at all times so alignment cues are available during pan/zoom.
 * - Keep contrast restrained: grid must remain visible without competing with nodes/edges.
 */
const CANVAS_STYLE: React.CSSProperties = {
  touchAction: "none",
  backgroundColor: "#eceff3",
};

/**
 * Dot grid tuning.
 * - Slightly cool gray dots preserve professional hierarchy behind white nodes.
 * - Spacing 20 approximates common schematic-grid rhythm while avoiding visual noise.
 */
const CANVAS_GRID_COLOR = "#c2c9d2";
const CANVAS_GRID_GAP = 20;
const CANVAS_GRID_DOT_SIZE = 1.2;

function formatMsAsSeconds(ms: number): string {
  return String(ms / MS_PER_SECOND);
}

function sanitizeStateMachineName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeStateMachineEventType(value: unknown): "rising" | "falling" | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "rising" || normalized === "falling") {
    return normalized;
  }

  return undefined;
}

function normalizeStateMachineModel(raw: unknown): StateMachineModel {
  const source =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};

  const seenStates = new Set<string>();
  const states = Array.isArray(source.states)
    ? source.states
        .map((entry) => sanitizeStateMachineName(entry))
        .filter((entry): entry is string => {
          if (!entry) {
            return false;
          }
          const normalized = entry.toLowerCase();
          if (seenStates.has(normalized)) {
            return false;
          }
          seenStates.add(normalized);
          return true;
        })
    : [];

  const initialStateCandidate = sanitizeStateMachineName(source.initialState);
  const initialState = initialStateCandidate ?? states[0] ?? "idle";

  const transitions = Array.isArray(source.transitions)
    ? source.transitions.reduce<StateMachineTransitionModel[]>((accumulator, transition) => {
        if (typeof transition !== "object" || transition === null) {
          return accumulator;
        }

        const candidate = transition as Record<string, unknown>;
        const from = sanitizeStateMachineName(candidate.from);
        const to = sanitizeStateMachineName(candidate.to);
        if (!from || !to) {
          return accumulator;
        }

        const guardExpr = sanitizeStateMachineName(candidate.guardExpr) ?? undefined;
        const actionExpr = sanitizeStateMachineName(candidate.actionExpr) ?? undefined;
        const numericOutput =
          typeof candidate.output === "number" && Number.isFinite(candidate.output)
            ? candidate.output
            : undefined;
        const output =
          typeof candidate.output === "boolean"
            ? candidate.output
            : numericOutput;
        const afterMs =
          typeof candidate.afterMs === "number" && Number.isFinite(candidate.afterMs) && candidate.afterMs >= 0
            ? candidate.afterMs
            : undefined;
        const event = sanitizeStateMachineEventType(candidate.event);
        const eventInput = sanitizeStateMachineName(candidate.eventInput) ?? undefined;

        const normalizedTransition: StateMachineTransitionModel = {
          from,
          to,
          ...(guardExpr ? { guardExpr } : {}),
          ...(actionExpr ? { actionExpr } : {}),
          ...(typeof output !== "undefined" ? { output } : {}),
          ...(typeof afterMs === "number" ? { afterMs } : {}),
          ...(event ? { event } : {}),
          ...(eventInput ? { eventInput } : {}),
        };

        accumulator.push(normalizedTransition);
        return accumulator;
      }, [])
    : [];

  const normalizedStates = states.includes(initialState)
    ? states
    : [initialState, ...states];

  return {
    initialState,
    states: normalizedStates,
    transitions,
  };
}

function parseStateMachineModelJson(rawValue: string): StateMachineModel | null {
  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    return normalizeStateMachineModel(parsed);
  } catch {
    return null;
  }
}

function formatStateMachineModelJson(model: StateMachineModel): string {
  return JSON.stringify(model, null, 2);
}

function triggerTextDownload(params: {
  fileName: string;
  extension: "json" | "csv";
  mimeType: string;
  content: string;
}): void {
  const safeBase = params.fileName.trim().length > 0 ? params.fileName.trim() : "simulation-log";
  const blob = new Blob([params.content], { type: params.mimeType });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeBase}.${params.extension}`;
  anchor.click();

  URL.revokeObjectURL(url);
}

export default function Home() {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingSubsystemId, setEditingSubsystemId] = useState<string | null>(null);
  const [isMobileInspectorOpen, setIsMobileInspectorOpen] = useState(false);
  const [isTracePanelOpen, setIsTracePanelOpen] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [recentRunRecords, setRecentRunRecords] = useState<PersistedSimulationRunRecord[]>([]);
  const [toFileActionMessage, setToFileActionMessage] = useState<string | null>(null);
  const [modelActionMessage, setModelActionMessage] = useState<string | null>(null);
  const [stateMachineModelDraft, setStateMachineModelDraft] = useState<string>("");
  const [stateMachineDraftNodeId, setStateMachineDraftNodeId] = useState<string | null>(null);
  const [stateMachineDraftError, setStateMachineDraftError] = useState<string | null>(null);
  const lastPersistedCompletionRef = useRef<string | null>(null);
  const modelFileInputRef = useRef<HTMLInputElement | null>(null);
  const hasInitializedModelPersistenceRef = useRef(false);

  const runtime = useSimulationRuntimeStore((state) => state.runtime);
  const metrics = useSimulationRuntimeStore((state) => state.metrics);
  const trace = useSimulationRuntimeStore((state) => state.trace);
  const clearTrace = useSimulationRuntimeStore((state) => state.clearTrace);
  const registry = useSimulationRuntimeStore((state) => state.registry);
  const setGraph = useSimulationRuntimeStore((state) => state.setGraph);
  const setTiming = useSimulationRuntimeStore((state) => state.setTiming);
  const run = useSimulationRuntimeStore((state) => state.run);
  const pause = useSimulationRuntimeStore((state) => state.pause);
  const reset = useSimulationRuntimeStore((state) => state.reset);

  const [stopTimeSecondsInput, setStopTimeSecondsInput] = useState(() =>
    formatMsAsSeconds(runtime.simulationTimeMs)
  );
  const [stepTimeSecondsInput, setStepTimeSecondsInput] = useState(() =>
    formatMsAsSeconds(runtime.stepTimeMs)
  );
  const [isEditingStopTime, setIsEditingStopTime] = useState(false);
  const [isEditingStepTime, setIsEditingStepTime] = useState(false);

  /**
   * One-way synchronization from React Flow state -> runtime store graph.
   *
   * Rationale:
   * - React Flow owns interaction-level state transitions (dragging, wiring updates).
   * - The simulation runtime should consume a normalized graph shape with only execution fields.
   * - Running this effect on node/edge changes keeps runtime graph always current for Run/Pause.
   */
  useEffect(() => {
    setGraph({
      nodes: nodes.map((node) => ({
        id: node.id,
        type: node.type ?? "default",
        data: (node.data as Record<string, unknown> | undefined) ?? {},
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? undefined,
        targetHandle: edge.targetHandle ?? undefined,
      })),
    });
  }, [edges, nodes, setGraph]);

  const stopTimeInputValue = isEditingStopTime
    ? stopTimeSecondsInput
    : formatMsAsSeconds(runtime.simulationTimeMs);
  const stepTimeInputValue = isEditingStepTime
    ? stepTimeSecondsInput
    : formatMsAsSeconds(runtime.stepTimeMs);

  /**
   * Timing control binding contract (critical UI->runtime path):
   * - Inputs are edited in seconds to match simulation nomenclature users expect (Stop Time/Ts).
   * - Runtime store consumes milliseconds, so conversion is centralized here to avoid split logic.
   * - Commit-on-blur / Enter guarantees drag/connect/deletion keyboard behavior remains unchanged
   *   because we do not dispatch store updates on every keypress.
   * - Invalid values are normalized back to the currently effective runtime values, preventing
   *   accidental NaN/zero timing from destabilizing the fixed-step scheduler.
   */
  const commitTimingValue = useCallback(
    (field: "stop" | "step", rawValue: string) => {
      const parsedSeconds = Number(rawValue);
      if (!Number.isFinite(parsedSeconds) || parsedSeconds < MIN_TIMING_SECONDS) {
        setStopTimeSecondsInput(formatMsAsSeconds(runtime.simulationTimeMs));
        setStepTimeSecondsInput(formatMsAsSeconds(runtime.stepTimeMs));
        return;
      }

      const nextMs = Math.round(parsedSeconds * MS_PER_SECOND);
      if (field === "stop") {
        setTiming({ simulationTimeMs: nextMs });
        return;
      }

      setTiming({ stepTimeMs: nextMs });
    },
    [runtime.simulationTimeMs, runtime.stepTimeMs, setTiming]
  );

  const onTimingInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>, field: "stop" | "step") => {
      if (event.key !== "Enter") {
        return;
      }
      event.currentTarget.blur();
      commitTimingValue(field, event.currentTarget.value);
    },
    [commitTimingValue]
  );

  /**
   * Connection handler (node wiring).
   *
   * Uses `addEdge` so React Flow applies canonical merge behavior and all edges automatically
   * inherit `DEFAULT_EDGE_OPTIONS` policy (`type: "straight"`).
   */
  const onConnect = useCallback<OnConnect>(
    (connection: Connection) => {
      const candidate: Edge = {
        ...connection,
        source: connection.source ?? "source",
        target: connection.target ?? "target",
        id: makeEdgeId(connection.source ?? "source", connection.target ?? "target"),
        // Belt-and-suspenders safety: preserve straight-edge policy even if call-sites evolve.
        type: DEFAULT_EDGE_OPTIONS.type ?? "straight",
      };

      const issue = validateConnectionCandidate({
        graph: {
          nodes: nodes.map((node) => ({
            id: node.id,
            type: node.type ?? "default",
            data: (node.data as Record<string, unknown> | undefined) ?? {},
          })),
          edges: edges
            .concat(candidate)
            .map((edge) => ({
              id: edge.id,
              source: edge.source,
              target: edge.target,
              sourceHandle: edge.sourceHandle ?? undefined,
              targetHandle: edge.targetHandle ?? undefined,
            })),
        },
        registry,
        edge: {
          id: candidate.id,
          source: candidate.source,
          target: candidate.target,
          sourceHandle: candidate.sourceHandle ?? undefined,
          targetHandle: candidate.targetHandle ?? undefined,
        },
      });

      if (issue) {
        setModelActionMessage(issue.message);
        return;
      }

      setModelActionMessage(null);
      setEdges((currentEdges) => addEdge(candidate, currentEdges));
    },
    [edges, nodes, registry, setEdges]
  );

  /**
   * Inspector selection model.
   *
   * We intentionally model selection at page-level (not in runtime store) because it is
   * presentation state. This keeps runtime deterministic and avoids mixing simulation concerns
   * with view concerns as the editor surface scales.
   */
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    setIsMobileInspectorOpen(true);
  }, []);

  /**
   * Delete action for selected nodes and selected edges.
   *
   * Selection sources:
   * - Explicit click-tracked node (`selectedNodeId`) for inspector-driven interactions.
   * - React Flow native selected flags for nodes/edges.
   *
   * Industrial UX directive:
   * - Operators must be able to select/delete wires directly.
   *   We therefore merge node-based and edge-based deletion paths in one deterministic routine.
   */
  const deleteSelectedNodes = useCallback(() => {
    const selectedNodeIds = nodes.filter((node) => node.selected).map((node) => node.id);
    if (selectedNodeId && !selectedNodeIds.includes(selectedNodeId)) {
      selectedNodeIds.push(selectedNodeId);
    }

    const selectedEdgeIdsFromCanvas = edges
      .filter((edge) => edge.selected)
      .map((edge) => edge.id);

    if (selectedNodeIds.length === 0 && selectedEdgeIdsFromCanvas.length === 0) {
      return;
    }

    const selectedNodeSet = new Set(selectedNodeIds);
    const selectedEdgeSet = new Set(selectedEdgeIdsFromCanvas);

    setNodes((currentNodes) => currentNodes.filter((node) => !selectedNodeSet.has(node.id)));
    setEdges((currentEdges) =>
      currentEdges.filter(
        (edge) =>
          !selectedEdgeSet.has(edge.id) &&
          !selectedNodeSet.has(edge.source) &&
          !selectedNodeSet.has(edge.target)
      )
    );
    setSelectedNodeId(null);
  }, [edges, nodes, selectedNodeId, setEdges, setNodes]);

  /**
   * Keyboard parity for deletion.
   *
   * Supports Delete/Backspace while avoiding interference with text-entry controls.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName.toLowerCase();
      const isTextEntryTarget =
        target?.isContentEditable || tagName === "input" || tagName === "textarea";

      if (isTextEntryTarget) {
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelectedNodes();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteSelectedNodes]);

  /**
   * HTML5 drag source initializer for library items.
   */
  const onLibraryDragStart = useCallback(
    (event: React.DragEvent<HTMLLIElement>, type: string) => {
      event.dataTransfer.setData("application/reactflow", type);
      event.dataTransfer.effectAllowed = "move";
    },
    []
  );

  /**
   * Canvas drop target policy. Required to allow browser drop events.
   */
  const onCanvasDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  /**
   * Library drop handler.
   *
   * Converts pointer screen coordinates to flow-space coordinates and appends
   * a fully-initialized node of the dragged block type.
   */
  const onCanvasDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");
      if (!type || !reactFlowInstance) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      setNodes((currentNodes) =>
        currentNodes.concat({
          id: makeNodeId(type),
          type,
          position,
          data: makeNodeData(type),
        })
      );
    },
    [reactFlowInstance, setNodes]
  );

  useEffect(() => {
    let cancelled = false;

    listRecentSimulationRunRecords(12)
      .then((records) => {
        if (!cancelled) {
          setRecentRunRecords(records);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setToFileActionMessage("IndexedDB unavailable: run history disabled.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (runtime.status !== "completed") {
      lastPersistedCompletionRef.current = null;
      return;
    }

    const completionSignature = `${runtime.tick}:${runtime.timeMs}`;
    if (lastPersistedCompletionRef.current === completionSignature) {
      return;
    }

    const toFileNodes = nodes.filter((node) => node.type === TO_FILE_BLOCK_TYPE);
    if (toFileNodes.length === 0) {
      lastPersistedCompletionRef.current = completionSignature;
      return;
    }

    let cancelled = false;

    const persist = async () => {
      const saved: PersistedSimulationRunRecord[] = [];

      for (const node of toFileNodes) {
        const nodeParams = (node.data as Record<string, unknown> | undefined) ?? {};
        const parsedState = toToFileState(runtime.nodeInternalState[node.id], nodeParams);
        const payload = buildToFilePayload({
          format: parsedState.format,
          samples: parsedState.samples,
        });

        const savedRecord = await saveSimulationRunRecord({
          nodeId: node.id,
          fileName: parsedState.fileName,
          format: parsedState.format,
          sampleCount: parsedState.samples.length,
          payload: payload.content,
        });

        if (savedRecord) {
          saved.push(savedRecord);
        }
      }

      if (cancelled || saved.length === 0) {
        return;
      }

      const latest = await listRecentSimulationRunRecords(12);
      if (!cancelled) {
        setRecentRunRecords(latest);
        setToFileActionMessage(`Persisted ${saved.length} To File run(s) to IndexedDB.`);
      }
    };

    lastPersistedCompletionRef.current = completionSignature;

    persist().catch(() => {
      if (!cancelled) {
        setToFileActionMessage("Failed to persist run outputs to IndexedDB.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [nodes, runtime.nodeInternalState, runtime.status, runtime.tick, runtime.timeMs]);

  useEffect(() => {
    const persisted = loadModelFromLocalStorage();
    if (persisted) {
      setNodes(
        persisted.nodes.map((node) => ({
          id: node.id,
          type: node.type,
          position: node.position,
          data: node.data,
        }))
      );
      setEdges(
        persisted.edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
          type: edge.type ?? "straight",
        }))
      );
      setTiming({
        simulationTimeMs: persisted.timing.simulationTimeMs,
        stepTimeMs: persisted.timing.stepTimeMs,
      });
      setModelActionMessage("Loaded persisted model snapshot (schema v3).");
    }

    hasInitializedModelPersistenceRef.current = true;
  }, [setEdges, setNodes, setTiming]);

  useEffect(() => {
    if (!hasInitializedModelPersistenceRef.current) {
      return;
    }

    try {
      const serialized = serializeModelV3({
        nodes: nodes.map((node) => ({
          id: node.id,
          type: node.type ?? "default",
          position: node.position,
          data: (node.data as Record<string, unknown> | undefined) ?? {},
        })),
        edges: edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle ?? undefined,
          targetHandle: edge.targetHandle ?? undefined,
          type: edge.type ?? "straight",
        })),
        timing: {
          simulationTimeMs: runtime.simulationTimeMs,
          stepTimeMs: runtime.stepTimeMs,
        },
      });

      saveModelToLocalStorage(serialized);
    } catch {
      setModelActionMessage("Failed to persist model snapshot to local storage.");
    }
  }, [edges, nodes, runtime.simulationTimeMs, runtime.stepTimeMs]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

  const editingSubsystemGraph = useMemo<{ nodes: Node[]; edges: Edge[] }>(() => {
    if (!editingSubsystemId) {
      return { nodes: [], edges: [] };
    }

    const subsystemNode = nodes.find((node) => node.id === editingSubsystemId);
    const rawData = (subsystemNode?.data as Record<string, unknown> | undefined) ?? {};
    const rawGraph = rawData.graph;

    if (
      typeof rawGraph === "object" &&
      rawGraph !== null &&
      "nodes" in rawGraph &&
      "edges" in rawGraph &&
      Array.isArray((rawGraph as { nodes?: unknown }).nodes) &&
      Array.isArray((rawGraph as { edges?: unknown }).edges)
    ) {
      return {
        nodes: (rawGraph as { nodes: Node[] }).nodes,
        edges: (rawGraph as { edges: Edge[] }).edges,
      };
    }

    return { nodes: [], edges: [] };
  }, [editingSubsystemId, nodes]);

  const selectedEdgeIds = useMemo(
    () => edges.filter((edge) => edge.selected).map((edge) => edge.id),
    [edges]
  );

  const hasSelection = useMemo(
    () =>
      Boolean(selectedNodeId) ||
      nodes.some((node) => node.selected) ||
      selectedEdgeIds.length > 0,
    [nodes, selectedEdgeIds.length, selectedNodeId]
  );

  const selectedCounterData = useMemo<CounterInspectorData | null>(() => {
    if (!selectedNode || selectedNode.type !== COUNTER_BLOCK_TYPE) {
      return null;
    }

    const raw = (selectedNode.data as Record<string, unknown> | undefined) ?? {};
    const start =
      typeof raw.start === "number" && Number.isFinite(raw.start)
        ? raw.start
        : DEFAULT_COUNTER_INSPECTOR_DATA.start;
    const step =
      typeof raw.step === "number" && Number.isFinite(raw.step)
        ? raw.step
        : DEFAULT_COUNTER_INSPECTOR_DATA.step;
    const mode: CounterMode = raw.mode === "dec" ? "dec" : "inc";

    return { start, step, mode };
  }, [selectedNode]);

  const selectedGainData = useMemo<GainInspectorData | null>(() => {
    if (!selectedNode || selectedNode.type !== GAIN_BLOCK_TYPE) {
      return null;
    }

    const raw = (selectedNode.data as Record<string, unknown> | undefined) ?? {};
    const gain =
      typeof raw.gain === "number" && Number.isFinite(raw.gain)
        ? raw.gain
        : DEFAULT_GAIN_INSPECTOR_DATA.gain;

    return { gain };
  }, [selectedNode]);

  const selectedToFileData = useMemo<ToFileInspectorData | null>(() => {
    if (!selectedNode || selectedNode.type !== TO_FILE_BLOCK_TYPE) {
      return null;
    }

    const raw = (selectedNode.data as Record<string, unknown> | undefined) ?? {};
    const parsedState = toToFileState(runtime.nodeInternalState[selectedNode.id], raw);

    return {
      format: parsedState.format,
      fileName: parsedState.fileName,
      maxRows: parsedState.maxRows,
      sampleCount: parsedState.samples.length,
    };
  }, [runtime.nodeInternalState, selectedNode]);

  const selectedIntegratorData = useMemo<IntegratorInspectorData | null>(() => {
    if (!selectedNode || selectedNode.type !== INTEGRATOR_BLOCK_TYPE) {
      return null;
    }

    const raw = (selectedNode.data as Record<string, unknown> | undefined) ?? {};
    const initialCondition =
      typeof raw.initialCondition === "number" && Number.isFinite(raw.initialCondition)
        ? raw.initialCondition
        : DEFAULT_INTEGRATOR_INSPECTOR_DATA.initialCondition;

    return { initialCondition };
  }, [selectedNode]);

  const selectedUnitDelayData = useMemo<UnitDelayInspectorData | null>(() => {
    if (!selectedNode || selectedNode.type !== UNIT_DELAY_BLOCK_TYPE) {
      return null;
    }

    const raw = (selectedNode.data as Record<string, unknown> | undefined) ?? {};
    const initialValue =
      typeof raw.initialValue === "number" && Number.isFinite(raw.initialValue)
        ? raw.initialValue
        : DEFAULT_UNIT_DELAY_INSPECTOR_DATA.initialValue;

    return { initialValue };
  }, [selectedNode]);

  const selectedCompareData = useMemo<CompareInspectorData | null>(() => {
    if (!selectedNode || selectedNode.type !== COMPARE_BLOCK_TYPE) {
      return null;
    }

    const raw = (selectedNode.data as Record<string, unknown> | undefined) ?? {};
    const operator: CompareOperator =
      raw.operator === "gte" ||
      raw.operator === "lt" ||
      raw.operator === "lte" ||
      raw.operator === "eq" ||
      raw.operator === "neq" ||
      raw.operator === "gt"
        ? raw.operator
        : DEFAULT_COMPARE_INSPECTOR_DATA.operator;

    return { operator };
  }, [selectedNode]);

  const selectedPidData = useMemo<PidInspectorData | null>(() => {
    if (!selectedNode || selectedNode.type !== PID_BLOCK_TYPE) {
      return null;
    }

    const raw = (selectedNode.data as Record<string, unknown> | undefined) ?? {};
    const kp = typeof raw.kp === "number" && Number.isFinite(raw.kp) ? raw.kp : DEFAULT_PID_INSPECTOR_DATA.kp;
    const ki = typeof raw.ki === "number" && Number.isFinite(raw.ki) ? raw.ki : DEFAULT_PID_INSPECTOR_DATA.ki;
    const kd = typeof raw.kd === "number" && Number.isFinite(raw.kd) ? raw.kd : DEFAULT_PID_INSPECTOR_DATA.kd;
    const n =
      typeof raw.n === "number" && Number.isFinite(raw.n) && raw.n >= 0
        ? raw.n
        : DEFAULT_PID_INSPECTOR_DATA.n;
    const lowerSaturation =
      typeof raw.lowerSaturation === "number" && Number.isFinite(raw.lowerSaturation)
        ? raw.lowerSaturation
        : null;
    const upperSaturation =
      typeof raw.upperSaturation === "number" && Number.isFinite(raw.upperSaturation)
        ? raw.upperSaturation
        : null;

    return { kp, ki, kd, n, lowerSaturation, upperSaturation };
  }, [selectedNode]);

  const selectedDiscreteTransferData = useMemo<DiscreteTransferInspectorData | null>(() => {
    if (!selectedNode || selectedNode.type !== DISCRETE_TRANSFER_FCN_BLOCK_TYPE) {
      return null;
    }

    const raw = (selectedNode.data as Record<string, unknown> | undefined) ?? {};
    const numerator = Array.isArray(raw.numerator)
      ? raw.numerator.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
      : [];
    const denominator = Array.isArray(raw.denominator)
      ? raw.denominator.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
      : [];

    return {
      numerator:
        numerator.length > 0 ? numerator : DEFAULT_DISCRETE_TRANSFER_INSPECTOR_DATA.numerator,
      denominator:
        denominator.length > 0
          ? denominator
          : DEFAULT_DISCRETE_TRANSFER_INSPECTOR_DATA.denominator,
    };
  }, [selectedNode]);

  const selectedLeadLagData = useMemo<LeadLagInspectorData | null>(() => {
    if (!selectedNode || selectedNode.type !== LEAD_LAG_BLOCK_TYPE) {
      return null;
    }

    const raw = (selectedNode.data as Record<string, unknown> | undefined) ?? {};
    return {
      gain:
        typeof raw.gain === "number" && Number.isFinite(raw.gain)
          ? raw.gain
          : DEFAULT_LEAD_LAG_INSPECTOR_DATA.gain,
      leadTimeConstantSec:
        typeof raw.leadTimeConstantSec === "number" && Number.isFinite(raw.leadTimeConstantSec)
          ? Math.max(0, raw.leadTimeConstantSec)
          : DEFAULT_LEAD_LAG_INSPECTOR_DATA.leadTimeConstantSec,
      lagTimeConstantSec:
        typeof raw.lagTimeConstantSec === "number" && Number.isFinite(raw.lagTimeConstantSec)
          ? Math.max(0, raw.lagTimeConstantSec)
          : DEFAULT_LEAD_LAG_INSPECTOR_DATA.lagTimeConstantSec,
    };
  }, [selectedNode]);

  const selectedGotoFromData = useMemo<{ tag: string } | null>(() => {
    if (!selectedNode || (selectedNode.type !== GOTO_BLOCK_TYPE && selectedNode.type !== FROM_BLOCK_TYPE)) {
      return null;
    }

    const raw = (selectedNode.data as Record<string, unknown> | undefined) ?? {};
    return { tag: typeof raw.tag === "string" ? raw.tag : "signal" };
  }, [selectedNode]);

  const selectedSubsystemMaskData = useMemo<SubsystemMaskInspectorData | null>(() => {
    if (!selectedNode || selectedNode.type !== SUBSYSTEM_BLOCK_TYPE) {
      return null;
    }

    const raw = (selectedNode.data as Record<string, unknown> | undefined) ?? {};
    const rawMask =
      typeof raw.mask === "object" && raw.mask !== null
        ? (raw.mask as Record<string, unknown>)
        : {};

    const sanitize = (value: unknown): string | null => {
      if (typeof value !== "string") {
        return null;
      }
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    const inputs = Array.isArray(rawMask.inputs)
      ? rawMask.inputs
          .map((entry) => sanitize(entry))
          .filter((entry): entry is string => typeof entry === "string")
      : [];
    const outputs = Array.isArray(rawMask.outputs)
      ? rawMask.outputs
          .map((entry) => sanitize(entry))
          .filter((entry): entry is string => typeof entry === "string")
      : [];
    const parameters =
      typeof rawMask.parameters === "object" && rawMask.parameters !== null
        ? JSON.stringify(rawMask.parameters, null, 2)
        : "{}";

    return { inputs, outputs, parameters };
  }, [selectedNode]);

  const selectedLut1DData = useMemo<Lut1DInspectorData | null>(() => {
    if (!selectedNode || selectedNode.type !== LUT_1D_BLOCK_TYPE) return null;
    const raw = (selectedNode.data as Record<string, unknown> | undefined) ?? {};
    return {
      breakpointsX: Array.isArray(raw.breakpointsX) ? raw.breakpointsX : [0, 10],
      tableData: Array.isArray(raw.tableData) ? raw.tableData : [0, 100],
    };
  }, [selectedNode]);

  const selectedLut2DData = useMemo<Lut2DInspectorData | null>(() => {
    if (!selectedNode || selectedNode.type !== LUT_2D_BLOCK_TYPE) return null;
    const raw = (selectedNode.data as Record<string, unknown> | undefined) ?? {};
    return {
      breakpointsX: Array.isArray(raw.breakpointsX) ? raw.breakpointsX : [0, 10],
      breakpointsY: Array.isArray(raw.breakpointsY) ? raw.breakpointsY : [0, 10],
      tableData: JSON.stringify(raw.tableData ?? [[0, 100], [100, 200]], null, 2),
    };
  }, [selectedNode]);

  const selectedStateMachineData = useMemo<StateMachineInspectorData | null>(() => {
    if (!selectedNode || selectedNode.type !== STATE_MACHINE_BLOCK_TYPE) {
      return null;
    }

    const raw = (selectedNode.data as Record<string, unknown> | undefined) ?? {};
    const model = normalizeStateMachineModel(raw);

    return {
      model,
      modelJson: formatStateMachineModelJson(model),
    };
  }, [selectedNode]);

  useEffect(() => {
    if (!selectedStateMachineData || !selectedNodeId) {
      setStateMachineDraftNodeId(null);
      setStateMachineModelDraft("");
      setStateMachineDraftError(null);
      return;
    }

    if (stateMachineDraftNodeId !== selectedNodeId) {
      setStateMachineDraftNodeId(selectedNodeId);
      setStateMachineModelDraft(selectedStateMachineData.modelJson);
      setStateMachineDraftError(null);
    }
  }, [selectedNodeId, selectedStateMachineData, stateMachineDraftNodeId]);

  const stateMachineDraftIsDirty = useMemo(() => {
    if (!selectedStateMachineData) {
      return false;
    }

    return stateMachineModelDraft !== selectedStateMachineData.modelJson;
  }, [selectedStateMachineData, stateMachineModelDraft]);

  const selectedSampleTimeMs = useMemo<number | null>(() => {
    if (!selectedNode) {
      return null;
    }

    const raw = (selectedNode.data as Record<string, unknown> | undefined)?.sampleTimeMs;
    return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : null;
  }, [selectedNode]);

  /**
   * Inspector -> graph node-data write path.
   *
   * High-density contract notes:
   * - We patch only the selected node and preserve every other node object reference.
   *   This keeps React Flow diffing cheap and avoids unnecessary rerenders/selection churn.
   * - Node data remains a plain serializable object because the runtime graph bridge
   *   (useEffect(setGraph)) depends on object fields, not methods/classes.
   * - We always merge on top of prior data so unrelated fields (e.g. label, future
   *   block params) survive inspector edits.
   * - Using selectedNodeId as the sole target ensures edits are explicit and do not leak
   *   into marquee-selected nodes.
   */
  const patchSelectedNodeData = useCallback(
    (patch: Record<string, unknown>) => {
      if (!selectedNodeId) {
        return;
      }

      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.id !== selectedNodeId) {
            return node;
          }

          const previousData = (node.data as Record<string, unknown> | undefined) ?? {};
          return {
            ...node,
            data: {
              ...previousData,
              ...patch,
            },
          };
        })
      );
    },
    [selectedNodeId, setNodes]
  );

  /**
   * Counter numeric field commit logic shared by Start/Step.
   *
   * We normalize invalid user input to the currently effective value instead of writing
   * NaN/Infinity into node data. This keeps runtime stepping deterministic and aligns with
   * the counter block's numeric param expectations.
   */
  const commitCounterNumericField = useCallback(
    (field: "start" | "step", rawValue: string) => {
      if (!selectedCounterData) {
        return;
      }

      const parsed = Number(rawValue);
      const safeValue = Number.isFinite(parsed) ? parsed : selectedCounterData[field];
      patchSelectedNodeData({ [field]: safeValue });
    },
    [patchSelectedNodeData, selectedCounterData]
  );

  const commitGainField = useCallback(
    (rawValue: string) => {
      if (!selectedGainData) {
        return;
      }

      const parsed = Number(rawValue);
      const safeValue = Number.isFinite(parsed)
        ? parsed
        : selectedGainData.gain;
      patchSelectedNodeData({ gain: safeValue });
    },
    [patchSelectedNodeData, selectedGainData]
  );

  const commitToFileMaxRows = useCallback(
    (rawValue: string) => {
      if (!selectedToFileData) {
        return;
      }

      const parsed = Number(rawValue);
      const safeValue =
        Number.isFinite(parsed) && parsed > 0
          ? Math.floor(parsed)
          : selectedToFileData.maxRows;
      patchSelectedNodeData({ maxRows: safeValue });
    },
    [patchSelectedNodeData, selectedToFileData]
  );

  const commitIntegratorInitialCondition = useCallback(
    (rawValue: string) => {
      if (!selectedIntegratorData) {
        return;
      }

      const parsed = Number(rawValue);
      const safeValue = Number.isFinite(parsed)
        ? parsed
        : selectedIntegratorData.initialCondition;
      patchSelectedNodeData({ initialCondition: safeValue });
    },
    [patchSelectedNodeData, selectedIntegratorData]
  );

  const commitUnitDelayInitialValue = useCallback(
    (rawValue: string) => {
      if (!selectedUnitDelayData) {
        return;
      }

      const parsed = Number(rawValue);
      const safeValue = Number.isFinite(parsed)
        ? parsed
        : selectedUnitDelayData.initialValue;
      patchSelectedNodeData({ initialValue: safeValue });
    },
    [patchSelectedNodeData, selectedUnitDelayData]
  );

  const commitCompareOperator = useCallback(
    (operator: CompareOperator) => {
      patchSelectedNodeData({ operator });
    },
    [patchSelectedNodeData]
  );

  const commitPidNumericField = useCallback(
    (
      field: "kp" | "ki" | "kd" | "n" | "lowerSaturation" | "upperSaturation",
      rawValue: string
    ) => {
      if (!selectedPidData) {
        return;
      }

      const trimmed = rawValue.trim();
      if (trimmed.length === 0 && (field === "lowerSaturation" || field === "upperSaturation")) {
        patchSelectedNodeData({ [field]: null });
        return;
      }

      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) {
        patchSelectedNodeData({ [field]: selectedPidData[field] });
        return;
      }

      if (field === "n") {
        patchSelectedNodeData({ n: Math.max(0, parsed) });
        return;
      }

      patchSelectedNodeData({ [field]: parsed });
    },
    [patchSelectedNodeData, selectedPidData]
  );

  const parseCoefficientList = useCallback((rawValue: string): number[] => {
    return rawValue
      .split(",")
      .map((segment) => Number(segment.trim()))
      .filter((value) => Number.isFinite(value));
  }, []);

  const commitDiscreteTransferCoefficients = useCallback(
    (field: "numerator" | "denominator", rawValue: string) => {
      if (!selectedDiscreteTransferData) {
        return;
      }

      const parsed = parseCoefficientList(rawValue);
      if (parsed.length === 0) {
        patchSelectedNodeData({
          [field]: selectedDiscreteTransferData[field],
        });
        return;
      }

      patchSelectedNodeData({ [field]: parsed });
    },
    [parseCoefficientList, patchSelectedNodeData, selectedDiscreteTransferData]
  );

  const commitLeadLagNumericField = useCallback(
    (field: "gain" | "leadTimeConstantSec" | "lagTimeConstantSec", rawValue: string) => {
      if (!selectedLeadLagData) {
        return;
      }

      const parsed = Number(rawValue.trim());
      if (!Number.isFinite(parsed)) {
        patchSelectedNodeData({ [field]: selectedLeadLagData[field] });
        return;
      }

      if (field === "leadTimeConstantSec" || field === "lagTimeConstantSec") {
        patchSelectedNodeData({ [field]: Math.max(0, parsed) });
        return;
      }

      patchSelectedNodeData({ [field]: parsed });
    },
    [patchSelectedNodeData, selectedLeadLagData]
  );

  const commitSubsystemMaskList = useCallback(
    (field: "inputs" | "outputs", rawValue: string) => {
      const list = rawValue
        .split(",")
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);

      const raw = (selectedNode?.data as Record<string, unknown> | undefined) ?? {};
      const existingMask =
        typeof raw.mask === "object" && raw.mask !== null
          ? (raw.mask as Record<string, unknown>)
          : {};

      patchSelectedNodeData({
        mask: {
          ...existingMask,
          [field]: list,
        },
      });
    },
    [patchSelectedNodeData, selectedNode]
  );

  const commitSubsystemMaskParameters = useCallback(
    (rawValue: string) => {
      const raw = (selectedNode?.data as Record<string, unknown> | undefined) ?? {};
      const existingMask =
        typeof raw.mask === "object" && raw.mask !== null
          ? (raw.mask as Record<string, unknown>)
          : {};

      try {
        const parsed = JSON.parse(rawValue) as unknown;
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          throw new Error("Mask parameters must be a JSON object.");
        }

        patchSelectedNodeData({
          mask: {
            ...existingMask,
            parameters: parsed,
          },
        });
        setModelActionMessage(null);
      } catch {
        setModelActionMessage("Subsystem mask parameters must be valid JSON object.");
      }
    },
    [patchSelectedNodeData, selectedNode]
  );

  const commitGotoFromTag = useCallback(
    (rawValue: string) => {
      const tag = rawValue.trim();
      patchSelectedNodeData({ tag: tag.length > 0 ? tag : "signal" });
    },
    [patchSelectedNodeData]
  );

  const commitLutVector = useCallback(
    (field: "breakpointsX" | "breakpointsY" | "tableData", rawValue: string) => {
      const parsed = parseCoefficientList(rawValue);
      if (parsed.length > 0) {
        patchSelectedNodeData({ [field]: parsed });
      }
    },
    [parseCoefficientList, patchSelectedNodeData]
  );

  const applyStateMachineModelDraft = useCallback(() => {
    if (!selectedStateMachineData) {
      return;
    }

    const parsed = parseStateMachineModelJson(stateMachineModelDraft);
    if (!parsed) {
      const message = "State machine model must be valid JSON object.";
      setStateMachineDraftError(message);
      setModelActionMessage(message);
      return;
    }

    patchSelectedNodeData({
      initialState: parsed.initialState,
      states: parsed.states,
      transitions: parsed.transitions,
    });

    const formatted = formatStateMachineModelJson(parsed);
    setStateMachineModelDraft(formatted);
    setStateMachineDraftError(null);
    setModelActionMessage("State machine model updated.");
  }, [patchSelectedNodeData, selectedStateMachineData, stateMachineModelDraft]);

  const formatStateMachineModelDraft = useCallback(() => {
    const parsed = parseStateMachineModelJson(stateMachineModelDraft);
    if (!parsed) {
      const message = "State machine model must be valid JSON object.";
      setStateMachineDraftError(message);
      setModelActionMessage(message);
      return;
    }

    setStateMachineModelDraft(formatStateMachineModelJson(parsed));
    setStateMachineDraftError(null);
    setModelActionMessage("State machine model formatted.");
  }, [stateMachineModelDraft]);

  const resetStateMachineModelDraft = useCallback(() => {
    if (!selectedStateMachineData) {
      return;
    }

    setStateMachineModelDraft(selectedStateMachineData.modelJson);
    setStateMachineDraftError(null);
    setModelActionMessage("State machine editor reset to node model.");
  }, [selectedStateMachineData]);

  const commitLut2DTable = useCallback(
    (rawValue: string) => {
      try {
        const parsed = JSON.parse(rawValue);
        if (Array.isArray(parsed)) {
          patchSelectedNodeData({ tableData: parsed });
          setModelActionMessage(null);
        }
      } catch {
        setModelActionMessage("Invalid matrix JSON for LUT 2D table data.");
      }
    },
    [patchSelectedNodeData]
  );

  const commitSampleTimeMs = useCallback(
    (rawValue: string) => {
      if (!selectedNode) {
        return;
      }

      const trimmed = rawValue.trim();
      if (trimmed.length === 0) {
        patchSelectedNodeData({ sampleTimeMs: null });
        return;
      }

      const parsed = Number(trimmed);
      const safeValue =
        Number.isFinite(parsed) && parsed > 0
          ? parsed
          : selectedSampleTimeMs ?? runtime.stepTimeMs;
      patchSelectedNodeData({ sampleTimeMs: safeValue });
    },
    [patchSelectedNodeData, runtime.stepTimeMs, selectedNode, selectedSampleTimeMs]
  );

  const exportSelectedToFile = useCallback(() => {
    if (!selectedNode || selectedNode.type !== TO_FILE_BLOCK_TYPE) {
      return;
    }

    const nodeParams = (selectedNode.data as Record<string, unknown> | undefined) ?? {};
    const parsedState = toToFileState(runtime.nodeInternalState[selectedNode.id], nodeParams);
    const payload = buildToFilePayload({
      format: parsedState.format,
      samples: parsedState.samples,
    });

    triggerTextDownload({
      fileName: parsedState.fileName,
      extension: payload.extension,
      mimeType: payload.mimeType,
      content: payload.content,
    });

    setToFileActionMessage(
      `Exported ${parsedState.samples.length} sample(s) as ${payload.extension.toUpperCase()}.`
    );
  }, [runtime.nodeInternalState, selectedNode]);

  const exportModelDocument = useCallback(() => {
    try {
      const serialized = serializeModelV3({
        nodes: nodes.map((node) => ({
          id: node.id,
          type: node.type ?? "default",
          position: node.position,
          data: (node.data as Record<string, unknown> | undefined) ?? {},
        })),
        edges: edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle ?? undefined,
          targetHandle: edge.targetHandle ?? undefined,
          type: edge.type ?? "straight",
        })),
        timing: {
          simulationTimeMs: runtime.simulationTimeMs,
          stepTimeMs: runtime.stepTimeMs,
        },
      });

      triggerTextDownload({
        fileName: `web-simulink-model-${Date.now()}`,
        extension: "json",
        mimeType: "application/json;charset=utf-8",
        content: serialized,
      });

      setModelActionMessage("Exported model document (schema v3).");
    } catch {
      setModelActionMessage("Failed to export model document.");
    }
  }, [edges, nodes, runtime.simulationTimeMs, runtime.stepTimeMs]);

  const openModelImportPicker = useCallback(() => {
    modelFileInputRef.current?.click();
  }, []);

  const importModelDocument = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      try {
        const raw = await file.text();
        const parsed = parseModelDocument(raw);

        setNodes(
          parsed.nodes.map((node) => ({
            id: node.id,
            type: node.type,
            position: node.position,
            data: node.data,
          }))
        );
        setEdges(
          parsed.edges.map((edge) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle,
            type: edge.type ?? "straight",
          }))
        );
        setTiming({
          simulationTimeMs: parsed.timing.simulationTimeMs,
          stepTimeMs: parsed.timing.stepTimeMs,
        });
        setSelectedNodeId(null);
        setModelActionMessage("Imported model document successfully.");
      } catch {
        setModelActionMessage("Import failed: invalid or unsupported model file.");
      } finally {
        event.target.value = "";
      }
    },
    [setEdges, setNodes, setTiming]
  );

  const renderInspectorCore = (params: { mobile: boolean }): React.ReactNode => {
    const { mobile } = params;

    if (!selectedNode) {
      return mobile ? (
        <p className="mt-3 text-sm text-slate-500">No node selected.</p>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          Select a node from the canvas to inspect its properties.
        </p>
      );
    }

    return (
      <div className="mt-3 space-y-2 text-sm text-slate-600">
        <p>
          <span className="font-medium text-slate-700">Node ID:</span> {selectedNode.id}
        </p>
        <p>
          <span className="font-medium text-slate-700">Label:</span>{" "}
          {String(selectedNode.data?.label ?? "Untitled")}
        </p>
        <p>
          <span className="font-medium text-slate-700">Position:</span> x=
          {Math.round(selectedNode.position.x)}, y={Math.round(selectedNode.position.y)}
        </p>

        <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            Execution Rate
          </p>
          <label className="block text-xs text-slate-600">
            Sample Time (ms)
            <input
              type="number"
              min={runtime.stepTimeMs}
              step={runtime.stepTimeMs}
              value={selectedSampleTimeMs === null ? "" : String(selectedSampleTimeMs)}
              placeholder={`base: ${runtime.stepTimeMs}`}
              onBlur={(event) => commitSampleTimeMs(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
              onChange={(event) => commitSampleTimeMs(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
            />
          </label>
          <button
            type="button"
            onClick={() => patchSelectedNodeData({ sampleTimeMs: null })}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700"
          >
            Use Base Rate ({runtime.stepTimeMs} ms)
          </button>
        </div>

        {selectedCounterData ? (
          <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Counter Properties
            </p>
            <label className="block text-xs text-slate-600">
              Start
              <input
                type="number"
                value={String(selectedCounterData.start)}
                onBlur={(event) => commitCounterNumericField("start", event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                onChange={(event) => commitCounterNumericField("start", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
              />
            </label>
            <label className="block text-xs text-slate-600">
              Step
              <input
                type="number"
                value={String(selectedCounterData.step)}
                onBlur={(event) => commitCounterNumericField("step", event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                onChange={(event) => commitCounterNumericField("step", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
              />
            </label>
            <label className="block text-xs text-slate-600">
              Mode
              <select
                value={selectedCounterData.mode}
                onChange={(event) => {
                  const mode: CounterMode = event.target.value === "dec" ? "dec" : "inc";
                  patchSelectedNodeData({ mode });
                }}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
              >
                <option value="inc">inc</option>
                <option value="dec">dec</option>
              </select>
            </label>
          </div>
        ) : null}

        {selectedGainData ? (
          <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Gain Properties
            </p>
            <label className="block text-xs text-slate-600">
              Gain (k)
              <input
                type="number"
                value={String(selectedGainData.gain)}
                onBlur={(event) => commitGainField(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                onChange={(event) => commitGainField(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
              />
            </label>
          </div>
        ) : null}

        {selectedIntegratorData ? (
          <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Integrator Properties
            </p>
            <label className="block text-xs text-slate-600">
              Initial Condition
              <input
                type="number"
                value={String(selectedIntegratorData.initialCondition)}
                onBlur={(event) => commitIntegratorInitialCondition(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                onChange={(event) => commitIntegratorInitialCondition(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
              />
            </label>
          </div>
        ) : null}

        {selectedUnitDelayData ? (
          <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Unit Delay Properties
            </p>
            <label className="block text-xs text-slate-600">
              Initial Value
              <input
                type="number"
                value={String(selectedUnitDelayData.initialValue)}
                onBlur={(event) => commitUnitDelayInitialValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                onChange={(event) => commitUnitDelayInitialValue(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
              />
            </label>
          </div>
        ) : null}

        {selectedCompareData ? (
          <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Compare Properties
            </p>
            <label className="block text-xs text-slate-600">
              Operator
              <select
                value={selectedCompareData.operator}
                onChange={(event) => commitCompareOperator(event.target.value as CompareOperator)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
              >
                <option value="gt">&gt;</option>
                <option value="gte">&gt;=</option>
                <option value="lt">&lt;</option>
                <option value="lte">&lt;=</option>
                <option value="eq">==</option>
                <option value="neq">!=</option>
              </select>
            </label>
          </div>
        ) : null}

        {selectedPidData ? (
          <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              PID Properties
            </p>
            <label className="block text-xs text-slate-600">
              Kp
              <input
                type="number"
                value={String(selectedPidData.kp)}
                onBlur={(event) => commitPidNumericField("kp", event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                onChange={(event) => commitPidNumericField("kp", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
              />
            </label>
            <label className="block text-xs text-slate-600">
              Ki
              <input
                type="number"
                value={String(selectedPidData.ki)}
                onBlur={(event) => commitPidNumericField("ki", event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                onChange={(event) => commitPidNumericField("ki", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
              />
            </label>
            <label className="block text-xs text-slate-600">
              Kd
              <input
                type="number"
                value={String(selectedPidData.kd)}
                onBlur={(event) => commitPidNumericField("kd", event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                onChange={(event) => commitPidNumericField("kd", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
              />
            </label>
            <label className="block text-xs text-slate-600">
              Derivative Filter Coefficient (N)
              <input
                type="number"
                min={0}
                value={String(selectedPidData.n)}
                onBlur={(event) => commitPidNumericField("n", event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                onChange={(event) => commitPidNumericField("n", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-slate-600">
                Lower Sat
                <input
                  type="number"
                  value={selectedPidData.lowerSaturation === null ? "" : String(selectedPidData.lowerSaturation)}
                  placeholder="none"
                  onBlur={(event) => commitPidNumericField("lowerSaturation", event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.currentTarget.blur();
                    }
                  }}
                  onChange={(event) => commitPidNumericField("lowerSaturation", event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
                />
              </label>
              <label className="block text-xs text-slate-600">
                Upper Sat
                <input
                  type="number"
                  value={selectedPidData.upperSaturation === null ? "" : String(selectedPidData.upperSaturation)}
                  placeholder="none"
                  onBlur={(event) => commitPidNumericField("upperSaturation", event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.currentTarget.blur();
                    }
                  }}
                  onChange={(event) => commitPidNumericField("upperSaturation", event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
                />
              </label>
            </div>
          </div>
        ) : null}

        {selectedDiscreteTransferData ? (
          <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Discrete Transfer Fcn Properties
            </p>
            <label className="block text-xs text-slate-600">
              Numerator Coefficients (b0,b1,...)
              <input
                type="text"
                value={selectedDiscreteTransferData.numerator.join(",")}
                onBlur={(event) =>
                  commitDiscreteTransferCoefficients("numerator", event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                onChange={(event) =>
                  commitDiscreteTransferCoefficients("numerator", event.target.value)
                }
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
              />
            </label>
            <label className="block text-xs text-slate-600">
              Denominator Coefficients (a0,a1,...)
              <input
                type="text"
                value={selectedDiscreteTransferData.denominator.join(",")}
                onBlur={(event) =>
                  commitDiscreteTransferCoefficients("denominator", event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                onChange={(event) =>
                  commitDiscreteTransferCoefficients("denominator", event.target.value)
                }
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
              />
            </label>
          </div>
        ) : null}

        {selectedLeadLagData ? (
          <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Lead/Lag Properties
            </p>
            <label className="block text-xs text-slate-600">
              Gain (K)
              <input
                type="number"
                value={String(selectedLeadLagData.gain)}
                onBlur={(event) => commitLeadLagNumericField("gain", event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                onChange={(event) => commitLeadLagNumericField("gain", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
              />
            </label>
            <label className="block text-xs text-slate-600">
              Lead Time Constant (s)
              <input
                type="number"
                min={0}
                step="0.001"
                value={String(selectedLeadLagData.leadTimeConstantSec)}
                onBlur={(event) =>
                  commitLeadLagNumericField("leadTimeConstantSec", event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                onChange={(event) =>
                  commitLeadLagNumericField("leadTimeConstantSec", event.target.value)
                }
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
              />
            </label>
            <label className="block text-xs text-slate-600">
              Lag Time Constant (s)
              <input
                type="number"
                min={0}
                step="0.001"
                value={String(selectedLeadLagData.lagTimeConstantSec)}
                onBlur={(event) =>
                  commitLeadLagNumericField("lagTimeConstantSec", event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                onChange={(event) =>
                  commitLeadLagNumericField("lagTimeConstantSec", event.target.value)
                }
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
              />
            </label>
          </div>
        ) : null}

        {selectedSubsystemMaskData ? (
          <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Subsystem Mask Interface
            </p>
            <label className="block text-xs text-slate-600">
              Input Handles (comma-separated)
              <input
                type="text"
                value={selectedSubsystemMaskData.inputs.join(",")}
                onBlur={(event) => commitSubsystemMaskList("inputs", event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                onChange={(event) => commitSubsystemMaskList("inputs", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
              />
            </label>
            <label className="block text-xs text-slate-600">
              Output Handles (comma-separated)
              <input
                type="text"
                value={selectedSubsystemMaskData.outputs.join(",")}
                onBlur={(event) => commitSubsystemMaskList("outputs", event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                onChange={(event) => commitSubsystemMaskList("outputs", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
              />
            </label>
            <label className="block text-xs text-slate-600">
              Mask Parameters (JSON object)
              <textarea
                rows={4}
                value={selectedSubsystemMaskData.parameters}
                onBlur={(event) => commitSubsystemMaskParameters(event.target.value)}
                onChange={(event) => commitSubsystemMaskParameters(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-700"
              />
            </label>
          </div>
        ) : null}

        {selectedGotoFromData ? (
          <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              GOTO/FROM Properties
            </p>
            <label className="block text-xs text-slate-600">
              Global Tag
              <input
                type="text"
                value={selectedGotoFromData.tag}
                onBlur={(event) => commitGotoFromTag(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                onChange={(event) => commitGotoFromTag(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
              />
            </label>
          </div>
        ) : null}

        {selectedLut1DData ? (
          <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              LUT 1D Properties
            </p>
            <label className="block text-xs text-slate-600">
              Breakpoints X (comma-separated)
              <input
                type="text"
                value={selectedLut1DData.breakpointsX.join(",")}
                onBlur={(event) => commitLutVector("breakpointsX", event.target.value)}
                onChange={(event) => commitLutVector("breakpointsX", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
              />
            </label>
            <label className="block text-xs text-slate-600">
              Table Data (comma-separated)
              <input
                type="text"
                value={selectedLut1DData.tableData.join(",")}
                onBlur={(event) => commitLutVector("tableData", event.target.value)}
                onChange={(event) => commitLutVector("tableData", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
              />
            </label>
          </div>
        ) : null}

        {selectedLut2DData ? (
          <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              LUT 2D Properties
            </p>
            <label className="block text-xs text-slate-600">
              Breakpoints X (comma-separated)
              <input
                type="text"
                value={selectedLut2DData.breakpointsX.join(",")}
                onBlur={(event) => commitLutVector("breakpointsX", event.target.value)}
                onChange={(event) => commitLutVector("breakpointsX", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
              />
            </label>
            <label className="block text-xs text-slate-600">
              Breakpoints Y (comma-separated)
              <input
                type="text"
                value={selectedLut2DData.breakpointsY.join(",")}
                onBlur={(event) => commitLutVector("breakpointsY", event.target.value)}
                onChange={(event) => commitLutVector("breakpointsY", event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
              />
            </label>
            <label className="block text-xs text-slate-600">
              Table Data (Matrix JSON)
              <textarea
                rows={4}
                value={selectedLut2DData.tableData}
                onBlur={(event) => commitLut2DTable(event.target.value)}
                onChange={(event) => commitLut2DTable(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-700"
              />
            </label>
          </div>
        ) : null}

        {selectedStateMachineData ? (
          <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              State Machine Properties
            </p>
            <p className="text-[11px] text-slate-500">
              States: {selectedStateMachineData.model.states.length} · Transitions: {selectedStateMachineData.model.transitions.length}
            </p>
            <p className="text-[11px] text-slate-500">
              Transition fields: <span className="font-mono">from,to,guardExpr,actionExpr,output,afterMs,event,eventInput</span>
            </p>
            <label className="block text-xs text-slate-600">
              State Machine Model (JSON)
              <textarea
                rows={10}
                value={stateMachineModelDraft}
                onChange={(event) => {
                  setStateMachineModelDraft(event.target.value);
                  if (stateMachineDraftError) {
                    setStateMachineDraftError(null);
                  }
                }}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-700"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={applyStateMachineModelDraft}
                className="rounded-md border border-indigo-300 bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700"
              >
                Apply JSON
              </button>
              <button
                type="button"
                onClick={formatStateMachineModelDraft}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
              >
                Format
              </button>
              <button
                type="button"
                onClick={resetStateMachineModelDraft}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
              >
                Reset
              </button>
              <span className="self-center text-[11px] text-slate-500">
                {stateMachineDraftIsDirty ? "Unsaved JSON changes" : "Synced"}
              </span>
            </div>
            {stateMachineDraftError ? (
              <p className="text-xs text-rose-700">{stateMachineDraftError}</p>
            ) : null}
          </div>
        ) : null}

        {selectedToFileData ? (
          <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              To File Properties
            </p>
            <label className="block text-xs text-slate-600">
              Format
              <select
                value={selectedToFileData.format}
                onChange={(event) => {
                  const format: ToFileExportFormat = event.target.value === "csv" ? "csv" : "json";
                  patchSelectedNodeData({ format });
                }}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
              >
                <option value="json">json</option>
                <option value="csv">csv</option>
              </select>
            </label>
            <label className="block text-xs text-slate-600">
              File Name
              <input
                type="text"
                value={selectedToFileData.fileName}
                onChange={(event) => patchSelectedNodeData({ fileName: event.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
              />
            </label>
            <label className="block text-xs text-slate-600">
              Max Rows
              <input
                type="number"
                min={1}
                value={String(selectedToFileData.maxRows)}
                onBlur={(event) => commitToFileMaxRows(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                onChange={(event) => commitToFileMaxRows(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
              />
            </label>
            <p className="text-xs text-slate-500">Captured Samples: {selectedToFileData.sampleCount}</p>
            <button
              type="button"
              onClick={exportSelectedToFile}
              className="w-full rounded-md border border-sky-300 bg-sky-100 px-2 py-1.5 text-xs font-semibold text-sky-700"
            >
              Export Latest Run
            </button>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col">
        <header className="border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Web Simulink
              </p>
              <h1 className="text-lg font-semibold">Block Diagram Editor</h1>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <label className="flex items-center gap-1 text-xs text-slate-600">
                Stop Time
                <input
                  type="number"
                  min={MIN_TIMING_SECONDS}
                  step="0.001"
                  value={stopTimeInputValue}
                  onFocus={() => setIsEditingStopTime(true)}
                  onChange={(event) => setStopTimeSecondsInput(event.target.value)}
                  onBlur={(event) => {
                    commitTimingValue("stop", event.target.value);
                    setIsEditingStopTime(false);
                  }}
                  onKeyDown={(event) => onTimingInputKeyDown(event, "stop")}
                  className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700"
                />
                <span className="text-slate-500">s</span>
              </label>
              <label className="flex items-center gap-1 text-xs text-slate-600">
                Step Time (Ts)
                <input
                  type="number"
                  min={MIN_TIMING_SECONDS}
                  step="0.001"
                  value={stepTimeInputValue}
                  onFocus={() => setIsEditingStepTime(true)}
                  onChange={(event) => setStepTimeSecondsInput(event.target.value)}
                  onBlur={(event) => {
                    commitTimingValue("step", event.target.value);
                    setIsEditingStepTime(false);
                  }}
                  onKeyDown={(event) => onTimingInputKeyDown(event, "step")}
                  className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700"
                />
                <span className="text-slate-500">s</span>
              </label>
              <button
                type="button"
                onClick={exportModelDocument}
                className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700"
              >
                Export Model
              </button>
              <button
                type="button"
                onClick={openModelImportPicker}
                className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700"
              >
                Import Model
              </button>
              <button
                type="button"
                onClick={run}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700"
              >
                Run
              </button>
              <button
                type="button"
                onClick={pause}
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700"
              >
                Pause
              </button>
              <button
                type="button"
                onClick={reset}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={deleteSelectedNodes}
                disabled={!hasSelection}
                className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              >
                Delete
              </button>
            </div>
          </div>
        </header>

        <main className="relative flex flex-1 flex-col gap-3 p-3 sm:gap-4 sm:p-6 lg:flex-row">
          <aside className="order-2 rounded-xl border border-slate-200 bg-white p-4 lg:order-1 lg:w-72">
            <h2 className="text-sm font-semibold text-slate-700">Library</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {LIBRARY_BLOCKS.map((block) => (
                <li
                  key={block.type}
                  draggable
                  onDragStart={(event) => onLibraryDragStart(event, block.type)}
                  className={`cursor-grab rounded-md border px-3 py-2 active:cursor-grabbing ${
                    block.type === COUNTER_BLOCK_TYPE
                      ? "border-orange-300 bg-orange-50 text-orange-700"
                      : "border-sky-300 bg-sky-50 text-sky-700"
                  }`}
                >
                  {block.label}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              Drag a block onto the canvas to create a node.
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Runtime status: <span className="font-medium">{runtime.status}</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">Tick: {runtime.tick}</p>
            <p className="mt-1 text-xs text-slate-500">Last step: {metrics.lastStepDurationMs.toFixed(2)} ms</p>
            <p className="mt-1 text-xs text-slate-500">Avg step: {metrics.averageStepDurationMs.toFixed(2)} ms</p>
            <p className="mt-1 text-xs text-slate-500">Peak step: {metrics.peakStepDurationMs.toFixed(2)} ms</p>
            <p className="mt-1 text-xs text-slate-500">Estimated step rate: {metrics.estimatedStepRateHz.toFixed(1)} Hz</p>
            <p className="mt-1 text-xs text-slate-500">IndexedDB runs: {recentRunRecords.length}</p>
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Runtime Trace
                </p>
                <button
                  type="button"
                  onClick={clearTrace}
                  className="text-[10px] font-medium text-slate-400 hover:text-slate-600 uppercase"
                >
                  Clear
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {trace.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic">No events recorded.</p>
                ) : (
                  trace.slice(0, 20).map((event, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-[10px] border-l-2 border-slate-200 pl-1.5 py-0.5">
                      <span className="font-mono font-bold text-slate-400">#{event.tick}</span>
                      <span className={`flex-1 ${event.status === 'paused' ? 'text-rose-600' : 'text-slate-600'}`}>
                        {event.note}
                      </span>
                      <span className="text-slate-400 tabular-nums">{event.durationMs.toFixed(1)}ms</span>
                    </div>
                  ))
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsTracePanelOpen(true)}
                className="mt-2 w-full rounded border border-slate-300 bg-white py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
              >
                Show Full Trace
              </button>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={exportModelDocument}
                className="rounded-md border border-sky-300 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700"
              >
                Export Model
              </button>
              <button
                type="button"
                onClick={openModelImportPicker}
                className="rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700"
              >
                Import Model
              </button>
            </div>
            {runtime.error ? (
              <p className="mt-1 text-xs text-rose-700">{runtime.error}</p>
            ) : null}
            {modelActionMessage ? (
              <p className="mt-1 text-xs text-indigo-700">{modelActionMessage}</p>
            ) : null}
            {toFileActionMessage ? (
              <p className="mt-1 text-xs text-sky-700">{toFileActionMessage}</p>
            ) : null}
          </aside>

          <section className="order-1 min-h-[420px] flex-1 overflow-hidden rounded-xl border border-slate-300 bg-white lg:order-2 lg:min-h-[560px]">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onInit={setReactFlowInstance}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onNodeDoubleClick={(_, node) => { if(node.type === SUBSYSTEM_BLOCK_TYPE) setEditingSubsystemId(node.id); }}
              onDragOver={onCanvasDragOver}
              onDrop={onCanvasDrop}
              defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
              nodeTypes={NODE_TYPES}
              fitView
              /**
               * Mobile/touch interaction policy:
               * - `touch-action: none` prevents browser scroll hijacking during node drag/pan.
               * - panOnDrag + zoomOnPinch keeps one-finger/gesture interactions predictable.
               */
              style={CANVAS_STYLE}
              panOnDrag
              zoomOnPinch
              zoomOnScroll
              selectionOnDrag={false}
              connectionRadius={44}
            >
              <Background
                variant={BackgroundVariant.Dots}
                color={CANVAS_GRID_COLOR}
                gap={CANVAS_GRID_GAP}
                size={CANVAS_GRID_DOT_SIZE}
              />
              <MiniMap pannable zoomable />
              <Controls showInteractive={false} />
              <Panel position="top-left">
                <div className="rounded-md bg-white/90 px-2 py-1 text-xs text-slate-600 shadow-sm">
                  Drag blocks from Library. Select nodes/edges, then use Delete or Backspace.
                </div>
              </Panel>
            </ReactFlow>
          </section>

          <aside className="order-3 hidden rounded-xl border border-slate-200 bg-white p-4 lg:block lg:w-72">
            <h2 className="text-sm font-semibold text-slate-700">Inspector</h2>
            {renderInspectorCore({ mobile: false })}
          </aside>
        </main>

        {/*
          Compact mobile timing + command bars.
          Keeping timing fields and transport controls in separate rows avoids cramped hit-targets
          and still preserves the touch-first drag/pan experience on the canvas.
        */}
        <div className="fixed inset-x-3 bottom-16 z-20 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-lg sm:hidden">
          <label className="text-xs text-slate-600">
            Stop Time (s)
            <input
              type="number"
              min={MIN_TIMING_SECONDS}
              step="0.001"
              value={stopTimeInputValue}
              onFocus={() => setIsEditingStopTime(true)}
              onChange={(event) => setStopTimeSecondsInput(event.target.value)}
              onBlur={(event) => {
                commitTimingValue("stop", event.target.value);
                setIsEditingStopTime(false);
              }}
              onKeyDown={(event) => onTimingInputKeyDown(event, "stop")}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700"
            />
          </label>
          <label className="text-xs text-slate-600">
            Step Time (Ts)
            <input
              type="number"
              min={MIN_TIMING_SECONDS}
              step="0.001"
              value={stepTimeInputValue}
              onFocus={() => setIsEditingStepTime(true)}
              onChange={(event) => setStepTimeSecondsInput(event.target.value)}
              onBlur={(event) => {
                commitTimingValue("step", event.target.value);
                setIsEditingStepTime(false);
              }}
              onKeyDown={(event) => onTimingInputKeyDown(event, "step")}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700"
            />
          </label>
        </div>
        <div className="fixed inset-x-3 bottom-3 z-20 grid grid-cols-4 gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-lg sm:hidden">
          <button
            type="button"
            onClick={run}
            className="rounded-md bg-emerald-100 px-2 py-2 text-sm font-semibold text-emerald-700"
          >
            Run
          </button>
          <button
            type="button"
            onClick={pause}
            className="rounded-md bg-amber-100 px-2 py-2 text-sm font-semibold text-amber-700"
          >
            Pause
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-slate-100 px-2 py-2 text-sm font-semibold text-slate-700"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={deleteSelectedNodes}
            disabled={!hasSelection}
            className="rounded-md bg-rose-100 px-2 py-2 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            Delete
          </button>
        </div>

        <input
          ref={modelFileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={importModelDocument}
        />

        {/*
          Mobile Inspector bottom sheet.
          Opens after node selection and can be dismissed via backdrop tap.
        */}
        {isMobileInspectorOpen && (
          <div
            className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
            onClick={() => setIsMobileInspectorOpen(false)}
          >
            <div
              className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-4"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />
              <h2 className="text-sm font-semibold text-slate-700">Inspector</h2>
              {renderInspectorCore({ mobile: true })}
            </div>
          </div>
        )}


        {isTracePanelOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="flex flex-col w-full max-w-2xl max-h-[80vh] bg-white rounded-2xl shadow-2xl overflow-hidden">
              <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Simulation Trace</h2>
                  <p className="text-xs text-slate-500">Tick-level execution probes and event timeline.</p>
                </div>
                <button
                  onClick={() => setIsTracePanelOpen(false)}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                >
                  ✕
                </button>
              </header>
              <main className="flex-1 overflow-y-auto p-6 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-white border-b border-slate-200">
                    <tr>
                      <th className="py-2 font-semibold text-slate-500 uppercase tracking-wider w-16">Tick</th>
                      <th className="py-2 font-semibold text-slate-500 uppercase tracking-wider w-20">Time</th>
                      <th className="py-2 font-semibold text-slate-500 uppercase tracking-wider w-24">Status</th>
                      <th className="py-2 font-semibold text-slate-500 uppercase tracking-wider">Note</th>
                      <th className="py-2 font-semibold text-slate-500 uppercase tracking-wider text-right w-20">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {trace.map((event, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 font-mono font-bold text-slate-400">#{event.tick}</td>
                        <td className="py-2 text-slate-600">{(event.timeMs / 1000).toFixed(2)}s</td>
                        <td className="py-2">
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            event.status === 'running' ? 'bg-emerald-100 text-emerald-700' :
                            event.status === 'paused' ? 'bg-rose-100 text-rose-700' :
                            event.status === 'completed' ? 'bg-sky-100 text-sky-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {event.status}
                          </span>
                        </td>
                        <td className="py-2 text-slate-700 break-all">{event.note}</td>
                        <td className="py-2 text-slate-500 text-right tabular-nums">{event.durationMs.toFixed(2)} ms</td>
                      </tr>
                    ))}
                    {trace.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 italic">No events recorded. Start the simulation to see trace events.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </main>
              <footer className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex justify-between items-center">
                <p className="text-xs text-slate-500">{trace.length} events logged (max 120).</p>
                <div className="flex gap-3">
                  <button
                    onClick={clearTrace}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
                  >
                    Clear Log
                  </button>
                  <button
                    onClick={() => setIsTracePanelOpen(false)}
                    className="rounded-lg bg-slate-800 px-6 py-2 text-sm font-medium text-white hover:bg-slate-900"
                  >
                    Close
                  </button>
                </div>
              </footer>
            </div>
          </div>
        )}
        {editingSubsystemId ? (
          <SubsystemEditorModal
            open={true}
            subsystemId={editingSubsystemId}
            initialGraph={editingSubsystemGraph}
            onClose={() => setEditingSubsystemId(null)}
            onSave={(graph) => {
              const maskFromGraph = deriveSubsystemMaskFromGraph(graph);

              setNodes((currentNodes) =>
                currentNodes.map((node) => {
                  if (node.id !== editingSubsystemId) {
                    return node;
                  }

                  const currentData =
                    ((node.data as Record<string, unknown> | undefined) ?? {});
                  const currentMask =
                    typeof currentData.mask === "object" && currentData.mask !== null
                      ? (currentData.mask as Record<string, unknown>)
                      : {};
                  const parameters =
                    typeof currentMask.parameters === "object" && currentMask.parameters !== null
                      ? currentMask.parameters
                      : {};

                  return {
                    ...node,
                    data: {
                      ...currentData,
                      graph,
                      mask: {
                        inputs: maskFromGraph.inputs,
                        outputs: maskFromGraph.outputs,
                        parameters,
                      },
                    },
                  };
                })
              );
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
