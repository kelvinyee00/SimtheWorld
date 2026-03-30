"use client";

import { SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * Slider block (P11-2 interactive source).
 * 
 * Interactive numeric source block. The value is updated via UI interaction
 * and persisted in node-local internal state.
 */
export const SLIDER_BLOCK_TYPE = "slider" as const;

export interface SliderBlockState {
  value: number;
}

export const SliderBlock: SimulationBlockDefinition = {
  type: SLIDER_BLOCK_TYPE,
  outputPortTypes: { default: "number" },
  initialize: (params) => ({
    value: typeof params.initialValue === "number" ? params.initialValue : 0,
  }),
  step: ({ previousState }) => {
    const state = (previousState as SliderBlockState) ?? { value: 0 };
    return {
      outputs: { default: state.value },
      nextState: state,
    };
  },
};

interface SliderBlockViewProps {
  id: string;
  state: unknown;
  params: Record<string, unknown>;
  onUpdateValue: (value: number) => void;
  className?: string;
}

export function SliderBlockView({ state, params, onUpdateValue, className }: SliderBlockViewProps) {
  const current = (state as SliderBlockState)?.value ?? 0;
  const min = typeof params.min === "number" ? params.min : 0;
  const max = typeof params.max === "number" ? params.max : 100;

  return (
    <div className={className ?? "rounded-md border border-orange-200 bg-orange-50/70 px-3 py-2"}>
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-slate-500 uppercase font-bold">{String(params.label ?? "Slider")}</span>
          <span className="text-xs font-mono font-semibold text-orange-700">{current.toFixed(1)}</span>
        </div>
        <input 
          type="range" 
          value={current}
          min={min}
          max={max}
          step={(max - min) / 100}
          onChange={(e) => onUpdateValue(Number(e.target.value))}
          className="w-full h-1.5 bg-orange-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
        />
        <div className="flex justify-between text-[8px] text-slate-400 font-mono">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    </div>
  );
}
