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
 * Zustand runtime store for scheduler + simulation snapshot.
 *
 * Critical design intent:
 * - Keep all mutating control APIs (`run`, `pause`, `reset`) centralized in one store.
 * - Keep stepping deterministic by delegating state transitions to pure engine functions.
 * - Keep scheduler handle outside serializable state (closure variable) to avoid accidental
 *   persistence/leaks when future model-save features serialize store slices.
 *
 * Iteration-2 scalability path:
 * - Add derived selectors and partial subscriptions for high-frequency charts.
 * - Move scheduler execution to Web Worker while preserving the same action contract.
 */
export interface SimulationRuntimeStore {
  graph: SimulationGraph;
  registry: BlockRegistry;
  runtime: SimulationRuntimeSnapshot;
  setGraph: (graph: SimulationGraph) => void;
  setRegistry: (registry: BlockRegistry) => void;
  setTiming: (params: { simulationTimeMs?: number; stepTimeMs?: number }) => void;
  run: () => void;
  pause: () => void;
  reset: () => void;
  complete: () => void;
  stepOnce: () => void;
}

const DEFAULT_RUNTIME = createInitialSnapshot({
  simulationTimeMs: 10_000,
  stepTimeMs: 100,
});

const EMPTY_GRAPH: SimulationGraph = {
  nodes: [],
  edges: [],
};

let timerId: ReturnType<typeof setTimeout> | null = null;

export const useSimulationRuntimeStore = create<SimulationRuntimeStore>(
  (set, get) => ({
    graph: EMPTY_GRAPH,
    registry: DEFAULT_BLOCK_REGISTRY,
    runtime: DEFAULT_RUNTIME,

    setGraph: (graph) => {
      set({ graph });
    },

    setRegistry: (registry) => {
      set({ registry });
    },

    setTiming: ({ simulationTimeMs, stepTimeMs }) => {
      const current = get().runtime;
      const wasRunning = current.status === "running";

      /**
       * Timing update policy (critical runtime-control seam):
       * - Any Stop Time / Ts edit re-materializes a fresh snapshot via createInitialSnapshot
       *   so timing constraints are validated in one canonical place.
       * - We intentionally preserve graph + registry and only reset runtime tick/time, matching
       *   desktop simulation tooling expectations after model-wide timing changes.
       * - If the model was actively running, we restart the scheduler immediately so Ts edits
       *   take effect without requiring an extra Run click.
       */
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
      });

      if (wasRunning) {
        scheduleNextTick();
      }
    },

    stepOnce: () => {
      const { graph, registry, runtime } = get();
      try {
        const next = stepSimulation({ graph, registry, snapshot: runtime });
        set({ runtime: next });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown simulation error.";
        set({
          runtime: {
            ...runtime,
            status: "paused",
            error: message,
          },
        });
      }
    },

    run: () => {
      const { graph, registry, runtime } = get();
      if (runtime.status === "running" || runtime.status === "completed") {
        return;
      }

      const issues = validateSimulationGraph({ graph, registry });
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
  })
);

/**
 * Deterministic wall-clock scheduler for fixed-step simulation.
 *
 * Important nuance:
 * - The engine itself is deterministic regardless of timer jitter.
 * - This scheduler uses planned timestamps to reduce accumulated drift so UI playback
 *   remains close to target rate over long runs.
 */
function scheduleNextTick(): void {
  const state = useSimulationRuntimeStore.getState();
  if (state.runtime.status !== "running") {
    return;
  }

  const startedAt = performance.now() - state.runtime.tick * state.runtime.stepTimeMs;

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

    const expectedNextAt =
      startedAt + afterStep.runtime.tick * afterStep.runtime.stepTimeMs;
    const delay = Math.max(0, expectedNextAt - performance.now());
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
