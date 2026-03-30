"use client";

import { memo, useMemo, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getStraightPath,
} from "reactflow";
import { useSimulationRuntimeStore } from "@/src/store/simulationRuntimeStore";

/**
 * P11-4: Probing Edge Component
 * 
 * Extends default straight edges with a hover-sensitive value tooltip.
 * Pulls live signal values from the runtime store based on source node ID and handle.
 */
export const ProbingEdge = memo(function ProbingEdge({
  id,
  source,
  sourceHandleId,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  const [isHovered, setIsHovered] = useState(false);

  // Subscribe to live value from source node output
  const liveValue = useSimulationRuntimeStore((state) => {
    const nodeOutputs = state.runtime.nodeOutputs[source];
    if (!nodeOutputs) return undefined;
    return nodeOutputs[sourceHandleId || "default"];
  });

  const formattedValue = useMemo(() => {
    if (liveValue === undefined || liveValue === null) return "—";
    if (typeof liveValue === "number") {
      return Number.isInteger(liveValue) ? String(liveValue) : liveValue.toFixed(2);
    }
    if (typeof liveValue === "boolean") {
      return liveValue ? "HIGH" : "LOW";
    }
    return String(liveValue);
  }, [liveValue]);

  return (
    <>
      <g 
        onMouseEnter={() => setIsHovered(true)} 
        onMouseLeave={() => setIsHovered(false)}
      >
        <BaseEdge
          id={id}
          path={edgePath}
          style={style}
          markerEnd={markerEnd}
          interactionWidth={42}
        />
      </g>
      {isHovered && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -100%) translate(${labelX}px, ${labelY - 10}px)`,
              pointerEvents: "none",
            }}
            className="z-50 rounded-md border border-slate-200 bg-white px-2 py-1 shadow-md"
          >
            <div className="flex items-center gap-1.5 whitespace-nowrap text-[10px] font-bold">
              <span className="text-slate-400 uppercase tracking-tight">Value:</span>
              <span className={typeof liveValue === 'boolean' ? (liveValue ? 'text-emerald-600' : 'text-rose-600') : 'text-sky-600'}>
                {formattedValue}
              </span>
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
