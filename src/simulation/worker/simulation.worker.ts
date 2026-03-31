import { stepSimulation } from "../engine";
import { DEFAULT_BLOCK_REGISTRY } from "../registry";
import { WorkerRequest, WorkerResponse } from "./types";

let currentGraph = { nodes: [], edges: [] };
let currentSnapshot = null;
let isRunning = false;
let batchSize = 1;

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  switch (request.type) {
    case "INIT":
      currentGraph = request.graph || currentGraph;
      currentSnapshot = request.snapshot || currentSnapshot;
      batchSize = request.batchSize || 1;
      break;

    case "START":
      isRunning = true;
      runLoop();
      break;

    case "PAUSE":
      isRunning = false;
      break;

    case "STEP":
      executeBatch();
      break;

    case "UPDATE_GRAPH":
      currentGraph = request.graph || currentGraph;
      break;

    case "RESET":
      isRunning = false;
      currentSnapshot = request.snapshot || null;
      break;
  }
};

function executeBatch() {
  if (!currentSnapshot || !currentGraph) return;

  const startTime = performance.now();
  let stepsInThisBatch = 0;

  try {
    for (let i = 0; i < batchSize; i++) {
      if (currentSnapshot.status === "completed") {
        self.postMessage({ type: "COMPLETED", snapshot: currentSnapshot });
        isRunning = false;
        break;
      }

      currentSnapshot = stepSimulation({
        graph: currentGraph,
        registry: DEFAULT_BLOCK_REGISTRY,
        snapshot: currentSnapshot,
      });
      stepsInThisBatch++;
    }

    const duration = performance.now() - startTime;
    self.postMessage({
      type: "STATE_UPDATE",
      snapshot: currentSnapshot,
      metrics: {
        batchDurationMs: duration,
        stepsExecuted: stepsInThisBatch,
      },
    } as WorkerResponse);
  } catch (error) {
    self.postMessage({
      type: "ERROR",
      error: error instanceof Error ? error.message : "Worker simulation error",
    });
    isRunning = false;
  }
}

function runLoop() {
  if (!isRunning) return;
  executeBatch();
  if (isRunning && currentSnapshot?.status === "running") {
    // Small delay to allow message processing and prevent blocking the worker event loop entirely
    setTimeout(runLoop, 0);
  }
}
