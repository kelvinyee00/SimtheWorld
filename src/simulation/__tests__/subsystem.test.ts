import { createInitialSnapshot, stepSimulation } from "@/src/simulation/engine";
import { COUNTER_BLOCK_TYPE } from "@/src/simulation/blocks/counterBlock";
import { DISPLAY_BLOCK_TYPE } from "@/src/simulation/blocks/displayBlock";
import { GAIN_BLOCK_TYPE } from "@/src/simulation/blocks/gainBlock";
import { INPORT_BLOCK_TYPE } from "@/src/simulation/blocks/inportBlock";
import { OUTPORT_BLOCK_TYPE } from "@/src/simulation/blocks/outportBlock";
import { SUBSYSTEM_BLOCK_TYPE } from "@/src/simulation/blocks/subsystemBlock";
import { DEFAULT_BLOCK_REGISTRY } from "@/src/simulation/registry";
import { SimulationGraph, SimulationRuntimeSnapshot } from "@/src/simulation/types";

function runTicks(params: {
  graph: SimulationGraph;
  ticks: number;
  stepTimeMs?: number;
  simulationTimeMs?: number;
}): SimulationRuntimeSnapshot {
  const { graph, ticks, stepTimeMs = 100, simulationTimeMs = 1_000 } = params;

  let snapshot = createInitialSnapshot({ simulationTimeMs, stepTimeMs });
  for (let index = 0; index < ticks; index += 1) {
    snapshot = stepSimulation({ graph, registry: DEFAULT_BLOCK_REGISTRY, snapshot });
  }

  return snapshot;
}

describe("Subsystem block execution", () => {
  it("executes nested graph and exports Outport to parent graph", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "counter", type: COUNTER_BLOCK_TYPE, data: { start: 1, step: 1, mode: "inc" } },
        {
          id: "subsystem",
          type: SUBSYSTEM_BLOCK_TYPE,
          data: {
            label: "Subsystem",
            graph: {
              nodes: [
                { id: "in", type: INPORT_BLOCK_TYPE, data: { label: "default" } },
                { id: "gain", type: GAIN_BLOCK_TYPE, data: { gain: 2 } },
                { id: "out", type: OUTPORT_BLOCK_TYPE, data: { label: "default" } },
              ],
              edges: [
                { id: "in->gain", source: "in", target: "gain", targetHandle: "in" },
                { id: "gain->out", source: "gain", target: "out", targetHandle: "in" },
              ],
            },
          },
        },
        { id: "display", type: DISPLAY_BLOCK_TYPE, data: { label: "Display" } },
      ],
      edges: [
        { id: "counter->subsystem", source: "counter", target: "subsystem" },
        { id: "subsystem->display", source: "subsystem", target: "display" },
      ],
    };

    let snapshot = createInitialSnapshot({ simulationTimeMs: 1_000, stepTimeMs: 100 });
    snapshot = stepSimulation({ graph, registry: DEFAULT_BLOCK_REGISTRY, snapshot });

    const displayState = snapshot.nodeInternalState.display as { value?: unknown };

    expect(snapshot.nodeOutputs.subsystem?.default).toBe(2);
    expect(displayState.value).toBe(2);
  });
  it("supports deterministic parent multi-rate hold behavior", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "counter", type: COUNTER_BLOCK_TYPE, data: { start: 1, step: 1, mode: "inc" } },
        {
          id: "subsystem",
          type: SUBSYSTEM_BLOCK_TYPE,
          data: {
            sampleTimeMs: 200,
            graph: {
              nodes: [
                { id: "in", type: INPORT_BLOCK_TYPE, data: { label: "default" } },
                { id: "gain", type: GAIN_BLOCK_TYPE, data: { gain: 2 } },
                { id: "out", type: OUTPORT_BLOCK_TYPE, data: { label: "default" } },
              ],
              edges: [
                { id: "in->gain", source: "in", target: "gain", targetHandle: "in" },
                { id: "gain->out", source: "gain", target: "out", targetHandle: "in" },
              ],
            },
          },
        },
        { id: "display", type: DISPLAY_BLOCK_TYPE, data: { label: "Display" } },
      ],
      edges: [
        { id: "counter->subsystem", source: "counter", target: "subsystem" },
        { id: "subsystem->display", source: "subsystem", target: "display" },
      ],
    };

    const afterTick0 = runTicks({ graph, ticks: 1 });
    const display0 = afterTick0.nodeInternalState.display as { value?: unknown };
    expect(afterTick0.nodeOutputs.subsystem?.default).toBe(2);
    expect(display0.value).toBe(2);

    const afterTick1 = runTicks({ graph, ticks: 2 });
    const display1 = afterTick1.nodeInternalState.display as { value?: unknown };
    expect(afterTick1.nodeOutputs.subsystem?.default).toBe(2);
    expect(display1.value).toBe(2);

    const afterTick2 = runTicks({ graph, ticks: 3 });
    const display2 = afterTick2.nodeInternalState.display as { value?: unknown };
    expect(afterTick2.nodeOutputs.subsystem?.default).toBe(6);
    expect(display2.value).toBe(6);
  });

});
