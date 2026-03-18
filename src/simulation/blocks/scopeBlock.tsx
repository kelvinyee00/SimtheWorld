"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { SimulationBlockDefinition } from "@/src/simulation/types";

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
}

export function ScopeBlockView({ state, className }: ScopeBlockViewProps) {
  const parsed = toScopeState(state, DEFAULT_SCOPE_MAX_POINTS);
  const latestValue = parsed.samples.at(-1)?.value ?? null;

  return (
    <div
      className={
        className ??
        "rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2"
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md border border-blue-200 bg-blue-50 text-blue-600">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
              <path
                d="M3 12h3l2-4 4 8 2-4h7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Scope
            </p>
            <p className="text-[11px] text-slate-500">{parsed.samples.length} samples</p>
          </div>
        </div>
        <p className="text-sm font-semibold tabular-nums text-slate-800">
          {latestValue === null ? "—" : latestValue.toFixed(3)}
        </p>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">Double-click to expand</p>
    </div>
  );
}

interface ScopeModalProps {
  open: boolean;
  onClose: () => void;
  state: unknown;
}

export function ScopeModal({ open, onClose, state }: ScopeModalProps) {
  const parsed = toScopeState(state, DEFAULT_SCOPE_MAX_POINTS);
  const [brushRange, setBrushRange] = useState<{ startIndex: number; endIndex: number } | null>(
    null
  );
  const [cursorSample, setCursorSample] = useState<ScopeSample | null>(null);

  const latestIndex = Math.max(0, parsed.samples.length - 1);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const defaultRange = { startIndex: Math.max(0, latestIndex - 120), endIndex: latestIndex };
  const activeRange = brushRange ?? defaultRange;
  const measuredCursorSample = cursorSample ?? parsed.samples.at(-1) ?? null;

  const visibleSamples = useMemo(
    () => parsed.samples.slice(activeRange.startIndex, activeRange.endIndex + 1),
    [activeRange.endIndex, activeRange.startIndex, parsed.samples]
  );

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 px-3 py-4 sm:px-6 sm:py-8" onClick={onClose}>
      <div
        className="mx-auto flex h-full w-full max-w-5xl flex-col rounded-xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-800 sm:text-base">Scope (Interactive)</h2>
            <p className="text-xs text-slate-500">
              Cursor: t={measuredCursorSample?.timeMs.toFixed(1) ?? "—"} ms, y={measuredCursorSample?.value.toFixed(4) ?? "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-3 py-3 sm:px-5 sm:py-4">
          {/*
            Interactivity logic notes (high-density):
            1) Crosshair/cursor behavior is delegated to Recharts Tooltip + cursor rendering.
               We still track cursor data ourselves via onMouseMove to expose deterministic
               measurement text in the modal header (time/value), independent of tooltip skin.
            2) We keep brush as the zoom strategy because it is robust on both mouse + touch.
               The brush range is controlled state (start/end indexes), so resets and updates
               remain predictable even when samples append while simulation runs.
            3) We derive visibleSamples from the active index window, then show window metadata
               to make zoom context explicit (helpful for debugging sample density / aliasing).
          */}
          <div className="min-h-[260px] flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={parsed.samples}
                margin={{ top: 10, right: 16, left: 0, bottom: 10 }}
                onMouseMove={(event: unknown) => {
                  const candidate =
                    typeof event === "object" && event !== null && "activeTooltipIndex" in event
                      ? (event as { activeTooltipIndex?: unknown }).activeTooltipIndex
                      : undefined;

                  if (typeof candidate === "number" && Number.isFinite(candidate)) {
                    const next = parsed.samples[candidate];
                    if (next) {
                      setCursorSample(next);
                    }
                  }
                }}
              >
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="timeMs" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} width={48} />
                <Tooltip cursor={{ stroke: "#0f172a", strokeWidth: 1 }} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Brush
                  dataKey="timeMs"
                  height={26}
                  stroke="#2563eb"
                  onChange={(range) => {
                    if (!range) {
                      return;
                    }
                    const safeStart = typeof range.startIndex === "number" ? range.startIndex : 0;
                    const safeEnd =
                      typeof range.endIndex === "number" ? range.endIndex : latestIndex;
                    setBrushRange({
                      startIndex: Math.max(0, Math.min(safeStart, latestIndex)),
                      endIndex: Math.max(0, Math.min(safeEnd, latestIndex)),
                    });
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <p>
              Visible window: {visibleSamples.length} points (idx {activeRange.startIndex} → {activeRange.endIndex})
            </p>
            <button
              type="button"
              onClick={() => setBrushRange(defaultRange)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Reset zoom
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
