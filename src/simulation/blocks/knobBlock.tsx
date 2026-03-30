"use client";

import { SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * Knob block (P11-2 interactive source).
 * 
 * Interactive numeric source block. The value is updated via UI interaction
 * and persisted in node-local internal state.
 */
export const KNOB_BLOCK_TYPE = "knob" as const;

export interface KnobBlockState {
  value: number;
}

export const KnobBlock: SimulationBlockDefinition = {
  type: KNOB_BLOCK_TYPE,
  outputPortTypes: { default: "number" },
  initialize: (params) => ({
    value: typeof params.initialValue === "number" ? params.initialValue : 0,
  }),
  step: ({ previousState }) => {
    const state = (previousState as KnobBlockState) ?? { value: 0 };
    return {
      outputs: { default: state.value },
      nextState: state,
    };
  },
};

interface KnobBlockViewProps {
  id: string;
  state: unknown;
  params: Record<string, unknown>;
  onUpdateValue: (value: number) => void;
  className?: string;
}

export function KnobBlockView({ state, params, onUpdateValue, className }: KnobBlockViewProps) {
  const current = (state as KnobBlockState)?.value ?? 0;
  const min = typeof params.min === "number" ? params.min : 0;
  const max = typeof params.max === "number" ? params.max : 100;

  // Simple numeric input for the "knob" in P11-2 scaffold
  return (
    <div className={className ?? "rounded-md border border-orange-200 bg-orange-50/70 px-3 py-2"}>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-slate-500 uppercase font-bold">{String(params.label ?? "Knob")}</span>
        <input 
          type="number" 
          value={current}
          min={min}
          max={max}
          step={(max - min) / 100}
          onChange={(e) => onUpdateValue(Number(e.target.value))}
          className="w-full bg-white border border-orange-300 rounded px-1 py-0.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
        <div className="flex justify-between text-[8px] text-slate-400 font-mono">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    </div>
  );
}
