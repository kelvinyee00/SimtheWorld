import { createInitialSnapshot, stepSimulation } from "@/src/simulation/engine";
import { COUNTER_BLOCK_TYPE } from "@/src/simulation/blocks/counterBlock";
import { DISPLAY_BLOCK_TYPE } from "@/src/simulation/blocks/displayBlock";
import { GOTO_BLOCK_TYPE } from "@/src/simulation/blocks/gotoBlock";
import { FROM_BLOCK_TYPE } from "@/src/simulation/blocks/fromBlock";
import { DEFAULT_BLOCK_REGISTRY } from "@/src/simulation/registry";
import { SimulationGraph, SimulationRuntimeSnapshot } from "@/src/simulation/types";

function runTicks(params: {
  graph: SimulationGraph;
  ticks: number;
  stepTimeMs?: number;
  simulationTimeMs?: number;
}): SimulationRuntimeSnapshot {
  const { graph, ticks, stepTimeMs = 100, simulationTimeMs = 10_000 } = params;

  let snapshot = createInitialSnapshot({
    simulationTimeMs,
    stepTimeMs,
  });

  for (let index = 0; index < ticks; index += 1) {
    snapshot = stepSimulation({
      graph,
      registry: DEFAULT_BLOCK_REGISTRY,
      snapshot,
    });
  }

  return snapshot;
}

describe("Global Signal Bus (GOTO/FROM)", () => {
  it("propagates values from GOTO to FROM across the global bus in the same tick", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "src", type: COUNTER_BLOCK_TYPE, data: { start: 42, step: 0, mode: "inc" } },
        { id: "send", type: GOTO_BLOCK_TYPE, data: { tag: "test-bus" } },
        { id: "recv", type: FROM_BLOCK_TYPE, data: { tag: "test-bus" } },
        { id: "disp", type: DISPLAY_BLOCK_TYPE, data: { label: "Display" } },
      ],
      edges: [
        { id: "src->send", source: "src", target: "send", targetHandle: "in" },
        { id: "recv->disp", source: "recv", target: "disp", targetHandle: "in" },
      ],
    };

    const snapshot = runTicks({ graph, ticks: 1 });
    const displayState = snapshot.nodeInternalState.disp as { value?: unknown };

    expect(snapshot.nodeOutputs.send?.default).toBe(42);
    expect(snapshot.nodeOutputs.recv?.default).toBe(42);
    expect(displayState.value).toBe(42);
  });

  it("handles multiple tags independently", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "c1", type: COUNTER_BLOCK_TYPE, data: { start: 1, step: 0 } },
        { id: "c2", type: COUNTER_BLOCK_TYPE, data: { start: 2, step: 0 } },
        { id: "g1", type: GOTO_BLOCK_TYPE, data: { tag: "a" } },
        { id: "g2", type: GOTO_BLOCK_TYPE, data: { tag: "b" } },
        { id: "f1", type: FROM_BLOCK_TYPE, data: { tag: "a" } },
        { id: "f2", type: FROM_BLOCK_TYPE, data: { tag: "b" } },
      ],
      edges: [
        { id: "c1->g1", source: "c1", target: "g1" },
        { id: "c2->g2", source: "c2", target: "g2" },
      ],
    };

    const snapshot = runTicks({ graph, ticks: 1 });
    expect(snapshot.nodeOutputs.f1?.default).toBe(1);
    expect(snapshot.nodeOutputs.f2?.default).toBe(2);
  });

  it("persists global bus state across ticks (latch behavior)", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "src", type: COUNTER_BLOCK_TYPE, data: { start: 10, step: 1, mode: "inc" } },
        { id: "send", type: GOTO_BLOCK_TYPE, data: { tag: "latch" } },
        { id: "recv", type: FROM_BLOCK_TYPE, data: { tag: "latch" } },
      ],
      edges: [
        { id: "src->send", source: "src", target: "send" },
      ],
    };

    const snapshot1 = runTicks({ graph, ticks: 1 });
    expect(snapshot1.nodeOutputs.recv?.default).toBe(10);

    const snapshot2 = runTicks({ graph, ticks: 2 });
    expect(snapshot2.nodeOutputs.recv?.default).toBe(11);
  });
});
