"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  addEdge,
  Background,
  Connection,
  Controls,
  Edge,
  NodeTypes,
  MiniMap,
  Node,
  OnConnect,
  Panel,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";

import { CustomBlockNode } from "@/src/canvas/customBlockNode";
import { DEFAULT_EDGE_OPTIONS } from "@/src/canvas/edgeDefaults";
import { COUNTER_BLOCK_TYPE } from "@/src/simulation/blocks/counterBlock";
import { DISPLAY_BLOCK_TYPE } from "@/src/simulation/blocks/displayBlock";
import { SCOPE_BLOCK_TYPE } from "@/src/simulation/blocks/scopeBlock";
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
  },
  {
    id: "counter-1->scope-1",
    source: "counter-1",
    target: "scope-1",
  },
];

const NODE_TYPES: NodeTypes = {
  [COUNTER_BLOCK_TYPE]: CustomBlockNode,
  [DISPLAY_BLOCK_TYPE]: CustomBlockNode,
  [SCOPE_BLOCK_TYPE]: CustomBlockNode,
};

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

export default function Home() {
  const [nodes, , onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isMobileInspectorOpen, setIsMobileInspectorOpen] = useState(false);

  const runtime = useSimulationRuntimeStore((state) => state.runtime);
  const setGraph = useSimulationRuntimeStore((state) => state.setGraph);
  const run = useSimulationRuntimeStore((state) => state.run);
  const pause = useSimulationRuntimeStore((state) => state.pause);
  const reset = useSimulationRuntimeStore((state) => state.reset);

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

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

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
            </div>
          </div>
        </header>

        <main className="relative flex flex-1 flex-col gap-3 p-3 sm:gap-4 sm:p-6 lg:flex-row">
          <aside className="order-2 rounded-xl border border-slate-200 bg-white p-4 lg:order-1 lg:w-72">
            <h2 className="text-sm font-semibold text-slate-700">Components</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li className="rounded-md border border-slate-200 px-3 py-2">Counter</li>
              <li className="rounded-md border border-slate-200 px-3 py-2">Display</li>
              <li className="rounded-md border border-slate-200 px-3 py-2">Scope</li>
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              Runtime status: <span className="font-medium">{runtime.status}</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">Tick: {runtime.tick}</p>
          </aside>

          <section className="order-1 min-h-[420px] flex-1 overflow-hidden rounded-xl border border-slate-300 bg-white lg:order-2 lg:min-h-[560px]">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
              nodeTypes={NODE_TYPES}
              fitView
              /**
               * Mobile/touch interaction policy:
               * - `touch-action: none` prevents browser scroll hijacking during node drag/pan.
               * - panOnDrag + zoomOnPinch keeps one-finger/gesture interactions predictable.
               */
              style={{ touchAction: "none" }}
              panOnDrag
              zoomOnPinch
              zoomOnScroll
              selectionOnDrag={false}
            >
              <Background />
              <MiniMap pannable zoomable />
              <Controls showInteractive={false} />
              <Panel position="top-left">
                <div className="rounded-md bg-white/90 px-2 py-1 text-xs text-slate-600 shadow-sm">
                  Tap/click nodes to inspect. Drag from a handle to connect.
                </div>
              </Panel>
            </ReactFlow>
          </section>

          <aside className="order-3 hidden rounded-xl border border-slate-200 bg-white p-4 lg:block lg:w-72">
            <h2 className="text-sm font-semibold text-slate-700">Inspector</h2>
            {selectedNode ? (
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
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                Select a node from the canvas to inspect its properties.
              </p>
            )}
          </aside>
        </main>

        {/*
          Compact mobile command bar.
          Fixed bottom placement keeps primary simulation actions reachable on phones while
          preserving vertical space for canvas gestures.
        */}
        <div className="fixed inset-x-3 bottom-3 z-20 grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-lg sm:hidden">
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
              {selectedNode ? (
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
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No node selected.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
