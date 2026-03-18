"use client";

import { memo, useState } from "react";
import { Handle, NodeProps, Position } from "reactflow";

import {
  DisplayBlockView,
  DISPLAY_BLOCK_TYPE,
} from "@/src/simulation/blocks/displayBlock";
import {
  ScopeBlockView,
  ScopeModal,
  SCOPE_BLOCK_TYPE,
} from "@/src/simulation/blocks/scopeBlock";
import { COUNTER_BLOCK_TYPE } from "@/src/simulation/blocks/counterBlock";
import { useSimulationRuntimeStore } from "@/src/store/simulationRuntimeStore";

/**
 * React Flow node `data` for our simulation blocks.
 *
 * Deliberately tiny surface area:
 * - `label` is presentation-only text for node header.
 * - all simulation params (e.g. `start`, `step`, `mode`, `maxPoints`) are still
 *   kept as plain fields in `data` and read by the engine via `setGraph`.
 */
interface BlockNodeData {
  label?: string;
}

/**
 * Unified renderer for simulation block nodes on the React Flow canvas.
 *
 * Architecture rationale:
 * - A single typed component keeps node rendering policy centralized and auditable.
 * - The component subscribes directly to runtime snapshot slices so visual widgets
 *   (Counter/Display/Scope) update in near real-time while simulation is running.
 * - `memo` + per-node selectors keeps updates scoped: each node re-renders only
 *   when its own output/state entry changes.
 */
export const CustomBlockNode = memo(function CustomBlockNode({
  id,
  data,
  type,
  selected,
}: NodeProps<BlockNodeData>) {
  const internalState = useSimulationRuntimeStore(
    (state) => state.runtime.nodeInternalState[id]
  );
  const [isScopeModalOpen, setIsScopeModalOpen] = useState(false);

  /**
   * Simulink-inspired node skin policy.
   *
   * Visual hierarchy targets:
   * - White body with subtle bevel-like edge contrast for a professional block silhouette.
   * - Slight vertical shadow stack to imply depth without introducing heavy card aesthetics.
   * - Tight, legible spacing/typography so dense diagrams stay readable when zoomed out.
   */
  const baseContainerClass =
    type === SCOPE_BLOCK_TYPE
      ? "min-w-[180px] rounded-lg border border-slate-300 bg-white px-3 py-2.5 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(15,23,42,0.04),0_3px_8px_rgba(15,23,42,0.08)] transition-[border-color,box-shadow]"
      : "min-w-[220px] rounded-lg border border-slate-300 bg-white px-3 py-2.5 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(15,23,42,0.04),0_3px_8px_rgba(15,23,42,0.08)] transition-[border-color,box-shadow]";
  const selectedClass = selected
    ? "border-blue-500 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_1px_rgba(59,130,246,0.24),0_6px_14px_rgba(37,99,235,0.2)]"
    : "border-slate-300";

  return (
    <>
      <div className={`${baseContainerClass} ${selectedClass}`}>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          {data.label ?? type ?? "Block"}
        </p>

        {type === COUNTER_BLOCK_TYPE ? (
          <div className="rounded-md border border-slate-200 bg-slate-50/80 p-2.5">
            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Counter</p>
            <p className="mt-1.5 text-xs font-medium leading-none text-slate-600">
              Background source (value hidden)
            </p>
          </div>
        ) : null}

        {type === DISPLAY_BLOCK_TYPE ? (
          <DisplayBlockView state={internalState} className="border-slate-200 bg-slate-50/80" />
        ) : null}

        {type === SCOPE_BLOCK_TYPE ? (
          <div onDoubleClick={() => setIsScopeModalOpen(true)} className="cursor-zoom-in">
            <ScopeBlockView state={internalState} className="border-slate-200 bg-slate-50/80" />
          </div>
        ) : null}

        {/* Counter is source-only for P0 model, Display/Scope are sink-only. */}
        {type === COUNTER_BLOCK_TYPE ? (
          <Handle type="source" id="default" position={Position.Right} />
        ) : null}

        {type === DISPLAY_BLOCK_TYPE || type === SCOPE_BLOCK_TYPE ? (
          <Handle type="target" id="default" position={Position.Left} />
        ) : null}
      </div>

      {type === SCOPE_BLOCK_TYPE ? (
        <ScopeModal
          open={isScopeModalOpen}
          onClose={() => setIsScopeModalOpen(false)}
          state={internalState}
        />
      ) : null}
    </>
  );
});
