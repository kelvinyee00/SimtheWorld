import { SimulationGraph, SimulationRuntimeSnapshot } from "../types";

export interface ParallelSweepOptions {
  /**
   * Maximum number of concurrent workers to use.
   * Defaults to navigator.hardwareConcurrency.
   */
  maxConcurrency?: number;
  /**
   * Fixed step time for the simulation in ms.
   * Defaults to 10ms.
   */
  stepTimeMs?: number;
  /**
   * Total simulation time in ms.
   * Defaults to 1000ms.
   */
  totalTimeMs?: number;
}

export interface SweepResult {
  parameterSet: Record<string, any>;
  finalSnapshot: SimulationRuntimeSnapshot;
  success: boolean;
  error?: string;
}

/**
 * Executes a parallel simulation sweep.
 * 
 * Runs the same model graph multiple times with different parameter sets
 * distributed across multiple Web Workers.
 */
export async function runParallelSweep(
  graph: SimulationGraph,
  parameterSets: Record<string, any>[],
  options: ParallelSweepOptions = {}
): Promise<SweepResult[]> {
  const {
    maxConcurrency = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4,
    stepTimeMs = 10,
    totalTimeMs = 1000,
  } = options;

  const results: SweepResult[] = new Array(parameterSets.length);
  const queue = parameterSets.map((params, index) => ({ params, index }));
  let activeWorkers = 0;
  let finishedCount = 0;

  return new Promise((resolve) => {
    const processNext = () => {
      if (finishedCount === parameterSets.length) {
        resolve(results);
        return;
      }

      while (activeWorkers < maxConcurrency && queue.length > 0) {
        const item = queue.shift()!;
        activeWorkers++;
        runSingleSimulation(graph, item.params, stepTimeMs, totalTimeMs)
          .then((snapshot) => {
            results[item.index] = {
              parameterSet: item.params,
              finalSnapshot: snapshot,
              success: true,
            };
          })
          .catch((err) => {
            results[item.index] = {
              parameterSet: item.params,
              finalSnapshot: null as any,
              success: false,
              error: err instanceof Error ? err.message : String(err),
            };
          })
          .finally(() => {
            activeWorkers--;
            finishedCount++;
            processNext();
          });
      }
    };

    processNext();
  });
}

/**
 * Spawns a worker to run a single simulation run.
 */
async function runSingleSimulation(
  graph: SimulationGraph,
  params: Record<string, any>,
  stepTimeMs: number,
  totalTimeMs: number
): Promise<SimulationRuntimeSnapshot> {
  // Deep clone graph to avoid mutations
  const runGraph = JSON.parse(JSON.stringify(graph)) as SimulationGraph;
  
  // Apply parameters to graph nodes
  for (const nodeId in params) {
    const node = runGraph.nodes.find(n => n.id === nodeId);
    if (node) {
      node.data = { ...node.data, ...params[nodeId] };
    }
  }

  // Initial snapshot
  const initialSnapshot: SimulationRuntimeSnapshot = {
    status: "running",
    tick: 0,
    timeMs: 0,
    simulationTimeMs: totalTimeMs,
    stepTimeMs: stepTimeMs,
    nodeOutputs: {},
    nodeInternalState: {},
  };

  return new Promise((resolve, reject) => {
    // Note: In Node environment for tests, Worker might not be global
    // In browser environment, this uses standard Web Workers
    const WorkerClass = typeof Worker !== 'undefined' ? Worker : require('worker_threads').Worker;
    
    // For browser/vite, we usually use new URL. 
    // For test stability in Node, we might need a different path or mock.
    const worker = new WorkerClass(new URL('./simulation.worker.ts', import.meta.url));

    worker.onmessage = (event: any) => {
      const response = event.data;
      if (response.type === "COMPLETED") {
        worker.terminate();
        resolve(response.snapshot);
      } else if (response.type === "ERROR") {
        worker.terminate();
        reject(new Error(response.error));
      } else if (response.type === "STATE_UPDATE") {
         if (response.snapshot.status === "completed") {
            worker.terminate();
            resolve(response.snapshot);
         }
      }
    };

    worker.onerror = (err: any) => {
      worker.terminate();
      reject(err);
    };

    worker.postMessage({
      type: "INIT",
      graph: runGraph,
      snapshot: initialSnapshot,
      batchSize: Math.ceil(totalTimeMs / stepTimeMs) + 1,
    });

    worker.postMessage({ type: "START" });
  });
}
