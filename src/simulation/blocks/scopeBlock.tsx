"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * Scope block (P0-4 visualization sink).
 *
 * Runtime behavior:
 * - Reads one numeric input (`default` preferred, `in` accepted).
 * - Appends `{ timeMs, value }` samples into node-local state.
 * - Maintains a strict sliding window (`maxPoints`) to cap memory/render cost.
 *
 * Scalability rationale (important for small step sizes):
 * - Without windowing, sample count grows linearly with runtime and causes
 *   unbounded memory usage + chart diff cost per render.
 * - We instead retain only the most recent N points. This bounds both:
 *   1) memory: O(maxPoints)
 *   2) render/update work: O(maxPoints)
 * - For P0, this deterministic truncation is sufficient and reproducible.
 * - Future optimization path: chunked/ring buffers to reduce array copy cost.
 */
export const SCOPE_BLOCK_TYPE = "scope" as const;

const DEFAULT_SCOPE_MAX_POINTS = 300;
const MAX_SCOPE_POINTS_HARD_CAP = 5_000;

export interface ScopeSample {
  timeMs: number;
  value: number;
}

export interface ScopeBlockState {
  samples: ScopeSample[];
  lastUpdatedTick: number;
  maxPoints: number;
}

function sanitizeMaxPoints(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return DEFAULT_SCOPE_MAX_POINTS;
  }

  const integer = Math.floor(raw);
  if (integer <= 0) {
    return DEFAULT_SCOPE_MAX_POINTS;
  }

  return Math.min(integer, MAX_SCOPE_POINTS_HARD_CAP);
}

function toScopeState(previousState: unknown, maxPoints: number): ScopeBlockState {
  if (
    typeof previousState === "object" &&
    previousState !== null &&
    "samples" in previousState &&
    "lastUpdatedTick" in previousState
  ) {
    const candidate = previousState as {
      samples?: unknown;
      lastUpdatedTick?: unknown;
      maxPoints?: unknown;
    };

    const rawSamples = Array.isArray(candidate.samples) ? candidate.samples : [];
    const samples = rawSamples
      .map((entry) => {
        if (typeof entry !== "object" || entry === null) {
          return null;
        }
        const sample = entry as { timeMs?: unknown; value?: unknown };
        if (
          typeof sample.timeMs !== "number" ||
          !Number.isFinite(sample.timeMs) ||
          typeof sample.value !== "number" ||
          !Number.isFinite(sample.value)
        ) {
          return null;
        }
        return { timeMs: sample.timeMs, value: sample.value } satisfies ScopeSample;
      })
      .filter((entry): entry is ScopeSample => entry !== null);

    const resolvedMaxPoints = sanitizeMaxPoints(candidate.maxPoints ?? maxPoints);

    return {
      samples: samples.slice(-resolvedMaxPoints),
      lastUpdatedTick:
        typeof candidate.lastUpdatedTick === "number" &&
        Number.isFinite(candidate.lastUpdatedTick)
          ? candidate.lastUpdatedTick
          : -1,
      maxPoints: resolvedMaxPoints,
    };
  }

  return {
    samples: [],
    lastUpdatedTick: -1,
    maxPoints,
  };
}

function readInputValue(inputs: Record<string, number | null>): number | null {
  const direct = inputs.default ?? inputs.in ?? null;
  return typeof direct === "number" && Number.isFinite(direct) ? direct : null;
}

export const ScopeBlock: SimulationBlockDefinition = {
  type: SCOPE_BLOCK_TYPE,
  initialize: (params) => ({
    samples: [],
    lastUpdatedTick: -1,
    maxPoints: sanitizeMaxPoints(params.maxPoints),
  } satisfies ScopeBlockState),
  step: ({ tick, timeMs, params, previousState, inputs }) => {
    const maxPoints = sanitizeMaxPoints(params.maxPoints);
    const state = toScopeState(previousState, maxPoints);
    const inputValue = readInputValue(inputs);

    if (inputValue === null) {
      return {
        outputs: {},
        nextState: {
          ...state,
          maxPoints,
        } satisfies ScopeBlockState,
      };
    }

    const appended: ScopeSample[] = [...state.samples, { timeMs, value: inputValue }];
    const windowed =
      appended.length > maxPoints ? appended.slice(-maxPoints) : appended;

    return {
      outputs: {},
      nextState: {
        samples: windowed,
        lastUpdatedTick: tick,
        maxPoints,
      } satisfies ScopeBlockState,
    };
  },
};

interface ScopeBlockViewProps {
  state: unknown;
  className?: string;
  height?: number;
}

/**
 * UI renderer for Scope block samples.
 */
export function ScopeBlockView({
  state,
  className,
  height = 180,
}: ScopeBlockViewProps) {
  const parsed = toScopeState(state, DEFAULT_SCOPE_MAX_POINTS);

  return (
    <div
      className={
        className ??
        "rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
      }
    >
      <p className="text-xs uppercase tracking-wide text-slate-500">Scope</p>
      <div className="mt-3" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={parsed.samples}>
            <XAxis dataKey="timeMs" tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis tickLine={false} axisLine={false} width={40} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#2563eb"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Window: last {parsed.maxPoints} points ({parsed.samples.length} loaded)
      </p>
    </div>
  );
}
