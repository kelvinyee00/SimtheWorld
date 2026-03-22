"use client";

import { CSSProperties, memo, useMemo, useState } from "react";
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
import { GAIN_BLOCK_TYPE } from "@/src/simulation/blocks/gainBlock";
import { SUM_BLOCK_TYPE } from "@/src/simulation/blocks/sumBlock";
import { PRODUCT_BLOCK_TYPE } from "@/src/simulation/blocks/productBlock";
import { INTEGRATOR_BLOCK_TYPE } from "@/src/simulation/blocks/integratorBlock";
import { UNIT_DELAY_BLOCK_TYPE } from "@/src/simulation/blocks/unitDelayBlock";
import { COMPARE_BLOCK_TYPE } from "@/src/simulation/blocks/compareBlock";
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
  TO_FILE_BLOCK_TYPE,
  toToFileState,
} from "@/src/simulation/blocks/toFileBlock";
import { useSimulationRuntimeStore } from "@/src/store/simulationRuntimeStore";

/**
 * React Flow node `data` for simulation blocks.
 *
 * Keep this shape intentionally simple and serializable because node `data` is mirrored into
 * the runtime graph store. Avoiding non-serializable fields keeps runtime snapshots deterministic.
 */
interface BlockNodeData {
  label?: string;
  gain?: number;
  initialCondition?: number;
  initialValue?: number;
  operator?: string;
  format?: "json" | "csv";
  fileName?: string;
  kp?: number;
  ki?: number;
  kd?: number;
  n?: number;
  lowerSaturation?: number | null;
  upperSaturation?: number | null;
  numerator?: number[];
  denominator?: number[];
  leadTimeConstantSec?: number;
  lagTimeConstantSec?: number;
  mask?: unknown;
  tag?: string;
  breakpointsX?: number[];
  breakpointsY?: number[];
  tableData?: number[] | number[][];
  states?: unknown[];
  transitions?: unknown[];
}

const SOURCE_ORANGE = "#f97316";
const SINK_BLUE = "#0ea5e9";

/**
 * Connection handle style policy for P2/P3.
 *
 * Product requirement:
 * - Make handle dots significantly larger and easier to latch while wiring.
 *
 * Implementation notes:
 * - The visible dot is enlarged (`22px`) and gets a colored ring to increase affordance.
 * - A transition + hover scale gives immediate user feedback when pointer approaches a latch point.
 * - We keep the shape circular and high-contrast for both light and dark edge strokes.
 */
function buildHandleStyle(color: string): CSSProperties {
  return {
    width: 22,
    height: 22,
    borderRadius: 9999,
    borderWidth: 3,
    borderStyle: "solid",
    borderColor: color,
    backgroundColor: "#ffffff",
    boxShadow:
      color === SOURCE_ORANGE
        ? "0 0 0 7px rgba(249,115,22,0.18)"
        : "0 0 0 7px rgba(14,165,233,0.20)",
  };
}

function withTop(style: CSSProperties, top: string): CSSProperties {
  return {
    ...style,
    top,
  };
}


function sanitizeHandleName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toSubsystemHandleList(params: {
  data: BlockNodeData;
  direction: "input" | "output";
}): string[] {
  const { data, direction } = params;

  const handles = new Set<string>(["default"]);
  const maskRaw =
    typeof (data as Record<string, unknown>).mask === "object" &&
    (data as Record<string, unknown>).mask !== null
      ? ((data as Record<string, unknown>).mask as Record<string, unknown>)
      : null;

  const key = direction === "input" ? "inputs" : "outputs";
  const masked = Array.isArray(maskRaw?.[key]) ? (maskRaw?.[key] as unknown[]) : [];

  masked.forEach((entry, index) => {
    const sanitized = sanitizeHandleName(entry);
    if (sanitized) {
      handles.add(sanitized);
    }
    handles.add(direction === "input" ? `in${index + 1}` : `out${index + 1}`);
  });

  return Array.from(handles);
}


/**
 * Unified renderer for all simulation blocks on the canvas.
 *
 * Why centralized:
 * - Styling, handle policy, and modal launch behavior remain consistent and auditable.
 * - Block visual identity (source orange vs sink blue) can be updated in one place.
 * - Runtime subscriptions stay node-local for efficient incremental rendering.
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

  const isCounter = type === COUNTER_BLOCK_TYPE;
  const isDisplay = type === DISPLAY_BLOCK_TYPE;
  const isScope = type === SCOPE_BLOCK_TYPE;
  const isGain = type === GAIN_BLOCK_TYPE;
  const isSum = type === SUM_BLOCK_TYPE;
  const isProduct = type === PRODUCT_BLOCK_TYPE;
  const isIntegrator = type === INTEGRATOR_BLOCK_TYPE;
  const isUnitDelay = type === UNIT_DELAY_BLOCK_TYPE;
  const isCompare = type === COMPARE_BLOCK_TYPE;
  const isSwitch = type === SWITCH_BLOCK_TYPE;
  const isToFile = type === TO_FILE_BLOCK_TYPE;
  const isSubsystem = type === SUBSYSTEM_BLOCK_TYPE;
  const isInport = type === INPORT_BLOCK_TYPE;
  const isOutport = type === OUTPORT_BLOCK_TYPE;
  const isMux = type === MUX_BLOCK_TYPE;
  const isDemux = type === DEMUX_BLOCK_TYPE;
  const isPid = type === PID_BLOCK_TYPE;
  const isDiscreteTransfer = type === DISCRETE_TRANSFER_FCN_BLOCK_TYPE;
  const isLeadLag = type === LEAD_LAG_BLOCK_TYPE;
  const isGoto = type === GOTO_BLOCK_TYPE;
  const isFrom = type === FROM_BLOCK_TYPE;
  const isLut1D = type === LUT_1D_BLOCK_TYPE;
  const isLut2D = type === LUT_2D_BLOCK_TYPE;
  const isStateMachine = type === STATE_MACHINE_BLOCK_TYPE;
  const isMathNode =
    isGain ||
    isSum ||
    isProduct ||
    isIntegrator ||
    isUnitDelay ||
    isCompare ||
    isSwitch ||
    isSubsystem ||
    isInport ||
    isOutport ||
    isMux ||
    isDemux ||
    isPid ||
    isDiscreteTransfer ||
    isLeadLag ||
    isGoto ||
    isFrom || isLut1D || isLut2D || isStateMachine;
  const isSinkNode = isDisplay || isScope || isToFile;

  const accentColor = isCounter ? SOURCE_ORANGE : SINK_BLUE;
  const handleStyle = useMemo(() => buildHandleStyle(accentColor), [accentColor]);

  const subsystemInputHandles = useMemo(
    () =>
      isSubsystem
        ? toSubsystemHandleList({ data, direction: "input" }).filter(
            (handle) => handle !== "default"
          )
        : [],
    [data, isSubsystem]
  );

  const subsystemOutputHandles = useMemo(
    () =>
      isSubsystem
        ? toSubsystemHandleList({ data, direction: "output" }).filter(
            (handle) => handle !== "default"
          )
        : [],
    [data, isSubsystem]
  );

  const containerClass = isCounter
    ? "group min-h-[82px] w-[88px] rounded-xl border-2 bg-white px-2 py-2 shadow-[0_1px_0_rgba(255,255,255,0.92)_inset,0_0_0_1px_rgba(15,23,42,0.05),0_5px_12px_rgba(15,23,42,0.18)] transition-[border-color,box-shadow]"
    : "group min-w-[220px] rounded-xl border-2 bg-white px-3 py-2.5 shadow-[0_1px_0_rgba(255,255,255,0.92)_inset,0_0_0_1px_rgba(15,23,42,0.05),0_5px_12px_rgba(15,23,42,0.14)] transition-[border-color,box-shadow]";

  const borderColorClass = isCounter ? "border-orange-500" : "border-sky-500";

  const selectedClass = selected
    ? isCounter
      ? "shadow-[0_1px_0_rgba(255,255,255,0.92)_inset,0_0_0_2px_rgba(249,115,22,0.35),0_8px_18px_rgba(194,65,12,0.24)]"
      : "shadow-[0_1px_0_rgba(255,255,255,0.92)_inset,0_0_0_2px_rgba(14,165,233,0.32),0_8px_18px_rgba(2,132,199,0.22)]"
    : "";

  const symbol = isGain
    ? "×"
    : isSum
      ? "Σ"
      : isProduct
        ? "Π"
        : isIntegrator
          ? "∫"
          : isUnitDelay
            ? "z⁻¹"
            : isCompare
              ? "≷"
              : isSwitch
                ? "⇆"
                : isSubsystem
                  ? "📦"
                  : isInport
                    ? "⇥"
                    : isOutport
                      ? "↦"
                      : isMux
                        ? "⫴"
                        : isDemux
                          ? "⫶"
                          : isPid
                            ? "PID"
                            : isDiscreteTransfer
                              ? "H(z)"
                              : isLeadLag
                                ? "L/L"
                                : "";
  const gainValue =
    typeof data.gain === "number" && Number.isFinite(data.gain) ? data.gain : 1;

  return (
    <>
      <div className={`${containerClass} ${borderColorClass} ${selectedClass}`}>
        {isCounter ? (
          <div className="grid h-full place-items-center rounded-md border border-orange-300 bg-orange-50">
            {/*
              Counter iconography requirement (P2):
              - compact source block shape
              - icon-only presentation (no subtext)
            */}
            <span className="text-xl font-black leading-none text-orange-600">123</span>
          </div>
        ) : null}

        {(isDisplay || isScope || isMathNode || isToFile) && (
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-600">
            {data.label ?? type ?? "Block"}
          </p>
        )}

        {isDisplay ? (
          <DisplayBlockView state={internalState} className="border-sky-200 bg-sky-50/70" />
        ) : null}

        {isScope ? (
          <div onDoubleClick={() => setIsScopeModalOpen(true)} className="cursor-zoom-in">
            <ScopeBlockView state={internalState} className="border-sky-200 bg-sky-50/70" />
          </div>
        ) : null}

        {isToFile ? (
          <div className="rounded-md border border-sky-200 bg-sky-50/70 px-3 py-2">
            <div className="flex items-center justify-between">
              <p className="text-xl font-black leading-none text-sky-700">⤓</p>
              <p className="text-[11px] text-slate-500 uppercase tracking-[0.08em]">
                {String(data.format ?? "json")}
              </p>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {toToFileState(internalState, data as Record<string, unknown>).samples.length} samples
            </p>
          </div>
        ) : null}

        {isMathNode ? (
          <div className="rounded-md border border-sky-200 bg-sky-50/70 px-3 py-2">
            <div className="flex items-center justify-between">
              <p className="text-2xl font-black leading-none text-sky-700">{symbol}</p>
              {isGain ? (
                <p className="text-sm font-semibold tabular-nums text-slate-700">k={gainValue}</p>
              ) : isIntegrator ? (
                <p className="text-[11px] text-slate-500">
                  x₀={
                    typeof data.initialCondition === "number" && Number.isFinite(data.initialCondition)
                      ? data.initialCondition
                      : 0
                  }
                </p>
              ) : isUnitDelay ? (
                <p className="text-[11px] text-slate-500">
                  y₀={
                    typeof data.initialValue === "number" && Number.isFinite(data.initialValue)
                      ? data.initialValue
                      : 0
                  }
                </p>
              ) : isCompare ? (
                <p className="text-[11px] text-slate-500">{String(data.operator ?? "gt")}</p>
              ) : isSwitch ? (
                <p className="text-[11px] text-slate-500">bool cond</p>
              ) : isPid ? (
                <p className="text-[11px] text-slate-500">
                  Kp={typeof data.kp === "number" && Number.isFinite(data.kp) ? data.kp : 1}
                </p>
              ) : isDiscreteTransfer ? (
                <p className="text-[11px] text-slate-500">
                  num/den
                </p>
              ) : isLeadLag ? (
                <p className="text-[11px] text-slate-500">
                  Tz/Tp
                </p>
              ) : isLut1D || isLut2D ? (
                <p className="text-[11px] text-slate-500">LUT</p>
              ) : isGoto || isFrom ? (
                <p className="text-[11px] text-slate-500">tag={String(data.tag ?? "signal")}</p>
              ) : isStateMachine ? (
                <p className="text-[11px] text-slate-500">states={Array.isArray(data.states) ? data.states.length : 0} / tx={Array.isArray(data.transitions) ? data.transitions.length : 0}</p>
              ) : isSubsystem ? (
                <p className="text-[11px] text-slate-500 italic">I/O: {subsystemInputHandles.length}/{subsystemOutputHandles.length}</p>
              ) : (
                <p className="text-[11px] text-slate-500">multi-input</p>
              )}
            </div>
          </div>
        ) : null}

        {(isCounter || isMathNode || isInport || isMux || isStateMachine) ? (
          <Handle
            type="source"
            id="default"
            position={Position.Right}
            style={isStateMachine ? withTop(handleStyle, "68%") : handleStyle}
            className="transition-transform duration-150 hover:scale-125 group-hover:scale-110"
          />
        ) : null}

        {isStateMachine ? (
          <Handle
            type="source"
            id="state"
            position={Position.Right}
            style={withTop(handleStyle, "30%")}
            className="transition-transform duration-150 hover:scale-125 group-hover:scale-110"
          />
        ) : null}

        {(isSinkNode || isGain || isIntegrator || isUnitDelay || isOutport || isDemux || isPid || isDiscreteTransfer || isLeadLag || isGoto || isLut1D || isStateMachine) && (
          <Handle
            type="target"
            id={isGain || isIntegrator || isUnitDelay || isOutport || isDemux || isPid || isDiscreteTransfer || isLeadLag || isGoto || isLut1D || isStateMachine ? "in" : "default"}
            position={Position.Left}
            style={handleStyle}
            className="transition-transform duration-150 hover:scale-125 group-hover:scale-110"
          />
        )}

        {isLut2D && (
          <>
            <Handle
              type="target"
              id="in1"
              position={Position.Left}
              style={withTop(handleStyle, "33%")}
              className="transition-transform duration-150 hover:scale-125 group-hover:scale-110"
            />
            <Handle
              type="target"
              id="in2"
              position={Position.Left}
              style={withTop(handleStyle, "68%")}
              className="transition-transform duration-150 hover:scale-125 group-hover:scale-110"
            />
          </>
        )}
        {(isSum || isProduct || isCompare) && (
          <>
            <Handle
              type="target"
              id="in1"
              position={Position.Left}
              style={withTop(handleStyle, "33%")}
              className="transition-transform duration-150 hover:scale-125 group-hover:scale-110"
            />
            <Handle
              type="target"
              id="in2"
              position={Position.Left}
              style={withTop(handleStyle, "68%")}
              className="transition-transform duration-150 hover:scale-125 group-hover:scale-110"
            />
          </>
        )}

        {isSwitch && (
          <>
            <Handle
              type="target"
              id="cond"
              position={Position.Left}
              style={withTop(handleStyle, "22%")}
              className="transition-transform duration-150 hover:scale-125 group-hover:scale-110"
            />
            <Handle
              type="target"
              id="inTrue"
              position={Position.Left}
              style={withTop(handleStyle, "50%")}
              className="transition-transform duration-150 hover:scale-125 group-hover:scale-110"
            />
            <Handle
              type="target"
              id="inFalse"
              position={Position.Left}
              style={withTop(handleStyle, "78%")}
              className="transition-transform duration-150 hover:scale-125 group-hover:scale-110"
            />
          </>
        )}

        {isMux && (
          <>
            <Handle
              type="target"
              id="in1"
              position={Position.Left}
              style={withTop(handleStyle, "35%")}
              className="transition-transform duration-150 hover:scale-125 group-hover:scale-110"
            />
            <Handle
              type="target"
              id="in2"
              position={Position.Left}
              style={withTop(handleStyle, "70%")}
              className="transition-transform duration-150 hover:scale-125 group-hover:scale-110"
            />
          </>
        )}

        {isDemux && (
          <>
            <Handle
              type="source"
              id="out1"
              position={Position.Right}
              style={withTop(handleStyle, "35%")}
              className="transition-transform duration-150 hover:scale-125 group-hover:scale-110"
            />
            <Handle
              type="source"
              id="out2"
              position={Position.Right}
              style={withTop(handleStyle, "70%")}
              className="transition-transform duration-150 hover:scale-125 group-hover:scale-110"
            />
          </>
        )}

        {isSubsystem &&
          subsystemInputHandles.map((handle, index) => {
            const top = `${((index + 1) / (subsystemInputHandles.length + 1)) * 100}%`;
            return (
              <Handle
                key={`sub-in-${handle}`}
                type="target"
                id={handle}
                position={Position.Left}
                style={withTop(handleStyle, top)}
                className="transition-transform duration-150 hover:scale-125 group-hover:scale-110"
              />
            );
          })}

        {isSubsystem &&
          subsystemOutputHandles.map((handle, index) => {
            const top = `${((index + 1) / (subsystemOutputHandles.length + 1)) * 100}%`;
            return (
              <Handle
                key={`sub-out-${handle}`}
                type="source"
                id={handle}
                position={Position.Right}
                style={withTop(handleStyle, top)}
                className="transition-transform duration-150 hover:scale-125 group-hover:scale-110"
              />
            );
          })}

      {isSubsystem && (
          <Handle
            type="target"
            id="default"
            position={Position.Left}
            style={handleStyle}
            className="transition-transform duration-150 hover:scale-125 group-hover:scale-110"
          />
      )}
      </div>

      {isScope ? (
        <ScopeModal
          open={isScopeModalOpen}
          onClose={() => setIsScopeModalOpen(false)}
          state={internalState}
        />
      ) : null}
    </>
  );
});
