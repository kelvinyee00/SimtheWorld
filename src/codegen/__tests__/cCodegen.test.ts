import { buildCodegenIR, generateAnsiCArtifacts } from "@/src/codegen/cCodegen";
import { COUNTER_BLOCK_TYPE } from "@/src/simulation/blocks/counterBlock";
import { DISPLAY_BLOCK_TYPE } from "@/src/simulation/blocks/displayBlock";
import { GAIN_BLOCK_TYPE } from "@/src/simulation/blocks/gainBlock";
import { SimulationGraph } from "@/src/simulation/types";

describe("C code generation pipeline v1", () => {
  it("builds deterministic sorted IR", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "z-gain", type: GAIN_BLOCK_TYPE, data: { gain: 2 } },
        { id: "a-counter", type: COUNTER_BLOCK_TYPE, data: { start: 1, step: 1 } },
      ],
      edges: [
        { id: "edge-b", source: "z-gain", target: "a-counter" },
        { id: "edge-a", source: "a-counter", target: "z-gain", targetHandle: "in" },
      ],
    };

    const ir = buildCodegenIR({ modelName: "Test Model", graph });

    expect(ir.modelName).toBe("Test_Model");
    expect(ir.nodes.map((node) => node.id)).toEqual(["a-counter", "z-gain"]);
    expect(ir.edges.map((edge) => edge.id)).toEqual(["edge-a", "edge-b"]);
  });

  it("reports unsupported block types and emits deterministic ANSI-C artifacts", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "counter", type: COUNTER_BLOCK_TYPE, data: { start: 0, step: 1 } },
        { id: "display", type: DISPLAY_BLOCK_TYPE, data: {} },
      ],
      edges: [{ id: "counter->display", source: "counter", target: "display" }],
    };

    const artifacts = generateAnsiCArtifacts({
      modelName: "line tracker",
      graph,
    });

    expect(artifacts.ir.unsupportedBlockTypes).toEqual([DISPLAY_BLOCK_TYPE]);
    expect(artifacts.headerSource).toContain("line_tracker_state");
    expect(artifacts.sourceSource).toContain("unsupported block types: display");
    expect(artifacts.sourceSource).toContain("node[0]");
  });
});
