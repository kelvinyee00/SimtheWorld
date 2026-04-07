import { DEFAULT_BLOCK_REGISTRY } from "../simulation/registry";
import { step } from "../simulation/engine";
import { SimulationGraph, SimulationState } from "../simulation/types";

export interface EngineRunOptions {
  graph: SimulationGraph;
  ticks: number;
  stepTimeMs?: number;
  onTick?: (tick: number, state: SimulationState) => void;
}

export async function runHeadlessEngine({
  graph,
  ticks,
  stepTimeMs = 10,
  onTick,
}: EngineRunOptions) {
  let currentState: SimulationState = {
    tick: 0,
    timeMs: 0,
    nodes: {},
    __globalSignals: {},
    lastEvents: []
  };

  console.log(`Starting headless engine run for ${ticks} ticks...`);

  for (let t = 0; t < ticks; t++) {
    currentState = step({
      graph,
      state: currentState,
      registry: DEFAULT_BLOCK_REGISTRY,
      stepTimeMs
    });

    if (onTick) {
      onTick(t, currentState);
    }
  }

  console.log("Headless engine run complete.");
  return currentState;
}
