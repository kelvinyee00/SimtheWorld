"use client";

import { SignalValue, SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * Display block (P0-4 visualization sink).
 *
 * Runtime behavior:
 * - Reads one numeric input (`default` preferred, `in` accepted as fallback).
 * - Persists latest observed value in deterministic node-local state.
 * - Emits no outputs because this is a terminal visualization sink in P0.
 */
export const DISPLAY_BLOCK_TYPE = "display" as const;

export interface DisplayBlockState {
  value: number | null;
  lastUpdatedTick: number;
}

function toDisplayState(previousState: unknown): DisplayBlockState {
  if (
    typeof previousState === "object" &&
    previousState !== null &&
    "value" in previousState &&
    "lastUpdatedTick" in previousState
  ) {
    const candidate = previousState as {
      value?: unknown;
      lastUpdatedTick?: unknown;
    };

    return {
      value:
        typeof candidate.value === "number" && Number.isFinite(candidate.value)
          ? candidate.value
          : null,
      lastUpdatedTick:
        typeof candidate.lastUpdatedTick === "number" &&
        Number.isFinite(candidate.lastUpdatedTick)
          ? candidate.lastUpdatedTick
          : -1,
    };
  }

  return {
    value: null,
    lastUpdatedTick: -1,
  };
}

function readInputValue(inputs: Record<string, SignalValue>): number | null {
  const direct = inputs.default ?? inputs.in ?? null;
  return typeof direct === "number" && Number.isFinite(direct) ? direct : null;
}

export const DisplayBlock: SimulationBlockDefinition = {
  type: DISPLAY_BLOCK_TYPE,
  inputPortTypes: { default: "number", in: "number" },
  outputPortTypes: {},
  initialize: () => ({
    value: null,
    lastUpdatedTick: -1,
  } satisfies DisplayBlockState),
  step: ({ tick, previousState, inputs }) => {
    const nextValue = readInputValue(inputs);
    const resolvedState = toDisplayState(previousState);

    return {
      outputs: {},
      nextState: {
        value: nextValue,
        lastUpdatedTick: nextValue === null ? resolvedState.lastUpdatedTick : tick,
      } satisfies DisplayBlockState,
    };
  },
};

interface DisplayBlockViewProps {
  state: unknown;
  className?: string;
}

/**
 * UI renderer for Display block state.
 *
 * Separated from `step()` so runtime logic remains pure and testable.
 */
export function DisplayBlockView({ state, className }: DisplayBlockViewProps) {
  const parsed = toDisplayState(state);

  return (
    <div
      className={
        className ??
        "rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
      }
    >
      <p className="text-xs uppercase tracking-wide text-slate-500">Display</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
        {parsed.value === null ? "—" : parsed.value}
      </p>
    </div>
  );
}
