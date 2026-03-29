import { create } from "zustand";

import { createInitialSnapshot, stepSimulation } from "@/src/simulation/engine";
import {
  formatGraphValidationIssues,
  validateSimulationGraph,
} from "@/src/simulation/validation";
import { DEFAULT_BLOCK_REGISTRY } from "@/src/simulation/registry";
import {
  BlockRegistry,
  SimulationGraph,
  SimulationRuntimeSnapshot,
  SimulationStatus,
} from "@/src/simulation/types";

/**
 * P11-3: Execution modes
 * - fast: Execute ticks as fast as the host allows (default)
 * - real-time: Sync simulation time with real-world wall clock
 */
export type ExecutionMode = "fast" | "real-time";

/**
 * Zustand runtime store for scheduler + simulation snapshot.
 */
export interface RuntimePerformanceMetrics {
  stepsExecuted: number;
  lastStepDurationMs: number;
  averageStepDurationMs: number;
  peakStepDurationMs: number;
  estimatedStepRateHz: number;
}

export interface RuntimeTraceEvent {
  tick: number;
  timeMs: number;
  durationMs: number;
  status: SimulationStatus;
  note: string;
}

export interface SimulationRuntimeStore {
  graph: SimulationGraph;
  registry: BlockRegistry;
  runtime: SimulationRuntimeSnapshot;
  metrics: RuntimePerformanceMetrics;
  trace: RuntimeTraceEvent[];
  executionMode: ExecutionMode;
  setGraph: (graph: SimulationGraph) => void;
  setRegistry: (registry: BlockRegistry) => void;
  setTiming: (params: { simulationTimeMs?: number; stepTimeMs?: number }) => void;
  setExecutionMode: (mode: ExecutionMode) => void;
  run: () => void;
  pause: () => void;
  reset: () => void;
  complete: () => void;
  stepOnce: () => void;
  clearTrace: () => void;
}

const DEFAULT_RUNTIME = createInitialSnapshot({
  simulationTimeMs: 10_000,
  stepTimeMs: 100,
});

const EMPTY_GRAPH: SimulationGraph = {
  nodes: [],
  edges: [],
};

const DEFAULT_METRICS: RuntimePerformanceMetrics = {
  stepsExecuted: 0,
  lastStepDurationMs: 0,
  averageStepDurationMs: 0,
  peakStepDurationMs: 0,
  estimatedStepRateHz: 0,
};

const MAX_TRACE_EVENTS = 120;

function appendTrace(
  trace: RuntimeTraceEvent[],
  event: RuntimeTraceEvent
): RuntimeTraceEvent[] {
  return [event, ...trace].slice(0, MAX_TRACE_EVENTS);
}

let timerId: ReturnType<typeof setTimeout> | null = null;

export const useSimulationRuntimeStore = create<SimulationRuntimeStore>(
  (set, get) => ({
    graph: EMPTY_GRAPH,
    registry: DEFAULT_BLOCK_REGISTRY,
    runtime: DEFAULT_RUNTIME,
    metrics: DEFAULT_METRICS,
    trace: [],
    executionMode: "fast",

    setGraph: (graph) => {
      set({ graph });
    },

    setRegistry: (registry) => {
      set({ registry });
    },

    setTiming: ({ simulationTimeMs, stepTimeMs }) => {
      const current = get().runtime;
      const wasRunning = current.status === "running";

      clearScheduler();
      const next = createInitialSnapshot({
        simulationTimeMs: simulationTimeMs ?? current.simulationTimeMs,
        stepTimeMs: stepTimeMs ?? current.stepTimeMs,
      });

      set({
        runtime: {
          ...next,
          status: wasRunning ? "running" : next.status,
        },
        metrics: DEFAULT_METRICS,
        trace: [],
      });

      if (wasRunning) {
        scheduleNextTick();
      }
    },

    setExecutionMode: (executionMode) => {
      const wasRunning = get().runtime.status === "running";
      if (wasRunning) clearScheduler();
      
      set({ executionMode });
      
      if (wasRunning) scheduleNextTick();
    },

    stepOnce: () => {
      const { graph, registry, runtime, metrics, trace } = get();
      const startedAt = performance.now();
      try {
        const next = stepSimulation({ graph, registry, snapshot: runtime });
        const durationMs = Math.max(0, performance.now() - startedAt);
        const nextSteps = metrics.stepsExecuted + 1;
        const nextAverage =
          nextSteps === 1
            ? durationMs
            : (metrics.averageStepDurationMs * metrics.stepsExecuted + durationMs) /
              nextSteps;

        set({
          runtime: next,
          metrics: {
            stepsExecuted: nextSteps,
            lastStepDurationMs: durationMs,
            averageStepDurationMs: nextAverage,
            peakStepDurationMs: Math.max(metrics.peakStepDurationMs, durationMs),
            estimatedStepRateHz: durationMs > 0 ? 1000 / durationMs : 0,
          },
          trace: appendTrace(trace, {
            tick: next.tick,
            timeMs: next.timeMs,
            durationMs,
            status: next.status,
            note: next.status === "completed" ? "step-complete" : "step",
          }),
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown simulation error.";
        set({
          runtime: {
            ...runtime,
            status: "paused",
            error: message,
          },
          trace: appendTrace(trace, {
            tick: runtime.tick,
            timeMs: runtime.timeMs,
            durationMs: Math.max(0, performance.now() - startedAt),
            status: "paused",
            note: `error: ${message}`,
          }),
        });
      }
    },

    run: () => {
      const { graph, registry, runtime } = get();
      if (runtime.status === "running" || runtime.status === "completed") {
        return;
      }

      const issues = validateSimulationGraph({
        graph,
        registry,
        baseStepTimeMs: runtime.stepTimeMs,
      });
      if (issues.length > 0) {
        set({
          runtime: {
            ...runtime,
            status: "idle",
            error: formatGraphValidationIssues(issues),
          },
        });
        return;
      }

      set({
        runtime: {
          ...runtime,
          status: "running",
          error: undefined,
        },
        metrics: runtime.tick === 0 ? DEFAULT_METRICS : get().metrics,
        trace: appendTrace(get().trace, {
          tick: runtime.tick,
          timeMs: runtime.timeMs,
          durationMs: 0,
          status: "running",
          note: "run",
        }),
      });

      scheduleNextTick();
    },

    pause: () => {
      clearScheduler();
      const runtime = get().runtime;
      const paused: SimulationStatus =
        runtime.status === "completed" ? "completed" : "paused";
      set({ runtime: { ...runtime, status: paused } });
    },

    reset: () => {
      clearScheduler();
      const current = get().runtime;
      set({
        runtime: createInitialSnapshot({
          simulationTimeMs: current.simulationTimeMs,
          stepTimeMs: current.stepTimeMs,
        }),
        metrics: DEFAULT_METRICS,
        trace: [],
      });
    },

    complete: () => {
      clearScheduler();
      const runtime = get().runtime;
      set({
        runtime: {
          ...runtime,
          status: "completed",
          timeMs: runtime.simulationTimeMs,
        },
      });
    },

    clearTrace: () => {
      set({ trace: [] });
    },
  })
);

function scheduleNextTick(): void {
  const state = useSimulationRuntimeStore.getState();
  if (state.runtime.status !== "running") {
    return;
  }

  /**
   * Wall-clock synchronization (P11-3).
   * Calculate a dynamic delay to keep simulation time matched with real-world time.
   */
  const wallClockStartedAt = performance.now() - state.runtime.tick * state.runtime.stepTimeMs;

  const tickLoop = () => {
    const current = useSimulationRuntimeStore.getState();
    if (current.runtime.status !== "running") {
      clearScheduler();
      return;
    }

    current.stepOnce();

    const afterStep = useSimulationRuntimeStore.getState();
    if (afterStep.runtime.status === "completed") {
      clearScheduler();
      return;
    }

    // Default: fast mode (minimal delay)
    let delay = 0;

    if (afterStep.executionMode === "real-time") {
      // Real-time: align with wall clock
      const expectedNextAt = wallClockStartedAt + afterStep.runtime.tick * afterStep.runtime.stepTimeMs;
      delay = Math.max(0, expectedNextAt - performance.now());
    }

    timerId = setTimeout(tickLoop, delay);
  };

  timerId = setTimeout(tickLoop, 0);
}

function clearScheduler(): void {
  if (timerId) {
    clearTimeout(timerId);
    timerId = null;
  }
}
