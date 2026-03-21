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
};

const LIBRARY_BLOCKS = [
  { label: "Inport", type: INPORT_BLOCK_TYPE },
  { label: "Outport", type: OUTPORT_BLOCK_TYPE },
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

function getNodeLabel(node: Node): string {
  const label = (node.data as Record<string, unknown> | undefined)?.label;
  return typeof label === "string" ? label.trim() : "";
}

function getNextPortIndex(nodes: Node[], type: string): number {
  return nodes.filter((node) => node.type === type).length + 1;
}

function makeNodeData(type: string, existingNodes: Node[]): Record<string, unknown> {
  switch (type) {
    case INPORT_BLOCK_TYPE:
      return { label: `in${getNextPortIndex(existingNodes, INPORT_BLOCK_TYPE)}` };
    case OUTPORT_BLOCK_TYPE:
      return { label: `out${getNextPortIndex(existingNodes, OUTPORT_BLOCK_TYPE)}` };
    case GAIN_BLOCK_TYPE:
      return { label: "Gain", gain: 1 };
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
      return {
        label: "LUT 2D",
        breakpointsX: [0, 10],
        breakpointsY: [0, 10],
        tableData: [[0, 100], [100, 200]],
      };
    case SUBSYSTEM_BLOCK_TYPE:
      return {
        label: "Subsystem",
        graph: { nodes: [], edges: [] },
        mask: { inputs: ["in1"], outputs: ["out1"], parameters: {} },
      };
    default:
      return { label: "Block" };
  }
}

function validateSubsystemInterfaceNodes(nodes: Node[]): string[] {
  const errors: string[] = [];

  const checkPortType = (type: string, typeLabel: string) => {
    const seen = new Map<string, string>();

    for (const node of nodes) {
      if (node.type !== type) {
        continue;
      }

      const label = getNodeLabel(node);
      if (!label) {
        errors.push(`${typeLabel} '${node.id}' has an empty label.`);
        continue;
      }

      const normalized = label.toLowerCase();
      const previous = seen.get(normalized);
      if (previous) {
        errors.push(`${typeLabel} label '${label}' is duplicated (${previous}, ${node.id}).`);
        continue;
      }

      seen.set(normalized, node.id);
    }
  };

  checkPortType(INPORT_BLOCK_TYPE, "Inport");
  checkPortType(OUTPORT_BLOCK_TYPE, "Outport");
  return errors;
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
  const [saveErrors, setSaveErrors] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setNodes(initialGraph.nodes);
      setEdges(initialGraph.edges);
      setSaveErrors([]);
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

    setNodes((currentNodes) =>
      currentNodes.concat({
        id: makeNodeId(type),
        type,
        position,
        data: makeNodeData(type, currentNodes),
      })
    );
  };

  const addInterfaceNode = useCallback(
    (type: typeof INPORT_BLOCK_TYPE | typeof OUTPORT_BLOCK_TYPE) => {
      setNodes((currentNodes) => {
        const offset = currentNodes.length;
        return currentNodes.concat({
          id: makeNodeId(type),
          type,
          position: { x: 120, y: 100 + offset * 28 },
          data: makeNodeData(type, currentNodes),
        });
      });

      setSaveErrors([]);
    },
    [setNodes]
  );

  const interfaceSummary = useMemo(() => {
    return nodes
      .filter((node) => node.type === INPORT_BLOCK_TYPE || node.type === OUTPORT_BLOCK_TYPE)
      .slice()
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((node) => {
        const label = getNodeLabel(node);
        const connectionCount = edges.filter(
          (edge) => edge.source === node.id || edge.target === node.id
        ).length;

        return {
          id: node.id,
          type: node.type === INPORT_BLOCK_TYPE ? "Inport" : "Outport",
          label: label || "(empty)",
          connectionCount,
        };
      });
  }, [edges, nodes]);

  const normalizeIoLabels = useCallback(() => {
    setNodes((currentNodes) => {
      let inIndex = 1;
      let outIndex = 1;

      return currentNodes.map((node) => {
        if (node.type === INPORT_BLOCK_TYPE) {
          return {
            ...node,
            data: {
              ...((node.data as Record<string, unknown> | undefined) ?? {}),
              label: `in${inIndex++}`,
            },
          };
        }

        if (node.type === OUTPORT_BLOCK_TYPE) {
          return {
            ...node,
            data: {
              ...((node.data as Record<string, unknown> | undefined) ?? {}),
              label: `out${outIndex++}`,
            },
          };
        }

        return node;
      });
    });

    setSaveErrors([]);
  }, [setNodes]);

  const handleSave = () => {
    const interfaceIssues = validateSubsystemInterfaceNodes(nodes);
    if (interfaceIssues.length > 0) {
      setSaveErrors(interfaceIssues);
      return;
    }

    setSaveErrors([]);
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
            onClick={normalizeIoLabels}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Normalize I/O Labels
          </button>
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

      {saveErrors.length > 0 ? (
        <div className="border-b border-amber-300 bg-amber-50 px-6 py-3 text-xs text-amber-800">
          <p className="font-semibold">Subsystem interface issues:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {saveErrors.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <main className="flex flex-1 overflow-hidden">
        <aside className="w-64 overflow-y-auto border-r border-slate-300 bg-white p-4">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-700">
            Subsystem Library
          </h3>
          <ul className="space-y-2">
            {LIBRARY_BLOCKS.map((block) => (
              <li
                key={block.type}
                draggable
                onDragStart={(e) => onLibraryDragStart(e, block.type)}
                className="cursor-grab rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-700 hover:border-sky-300 active:cursor-grabbing"
              >
                {block.label}
              </li>
            ))}
          </ul>

          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">
              Quick I/O Add
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => addInterfaceNode(INPORT_BLOCK_TYPE)}
                className="rounded border border-sky-300 bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700"
              >
                + Inport
              </button>
              <button
                type="button"
                onClick={() => addInterfaceNode(OUTPORT_BLOCK_TYPE)}
                className="rounded border border-sky-300 bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700"
              >
                + Outport
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-md border border-slate-200 bg-white p-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">
              Interface Summary
            </p>
            {interfaceSummary.length === 0 ? (
              <p className="mt-1 text-xs text-slate-500">No Inport/Outport nodes yet.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {interfaceSummary.map((port) => (
                  <li key={port.id} className="rounded border border-slate-100 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">
                    <span className="font-semibold">{port.type}</span> {port.label}
                    <span className="ml-1 text-slate-500">({port.connectionCount} conn)</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
