import { createInitialSnapshot, stepSimulation } from "@/src/simulation/engine";
import { COUNTER_BLOCK_TYPE } from "@/src/simulation/blocks/counterBlock";
import { DISPLAY_BLOCK_TYPE } from "@/src/simulation/blocks/displayBlock";
import {
  DISCRETE_TRANSFER_FCN_BLOCK_TYPE,
} from "@/src/simulation/blocks/discreteTransferFcnBlock";
import { LEAD_LAG_BLOCK_TYPE } from "@/src/simulation/blocks/leadLagBlock";
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

describe("Discrete filter family", () => {
  it("Discrete Transfer Fcn behaves as identity for numerator=[1], denominator=[1]", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "counter", type: COUNTER_BLOCK_TYPE, data: { start: 4, step: 0, mode: "inc" } },
        {
          id: "dtf",
          type: DISCRETE_TRANSFER_FCN_BLOCK_TYPE,
          data: { numerator: [1], denominator: [1] },
        },
        { id: "display", type: DISPLAY_BLOCK_TYPE, data: { label: "Display" } },
      ],
      edges: [
        { id: "counter->dtf", source: "counter", target: "dtf", targetHandle: "in" },
        { id: "dtf->display", source: "dtf", target: "display" },
      ],
    };

    const snapshot = runTicks({ graph, ticks: 1 });
    const displayState = snapshot.nodeInternalState.display as { value?: unknown };

    expect(snapshot.nodeOutputs.dtf?.default).toBe(4);
    expect(displayState.value).toBe(4);
  });

  it("Discrete Transfer Fcn supports stable first-order lag response", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "counter", type: COUNTER_BLOCK_TYPE, data: { start: 1, step: 0, mode: "inc" } },
        {
          id: "dtf",
          type: DISCRETE_TRANSFER_FCN_BLOCK_TYPE,
          data: { numerator: [0.5], denominator: [1, -0.5] },
        },
      ],
      edges: [{ id: "counter->dtf", source: "counter", target: "dtf", targetHandle: "in" }],
    };

    const afterTick1 = runTicks({ graph, ticks: 1 });
    const afterTick2 = runTicks({ graph, ticks: 2 });
    const afterTick3 = runTicks({ graph, ticks: 3 });

    expect(afterTick1.nodeOutputs.dtf?.default).toBeCloseTo(0.5, 6);
    expect(afterTick2.nodeOutputs.dtf?.default).toBeCloseTo(0.75, 6);
    expect(afterTick3.nodeOutputs.dtf?.default).toBeCloseTo(0.875, 6);
  });

  it("Lead/Lag falls back to static gain when lag time constant is zero", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "counter", type: COUNTER_BLOCK_TYPE, data: { start: 3, step: 0, mode: "inc" } },
        {
          id: "leadlag",
          type: LEAD_LAG_BLOCK_TYPE,
          data: { gain: 2, leadTimeConstantSec: 0.2, lagTimeConstantSec: 0 },
        },
      ],
      edges: [
        {
          id: "counter->leadlag",
          source: "counter",
          target: "leadlag",
          targetHandle: "in",
        },
      ],
    };

    const snapshot = runTicks({ graph, ticks: 1 });
    expect(snapshot.nodeOutputs.leadlag?.default).toBe(6);
  });

  it("Lead/Lag response is deterministic across repeated runs", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "counter", type: COUNTER_BLOCK_TYPE, data: { start: 1, step: 1, mode: "inc" } },
        {
          id: "leadlag",
          type: LEAD_LAG_BLOCK_TYPE,
          data: { gain: 1.2, leadTimeConstantSec: 0.05, lagTimeConstantSec: 0.2 },
        },
      ],
      edges: [
        {
          id: "counter->leadlag",
          source: "counter",
          target: "leadlag",
          targetHandle: "in",
        },
      ],
    };

    const first = runTicks({ graph, ticks: 5, stepTimeMs: 100, simulationTimeMs: 2_000 });
    const second = runTicks({ graph, ticks: 5, stepTimeMs: 100, simulationTimeMs: 2_000 });

    expect(first.nodeOutputs.leadlag?.default).toEqual(second.nodeOutputs.leadlag?.default);
    expect(first.nodeInternalState.leadlag).toEqual(second.nodeInternalState.leadlag);
  });
});
