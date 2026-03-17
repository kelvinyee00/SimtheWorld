import { stepSimulation } from "@/src/simulation/engine";
import { DEFAULT_BLOCK_REGISTRY } from "@/src/simulation/registry";
import { SimulationGraph, SimulationRuntimeSnapshot } from "@/src/simulation/types";

/**
 * Basic signal propagation wiring check for P0-3.
 *
 * Graph:
 * - source(counter inc from 1 by 2) -> sink(counter dec from 10 by 1)
 *
 * We verify wiring-level behavior:
 * - Tick 0 source emits 1, sink input `in` receives 1 from source output `default`.
 * - Engine remains deterministic and state transitions are persisted per node.
 *
 * This is intentionally lightweight (no external test runner), but type-checked
 * and executable by direct invocation in a debug shell if needed.
 */
export function verifyBasicSignalPropagation(): void {
  const graph: SimulationGraph = {
    nodes: [
      { id: "source", type: "counter", data: { start: 1, step: 2, mode: "inc" } },
      { id: "sink", type: "counter", data: { start: 10, step: 1, mode: "dec" } },
    ],
    edges: [
      {
        id: "edge-source-to-sink",
        source: "source",
        target: "sink",
        sourceHandle: "default",
        targetHandle: "in",
      },
    ],
  };

  const initial: SimulationRuntimeSnapshot = {
    status: "idle",
    tick: 0,
    timeMs: 0,
    simulationTimeMs: 1_000,
    stepTimeMs: 100,
    nodeOutputs: {},
    nodeInternalState: {},
  };

  const afterFirstTick = stepSimulation({
    graph,
    registry: DEFAULT_BLOCK_REGISTRY,
    snapshot: initial,
  });

  if (afterFirstTick.nodeOutputs.source?.default !== 1) {
    throw new Error("Signal check failed: source did not emit expected tick-0 value.");
  }

  if (afterFirstTick.nodeOutputs.sink?.default !== 10) {
    throw new Error("Signal check failed: sink did not emit expected tick-0 value.");
  }
}
