import { buildCodegenIR, generateAnsiCArtifacts } from "@/src/codegen/cCodegen";
import { COUNTER_BLOCK_TYPE } from "@/src/simulation/blocks/counterBlock";
import { DISPLAY_BLOCK_TYPE } from "@/src/simulation/blocks/displayBlock";
import { GAIN_BLOCK_TYPE } from "@/src/simulation/blocks/gainBlock";
import { TRUTH_TABLE_BLOCK_TYPE } from "@/src/simulation/blocks/truthTableBlock";
import { STATE_MACHINE_BLOCK_TYPE } from "@/src/simulation/blocks/stateMachineBlock";
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

  it("emits truth table branch code for numeric/boolean row domains", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "counter", type: COUNTER_BLOCK_TYPE, data: { start: 1, step: 1 } },
        {
          id: "truth",
          type: TRUTH_TABLE_BLOCK_TYPE,
          data: {
            inputHandles: ["in1", "in2"],
            rows: [
              { when: { in1: 1 }, output: 10 },
              { when: { in2: true }, output: 20 },
            ],
            elseOutput: 0,
          },
        },
      ],
      edges: [
        { id: "counter->truth-in1", source: "counter", target: "truth", targetHandle: "in1" },
      ],
    };

    const artifacts = generateAnsiCArtifacts({ modelName: "truth_codegen", graph });

    expect(artifacts.sourceSource).toContain("Truth Table logic emitted (row-priority)");
    expect(artifacts.sourceSource).toContain("fabs(");
    expect(artifacts.sourceSource).toContain("else {");
  });


  it("emits state-machine state index initialization and transition skeleton", () => {
    const graph: SimulationGraph = {
      nodes: [
        {
          id: "sm",
          type: STATE_MACHINE_BLOCK_TYPE,
          data: {
            initialState: "idle",
            states: ["idle", "active"],
            transitions: [
              { from: "idle", to: "active", output: 1 },
              { from: "active", to: "idle", guardExpr: "inputs.in === false", output: 0 },
            ],
          },
        },
      ],
      edges: [],
    };

    const artifacts = generateAnsiCArtifacts({ modelName: "sm_codegen", graph });

    expect(artifacts.sourceSource).toContain("state_machine_active_state[0] = 0");
    expect(artifacts.sourceSource).toContain("State Machine logic emitted (state-index skeleton)");
    expect(artifacts.sourceSource).toContain("sm_prev_state_0 == 0");
    expect(artifacts.sourceSource).toContain("guardExpr not lowered in v1");
    expect(artifacts.sourceSource).toContain("states: 0:idle, 1:active");
  });

});
