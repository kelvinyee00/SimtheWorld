import { buildCodegenIR, generateAnsiCArtifacts } from "@/src/codegen/cCodegen";
import { COUNTER_BLOCK_TYPE } from "@/src/simulation/blocks/counterBlock";
import { DISPLAY_BLOCK_TYPE } from "@/src/simulation/blocks/displayBlock";
import { GAIN_BLOCK_TYPE } from "@/src/simulation/blocks/gainBlock";
import { TRUTH_TABLE_BLOCK_TYPE } from "@/src/simulation/blocks/truthTableBlock";
import { STATE_MACHINE_BLOCK_TYPE } from "@/src/simulation/blocks/stateMachineBlock";
import { SimulationGraph } from "@/src/simulation/types";

describe("C code generation pipeline", () => {
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
    // Edges are sorted in IR builder
    expect(ir.edges.length).toBe(2);
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
    expect(artifacts.sourceSource).toContain("/* node[1] id=display type=display */");
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
    expect(artifacts.sourceSource).toContain("states: 0:idle, 1:active");
  });

  it("lowers guard comparisons plus temporal/event gates for state machine transitions", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "src", type: COUNTER_BLOCK_TYPE, data: { start: 0, step: 1 } },
        {
          id: "sm",
          type: STATE_MACHINE_BLOCK_TYPE,
          data: {
            initialState: "idle",
            states: ["idle", "active"],
            transitions: [
              {
                from: "idle",
                to: "active",
                guardExpr: "inputs.in > 0",
                afterMs: 50,
                event: "rising" as const,
                eventInput: "in",
                output: 1,
              },
            ],
          },
        },
      ],
      edges: [{ id: "src->sm", source: "src", target: "sm", targetHandle: "in" }],
    };

    const artifacts = generateAnsiCArtifacts({ modelName: "sm_v2_codegen", graph });

    expect(artifacts.headerSource).toContain("state_machine_elapsed_ms");
    expect(artifacts.headerSource).toContain("state_machine_prev_event_input");
    expect(artifacts.sourceSource).toContain("double step_ms = step_time_sec > 0.0 ? step_time_sec * 1000.0 : 0.0;");
    expect(artifacts.sourceSource).toContain("sm_prev_elapsed_ms_0 >= 50.000000");
    expect(artifacts.sourceSource).toContain("sm_prev_event_signal_0 <= 0.0 && sm_event_signal_0 > 0.0");
  });

  it("lowers constrained state-machine actions and keeps fallback comments for unsupported actions", () => {
    const graph: SimulationGraph = {
      nodes: [
        {
          id: "sm",
          type: STATE_MACHINE_BLOCK_TYPE,
          data: {
            initialState: "idle",
            states: ["idle", "armed", "done"],
            transitions: [
              {
                from: "idle",
                to: "armed",
                guardExpr: "true",
                actionExpr: "memory.slot1 = 3",
                output: 1,
              },
              {
                from: "armed",
                to: "done",
                guardExpr: "true",
                actionExpr: "outputs.out = false",
                output: 0,
              },
              {
                from: "done",
                to: "idle",
                guardExpr: "true",
                actionExpr: "{ count: (memory.count || 0) + 1 }",
                output: 0,
              },
            ],
          },
        },
      ],
      edges: [],
    };

    const artifacts = generateAnsiCArtifacts({ modelName: "sm_action_codegen", graph });

    expect(artifacts.sourceSource).toContain("state->node_internal_state[1] = 3.000000;");
    expect(artifacts.sourceSource).toContain("state->node_outputs[0] = 0.0;");
    expect(artifacts.sourceSource).toContain("actionExpr fallback (unsupported subset)");
  });

  it("recursively flattens subsystems into namespaced C code", () => {
    const graph: SimulationGraph = {
      nodes: [
        {
          id: "sub",
          type: "subsystem",
          data: {
            graph: {
              nodes: [
                { id: "in", type: "inport", data: { label: "in1" } },
                { id: "gain", type: "gain", data: { gain: 5 } },
                { id: "out", type: "outport", data: { label: "out1" } },
              ],
              edges: [
                { id: "e1", source: "in", target: "gain" },
                { id: "e2", source: "gain", target: "out" },
              ],
            },
          },
        },
        { id: "src", type: "counter", data: { start: 1, step: 1 } },
      ],
      edges: [
        { id: "top-e", source: "src", target: "sub", targetHandle: "in1" },
      ],
    };

    const artifacts = generateAnsiCArtifacts({ modelName: "hier_model", graph });

    // Verify all nodes exist in IR with remapped names
    const nodeIds = artifacts.ir.nodes.map(n => n.id);
    expect(nodeIds).toContain("src");
    expect(nodeIds).toContain("sub_in");
    expect(nodeIds).toContain("sub_gain");
    expect(nodeIds).toContain("sub_out");

    // Verify boundary stitching in edges
    const edgeToSubIn = artifacts.ir.edges.find(e => e.target === "sub_in");
    expect(edgeToSubIn?.source).toBe("src");

    expect(artifacts.sourceSource).toContain("/* node[1] id=sub_gain type=gain */");
    // Check for gain logic: index of sub_gain should use output from index of sub_in
    const subInIdx = artifacts.ir.nodes.findIndex(n => n.id === "sub_in");
    const subGainIdx = artifacts.ir.nodes.findIndex(n => n.id === "sub_gain");
    expect(artifacts.sourceSource).toContain(`state->node_outputs[${subGainIdx}] = state->node_outputs[${subInIdx}] * 5.000000;`);
  });
});
