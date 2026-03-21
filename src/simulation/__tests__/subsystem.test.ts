import { createInitialSnapshot, stepSimulation } from "@/src/simulation/engine";
import { COUNTER_BLOCK_TYPE } from "@/src/simulation/blocks/counterBlock";
import { DISPLAY_BLOCK_TYPE } from "@/src/simulation/blocks/displayBlock";
import { GAIN_BLOCK_TYPE } from "@/src/simulation/blocks/gainBlock";
import { SUM_BLOCK_TYPE } from "@/src/simulation/blocks/sumBlock";
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

  it("maps named Inport handles and Outport source handles deterministically", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "counter-a", type: COUNTER_BLOCK_TYPE, data: { start: 1, step: 0, mode: "inc" } },
        { id: "counter-b", type: COUNTER_BLOCK_TYPE, data: { start: 2, step: 0, mode: "inc" } },
        {
          id: "subsystem",
          type: SUBSYSTEM_BLOCK_TYPE,
          data: {
            graph: {
              nodes: [
                { id: "in-a", type: INPORT_BLOCK_TYPE, data: { label: "in1" } },
                { id: "in-b", type: INPORT_BLOCK_TYPE, data: { label: "in2" } },
                { id: "sum", type: SUM_BLOCK_TYPE, data: { label: "Sum" } },
                { id: "out", type: OUTPORT_BLOCK_TYPE, data: { label: "sumOut" } },
              ],
              edges: [
                { id: "a->sum", source: "in-a", target: "sum", targetHandle: "in1" },
                { id: "b->sum", source: "in-b", target: "sum", targetHandle: "in2" },
                { id: "sum->out", source: "sum", target: "out", targetHandle: "in" },
              ],
            },
          },
        },
        { id: "display", type: DISPLAY_BLOCK_TYPE, data: { label: "Display" } },
      ],
      edges: [
        {
          id: "counter-a->subsystem-in1",
          source: "counter-a",
          target: "subsystem",
          targetHandle: "in1",
        },
        {
          id: "counter-b->subsystem-in2",
          source: "counter-b",
          target: "subsystem",
          targetHandle: "in2",
        },
        {
          id: "subsystem-sumOut->display",
          source: "subsystem",
          sourceHandle: "sumOut",
          target: "display",
        },
      ],
    };

    const snapshot = runTicks({ graph, ticks: 1 });
    const displayState = snapshot.nodeInternalState.display as { value?: unknown };

    expect(snapshot.nodeOutputs.subsystem?.sumOut).toBe(3);
    expect(snapshot.nodeOutputs.subsystem?.default).toBe(3);
    expect(displayState.value).toBe(3);
  });

  it("supports masked multi-I/O handles and parameterized nested block values", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "error", type: COUNTER_BLOCK_TYPE, data: { start: 2, step: 0, mode: "inc" } },
        {
          id: "subsystem",
          type: SUBSYSTEM_BLOCK_TYPE,
          data: {
            mask: {
              inputs: ["err"],
              outputs: ["ctrl"],
              parameters: { gainK: 3 },
            },
            graph: {
              nodes: [
                { id: "in", type: INPORT_BLOCK_TYPE, data: { label: "in1" } },
                { id: "gain", type: GAIN_BLOCK_TYPE, data: { gain: "$gainK" } },
                { id: "out", type: OUTPORT_BLOCK_TYPE, data: { label: "out1" } },
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
        { id: "error->subsystem-err", source: "error", target: "subsystem", targetHandle: "err" },
        { id: "subsystem-ctrl->display", source: "subsystem", sourceHandle: "ctrl", target: "display" },
      ],
    };

    const snapshot = runTicks({ graph, ticks: 1 });
    const displayState = snapshot.nodeInternalState.display as { value?: unknown };

    expect(snapshot.nodeOutputs.subsystem?.ctrl).toBe(6);
    expect(snapshot.nodeOutputs.subsystem?.default).toBe(6);
    expect(displayState.value).toBe(6);
  });

});
