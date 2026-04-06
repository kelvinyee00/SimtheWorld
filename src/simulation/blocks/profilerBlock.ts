import { SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * Engine Profiler Block (P13-3).
 *
 * Captures real-time performance metrics during simulation execution.
 * - Tick duration measurement
 * - Memory usage tracking (if available in environment)
 * - Step rate calculation
 */
export const PROFILER_BLOCK_TYPE = "profiler" as const;

export interface ProfilerBlockState {
  tickCount: number;
  lastTickDurationMs: number;
  averageTickDurationMs: number;
  maxTickDurationMs: number;
  totalTimeMs: number;
  startTime: number | null;
}

export const ProfilerBlock: SimulationBlockDefinition = {
  type: PROFILER_BLOCK_TYPE,
  inputPortTypes: { trigger: "any" },
  outputPortTypes: {
    tickCount: "number",
    tickDuration: "number",
    avgTickDuration: "number",
    maxTickDuration: "number",
    stepRate: "number",
  },
  initialize: () => ({
    tickCount: 0,
    lastTickDurationMs: 0,
    averageTickDurationMs: 0,
    maxTickDurationMs: 0,
    totalTimeMs: 0,
    startTime: null,
  }),
  step: ({ inputs, previousState, tick, timeMs }) => {
    const now = performance.now();
    const state = (previousState as ProfilerBlockState) || {
      tickCount: 0,
      lastTickDurationMs: 0,
      averageTickDurationMs: 0,
      maxTickDurationMs: 0,
      totalTimeMs: 0,
      startTime: null,
    };

    // Trigger input starts/resets profiling
    const trigger = inputs.trigger ?? inputs.default ?? null;
    
    if (state.startTime === null) {
      return {
        outputs: {
          tickCount: 0,
          tickDuration: 0,
          avgTickDuration: 0,
          maxTickDuration: 0,
          stepRate: 0,
        },
        nextState: { ...state, startTime: now },
      };
    }

    const tickDuration = now - state.startTime;
    const newTickCount = state.tickCount + 1;
    const newTotalTime = state.totalTimeMs + tickDuration;
    const avgTickDuration = newTotalTime / newTickCount;
    const maxTickDuration = Math.max(state.maxTickDurationMs, tickDuration);
    const stepRate = tickDuration > 0 ? 1000 / tickDuration : 0;

    return {
      outputs: {
        tickCount: newTickCount,
        tickDuration,
        avgTickDuration,
        maxTickDuration,
        stepRate,
      },
      nextState: {
        tickCount: newTickCount,
        lastTickDurationMs: tickDuration,
        averageTickDurationMs: avgTickDuration,
        maxTickDurationMs: maxTickDuration,
        totalTimeMs: newTotalTime,
        startTime: trigger !== null ? now : null, // Reset if trigger received
      },
    };
  },
};
