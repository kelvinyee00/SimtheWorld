import { DEFAULT_BLOCK_REGISTRY } from "../simulation/registry";
import { stepSimulation, createInitialSnapshot } from "../simulation/engine";
import { SimulationGraph, SimulationRuntimeSnapshot } from "../simulation/types";

export interface EngineRunOptions {
  graph: SimulationGraph;
  ticks: number;
  stepTimeMs?: number;
  simulationTimeMs?: number;
  onTick?: (tick: number, state: SimulationRuntimeSnapshot) => void;
}

export async function runHeadlessEngine({
  graph,
  ticks,
  stepTimeMs = 10,
  simulationTimeMs = 1000,
  onTick,
}: EngineRunOptions) {
  let currentState: SimulationRuntimeSnapshot = createInitialSnapshot({
    simulationTimeMs,
    stepTimeMs,
  });

  console.log(`Starting headless engine run for ${ticks} ticks...`);

  for (let t = 0; t < ticks; t++) {
    currentState = stepSimulation({
      graph,
      snapshot: currentState,
      registry: DEFAULT_BLOCK_REGISTRY,
    });

    if (onTick) {
      onTick(t, currentState);
    }

    if (currentState.status === "completed") {
      break;
    }
  }

  console.log("Headless engine run complete.");
  return currentState;
}
