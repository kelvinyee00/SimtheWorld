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
  serializeModelV2,
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
      return { label: "Subsystem", graph: { nodes: [], edges: [] } };
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
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [recentRunRecords, setRecentRunRecords] = useState<PersistedSimulationRunRecord[]>([]);
  const [toFileActionMessage, setToFileActionMessage] = useState<string | null>(null);
  const [modelActionMessage, setModelActionMessage] = useState<string | null>(null);
  const lastPersistedCompletionRef = useRef<string | null>(null);
  const modelFileInputRef = useRef<HTMLInputElement | null>(null);
  const hasInitializedModelPersistenceRef = useRef(false);

  const runtime = useSimulationRuntimeStore((state) => state.runtime);
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
      setModelActionMessage("Loaded persisted model snapshot (schema v2).");
    }

    hasInitializedModelPersistenceRef.current = true;
  }, [setEdges, setNodes, setTiming]);

  useEffect(() => {
    if (!hasInitializedModelPersistenceRef.current) {
      return;
    }

    try {
      const serialized = serializeModelV2({
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
      const serialized = serializeModelV2({
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

      setModelActionMessage("Exported model document (schema v2).");
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
            <p className="mt-1 text-xs text-slate-500">IndexedDB runs: {recentRunRecords.length}</p>
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

        {editingSubsystemId ? (
          <SubsystemEditorModal
            open={true}
            subsystemId={editingSubsystemId}
            initialGraph={editingSubsystemGraph}
            onClose={() => setEditingSubsystemId(null)}
            onSave={(graph) => {
              setNodes((currentNodes) =>
                currentNodes.map((node) =>
                  node.id === editingSubsystemId
                    ? {
                        ...node,
                        data: {
                          ...((node.data as Record<string, unknown> | undefined) ?? {}),
                          graph,
                        },
                      }
                    : node
                )
              );
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
