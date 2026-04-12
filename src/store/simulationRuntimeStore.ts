import { WorkerRequest, WorkerResponse } from "../simulation/worker/types";
import { WEBSOCKET_BLOCK_TYPE } from "../simulation/blocks/websocketBlock";
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
import { getSocket } from "@/src/utils/socket";

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
  modelId: string | null;
  graph: SimulationGraph;
  registry: BlockRegistry;
  runtime: SimulationRuntimeSnapshot;
  metrics: RuntimePerformanceMetrics;
  trace: RuntimeTraceEvent[];
  executionMode: ExecutionMode;
  batchSize: number;
  setModelId: (modelId: string | null) => void;
  setGraph: (graph: SimulationGraph) => void;
  setRegistry: (registry: BlockRegistry) => void;
  setTiming: (params: { simulationTimeMs?: number; stepTimeMs?: number }) => void;
  setExecutionMode: (mode: ExecutionMode) => void;
  setBatchSize: (batchSize: number) => void;
  run: () => void;
  pause: () => void;
  reset: () => void;
  complete: () => void;
  stepOnce: () => void;
  clearTrace: () => void;
  updateNodeInternalState: (nodeId: string, state: unknown) => void;
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
let worker: Worker | null = null;
const activeWebSockets: Map<string, WebSocket> = new Map();

// P15-2b: Broadcast frequency control
let lastEmitTime = 0;
const EMIT_INTERVAL_MS = 200; // Emit at most every 200ms

export const useSimulationRuntimeStore = create<SimulationRuntimeStore>(
  (set, get) => ({
    modelId: null,
    graph: EMPTY_GRAPH,
    registry: DEFAULT_BLOCK_REGISTRY,
    runtime: DEFAULT_RUNTIME,
    metrics: DEFAULT_METRICS,
    trace: [],
    executionMode: "fast",
    batchSize: 10,

    setModelId: (modelId) => {
      const socket = getSocket();
      const previousId = get().modelId;
      if (previousId) {
        socket.emit("leave-room", previousId);
      }
      set({ modelId });
      if (modelId) {
        socket.emit("join-room", modelId);
      }
    },

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

    setBatchSize: (batchSize) => {
      set({ batchSize });
    },

    setExecutionMode: (executionMode) => {
      const wasRunning = get().runtime.status === "running";
      if (wasRunning) clearScheduler();
      
      set({ executionMode });
      
      if (wasRunning) scheduleNextTick();
    },

    stepOnce: () => {
      const { graph, registry, runtime, metrics, trace, modelId } = get();
      const startedAt = performance.now();
      try {
        const next = stepSimulation({ graph, registry, snapshot: runtime });
        
        // P15-2b: Broadcast state via Socket.io
        if (modelId && next.status === "running") {
          const now = Date.now();
          if (now - lastEmitTime >= EMIT_INTERVAL_MS) {
            getSocket().emit("simulation-snapshot", { modelId, snapshot: next });
            lastEmitTime = now;
          }
        }

        // P13-1: Handle WebSocket Publish
        graph.nodes.forEach((node) => {
          if (node.type === WEBSOCKET_BLOCK_TYPE && node.data?.mode === "pub") {
            const ws = activeWebSockets.get(node.id);
            if (ws && ws.readyState === WebSocket.OPEN) {
              const outputs = next.nodeOutputs[node.id];
              if (outputs && outputs.default !== undefined) {
                ws.send(JSON.stringify(outputs.default));
              }
            }
          }
        });
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
      const { graph, registry, runtime, executionMode, batchSize } = get();
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

      startWebSockets();
      if (executionMode === "fast" && typeof Worker !== "undefined") {
        startWorker(graph, runtime, batchSize);
      } else {
        scheduleNextTick();
      }
    },

    pause: () => {
      stopWebSockets();
      stopWorker();
      clearScheduler();
      const runtime = get().runtime;
      const paused: SimulationStatus =
        runtime.status === "completed" ? "completed" : "paused";
      set({ runtime: { ...runtime, status: paused } });
    },

    reset: () => {
      stopWebSockets();
      stopWorker();
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

    updateNodeInternalState: (nodeId, state) => {
      set((current) => ({
        runtime: {
          ...current.runtime,
          nodeInternalState: {
            ...current.runtime.nodeInternalState,
            [nodeId]: state,
          },
        },
      }));
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

function stopWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}

function startWorker(graph: SimulationGraph, snapshot: SimulationRuntimeSnapshot, batchSize: number) {
  stopWorker();
  
  worker = new Worker(new URL("../simulation/worker/simulation.worker.ts", import.meta.url));
  
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const response = event.data;
    const store = useSimulationRuntimeStore.getState();

    switch (response.type) {
      case "STATE_UPDATE":
        if (response.snapshot) {
          const { metrics, trace, modelId } = store;
          const durationMs = response.metrics?.batchDurationMs || 0;
          const steps = response.metrics?.stepsExecuted || 1;
          
          const nextSteps = metrics.stepsExecuted + steps;
          const nextAverage = (metrics.averageStepDurationMs * metrics.stepsExecuted + durationMs) / nextSteps;

          // P15-2b: Broadcast state via Socket.io from worker updates
          if (modelId) {
            const now = Date.now();
            if (now - lastEmitTime >= EMIT_INTERVAL_MS) {
              getSocket().emit("simulation-snapshot", { modelId, snapshot: response.snapshot });
              lastEmitTime = now;
            }
          }

          useSimulationRuntimeStore.setState({
            runtime: response.snapshot,
            metrics: {
              stepsExecuted: nextSteps,
              lastStepDurationMs: durationMs / steps,
              averageStepDurationMs: nextAverage / steps,
              peakStepDurationMs: Math.max(metrics.peakStepDurationMs, durationMs / steps),
              estimatedStepRateHz: durationMs > 0 ? (1000 * steps) / durationMs : 0,
            },
            trace: appendTrace(trace, {
              tick: response.snapshot.tick,
              timeMs: response.snapshot.timeMs,
              durationMs,
              status: response.snapshot.status,
              note: `batch-${steps}`,
            }),
          });
        }
        break;

      case "COMPLETED":
        if (response.snapshot) {
          useSimulationRuntimeStore.setState({ runtime: response.snapshot });
        }
        stopWorker();
        break;

      case "ERROR":
        useSimulationRuntimeStore.setState({
          runtime: {
            ...store.runtime,
            status: "paused",
            error: response.error,
          },
        });
        stopWorker();
        break;
    }
  };

  worker.postMessage({
    type: "INIT",
    graph,
    snapshot,
    batchSize,
  } as WorkerRequest);
  
  worker.postMessage({ type: "START" } as WorkerRequest);
}

function stopWebSockets() {
  activeWebSockets.forEach((ws) => ws.close());
  activeWebSockets.clear();
}

function startWebSockets() {
  stopWebSockets();
  const state = useSimulationRuntimeStore.getState();
  const { graph } = state;
  
  graph.nodes.forEach((node) => {
    if (node.type === WEBSOCKET_BLOCK_TYPE) {
      const { url, mode } = (node.data as { url?: string; mode?: string }) || {};
      if (typeof url === "string" && url.startsWith("ws")) {
        try {
          const ws = new WebSocket(url);
          if (mode !== "pub") {
            ws.onmessage = (event) => {
              const store = useSimulationRuntimeStore.getState();
              // Only update if still running and this node exists
              if (store.runtime.status === "running") {
                let val: unknown = event.data;
                try { val = JSON.parse(event.data); } catch { /* ignore parse error */ }
                store.updateNodeInternalState(node.id, { lastReceived: val });
              }
            };
          }
          activeWebSockets.set(node.id, ws);
        } catch (e) {
          console.error("Failed to connect WebSocket", node.id, e);
        }
      }
    }
  });
}
