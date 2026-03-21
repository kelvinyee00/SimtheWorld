import { COUNTER_BLOCK_TYPE } from "@/src/simulation/blocks/counterBlock";
import { DISPLAY_BLOCK_TYPE } from "@/src/simulation/blocks/displayBlock";
import { SUM_BLOCK_TYPE } from "@/src/simulation/blocks/sumBlock";
import { COMPARE_BLOCK_TYPE } from "@/src/simulation/blocks/compareBlock";
import { SWITCH_BLOCK_TYPE } from "@/src/simulation/blocks/switchBlock";
import { UNIT_DELAY_BLOCK_TYPE } from "@/src/simulation/blocks/unitDelayBlock";
import { INPORT_BLOCK_TYPE } from "@/src/simulation/blocks/inportBlock";
import { OUTPORT_BLOCK_TYPE } from "@/src/simulation/blocks/outportBlock";
import { SUBSYSTEM_BLOCK_TYPE } from "@/src/simulation/blocks/subsystemBlock";
import { MUX_BLOCK_TYPE } from "@/src/simulation/blocks/muxBlock";
import { DEMUX_BLOCK_TYPE } from "@/src/simulation/blocks/demuxBlock";
import { PID_BLOCK_TYPE } from "@/src/simulation/blocks/pidBlock";
import { DEFAULT_BLOCK_REGISTRY } from "@/src/simulation/registry";
import {
  formatGraphValidationIssues,
  validateSimulationGraph,
} from "@/src/simulation/validation";
import { SimulationGraph } from "@/src/simulation/types";

describe("validateSimulationGraph", () => {
  it("reports unknown block type", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "mystery", type: "unknown-type", data: {} },
        { id: "display", type: DISPLAY_BLOCK_TYPE, data: {} },
      ],
      edges: [
        {
          id: "unknown->display",
          source: "mystery",
          target: "display",
        },
      ],
    };

    const issues = validateSimulationGraph({
      graph,
      registry: DEFAULT_BLOCK_REGISTRY,
    });

    expect(issues.some((issue) => issue.code === "UNKNOWN_BLOCK_TYPE")).toBe(true);
  });

  it("reports invalid handle wiring", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "counter", type: COUNTER_BLOCK_TYPE, data: {} },
        { id: "display", type: DISPLAY_BLOCK_TYPE, data: {} },
      ],
      edges: [
        {
          id: "counter->display-in99",
          source: "counter",
          target: "display",
          targetHandle: "in99",
        },
      ],
    };

    const issues = validateSimulationGraph({
      graph,
      registry: DEFAULT_BLOCK_REGISTRY,
    });

    expect(issues.some((issue) => issue.code === "INVALID_TARGET_HANDLE")).toBe(true);
    expect(formatGraphValidationIssues(issues)).toMatch(/validation failed/i);
  });

  it("accepts cycle-safe feedback models with Unit Delay", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "sum", type: SUM_BLOCK_TYPE, data: {} },
        { id: "delay", type: UNIT_DELAY_BLOCK_TYPE, data: { initialValue: 0 } },
      ],
      edges: [
        {
          id: "sum->delay",
          source: "sum",
          target: "delay",
          targetHandle: "in",
        },
        {
          id: "delay->sum",
          source: "delay",
          target: "sum",
          targetHandle: "in1",
        },
      ],
    };

    const issues = validateSimulationGraph({
      graph,
      registry: DEFAULT_BLOCK_REGISTRY,
    });

    expect(issues).toEqual([]);
  });

  it("flags unsupported pure algebraic cycles", () => {
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

    const issues = validateSimulationGraph({
      graph,
      registry: DEFAULT_BLOCK_REGISTRY,
    });

    expect(issues.some((issue) => issue.code === "UNSUPPORTED_CYCLE")).toBe(true);
  });
  it("rejects incompatible signal types during validation", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "counter", type: COUNTER_BLOCK_TYPE, data: {} },
        { id: "switch", type: SWITCH_BLOCK_TYPE, data: {} },
      ],
      edges: [
        {
          id: "counter->switch-cond",
          source: "counter",
          target: "switch",
          targetHandle: "cond",
        },
      ],
    };

    const issues = validateSimulationGraph({
      graph,
      registry: DEFAULT_BLOCK_REGISTRY,
    });

    expect(issues.some((issue) => issue.code === "INVALID_SIGNAL_TYPE")).toBe(true);
  });

  it("accepts boolean-to-boolean typed wiring (Compare -> Switch.cond)", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "counter-a", type: COUNTER_BLOCK_TYPE, data: {} },
        { id: "counter-b", type: COUNTER_BLOCK_TYPE, data: { start: 1 } },
        { id: "compare", type: COMPARE_BLOCK_TYPE, data: { operator: "lt" } },
        { id: "switch", type: SWITCH_BLOCK_TYPE, data: {} },
      ],
      edges: [
        {
          id: "a->compare-in1",
          source: "counter-a",
          target: "compare",
          targetHandle: "in1",
        },
        {
          id: "b->compare-in2",
          source: "counter-b",
          target: "compare",
          targetHandle: "in2",
        },
        {
          id: "compare->switch-cond",
          source: "compare",
          target: "switch",
          targetHandle: "cond",
        },
      ],
    };

    const issues = validateSimulationGraph({
      graph,
      registry: DEFAULT_BLOCK_REGISTRY,
    });

    expect(issues).toEqual([]);
  });

  it("flags invalid non-integer sample time ratio", () => {
    const graph: SimulationGraph = {
      nodes: [
        {
          id: "counter",
          type: COUNTER_BLOCK_TYPE,
          data: { sampleTimeMs: 150 },
        },
      ],
      edges: [],
    };

    const issues = validateSimulationGraph({
      graph,
      registry: DEFAULT_BLOCK_REGISTRY,
      baseStepTimeMs: 100,
    });

    expect(issues.some((issue) => issue.code === "INVALID_SAMPLE_TIME")).toBe(true);
  });

  it("flags invalid sample time inside subsystem graph", () => {
    const graph: SimulationGraph = {
      nodes: [
        {
          id: "subsystem",
          type: SUBSYSTEM_BLOCK_TYPE,
          data: {
            graph: {
              nodes: [
                { id: "in", type: INPORT_BLOCK_TYPE, data: { label: "default" } },
                { id: "counter", type: COUNTER_BLOCK_TYPE, data: { sampleTimeMs: 150 } },
                { id: "out", type: OUTPORT_BLOCK_TYPE, data: { label: "default" } },
              ],
              edges: [
                { id: "in->out", source: "in", target: "out", targetHandle: "in" },
              ],
            },
          },
        },
      ],
      edges: [],
    };

    const issues = validateSimulationGraph({
      graph,
      registry: DEFAULT_BLOCK_REGISTRY,
      baseStepTimeMs: 100,
    });

    expect(
      issues.some(
        (issue) =>
          issue.code === "INVALID_SAMPLE_TIME" && issue.message.includes("[Subsystem subsystem]")
      )
    ).toBe(true);
  });

  it("flags duplicate subsystem interface labels", () => {
    const graph: SimulationGraph = {
      nodes: [
        {
          id: "subsystem",
          type: SUBSYSTEM_BLOCK_TYPE,
          data: {
            graph: {
              nodes: [
                { id: "in-1", type: INPORT_BLOCK_TYPE, data: { label: "in1" } },
                { id: "in-2", type: INPORT_BLOCK_TYPE, data: { label: "In1" } },
                { id: "out", type: OUTPORT_BLOCK_TYPE, data: { label: "out1" } },
              ],
              edges: [],
            },
          },
        },
      ],
      edges: [],
    };

    const issues = validateSimulationGraph({
      graph,
      registry: DEFAULT_BLOCK_REGISTRY,
      baseStepTimeMs: 100,
    });

    expect(issues.some((issue) => issue.code === "INVALID_SUBSYSTEM_INTERFACE")).toBe(true);
  });

  it("flags empty subsystem Outport label", () => {
    const graph: SimulationGraph = {
      nodes: [
        {
          id: "subsystem",
          type: SUBSYSTEM_BLOCK_TYPE,
          data: {
            graph: {
              nodes: [
                { id: "in", type: INPORT_BLOCK_TYPE, data: { label: "in1" } },
                { id: "out", type: OUTPORT_BLOCK_TYPE, data: { label: "   " } },
              ],
              edges: [],
            },
          },
        },
      ],
      edges: [],
    };

    const issues = validateSimulationGraph({
      graph,
      registry: DEFAULT_BLOCK_REGISTRY,
      baseStepTimeMs: 100,
    });

    expect(
      issues.some(
        (issue) => issue.code === "INVALID_SUBSYSTEM_INTERFACE" && issue.message.includes("empty label")
      )
    ).toBe(true);
  });

  it("rejects vector-to-number direct wiring (Mux -> Gain)", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "counter-a", type: COUNTER_BLOCK_TYPE, data: {} },
        { id: "counter-b", type: COUNTER_BLOCK_TYPE, data: {} },
        { id: "mux", type: MUX_BLOCK_TYPE, data: {} },
        { id: "gain", type: SUM_BLOCK_TYPE, data: {} },
      ],
      edges: [
        { id: "a->mux1", source: "counter-a", target: "mux", targetHandle: "in1" },
        { id: "b->mux2", source: "counter-b", target: "mux", targetHandle: "in2" },
        { id: "mux->gain", source: "mux", target: "gain", targetHandle: "in1" },
      ],
    };

    const issues = validateSimulationGraph({
      graph,
      registry: DEFAULT_BLOCK_REGISTRY,
    });

    expect(issues.some((issue) => issue.code === "INVALID_SIGNAL_TYPE")).toBe(true);
  });


  it("accepts vector wiring between Mux and Demux", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "counter-a", type: COUNTER_BLOCK_TYPE, data: {} },
        { id: "counter-b", type: COUNTER_BLOCK_TYPE, data: {} },
        { id: "mux", type: MUX_BLOCK_TYPE, data: {} },
        { id: "demux", type: DEMUX_BLOCK_TYPE, data: {} },
      ],
      edges: [
        { id: "a->mux1", source: "counter-a", target: "mux", targetHandle: "in1" },
        { id: "b->mux2", source: "counter-b", target: "mux", targetHandle: "in2" },
        { id: "mux->demux", source: "mux", target: "demux", targetHandle: "in" },
      ],
    };

    const issues = validateSimulationGraph({
      graph,
      registry: DEFAULT_BLOCK_REGISTRY,
    });

    expect(issues).toEqual([]);
  });

  it("accepts subsystem mask handle aliases for edge validation", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "counter", type: COUNTER_BLOCK_TYPE, data: {} },
        {
          id: "subsystem",
          type: SUBSYSTEM_BLOCK_TYPE,
          data: {
            mask: {
              inputs: ["err"],
              outputs: ["ctrl"],
              parameters: {},
            },
            graph: {
              nodes: [
                { id: "in", type: INPORT_BLOCK_TYPE, data: { label: "in1" } },
                { id: "pid", type: PID_BLOCK_TYPE, data: { kp: 1, ki: 0, kd: 0, n: 10 } },
                { id: "out", type: OUTPORT_BLOCK_TYPE, data: { label: "out1" } },
              ],
              edges: [
                { id: "in->pid", source: "in", target: "pid", targetHandle: "in" },
                { id: "pid->out", source: "pid", target: "out", targetHandle: "in" },
              ],
            },
          },
        },
        { id: "sink", type: DISPLAY_BLOCK_TYPE, data: {} },
      ],
      edges: [
        { id: "counter->sub-err", source: "counter", target: "subsystem", targetHandle: "err" },
        { id: "sub-ctrl->sink", source: "subsystem", sourceHandle: "ctrl", target: "sink" },
      ],
    };

    const issues = validateSimulationGraph({ graph, registry: DEFAULT_BLOCK_REGISTRY });
    expect(issues).toEqual([]);
  });

});
