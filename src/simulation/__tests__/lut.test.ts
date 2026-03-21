import { createInitialSnapshot, stepSimulation } from "@/src/simulation/engine";
import { COUNTER_BLOCK_TYPE } from "@/src/simulation/blocks/counterBlock";
import { DISPLAY_BLOCK_TYPE } from "@/src/simulation/blocks/displayBlock";
import { LUT_1D_BLOCK_TYPE, LUT_2D_BLOCK_TYPE } from "@/src/simulation/blocks/lutBlock";
import { DEFAULT_BLOCK_REGISTRY } from "@/src/simulation/registry";
import { SimulationGraph, SimulationRuntimeSnapshot } from "@/src/simulation/types";

function runTicks(params: {
  graph: SimulationGraph;
  ticks: number;
  stepTimeMs?: number;
  simulationTimeMs?: number;
}): SimulationRuntimeSnapshot {
  const { graph, ticks, stepTimeMs = 100, simulationTimeMs = 10_000 } = params;

  let snapshot = createInitialSnapshot({ simulationTimeMs, stepTimeMs });
  for (let index = 0; index < ticks; index += 1) {
    snapshot = stepSimulation({
      graph,
      registry: DEFAULT_BLOCK_REGISTRY,
      snapshot,
    });
  }

  return snapshot;
}

describe("Lookup Table blocks", () => {
  it("interpolates LUT 1D values linearly", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "src", type: COUNTER_BLOCK_TYPE, data: { start: 2.5, step: 0 } },
        {
          id: "lut",
          type: LUT_1D_BLOCK_TYPE,
          data: { breakpointsX: [0, 10], tableData: [0, 100] },
        },
        { id: "disp", type: DISPLAY_BLOCK_TYPE, data: {} },
      ],
      edges: [
        { id: "src->lut", source: "src", target: "lut", targetHandle: "in" },
        { id: "lut->disp", source: "lut", target: "disp", targetHandle: "in" },
      ],
    };

    const snapshot = runTicks({ graph, ticks: 1 });
    const displayState = snapshot.nodeInternalState.disp as { value?: unknown };

    expect(snapshot.nodeOutputs.lut?.default).toBeCloseTo(25);
    expect(displayState.value).toBeCloseTo(25);
  });

  it("interpolates LUT 2D values with bilinear interpolation", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "x", type: COUNTER_BLOCK_TYPE, data: { start: 5, step: 0 } },
        { id: "y", type: COUNTER_BLOCK_TYPE, data: { start: 5, step: 0 } },
        {
          id: "lut2",
          type: LUT_2D_BLOCK_TYPE,
          data: {
            breakpointsX: [0, 10],
            breakpointsY: [0, 10],
            tableData: [
              [0, 100],
              [100, 200],
            ],
          },
        },
      ],
      edges: [
        { id: "x->lut2", source: "x", target: "lut2", targetHandle: "in1" },
        { id: "y->lut2", source: "y", target: "lut2", targetHandle: "in2" },
      ],
    };

    const snapshot = runTicks({ graph, ticks: 1 });
    expect(snapshot.nodeOutputs.lut2?.default).toBeCloseTo(100);
  });

  it("clamps LUT 2D interpolation outside breakpoint range", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "x", type: COUNTER_BLOCK_TYPE, data: { start: 99, step: 0 } },
        { id: "y", type: COUNTER_BLOCK_TYPE, data: { start: -10, step: 0 } },
        {
          id: "lut2",
          type: LUT_2D_BLOCK_TYPE,
          data: {
            breakpointsX: [0, 10],
            breakpointsY: [0, 10],
            tableData: [
              [0, 100],
              [100, 200],
            ],
          },
        },
      ],
      edges: [
        { id: "x->lut2", source: "x", target: "lut2", targetHandle: "in1" },
        { id: "y->lut2", source: "y", target: "lut2", targetHandle: "in2" },
      ],
    };

    const snapshot = runTicks({ graph, ticks: 1 });
    expect(snapshot.nodeOutputs.lut2?.default).toBeCloseTo(100);
  });
});
