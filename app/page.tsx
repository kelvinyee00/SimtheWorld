"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { DEFAULT_EDGE_OPTIONS } from "@/src/canvas/edgeDefaults";
import { COUNTER_BLOCK_TYPE } from "@/src/simulation/blocks/counterBlock";
import { DISPLAY_BLOCK_TYPE } from "@/src/simulation/blocks/displayBlock";
import { SCOPE_BLOCK_TYPE } from "@/src/simulation/blocks/scopeBlock";
import { GAIN_BLOCK_TYPE } from "@/src/simulation/blocks/gainBlock";
import { SUM_BLOCK_TYPE } from "@/src/simulation/blocks/sumBlock";
import { PRODUCT_BLOCK_TYPE } from "@/src/simulation/blocks/productBlock";
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

const DEFAULT_COUNTER_INSPECTOR_DATA: CounterInspectorData = {
  start: 0,
  step: 1,
  mode: "inc",
};

const DEFAULT_GAIN_INSPECTOR_DATA: GainInspectorData = {
  gain: 1,
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

export default function Home() {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isMobileInspectorOpen, setIsMobileInspectorOpen] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  const runtime = useSimulationRuntimeStore((state) => state.runtime);
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
      setEdges((currentEdges) =>
        addEdge(
          {
            ...connection,
            id: makeEdgeId(connection.source ?? "source", connection.target ?? "target"),
            // Belt-and-suspenders safety: preserve straight-edge policy even if call-sites evolve.
            type: DEFAULT_EDGE_OPTIONS.type ?? "straight",
          },
          currentEdges
        )
      );
    },
    [setEdges]
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

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

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
      </div>
    </div>
  );
}
