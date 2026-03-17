"use client";

import { memo } from "react";
import { Handle, NodeProps, Position } from "reactflow";

import {
  DisplayBlockView,
  DISPLAY_BLOCK_TYPE,
} from "@/src/simulation/blocks/displayBlock";
import { ScopeBlockView, SCOPE_BLOCK_TYPE } from "@/src/simulation/blocks/scopeBlock";
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
 * Resolve a robust scalar value from runtime snapshots for Counter display.
 *
 * Why both output + internal state are checked:
 * - Counter emits the *current* value to output and stores the *next* state.
 * - During fast ticking, showing only one source can look "off by one" depending
 *   on when React renders relative to the scheduler tick.
 * - We prefer output (what downstream blocks consume), then fall back to internal state.
 */
function resolveCounterValue(params: {
  outputValue: unknown;
  internalState: unknown;
}): number | null {
  const { outputValue, internalState } = params;

  if (typeof outputValue === "number" && Number.isFinite(outputValue)) {
    return outputValue;
  }

  if (typeof internalState === "number" && Number.isFinite(internalState)) {
    return internalState;
  }

  return null;
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
  const outputValue = useSimulationRuntimeStore(
    (state) => state.runtime.nodeOutputs[id]?.default ?? null
  );
  const internalState = useSimulationRuntimeStore(
    (state) => state.runtime.nodeInternalState[id]
  );

  const baseContainerClass =
    "min-w-[220px] rounded-xl border bg-white p-3 shadow-sm transition-colors";
  const selectedClass = selected
    ? "border-blue-400 shadow-blue-100"
    : "border-slate-300";

  return (
    <div className={`${baseContainerClass} ${selectedClass}`}>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {data.label ?? type ?? "Block"}
      </p>

      {type === COUNTER_BLOCK_TYPE ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Counter</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
            {resolveCounterValue({ outputValue, internalState }) ?? "—"}
          </p>
        </div>
      ) : null}

      {type === DISPLAY_BLOCK_TYPE ? (
        <DisplayBlockView state={internalState} className="border-slate-200 bg-slate-50" />
      ) : null}

      {type === SCOPE_BLOCK_TYPE ? (
        <ScopeBlockView
          state={internalState}
          className="border-slate-200 bg-slate-50"
          height={140}
        />
      ) : null}

      {/* Counter is source-only for P0 model, Display/Scope are sink-only. */}
      {type === COUNTER_BLOCK_TYPE ? (
        <Handle type="source" id="default" position={Position.Right} />
      ) : null}

      {type === DISPLAY_BLOCK_TYPE || type === SCOPE_BLOCK_TYPE ? (
        <Handle type="target" id="default" position={Position.Left} />
      ) : null}
    </div>
  );
});
