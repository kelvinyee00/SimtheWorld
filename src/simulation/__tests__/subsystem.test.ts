import { createInitialSnapshot, stepSimulation } from "@/src/simulation/engine";
import { COUNTER_BLOCK_TYPE } from "@/src/simulation/blocks/counterBlock";
import { DISPLAY_BLOCK_TYPE } from "@/src/simulation/blocks/displayBlock";
import { GAIN_BLOCK_TYPE } from "@/src/simulation/blocks/gainBlock";
import { INPORT_BLOCK_TYPE } from "@/src/simulation/blocks/inportBlock";
import { OUTPORT_BLOCK_TYPE } from "@/src/simulation/blocks/outportBlock";
import { SUBSYSTEM_BLOCK_TYPE } from "@/src/simulation/blocks/subsystemBlock";
import { DEFAULT_BLOCK_REGISTRY } from "@/src/simulation/registry";
import { SimulationGraph } from "@/src/simulation/types";

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
});
