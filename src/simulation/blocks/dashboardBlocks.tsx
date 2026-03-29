"use client";

import { SignalValue, SimulationBlockDefinition } from "@/src/simulation/types";

// --- GAUGE BLOCK ---
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
    return { outputs: {}, nextState: { value } };
  },
};

// --- LAMP BLOCK ---
export const LAMP_BLOCK_TYPE = "lamp" as const;

export interface LampBlockState {
  active: boolean;
}

function toLampState(previousState: unknown): LampBlockState {
  if (typeof previousState === "object" && previousState !== null && "active" in previousState) {
    return previousState as LampBlockState;
  }
  return { active: false };
}

export const LampBlock: SimulationBlockDefinition = {
  type: LAMP_BLOCK_TYPE,
  inputPortTypes: { in: "any", default: "any" },
  outputPortTypes: {},
  initialize: () => ({ active: false }),
  step: ({ params, inputs }) => {
    const raw = inputs.in ?? inputs.default ?? null;
    const threshold = typeof params.threshold === "number" ? params.threshold : 0.5;
    
    let active = false;
    if (typeof raw === "boolean") {
      active = raw;
    } else if (typeof raw === "number") {
      active = raw >= threshold;
    }

    return { outputs: {}, nextState: { active } };
  },
};

// --- VIEW COMPONENTS ---

export function GaugeBlockView({ state, params, className }: { state: unknown; params: any; className?: string }) {
  const { value } = toGaugeState(state);
  const min = typeof params.min === "number" ? params.min : 0;
  const max = typeof params.max === "number" ? params.max : 100;
  
  const percentage = value === null ? 0 : Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  return (
    <div className={className ?? "rounded-lg border border-slate-200 bg-white p-3 shadow-sm"}>
      <p className="text-[10px] uppercase font-bold text-slate-400 mb-2">Gauge</p>
      <div className="relative h-4 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
        <div 
          className="absolute left-0 top-0 h-full bg-sky-500 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[9px] font-mono text-slate-400">
        <span>{min}</span>
        <span className="text-slate-700 font-bold">{value?.toFixed(1) ?? "—"}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export function LampBlockView({ state, className }: { state: unknown; className?: string }) {
  const { active } = toLampState(state);

  return (
    <div className={className ?? "rounded-lg border border-slate-200 bg-white p-3 shadow-sm flex items-center gap-3"}>
      <div 
        className={`h-6 w-6 rounded-full border-2 transition-colors duration-200 ${
          active ? "bg-emerald-400 border-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.6)]" : "bg-slate-200 border-slate-300"
        }`}
      />
      <div>
        <p className="text-[10px] uppercase font-bold text-slate-400">Indicator</p>
        <p className="text-[10px] font-bold text-slate-600">{active ? "HIGH / ON" : "LOW / OFF"}</p>
      </div>
    </div>
  );
}
