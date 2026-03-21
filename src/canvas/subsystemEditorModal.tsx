"use client";

import { useCallback, useState, useEffect } from "react";
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
  ReactFlowInstance,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";

import { CustomBlockNode } from "./customBlockNode";
import { DEFAULT_EDGE_OPTIONS } from "./edgeDefaults";
import { COUNTER_BLOCK_TYPE } from "@/src/simulation/blocks/counterBlock";
import { DISPLAY_BLOCK_TYPE } from "@/src/simulation/blocks/displayBlock";
import { SCOPE_BLOCK_TYPE } from "@/src/simulation/blocks/scopeBlock";
import { GAIN_BLOCK_TYPE } from "@/src/simulation/blocks/gainBlock";
import { SUM_BLOCK_TYPE } from "@/src/simulation/blocks/sumBlock";
import { PRODUCT_BLOCK_TYPE } from "@/src/simulation/blocks/productBlock";
import { INTEGRATOR_BLOCK_TYPE } from "@/src/simulation/blocks/integratorBlock";
import { UNIT_DELAY_BLOCK_TYPE } from "@/src/simulation/blocks/unitDelayBlock";
import { COMPARE_BLOCK_TYPE } from "@/src/simulation/blocks/compareBlock";
import { SWITCH_BLOCK_TYPE } from "@/src/simulation/blocks/switchBlock";
import { TO_FILE_BLOCK_TYPE } from "@/src/simulation/blocks/toFileBlock";
import { INPORT_BLOCK_TYPE } from "@/src/simulation/blocks/inportBlock";
import { OUTPORT_BLOCK_TYPE } from "@/src/simulation/blocks/outportBlock";
import { SUBSYSTEM_BLOCK_TYPE } from "@/src/simulation/blocks/subsystemBlock";

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

const LIBRARY_BLOCKS = [
  { label: "Inport", type: INPORT_BLOCK_TYPE },
  { label: "Outport", type: OUTPORT_BLOCK_TYPE },
  { label: "Gain", type: GAIN_BLOCK_TYPE },
  { label: "Sum", type: SUM_BLOCK_TYPE },
  { label: "Product", type: PRODUCT_BLOCK_TYPE },
  { label: "Integrator", type: INTEGRATOR_BLOCK_TYPE },
  { label: "Unit Delay", type: UNIT_DELAY_BLOCK_TYPE },
  { label: "Compare", type: COMPARE_BLOCK_TYPE },
  { label: "Switch", type: SWITCH_BLOCK_TYPE },
  { label: "To File", type: TO_FILE_BLOCK_TYPE },
  { label: "Subsystem", type: SUBSYSTEM_BLOCK_TYPE },
] as const;

function makeNodeId(type: string): string {
  return `${type}-${Date.now()}`;
}

function makeEdgeId(source: string, target: string): string {
    return `${source}->${target}-${Date.now()}`;
}

function makeNodeData(type: string): Record<string, unknown> {
  switch (type) {
    case INPORT_BLOCK_TYPE:
      return { label: "Inport" };
    case OUTPORT_BLOCK_TYPE:
      return { label: "Outport" };
    case GAIN_BLOCK_TYPE:
      return { label: "Gain", gain: 1 };
    case SUBSYSTEM_BLOCK_TYPE:
      return { label: "Subsystem", graph: { nodes: [], edges: [] } };
    default:
      return { label: "Block" };
  }
}

interface SubsystemEditorModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (graph: { nodes: Node[]; edges: Edge[] }) => void;
  initialGraph: { nodes: Node[]; edges: Edge[] };
  subsystemId: string;
}

export function SubsystemEditorModal({
  open,
  onClose,
  onSave,
  initialGraph,
  subsystemId,
}: SubsystemEditorModalProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialGraph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialGraph.edges);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  useEffect(() => {
    if (open) {
      setNodes(initialGraph.nodes);
      setEdges(initialGraph.edges);
    }
  }, [open, initialGraph, setNodes, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((currentEdges) =>
        addEdge(
          {
            ...connection,
            id: makeEdgeId(connection.source ?? "source", connection.target ?? "target"),
            type: "straight",
          },
          currentEdges
        )
      );
    },
    [setEdges]
  );

  const onLibraryDragStart = (event: React.DragEvent, type: string) => {
    event.dataTransfer.setData("application/reactflow", type);
    event.dataTransfer.effectAllowed = "move";
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData("application/reactflow");
    if (!type || !reactFlowInstance) return;

    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    setNodes((nds) =>
      nds.concat({
        id: makeNodeId(type),
        type,
        position,
        data: makeNodeData(type),
      })
    );
  };

  const handleSave = () => {
    onSave({ nodes, edges });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-100">
      <header className="flex items-center justify-between border-b border-slate-300 bg-white px-6 py-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Editing Subsystem: {subsystemId}</h2>
          <p className="text-xs text-slate-500">Add Inports/Outports to define external interface.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
          >
            Save & Close
          </button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <aside className="w-64 border-r border-slate-300 bg-white p-4 overflow-y-auto">
          <h3 className="mb-4 text-sm font-semibold text-slate-700 uppercase tracking-wider">Subsystem Library</h3>
          <ul className="space-y-2">
            {LIBRARY_BLOCKS.map((block) => (
              <li
                key={block.type}
                draggable
                onDragStart={(e) => onLibraryDragStart(e, block.type)}
                className="cursor-grab rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-700 active:cursor-grabbing hover:border-sky-300"
              >
                {block.label}
              </li>
            ))}
          </ul>
        </aside>

        <section className="flex-1 bg-[#eceff3]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            nodeTypes={NODE_TYPES}
            defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
            fitView
          >
            <Background variant={BackgroundVariant.Dots} color="#c2c9d2" gap={20} />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </section>
      </main>
    </div>
  );
}
