"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  EdgeChange,
  NodeChange,
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
import { ProbingEdge } from "@/src/canvas/probingEdge";
import { traceSignalPath, computeEdgeStyles } from "@/src/canvas/signalPath";
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
import { GPS_BLOCK_TYPE } from "@/src/simulation/blocks/gpsBlock";
import { ACCELEROMETER_BLOCK_TYPE } from "@/src/simulation/blocks/accelerometerBlock";
import { BLE_BLOCK_TYPE } from "@/src/simulation/blocks/bleBlock";
import { HEART_RATE_BLOCK_TYPE, BATTERY_LEVEL_BLOCK_TYPE } from "@/src/simulation/blocks/specializedBleBlocks";
import { ORIENTATION_BLOCK_TYPE } from "@/src/simulation/blocks/orientationBlock";
import { LUT_1D_BLOCK_TYPE, LUT_2D_BLOCK_TYPE } from "@/src/simulation/blocks/lutBlock";
import { STATE_MACHINE_BLOCK_TYPE } from "@/src/simulation/blocks/stateMachineBlock";
import { TRUTH_TABLE_BLOCK_TYPE } from "@/src/simulation/blocks/truthTableBlock";
import { GAUGE_BLOCK_TYPE } from "@/src/simulation/blocks/gaugeBlock";
import { LAMP_BLOCK_TYPE } from "@/src/simulation/blocks/lampBlock";
import { SPECTRUM_ANALYZER_BLOCK_TYPE } from "@/src/simulation/blocks/spectrumAnalyzerBlock";
import { SCOPE_3D_BLOCK_TYPE } from "@/src/simulation/blocks/scope3dBlock";
import { RIGID_BODY_SINK_BLOCK_TYPE } from "@/src/simulation/blocks/rigidBodySinkBlock";
import { KNOB_BLOCK_TYPE } from "@/src/simulation/blocks/knobBlock";
import { SLIDER_BLOCK_TYPE } from "@/src/simulation/blocks/sliderBlock";
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
  persistModel,
  fetchModel,
  listModels,
  parseModelDocument,
  type PersistedModelV3,
  type SupabaseModelMetadata,
} from "@/src/persistence/index";
import { syncModels } from "@/src/persistence/sync";
import {
  validateConnectionCandidate,
} from "@/src/simulation/validation";
import { parseNumericExpression } from "@/src/simulation/expressions";
import { useSimulationRuntimeStore } from "@/src/store/simulationRuntimeStore";
import { useCollaborationSync } from "@/src/collaboration/collaborationSync";
import { createClient } from "@/src/utils/supabase/client";
import { SweepManager } from "@/src/components/SweepManager";

import { OfflineIndicator } from "@/src/components/offline/OfflineIndicator";
import { User } from "@supabase/supabase-js";

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

const EDGE_TYPES = {
  probing: ProbingEdge,
};

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
  [GPS_BLOCK_TYPE]: CustomBlockNode,
  [ACCELEROMETER_BLOCK_TYPE]: CustomBlockNode,
  [BLE_BLOCK_TYPE]: CustomBlockNode,
  [HEART_RATE_BLOCK_TYPE]: CustomBlockNode,
  [BATTERY_LEVEL_BLOCK_TYPE]: CustomBlockNode,
  [ORIENTATION_BLOCK_TYPE]: CustomBlockNode,
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
  [TRUTH_TABLE_BLOCK_TYPE]: CustomBlockNode,
  [GAUGE_BLOCK_TYPE]: CustomBlockNode,
  [LAMP_BLOCK_TYPE]: CustomBlockNode,
  [SPECTRUM_ANALYZER_BLOCK_TYPE]: CustomBlockNode,
  [SCOPE_3D_BLOCK_TYPE]: CustomBlockNode,
  [RIGID_BODY_SINK_BLOCK_TYPE]: CustomBlockNode,
};

const LIBRARY_BLOCKS = [
  { label: "GPS", type: GPS_BLOCK_TYPE, category: "Sensors" },
  { label: "Accelerometer", type: ACCELEROMETER_BLOCK_TYPE, category: "Sensors" },
  { label: "BLE Device", type: BLE_BLOCK_TYPE, category: "Sensors" },
  { label: "Heart Rate", type: HEART_RATE_BLOCK_TYPE, category: "Sensors" },
  { label: "Battery Level", type: BATTERY_LEVEL_BLOCK_TYPE, category: "Sensors" },
  { label: "Orientation", type: ORIENTATION_BLOCK_TYPE, category: "Sensors" },
  { label: "Counter", type: COUNTER_BLOCK_TYPE, category: "General" },
  { label: "Gain", type: GAIN_BLOCK_TYPE, category: "General" },
  { label: "Sum", type: SUM_BLOCK_TYPE, category: "General" },
  { label: "Product", type: PRODUCT_BLOCK_TYPE, category: "General" },
  { label: "Mux", type: MUX_BLOCK_TYPE, category: "General" },
  { label: "Demux", type: DEMUX_BLOCK_TYPE, category: "General" },
  { label: "PID", type: PID_BLOCK_TYPE, category: "General" },
  { label: "Discrete Transfer Fcn", type: DISCRETE_TRANSFER_FCN_BLOCK_TYPE, category: "General" },
  { label: "Lead/Lag", type: LEAD_LAG_BLOCK_TYPE, category: "General" },
  { label: "GOTO", type: GOTO_BLOCK_TYPE, category: "General" },
  { label: "FROM", type: FROM_BLOCK_TYPE, category: "General" },
  { label: "LUT 1D", type: LUT_1D_BLOCK_TYPE, category: "General" },
  { label: "LUT 2D", type: LUT_2D_BLOCK_TYPE, category: "General" },
  { label: "State Machine", type: STATE_MACHINE_BLOCK_TYPE, category: "General" },
  { label: "Truth Table", type: TRUTH_TABLE_BLOCK_TYPE, category: "General" },
  { label: "Inport", type: INPORT_BLOCK_TYPE, category: "General" },
  { label: "Outport", type: OUTPORT_BLOCK_TYPE, category: "General" },
  { label: "Subsystem", type: SUBSYSTEM_BLOCK_TYPE, category: "General" },
  { label: "Integrator", type: INTEGRATOR_BLOCK_TYPE, category: "General" },
  { label: "Unit Delay", type: UNIT_DELAY_BLOCK_TYPE, category: "General" },
  { label: "Compare", type: COMPARE_BLOCK_TYPE, category: "General" },
  { label: "Switch", type: SWITCH_BLOCK_TYPE, category: "General" },
  { label: "To File", type: TO_FILE_BLOCK_TYPE, category: "General" },
  { label: "Gauge", type: GAUGE_BLOCK_TYPE, category: "General" },
  { label: "Lamp", type: LAMP_BLOCK_TYPE, category: "General" },
  { label: "Spectrum Analyzer", type: SPECTRUM_ANALYZER_BLOCK_TYPE, category: "General" },
  { label: "3D Scope", type: SCOPE_3D_BLOCK_TYPE, category: "General" },
  { label: "Rigid Body Sink", type: RIGID_BODY_SINK_BLOCK_TYPE, category: "General" },
  { label: "Display", type: DISPLAY_BLOCK_TYPE, category: "General" },
  { label: "Scope", type: SCOPE_BLOCK_TYPE, category: "General" },
] as const;

function makeEdgeId(source: string, target: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${source}->${target}-${crypto.randomUUID()}`;
  }
  return `${source}->${target}-${Date.now()}`;
}

function makeNodeId(type: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${type}-${crypto.randomUUID()}`;
  }
  return `${type}-${Date.now()}`;
}

function deriveSubsystemMaskFromGraph(graph: { nodes: Node[]; edges: Edge[] }): {
  inputs: string[];
  outputs: string[];
} {
  const sanitize = (value: unknown, fallback: string): string => {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  };
  const inports = graph.nodes
    .filter((node) => node.type === INPORT_BLOCK_TYPE)
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((node, index) => sanitize((node.data as any)?.label, `in${index + 1}`));
  const outports = graph.nodes
    .filter((node) => node.type === OUTPORT_BLOCK_TYPE)
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((node, index) => sanitize((node.data as any)?.label, `out${index + 1}`));
  return { inputs: inports, outputs: outports };
}

function makeNodeData(type: string): Record<string, unknown> {
  switch (type) {
    case COUNTER_BLOCK_TYPE: return { label: "Counter", start: 0, step: 1, mode: "inc" };
    case GAIN_BLOCK_TYPE: return { label: "Gain", gain: 1 };
    case SUM_BLOCK_TYPE: return { label: "Sum" };
    case PRODUCT_BLOCK_TYPE: return { label: "Product" };
    case MUX_BLOCK_TYPE: return { label: "Mux" };
    case DEMUX_BLOCK_TYPE: return { label: "Demux" };
    case PID_BLOCK_TYPE: return { label: "PID", kp: 1, ki: 0, kd: 0, n: 10, lowerSaturation: null, upperSaturation: null };
    case DISCRETE_TRANSFER_FCN_BLOCK_TYPE: return { label: "Discrete Transfer Fcn", numerator: [1], denominator: [1, 0] };
    case LEAD_LAG_BLOCK_TYPE: return { label: "Lead/Lag", gain: 1, leadTimeConstantSec: 0.1, lagTimeConstantSec: 1 };
    case GOTO_BLOCK_TYPE: return { label: "GOTO", tag: "signal" };
    case FROM_BLOCK_TYPE: return { label: "FROM", tag: "signal" };
    case LUT_1D_BLOCK_TYPE: return { label: "LUT 1D", breakpointsX: [0, 10], tableData: [0, 100] };
    case LUT_2D_BLOCK_TYPE: return { label: "LUT 2D", breakpointsX: [0, 10], breakpointsY: [0, 10], tableData: [[0, 100], [100, 200]] };
    case STATE_MACHINE_BLOCK_TYPE: return { label: "State Machine", initialState: "idle", states: ["idle", "active"], transitions: [{ from: "idle", to: "active", event: "rising", eventInput: "in", guardExpr: "inputs.in === true", output: true }, { from: "active", to: "idle", event: "falling", eventInput: "in", guardExpr: "inputs.in === false", output: false }] };
    case GAUGE_BLOCK_TYPE: return { label: "Gauge", min: 0, max: 100 };
    case LAMP_BLOCK_TYPE: return { label: "Lamp", colorTrue: "#22c55e", colorFalse: "#ef4444" };
    case SPECTRUM_ANALYZER_BLOCK_TYPE: return { label: "Spectrum", windowSize: 128 };
    case SCOPE_3D_BLOCK_TYPE: return { label: "3D Scope", maxPoints: 500 };
    case RIGID_BODY_SINK_BLOCK_TYPE: return { label: "Rigid Body Sink" };
    case TRUTH_TABLE_BLOCK_TYPE: return { label: "Truth Table", inputHandles: ["in1", "in2"], rows: [{ when: { in1: true, in2: true }, output: true }], elseOutput: false };
    case INTEGRATOR_BLOCK_TYPE: return { label: "Integrator", initialCondition: 0 };
    case UNIT_DELAY_BLOCK_TYPE: return { label: "Unit Delay", initialValue: 0 };
    case COMPARE_BLOCK_TYPE: return { label: "Compare", operator: "gt" };
    case SWITCH_BLOCK_TYPE: return { label: "Switch" };
    case TO_FILE_BLOCK_TYPE: return { label: "To File", format: "json", fileName: "simulation-log", maxRows: 2000 };
    case INPORT_BLOCK_TYPE: return { label: "Inport" };
    case OUTPORT_BLOCK_TYPE: return { label: "Outport" };
    case SUBSYSTEM_BLOCK_TYPE: return { label: "Subsystem", graph: { nodes: [], edges: [] }, mask: { inputs: ["in1"], outputs: ["out1"], parameters: {} } };
    case DISPLAY_BLOCK_TYPE: return { label: "Display" };
    case BLE_BLOCK_TYPE: return { label: "BLE Device", parsingMode: "raw" };
    case HEART_RATE_BLOCK_TYPE: return { label: "Heart Rate" };
    case BATTERY_LEVEL_BLOCK_TYPE: return { label: "Battery Level" };
    case GPS_BLOCK_TYPE: return { label: "GPS" };
    case ACCELEROMETER_BLOCK_TYPE: return { label: "Accelerometer" };
    case ORIENTATION_BLOCK_TYPE: return { label: "Orientation" };
    case SCOPE_BLOCK_TYPE: return { label: "Scope", maxPoints: 240 };
    default: return { label: "Block" };
  }
}

type CounterMode = "inc" | "dec";

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

interface TruthTableRowModel {
  when: Record<string, number | boolean | string>;
  output: number | boolean;
}

interface TruthTableModel {
  inputHandles: string[];
  rows: TruthTableRowModel[];
  elseOutput: number | boolean | null;
}

interface StateMachineModel {
  initialState: string;
  states: string[];
  transitions: StateMachineTransitionModel[];
}

const MS_PER_SECOND = 1_000;
const MIN_TIMING_SECONDS = 0.001;

const CANVAS_STYLE: React.CSSProperties = {
  touchAction: "none",
  backgroundColor: "#eceff3",
};

const CANVAS_GRID_COLOR = "#c2c9d2";
const CANVAS_GRID_GAP = 20;
const CANVAS_GRID_DOT_SIZE = 1.2;

function formatMsAsSeconds(ms: number): string {
  return String(ms / MS_PER_SECOND);
}

function sanitizeStateMachineName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeStateMachineEventType(value: unknown): "rising" | "falling" | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "rising" || normalized === "falling") return normalized as "rising" | "falling";
  return undefined;
}

function normalizeStateMachineModel(raw: unknown): StateMachineModel {
  const source = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const seenStates = new Set<string>();
  const states = Array.isArray(source.states)
    ? source.states
        .map((entry) => sanitizeStateMachineName(entry))
        .filter((entry): entry is string => {
          if (!entry) return false;
          const normalized = entry.toLowerCase();
          if (seenStates.has(normalized)) return false;
          seenStates.add(normalized);
          return true;
        })
    : [];
  const initialStateCandidate = sanitizeStateMachineName(source.initialState);
  const initialState = initialStateCandidate ?? states[0] ?? "idle";
  const transitions = Array.isArray(source.transitions)
    ? source.transitions.reduce<StateMachineTransitionModel[]>((accumulator, transition) => {
        if (typeof transition !== "object" || transition === null) return accumulator;
        const candidate = transition as Record<string, unknown>;
        const from = sanitizeStateMachineName(candidate.from);
        const to = sanitizeStateMachineName(candidate.to);
        if (!from || !to) return accumulator;
        const guardExpr = sanitizeStateMachineName(candidate.guardExpr) ?? undefined;
        const actionExpr = sanitizeStateMachineName(candidate.actionExpr) ?? undefined;
        const numericOutput = typeof candidate.output === "number" && Number.isFinite(candidate.output) ? candidate.output : undefined;
        const output = typeof candidate.output === "boolean" ? candidate.output : numericOutput;
        const afterMs = typeof candidate.afterMs === "number" && Number.isFinite(candidate.afterMs) && candidate.afterMs >= 0 ? candidate.afterMs : undefined;
        const event = sanitizeStateMachineEventType(candidate.event);
        const eventInput = sanitizeStateMachineName(candidate.eventInput) ?? undefined;
        accumulator.push({
          from, to,
          ...(guardExpr ? { guardExpr } : {}),
          ...(actionExpr ? { actionExpr } : {}),
          ...(typeof output !== "undefined" ? { output } : {}),
          ...(typeof afterMs === "number" ? { afterMs } : {}),
          ...(event ? { event } : {}),
          ...(eventInput ? { eventInput } : {}),
        });
        return accumulator;
      }, [])
    : [];
  const normalizedStates = states.includes(initialState) ? states : [initialState, ...states];
  return { initialState, states: normalizedStates, transitions };
}

function parseStateMachineModelJson(rawValue: string): StateMachineModel | null {
  try {
    const parsed = JSON.parse(rawValue);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return normalizeStateMachineModel(parsed);
  } catch { return null; }
}

function formatStateMachineModelJson(model: StateMachineModel): string {
  return JSON.stringify(model, null, 2);
}

function normalizeTruthTableModel(raw: unknown): TruthTableModel {
  const source = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const seenHandles = new Set<string>();
  const inputHandles = Array.isArray(source.inputHandles)
    ? source.inputHandles
        .map((entry) => sanitizeStateMachineName(entry))
        .filter((entry): entry is string => {
          if (!entry) return false;
          const normalized = entry.toLowerCase();
          if (seenHandles.has(normalized)) return false;
          seenHandles.add(normalized);
          return true;
        })
    : ["in1", "in2"];
  const rows = Array.isArray(source.rows)
    ? source.rows.reduce<TruthTableRowModel[]>((accumulator, row) => {
        if (typeof row !== "object" || row === null) return accumulator;
        const candidate = row as Record<string, unknown>;
        const output = typeof candidate.output === "boolean" ? candidate.output : typeof candidate.output === "number" && Number.isFinite(candidate.output) ? candidate.output : null;
        if (output === null) return accumulator;
        const whenRaw = typeof candidate.when === "object" && candidate.when !== null ? (candidate.when as Record<string, unknown>) : {};
        const when: Record<string, number | boolean | string> = {};
        for (const [key, value] of Object.entries(whenRaw)) {
          const normalizedKey = sanitizeStateMachineName(key);
          const normalizedValue = typeof value === "boolean" ? value : typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" ? value : null;
          if (normalizedKey && normalizedValue !== null) when[normalizedKey] = normalizedValue;
        }
        accumulator.push({ when, output: output as number | boolean });
        return accumulator;
      }, [])
    : [];
  const elseOutput = typeof source.elseOutput === "boolean" ? source.elseOutput : typeof source.elseOutput === "number" && Number.isFinite(source.elseOutput) ? source.elseOutput : null;
  return { inputHandles: inputHandles.length > 0 ? inputHandles : ["in1", "in2"], rows, elseOutput };
}

function parseTruthTableModelJson(rawValue: string): TruthTableModel | null {
  try {
    const parsed = JSON.parse(rawValue);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return normalizeTruthTableModel(parsed);
  } catch { return null; }
}

function formatTruthTableModelJson(model: TruthTableModel): string {
  return JSON.stringify(model, null, 2);
}

function triggerTextDownload(params: { fileName: string; extension: "json" | "csv"; mimeType: string; content: string; }): void {
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
  const [cloudModels, setCloudModels] = useState<SupabaseModelMetadata[]>([]);
  const [serverModels, setServerModels] = useState<Array<{ id: string; name: string; version: number; updated_at: string }>>([]);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isCloudPanelOpen, setIsCloudPanelOpen] = useState(false);
  const [isSweepModalOpen, setIsSweepModalOpen] = useState(false);
  const [currentCloudModelId, setCurrentCloudModelId] = useState<string | null>(null);
  const [currentServerModelId, setCurrentServerModelId] = useState<string | null>(null);
  const [isServerPanelOpen, setIsServerPanelOpen] = useState(false);
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
  const [blockSearchTerm, setBlockSearchTerm] = useState("");
  const [selectedSignalSource, setSelectedSignalSource] = useState<string | null>(null);
  const [stateMachineModelDraft, setStateMachineModelDraft] = useState<string>("");
  const [stateMachineDraftNodeId, setStateMachineDraftNodeId] = useState<string | null>(null);
  const [stateMachineDraftError, setStateMachineDraftError] = useState<string | null>(null);
  const [truthTableModelDraft, setTruthTableModelDraft] = useState<string>("");
  const [truthTableDraftNodeId, setTruthTableDraftNodeId] = useState<string | null>(null);
  const [truthTableDraftError, setTruthTableDraftError] = useState<string | null>(null);
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
  const setModelId = useSimulationRuntimeStore((state) => state.setModelId);
  const isFollowerMode = useSimulationRuntimeStore((state) => state.isFollowerMode);
  const setFollowerMode = useSimulationRuntimeStore((state) => state.setFollowerMode);

  const { isConnected: collabConnected, sendCommand } = useCollaborationSync();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
  };

  const run = useSimulationRuntimeStore((state) => state.run);
  const pause = useSimulationRuntimeStore((state) => state.pause);
  const reset = useSimulationRuntimeStore((state) => state.reset);
  const executionMode = useSimulationRuntimeStore((state) => state.executionMode);
  const setExecutionMode = useSimulationRuntimeStore((state) => state.setExecutionMode);
  const batchSize = useSimulationRuntimeStore((state) => state.batchSize);
  const setBatchSize = useSimulationRuntimeStore((state) => state.setBatchSize);

  const [stopTimeSecondsInput, setStopTimeSecondsInput] = useState(() => formatMsAsSeconds(runtime.simulationTimeMs));
  const [stepTimeSecondsInput, setStepTimeSecondsInput] = useState(() => formatMsAsSeconds(runtime.stepTimeMs));
  const [isEditingStopTime, setIsEditingStopTime] = useState(false);
  const [isEditingStepTime, setIsEditingStepTime] = useState(false);

  useEffect(() => {
    setGraph({
      nodes: nodes.map((node) => ({ id: node.id, type: node.type ?? "default", data: (node.data as any) ?? {} })),
      edges: edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle ?? undefined, targetHandle: edge.targetHandle ?? undefined })),
    });
  }, [edges, nodes, setGraph]);

  const styledEdges = useMemo(() => {
    if (!selectedSignalSource) return edges;
    const trace = traceSignalPath({ sourceNodeId: selectedSignalSource, nodes, edges });
    return computeEdgeStyles({ edges, highlightedEdgeIds: trace.edgeIds, isActive: true });
  }, [edges, nodes, selectedSignalSource]);

  const searchResults = useMemo(() => {
    const term = blockSearchTerm.trim().toLowerCase();
    if (term.length < 1) return [];
    return nodes.filter((node) => {
      const data = node.data as any;
      const label = (data?.label || "").toLowerCase();
      const type = (node.type ?? "").toLowerCase();
      const id = node.id.toLowerCase();
      return label.includes(term) || type.includes(term) || id.includes(term);
    });
  }, [nodes, blockSearchTerm]);

  const stopTimeInputValue = isEditingStopTime ? stopTimeSecondsInput : formatMsAsSeconds(runtime.simulationTimeMs);
  const stepTimeInputValue = isEditingStepTime ? stepTimeSecondsInput : formatMsAsSeconds(runtime.stepTimeMs);

  const commitTimingValue = useCallback((field: "stop" | "step", rawValue: string) => {
    const parsedSeconds = Number(rawValue);
    if (!Number.isFinite(parsedSeconds) || parsedSeconds < MIN_TIMING_SECONDS) {
      setStopTimeSecondsInput(formatMsAsSeconds(runtime.simulationTimeMs));
      setStepTimeSecondsInput(formatMsAsSeconds(runtime.stepTimeMs));
      return;
    }
    const nextMs = Math.round(parsedSeconds * MS_PER_SECOND);
    if (field === "stop") {
      setTiming({ simulationTimeMs: nextMs });
    } else {
      setTiming({ stepTimeMs: nextMs });
    }
  }, [runtime.simulationTimeMs, runtime.stepTimeMs, setTiming]);

  const onTimingInputKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>, field: "stop" | "step") => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
      commitTimingValue(field, event.currentTarget.value);
    }
  }, [commitTimingValue]);

  const onConnect = useCallback<OnConnect>((connection: Connection) => {
    const candidate: Edge = {
      ...connection,
      source: connection.source ?? "source",
      target: connection.target ?? "target",
      id: makeEdgeId(connection.source ?? "source", connection.target ?? "target"),
      type: DEFAULT_EDGE_OPTIONS.type ?? "straight",
    };
    const issue = validateConnectionCandidate({
      graph: {
        nodes: nodes.map((node) => ({ id: node.id, type: node.type ?? "default", data: (node.data as any) ?? {} })),
        edges: edges.concat(candidate).map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle ?? undefined, targetHandle: edge.targetHandle ?? undefined })),
      },
      registry,
      edge: { id: candidate.id, source: candidate.source, target: candidate.target, sourceHandle: candidate.sourceHandle ?? undefined, targetHandle: candidate.targetHandle ?? undefined },
    });
    if (issue) {
      setModelActionMessage(issue.message);
      return;
    }
    setModelActionMessage(null);
    setEdges((currentEdges) => addEdge(candidate, currentEdges));
  }, [edges, nodes, registry, setEdges]);

  const focusNode = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || !reactFlowInstance) return;
    const x = node.position.x + (node.width ?? 220) / 2;
    const y = node.position.y + (node.height ?? 100) / 2;
    reactFlowInstance.setCenter(x, y, { zoom: 1.2, duration: 800 });
    setSelectedNodeId(nodeId);
  }, [nodes, reactFlowInstance]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (event.ctrlKey || event.metaKey) {
      event.stopPropagation();
      setSelectedSignalSource((current) => current === node.id ? null : node.id);
      return;
    }
    setSelectedNodeId(node.id);
    setIsMobileInspectorOpen(true);
  }, []);

  const deleteSelectedNodes = useCallback(() => {
    const selectedNodeIds = nodes.filter((node) => node.selected).map((node) => node.id);
    if (selectedNodeId && !selectedNodeIds.includes(selectedNodeId)) selectedNodeIds.push(selectedNodeId);
    const selectedEdgeIdsFromCanvas = edges.filter((edge) => edge.selected).map((edge) => edge.id);
    if (selectedNodeIds.length === 0 && selectedEdgeIdsFromCanvas.length === 0) return;
    const selectedNodeSet = new Set(selectedNodeIds);
    const selectedEdgeSet = new Set(selectedEdgeIdsFromCanvas);
    setNodes((currentNodes) => currentNodes.filter((node) => !selectedNodeSet.has(node.id)));
    setEdges((currentEdges) => currentEdges.filter((edge) => !selectedEdgeSet.has(edge.id) && !selectedNodeSet.has(edge.source) && !selectedNodeSet.has(edge.target)));
    setSelectedNodeId(null);
  }, [edges, nodes, selectedNodeId, setEdges, setNodes]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const isTextEntryTarget = target?.isContentEditable || target?.tagName.toLowerCase() === "input" || target?.tagName.toLowerCase() === "textarea";
      if (isTextEntryTarget) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setSelectedSignalSource(null);
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

  const onLibraryDragStart = useCallback((event: React.DragEvent<HTMLElement>, type: string) => {
    event.dataTransfer.setData("application/reactflow", type);
    event.dataTransfer.effectAllowed = "move";
  }, []);

  const onCanvasDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onCanvasDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData("application/reactflow");
    if (!type || !reactFlowInstance) return;
    const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    setNodes((currentNodes) => currentNodes.concat({ id: makeNodeId(type), type, position, data: makeNodeData(type) }));
  }, [reactFlowInstance, setNodes]);

  useEffect(() => {
    listRecentSimulationRunRecords(12).then((records) => setRecentRunRecords(records)).catch(() => setToFileActionMessage("IndexedDB unavailable."));
  }, []);

  useEffect(() => {
    if (runtime.status !== "completed") {
      lastPersistedCompletionRef.current = null;
      return;
    }
    const sig = `${runtime.tick}:${runtime.timeMs}`;
    if (lastPersistedCompletionRef.current === sig) return;
    const nodesToFile = nodes.filter((n) => n.type === TO_FILE_BLOCK_TYPE);
    if (nodesToFile.length === 0) {
      lastPersistedCompletionRef.current = sig;
      return;
    }
    const persist = async () => {
      const saved = [];
      for (const node of nodesToFile) {
        const state = toToFileState(runtime.nodeInternalState[node.id], node.data as any);
        const payload = buildToFilePayload({ format: state.format, samples: state.samples });
        const record = await saveSimulationRunRecord({ nodeId: node.id, fileName: state.fileName, format: state.format, sampleCount: state.samples.length, payload: payload.content });
        if (record) saved.push(record);
      }
      if (saved.length > 0) {
        setRecentRunRecords(await listRecentSimulationRunRecords(12));
        setToFileActionMessage(`Persisted ${saved.length} run(s).`);
      }
    };
    lastPersistedCompletionRef.current = sig;
    persist().catch(() => setToFileActionMessage("Persistence failed."));
  }, [nodes, runtime.nodeInternalState, runtime.status, runtime.tick, runtime.timeMs]);
  const getCurrentModel = useCallback((): PersistedModelV3 => ({
    schemaVersion: 3,
    metadata: { app: "web-simulink", savedAtMs: Date.now(), modelName: "Model" },
    nodes: nodes.map(n => ({ id: n.id, type: n.type ?? "default", position: n.position, data: n.data as any })),
    edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? undefined, targetHandle: e.targetHandle ?? undefined, type: e.type ?? "straight" })),
    timing: { simulationTimeMs: runtime.simulationTimeMs, stepTimeMs: runtime.stepTimeMs }
  }), [nodes, edges, runtime]);

  useEffect(() => {
    const restoreLocal = async () => {
      const persisted = await fetchModel(undefined, "local");
      if (persisted) {
        setNodes(persisted.nodes.map(n => ({ ...n, type: n.type as any })));
        setEdges(persisted.edges.map(e => ({ ...e, type: e.type ?? "straight" })));
        setTiming(persisted.timing);
        setModelActionMessage("Restored local snapshot.");
      }
      hasInitializedModelPersistenceRef.current = true;
    };
    restoreLocal();
  }, [setEdges, setNodes, setTiming]);

  useEffect(() => {
    if (!hasInitializedModelPersistenceRef.current) return;
    const model = getCurrentModel();
    model.metadata.modelName = "Autosave";
    persistModel(model, { target: "local" });
  }, [edges, nodes, runtime.simulationTimeMs, runtime.stepTimeMs, getCurrentModel]);

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId) ?? null, [nodes, selectedNodeId]);

  const patchSelectedNodeData = useCallback((patch: Record<string, unknown>) => {
    if (!selectedNodeId) return;
    setNodes(nds => nds.map(n => n.id === selectedNodeId ? { ...n, data: { ...(n.data as any), ...patch } } : n));
  }, [selectedNodeId, setNodes]);

  const editingSubsystemGraph = useMemo(() => {
    if (!editingSubsystemId) return { nodes: [], edges: [] };
    const n = nodes.find(n => n.id === editingSubsystemId);
    const g = (n?.data as any)?.graph;
    return (g && typeof g === "object" && Array.isArray(g.nodes)) ? g : { nodes: [], edges: [] };
  }, [editingSubsystemId, nodes]);

  const hasSelection = useMemo(() => Boolean(selectedNodeId) || nodes.some(n => n.selected) || edges.some(e => e.selected), [nodes, edges, selectedNodeId]);

  const refreshCloudModels = useCallback(async () => {
    try { setCloudModels(await listModels("cloud")); } catch { setModelActionMessage("Cloud refresh failed."); }
  }, []);
  
  const refreshServerModels = useCallback(async () => {
    try { setServerModels(await listModels("server")); } catch { setModelActionMessage("Edge Server refresh failed."); }
  }, []);

  useEffect(() => { refreshCloudModels(); refreshServerModels(); }, [refreshCloudModels, refreshServerModels]);


  const saveToServer = useCallback(async () => {
    const model = getCurrentModel();
    model.metadata.modelName = "Edge Model";
    const id = currentServerModelId || crypto.randomUUID();
    const result = await persistModel(model, { target: "server", modelId: id, modelName: "Edge Model" });
    if (result.success) {
      setCurrentServerModelId(id);
      setModelId(id);
      setModelActionMessage("Edge Server save success.");
      refreshServerModels();
    } else {
      setModelActionMessage(`Edge Server save failed: ${result.error}`);
    }
  }, [getCurrentModel, currentServerModelId, refreshServerModels, setModelId]);

  const loadFromServer = useCallback(async (id: string) => {
    const p = await fetchModel(id, "server");
    if (p) {
      setNodes(p.nodes.map(n => ({ ...n, type: n.type as any })));
      setEdges(p.edges.map(e => ({ ...e, type: e.type ?? "straight" })));
      setTiming(p.timing);
      setCurrentServerModelId(id);
      setModelId(id);
      setIsServerPanelOpen(false);
      setModelActionMessage("Edge Server model loaded.");
    } else {
      setModelActionMessage("Edge Server load failed.");
    }
  }, [setNodes, setEdges, setTiming, setModelId]);

  const saveToCloud = useCallback(async () => {
    const model = getCurrentModel();
    model.metadata.modelName = "Cloud Model";
    const result = await persistModel(model, { target: "cloud", modelId: currentCloudModelId || undefined });
    if (result.success) {
      if (result.modelId) {
        setCurrentCloudModelId(result.modelId);
        setModelId(result.modelId);
      }
      setModelActionMessage("Cloud save success.");
      refreshCloudModels();
    } else {
      setModelActionMessage(`Cloud save failed: ${result.error}`);
    }
  }, [getCurrentModel, currentCloudModelId, refreshCloudModels, setModelId]);

  const handleSync = useCallback(async () => {
    const target = user ? "cloud" : "server";
    try {
      const result = await syncModels("local", target);
      setModelActionMessage(`Sync to ${target} complete: ${result.synced.length} synced, ${result.skipped.length} skipped.`);
      if (user) refreshCloudModels();
      else refreshServerModels();
    } catch (err) {
      setModelActionMessage(`Sync failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [user, refreshCloudModels, refreshServerModels]);

  const loadFromCloud = useCallback(async (id: string) => {
    const p = await fetchModel(id, "cloud");
    if (p) {
      setNodes(p.nodes.map(n => ({ ...n, type: n.type as any })));
      setEdges(p.edges.map(e => ({ ...e, type: e.type ?? "straight" })));
      setTiming(p.timing);
      setCurrentCloudModelId(id);
      setModelId(id);
      setIsCloudPanelOpen(false);
      setModelActionMessage("Cloud model loaded.");
    } else {
      setModelActionMessage("Cloud load failed.");
    }
  }, [setNodes, setEdges, setTiming, setModelId]);

  const exportModelDocument = useCallback(() => {
    try {
      const model = getCurrentModel();
      model.metadata.modelName = "Exported Model";
      const s = JSON.stringify(model, null, 2);
      triggerTextDownload({ fileName: `web-simulink-model-${Date.now()}`, extension: "json", mimeType: "application/json", content: s });
      setModelActionMessage("Model exported.");
    } catch { setModelActionMessage("Export failed."); }
  }, [getCurrentModel]);

  const importModelDocument = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const p = parseModelDocument(await f.text());
      setNodes(p.nodes.map(n => ({ ...n, type: n.type as any })));
      setEdges(p.edges.map(e => ({ ...e, type: e.type ?? "straight" })));
      setTiming(p.timing);
      setSelectedNodeId(null);
      setModelActionMessage("Import success.");
    } catch {
      setModelActionMessage("Import failed.");
    }
    finally { e.target.value = ""; }
  }, [setEdges, setNodes, setTiming]);
  const renderInspectorCore = useCallback(({ mobile }: { mobile: boolean }) => {
    if (!selectedNode) return <p className="text-slate-500 text-xs italic p-4">Select a node to inspect properties.</p>;
    const data = selectedNode.data as any;

    return (
      <div className="p-4 space-y-4">
        <div className="space-y-1">
          <p className="text-[10px] uppercase font-bold text-slate-400">Node Information</p>
          <p className="text-xs font-mono text-slate-700">{selectedNode.id}</p>
          <input type="text" value={data.label || ""} onChange={e => patchSelectedNodeData({ label: e.target.value })} className="w-full border rounded p-1 text-xs" />
        </div>

        {selectedNode.type === COUNTER_BLOCK_TYPE && (
          <div className="space-y-2 border-t pt-3">
             <p className="text-[10px] uppercase font-bold text-orange-600">Counter Parameters</p>
             <label className="block text-xs">Start<input type="number" value={data.start ?? 0} onChange={e => patchSelectedNodeData({ start: Number(e.target.value) })} className="w-full border rounded p-1" /></label>
             <label className="block text-xs">Step<input type="number" value={data.step ?? 1} onChange={e => patchSelectedNodeData({ step: Number(e.target.value) })} className="w-full border rounded p-1" /></label>
          </div>
        )}

        <div className="space-y-2 border-t pt-3">
           <p className="text-[10px] uppercase font-bold text-slate-400">Advanced</p>
           <label className="block text-xs">Sample Time (ms)<input type="number" value={data.sampleTimeMs ?? ""} placeholder="Default" onChange={e => patchSelectedNodeData({ sampleTimeMs: Number(e.target.value) || null })} className="w-full border rounded p-1" /></label>
        </div>
      </div>
    );
  }, [selectedNode, patchSelectedNodeData]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <OfflineIndicator />
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col">
        <header className="border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Web Simulink</p>
              <h1 className="text-lg font-semibold">Block Diagram Editor</h1>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <label className="flex items-center gap-1 text-xs text-slate-600">
                Stop Time
                <input type="number" step="0.001" value={stopTimeInputValue} onFocus={() => setIsEditingStopTime(true)} onChange={e => setStopTimeSecondsInput(e.target.value)} onBlur={e => { commitTimingValue("stop", e.target.value); setIsEditingStopTime(false); }} onKeyDown={e => onTimingInputKeyDown(e, "stop")} className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700" />
                <span className="text-slate-500">s</span>
              </label>
              <label className="flex items-center gap-1 text-xs text-slate-600">
                Step (Ts)
                <input type="number" step="0.001" value={stepTimeInputValue} onFocus={() => setIsEditingStepTime(true)} onChange={e => setStepTimeSecondsInput(e.target.value)} onBlur={e => { commitTimingValue("step", e.target.value); setIsEditingStepTime(false); }} onKeyDown={e => onTimingInputKeyDown(e, "step")} className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700" />
                <span className="text-slate-500">s</span>
              </label>
              <button onClick={() => { refreshServerModels(); setIsServerPanelOpen(true); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Edge Server</button>
              <button onClick={handleSync} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">Sync</button>
              <button onClick={user ? saveToCloud : () => window.location.href="/login"} className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">Save</button>
              <button onClick={() => { refreshCloudModels(); setIsCloudPanelOpen(true); }} className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700">Cloud</button>
              <button onClick={() => sendCommand("run")} className="rounded-lg border border-emerald-300 bg-emerald-100 px-3 py-2 text-sm font-bold text-emerald-800">RUN</button>
              <button onClick={() => sendCommand("pause")} className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-sm font-bold text-amber-800">PAUSE</button>
              <button onClick={() => sendCommand("reset")} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700">RESET</button>
              <div className="ml-2 border-l border-slate-200 pl-4">
                {authLoading ? <div className="h-8 w-8 animate-pulse rounded-full bg-slate-100" /> : user ? (
                  <div className="flex items-center gap-3">
                    <button onClick={handleSignOut} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Sign Out</button>
                  </div>
                ) : (
                  <button onClick={() => window.location.href = "/login"} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900">Sign In</button>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="relative flex flex-1 flex-col gap-3 p-3 sm:gap-4 sm:p-6 lg:flex-row">
          <aside className="order-2 rounded-xl border border-slate-200 bg-white p-4 lg:order-1 lg:w-72">
            <h2 className="text-sm font-semibold text-slate-700">Collaboration (P15-2)</h2>
            <div className="mt-3 space-y-2 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
               <div className="flex items-center justify-between">
                 <span className="text-xs font-bold text-indigo-700 uppercase">Live Sync</span>
                 <span className={`h-2 w-2 rounded-full ${collabConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-300"}`} />
               </div>
               <p className="text-[10px] text-indigo-600 leading-tight">Syncs transport controls and live signal traces across sessions.</p>
               <label className="flex items-center gap-2 cursor-pointer pt-1">
                 <input type="checkbox" checked={isFollowerMode} onChange={e => setFollowerMode(e.target.checked)} className="h-3 w-3 rounded text-indigo-600" />
                 <span className="text-[11px] font-semibold text-indigo-800 uppercase">Follower Mode</span>
               </label>
            </div>

            <div className="mt-6 border-t pt-6">
              <h2 className="text-sm font-semibold text-slate-700">Library</h2>
              <div className="mt-3 text-sm text-slate-600 max-h-96 overflow-y-auto pr-1">
                {LIBRARY_BLOCKS.map(block => (
                  <div key={block.type} draggable onDragStart={e => onLibraryDragStart(e, block.type)} className="mb-2 cursor-grab rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sky-700 active:cursor-grabbing text-xs">{block.label}</div>
                ))}
              </div>
            </div>

            <div className="mt-6 border-t pt-4">
              <p className="text-xs text-slate-500">Status: <span className="font-bold uppercase text-indigo-600">{runtime.status}</span></p>
              <p className="text-[11px] text-slate-400">Tick: {runtime.tick}</p>
              <button onClick={() => setIsTracePanelOpen(true)} className="mt-2 w-full rounded border border-slate-300 bg-white py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50 uppercase">Show Trace</button>
            </div>
          </aside>

          <section className="order-1 min-h-[420px] flex-1 overflow-hidden rounded-xl border border-slate-300 bg-white lg:order-2 lg:min-h-[560px]">
            <ReactFlow
              nodes={nodes}
              edges={styledEdges}
              edgeTypes={EDGE_TYPES}
              onInit={setReactFlowInstance}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onNodeDoubleClick={(_, n) => { if (n.type === SUBSYSTEM_BLOCK_TYPE) setEditingSubsystemId(n.id); }}
              onDragOver={onCanvasDragOver}
              onDrop={onCanvasDrop}
              defaultEdgeOptions={{ ...DEFAULT_EDGE_OPTIONS, type: "probing" }}
              nodeTypes={NODE_TYPES}
              fitView
              style={CANVAS_STYLE}
              panOnDrag
              zoomOnPinch
              zoomOnScroll
              connectionRadius={44}
            >
              <Background variant={BackgroundVariant.Dots} color={CANVAS_GRID_COLOR} gap={CANVAS_GRID_GAP} size={CANVAS_GRID_DOT_SIZE} />
              <MiniMap />
              <Controls showInteractive={false} />
            </ReactFlow>
          </section>

          <aside className="order-3 hidden rounded-xl border border-slate-200 bg-white p-4 lg:block lg:w-72">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4 border-b pb-2">Inspector</h2>
            <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
              {renderInspectorCore({ mobile: false })}
            </div>
          </aside>
        </main>

        {isTracePanelOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="flex flex-col w-full max-w-2xl max-h-[80vh] bg-white rounded-2xl shadow-2xl overflow-hidden">
              <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
                <h2 className="text-lg font-bold text-slate-800">Simulation Trace</h2>
                <button onClick={() => setIsTracePanelOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
              </header>
              <main className="flex-1 overflow-y-auto p-6">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-50 uppercase text-slate-500">
                    <tr><th className="p-2">Tick</th><th className="p-2">Status</th><th className="p-2">Note</th><th className="p-2 text-right">Duration</th></tr>
                  </thead>
                  <tbody>
                    {trace.map((e, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="p-2 font-mono">#{e.tick}</td>
                        <td className="p-2 uppercase font-bold">{e.status}</td>
                        <td className="p-2">{e.note}</td>
                        <td className="p-2 text-right">{e.durationMs.toFixed(2)}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </main>
            </div>
          </div>
        )}

        
        {isServerPanelOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
              <header className="flex items-center justify-between border-b px-6 py-4 bg-slate-50 font-bold">
                Edge Server Models
                <div className="flex gap-2">
                  <button onClick={saveToServer} className="bg-emerald-600 text-white px-3 py-1 rounded text-xs">Save Current</button>
                  <button onClick={() => setIsServerPanelOpen(false)}>✕</button>
                </div>
              </header>
              <main className="p-4 space-y-2 max-h-96 overflow-y-auto">
                {serverModels.map(m => (
                  <div key={m.id} className="flex justify-between p-3 border rounded-lg hover:bg-indigo-50">
                    <div className="flex flex-col truncate pr-4">
                      <span className="font-bold">{m.name}</span>
                      <span className="text-[10px] text-slate-400">ID: {m.id.slice(0, 8)}... | Updated: {new Date(m.updated_at).toLocaleString()}</span>
                    </div>
                    <button onClick={() => loadFromServer(m.id)} className="bg-indigo-600 text-white px-3 py-1 rounded text-xs self-center">Load</button>
                  </div>
                ))}
                {serverModels.length === 0 && <p className="text-center text-slate-500 text-xs py-8 italic">No models found on server.</p>}
              </main>
            </div>
          </div>
        )}

        {isCloudPanelOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
              <header className="flex items-center justify-between border-b px-6 py-4 bg-slate-50 font-bold">Cloud Models<button onClick={() => setIsCloudPanelOpen(false)}>✕</button></header>
              <main className="p-4 space-y-2 max-h-96 overflow-y-auto">
                {cloudModels.map(m => (
                  <div key={m.id} className="flex justify-between p-3 border rounded-lg hover:bg-sky-50">
                    <span className="font-bold truncate pr-4">{m.name}</span>
                    <button onClick={() => loadFromCloud(m.id)} className="bg-sky-600 text-white px-3 py-1 rounded text-xs">Load</button>
                  </div>
                ))}
              </main>
            </div>
          </div>
        )}

        {editingSubsystemId && (
          <SubsystemEditorModal
            open={true}
            subsystemId={editingSubsystemId}
            initialGraph={editingSubsystemGraph}
            onClose={() => setEditingSubsystemId(null)}
            onSave={(g) => {
              const m = deriveSubsystemMaskFromGraph(g);
              setNodes(nds => nds.map(n => n.id === editingSubsystemId ? { ...n, data: { ...(n.data as any), graph: g, mask: { ...((n.data as any).mask || {}), inputs: m.inputs, outputs: m.outputs } } } : n));
            }}
          />
        )}
      </div>
      <input ref={modelFileInputRef} type="file" className="hidden" onChange={importModelDocument} />
    </div>
  );
}
