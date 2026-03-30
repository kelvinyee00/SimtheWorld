"use client";

import { SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * Gauge block (P11-1 dashboard sink).
 * 
 * Visualizes a numeric input within a defined range [min, max].
 */
export const GAUGE_BLOCK_TYPE = "gauge" as const;

export interface GaugeBlockState {
  value: number | null;
}

function toGaugeState(previousState: unknown): GaugeBlockState {
  if (typeof previousState === "object" && previousState !== null && "value" in previousState) {
    const candidate = previousState as { value?: unknown };
    return {
      value: typeof candidate.value === "number" && Number.isFinite(candidate.value) ? candidate.value : null,
    };
  }
  return { value: null };
}

export const GaugeBlock: SimulationBlockDefinition = {
  type: GAUGE_BLOCK_TYPE,
  inputPortTypes: { in: "number", default: "number" },
  outputPortTypes: {},
  initialize: () => ({ value: null }),
  step: ({ inputs }) => {
    const raw = inputs.in ?? inputs.default ?? null;
    const value = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
    return {
      outputs: {},
      nextState: { value } satisfies GaugeBlockState,
    };
  },
};

interface GaugeBlockViewProps {
  state: unknown;
  params: Record<string, unknown>;
  className?: string;
}

export function GaugeBlockView({ state, params, className }: GaugeBlockViewProps) {
  const { value } = toGaugeState(state);
  const min = typeof params.min === "number" ? params.min : 0;
  const max = typeof params.max === "number" ? params.max : 100;
  
  const percentage = value === null ? 0 : Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <div className={className ?? "rounded-md border border-sky-200 bg-sky-50/70 px-3 py-2"}>
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] text-slate-500 uppercase font-bold">{String(params.label ?? "Gauge")}</span>
        <span className="text-xs font-mono font-semibold">{value !== null ? value.toFixed(1) : "—"}</span>
      </div>
      <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-sky-500 transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[8px] text-slate-400 font-mono">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
