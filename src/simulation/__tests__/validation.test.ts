import { COUNTER_BLOCK_TYPE } from "@/src/simulation/blocks/counterBlock";
import { DISPLAY_BLOCK_TYPE } from "@/src/simulation/blocks/displayBlock";
import { SUM_BLOCK_TYPE } from "@/src/simulation/blocks/sumBlock";
import { UNIT_DELAY_BLOCK_TYPE } from "@/src/simulation/blocks/unitDelayBlock";
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
});
