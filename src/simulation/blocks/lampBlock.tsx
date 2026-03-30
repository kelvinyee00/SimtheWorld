"use client";

import { SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * Lamp block (P11-1 dashboard sink).
 * 
 * Changes color based on a boolean or numeric input.
 */
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
  step: ({ inputs }) => {
    const raw = inputs.in ?? inputs.default ?? null;
    let active = false;
    if (typeof raw === "boolean") active = raw;
    else if (typeof raw === "number") active = raw > 0;
    
    return {
      outputs: {},
      nextState: { active } satisfies LampBlockState,
    };
  },
};

interface LampBlockViewProps {
  state: unknown;
  params: Record<string, unknown>;
  className?: string;
}

export function LampBlockView({ state, params, className }: LampBlockViewProps) {
  const { active } = toLampState(state);
  const colorTrue = typeof params.colorTrue === "string" ? params.colorTrue : "#22c55e"; // emerald-500
  const colorFalse = typeof params.colorFalse === "string" ? params.colorFalse : "#ef4444"; // rose-500

  return (
    <div className={className ?? "rounded-md border border-sky-200 bg-sky-50/70 px-3 py-2"}>
      <div className="flex items-center gap-3">
        <div 
          className="h-6 w-6 rounded-full border-2 border-white shadow-sm transition-colors duration-200"
          style={{ backgroundColor: active ? colorTrue : colorFalse }}
        />
        <span className="text-[10px] text-slate-500 uppercase font-bold truncate">
          {String(params.label ?? "Status")}
        </span>
      </div>
    </div>
  );
}
