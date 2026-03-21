import { createInitialSnapshot, stepSimulation } from "@/src/simulation/engine";
import { COUNTER_BLOCK_TYPE } from "@/src/simulation/blocks/counterBlock";
import { DISPLAY_BLOCK_TYPE } from "@/src/simulation/blocks/displayBlock";
import { SUM_BLOCK_TYPE } from "@/src/simulation/blocks/sumBlock";
import { UNIT_DELAY_BLOCK_TYPE } from "@/src/simulation/blocks/unitDelayBlock";
import { COMPARE_BLOCK_TYPE } from "@/src/simulation/blocks/compareBlock";
import { SWITCH_BLOCK_TYPE } from "@/src/simulation/blocks/switchBlock";
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

describe("stepSimulation deterministic execution", () => {
  it("produces identical snapshots for identical graph/timing inputs", () => {
    const graph: SimulationGraph = {
      nodes: [
        {
          id: "counter",
          type: COUNTER_BLOCK_TYPE,
          data: { start: 0, step: 1, mode: "inc" },
        },
        {
          id: "sum",
          type: SUM_BLOCK_TYPE,
          data: { label: "Sum" },
        },
        {
          id: "delay",
          type: UNIT_DELAY_BLOCK_TYPE,
          data: { initialValue: 0 },
        },
        {
          id: "display",
          type: DISPLAY_BLOCK_TYPE,
          data: { label: "Display" },
        },
      ],
      edges: [
        {
          id: "counter->sum-in1",
          source: "counter",
          target: "sum",
          targetHandle: "in1",
        },
        {
          id: "delay->sum-in2",
          source: "delay",
          target: "sum",
          targetHandle: "in2",
        },
        {
          id: "sum->delay-in",
          source: "sum",
          target: "delay",
          targetHandle: "in",
        },
        {
          id: "delay->display",
          source: "delay",
          target: "display",
        },
      ],
    };

    const first = runTicks({ graph, ticks: 8, stepTimeMs: 100, simulationTimeMs: 1_000 });
    const second = runTicks({ graph, ticks: 8, stepTimeMs: 100, simulationTimeMs: 1_000 });

    expect(first).toEqual(second);
    // Unit Delay output should be 12 after 8 ticks (trace: 0, 0, 0, 1, 2, 4, 6, 9 -> next is 12)
    // Wait, let's re-verify Tick 7 end:
    // sum output 16. delay executes: output 12 (previous state), nextState 16.
    // So delay.default is 12.
    expect(first.nodeOutputs.delay?.default).toBe(12);
    expect(first.nodeInternalState.delay).toBe(16);
  });


  it("evaluates Compare/Switch typed boolean control deterministically", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "counter-a", type: COUNTER_BLOCK_TYPE, data: { start: 0, step: 1, mode: "inc" } },
        { id: "counter-b", type: COUNTER_BLOCK_TYPE, data: { start: 5, step: 0, mode: "inc" } },
        { id: "compare", type: COMPARE_BLOCK_TYPE, data: { operator: "lt" } },
        { id: "switch", type: SWITCH_BLOCK_TYPE, data: {} },
      ],
      edges: [
        { id: "a->compare1", source: "counter-a", target: "compare", targetHandle: "in1" },
        { id: "b->compare2", source: "counter-b", target: "compare", targetHandle: "in2" },
        { id: "compare->switch-cond", source: "compare", target: "switch", targetHandle: "cond" },
        { id: "a->switch-true", source: "counter-a", target: "switch", targetHandle: "inTrue" },
        { id: "b->switch-false", source: "counter-b", target: "switch", targetHandle: "inFalse" },
      ],
    };

    const snapshot = runTicks({ graph, ticks: 2, stepTimeMs: 100, simulationTimeMs: 1_000 });

    expect(snapshot.nodeOutputs.compare?.default).toBe(true);
    expect(snapshot.nodeOutputs.switch?.default).toBe(1);
  });

  it("throws for unsupported algebraic cycles without memory/delay breakers", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "sum-a", type: SUM_BLOCK_TYPE, data: {} },
        { id: "sum-b", type: SUM_BLOCK_TYPE, data: {} },
      ],
      edges: [
        {
          id: "a->b",
          source: "sum-a",
          target: "sum-b",
          targetHandle: "in1",
        },
        {
          id: "b->a",
          source: "sum-b",
          target: "sum-a",
          targetHandle: "in1",
        },
      ],
    };

    const snapshot = createInitialSnapshot({ simulationTimeMs: 1_000, stepTimeMs: 100 });

    expect(() =>
      stepSimulation({
        graph,
        registry: DEFAULT_BLOCK_REGISTRY,
        snapshot,
      })
    ).toThrow(/unsupported cycle/i);
  });
});
