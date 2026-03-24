import { runSilEquivalence, serializeSilReport } from "@/src/codegen/silHarness";
import { COUNTER_BLOCK_TYPE } from "@/src/simulation/blocks/counterBlock";
import { DISPLAY_BLOCK_TYPE } from "@/src/simulation/blocks/displayBlock";
import { GAIN_BLOCK_TYPE } from "@/src/simulation/blocks/gainBlock";
import { INTEGRATOR_BLOCK_TYPE } from "@/src/simulation/blocks/integratorBlock";
import { STATE_MACHINE_BLOCK_TYPE } from "@/src/simulation/blocks/stateMachineBlock";
import { DEFAULT_BLOCK_REGISTRY } from "@/src/simulation/registry";
import { SimulationGraph } from "@/src/simulation/types";

describe("SIL equivalence harness", () => {
  it("passes for supported deterministic subset", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "counter", type: COUNTER_BLOCK_TYPE, data: { start: 1, step: 1, mode: "inc" } },
        { id: "gain", type: GAIN_BLOCK_TYPE, data: { gain: 2 } },
      ],
      edges: [{ id: "counter->gain", source: "counter", target: "gain", targetHandle: "in" }],
    };

    const result = runSilEquivalence({
      modelName: "sil_supported",
      graph,
      registry: DEFAULT_BLOCK_REGISTRY,
      ticks: 4,
      probes: [{ nodeId: "gain" }],
    });

    expect(result.pass).toBe(true);
    expect(result.mismatches).toEqual([]);
    expect(result.unsupportedBlockTypes).toEqual([]);
    expect(result.report.pass).toBe(true);
  });

  it("detects mismatch/unsupported blocks outside generated subset", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "counter", type: COUNTER_BLOCK_TYPE, data: { start: 1, step: 1, mode: "inc" } },
        { id: "integrator", type: INTEGRATOR_BLOCK_TYPE, data: { initialCondition: 0 } },
      ],
      edges: [
        { id: "counter->integrator", source: "counter", target: "integrator", targetHandle: "in" },
      ],
    };

    const result = runSilEquivalence({
      modelName: "sil_unsupported",
      graph,
      registry: DEFAULT_BLOCK_REGISTRY,
      ticks: 3,
      probes: [{ nodeId: "integrator" }],
    });

    expect(result.pass).toBe(false);
    expect(result.mismatches.length).toBeGreaterThan(0);
    expect(result.unsupportedBlockTypes).toContain(INTEGRATOR_BLOCK_TYPE);
  });

  it("fails strict mode when unsupported blocks exist even without mismatches", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "counter", type: COUNTER_BLOCK_TYPE, data: { start: 1, step: 0, mode: "inc" } },
        { id: "display", type: DISPLAY_BLOCK_TYPE, data: {} },
      ],
      edges: [{ id: "counter->display", source: "counter", target: "display", targetHandle: "in" }],
    };

    const result = runSilEquivalence({
      modelName: "sil_strict_unsupported",
      graph,
      registry: DEFAULT_BLOCK_REGISTRY,
      ticks: 2,
      probes: [{ nodeId: "display" }],
      strictMode: "unsupported-fail",
    });

    expect(result.unsupportedBlockTypes).toContain(DISPLAY_BLOCK_TYPE);
    expect(result.mismatches).toEqual([]);
    expect(result.pass).toBe(false);
    expect(result.failureReason).toContain("Unsupported block types");
  });

  it("matches runtime for temporal and event-gated state-machine transitions", () => {
    const graph: SimulationGraph = {
      nodes: [
        { id: "srcRise", type: COUNTER_BLOCK_TYPE, data: { start: 0, step: 1, mode: "inc" } },
        { id: "srcFall", type: COUNTER_BLOCK_TYPE, data: { start: 1, step: 1, mode: "dec" } },
        {
          id: "smRise",
          type: STATE_MACHINE_BLOCK_TYPE,
          data: {
            initialState: "idle",
            states: ["idle", "armed", "active"],
            transitions: [
              { from: "idle", to: "armed", event: "rising" as const, eventInput: "in", output: 10 },
              { from: "armed", to: "active", afterMs: 200, output: 20 },
            ],
          },
        },
        {
          id: "smFall",
          type: STATE_MACHINE_BLOCK_TYPE,
          data: {
            initialState: "idle",
            states: ["idle", "done"],
            transitions: [
              { from: "idle", to: "done", event: "falling" as const, eventInput: "in", output: 30 },
            ],
          },
        },
      ],
      edges: [
        { id: "srcRise->smRise", source: "srcRise", target: "smRise", targetHandle: "in" },
        { id: "srcFall->smFall", source: "srcFall", target: "smFall", targetHandle: "in" },
      ],
    };

    const result = runSilEquivalence({
      modelName: "sil_sm_temporal_events",
      graph,
      registry: DEFAULT_BLOCK_REGISTRY,
      ticks: 5,
      probes: [
        { nodeId: "smRise", handle: "state" },
        { nodeId: "smRise", handle: "default" },
        { nodeId: "smFall", handle: "state" },
        { nodeId: "smFall", handle: "default" },
      ],
      stepTimeMs: 100,
    });

    expect(result.pass).toBe(true);
    expect(result.mismatches).toEqual([]);

    expect(result.generatedTrace.map((entry) => entry.values["smRise.state"])).toEqual([
      "idle",
      "armed",
      "armed",
      "active",
      "active",
    ]);
    expect(result.generatedTrace.map((entry) => entry.values["smRise.default"])).toEqual([
      null,
      10,
      null,
      20,
      null,
    ]);
    expect(result.generatedTrace.map((entry) => entry.values["smFall.state"])).toEqual([
      "idle",
      "done",
      "done",
      "done",
      "done",
    ]);
    expect(result.generatedTrace.map((entry) => entry.values["smFall.default"])).toEqual([
      null,
      30,
      null,
      null,
      null,
    ]);
  });

  it("normalizes probe ordering for deterministic SIL traces", () => {
    const graph: SimulationGraph = {
      nodes: [{ id: "counter", type: COUNTER_BLOCK_TYPE, data: { start: 1, step: 0, mode: "inc" } }],
      edges: [],
    };

    const result = runSilEquivalence({
      modelName: "sil_probe_determinism",
      graph,
      registry: DEFAULT_BLOCK_REGISTRY,
      ticks: 1,
      probes: [
        { nodeId: "counter", handle: "z" },
        { nodeId: "counter" },
        { nodeId: "counter", handle: "a" },
      ],
    });

    expect(result.report.probes).toEqual([
      { nodeId: "counter", handle: "a" },
      { nodeId: "counter" },
      { nodeId: "counter", handle: "z" },
    ]);
    expect(Object.keys(result.generatedTrace[0].values)).toEqual([
      "counter.a",
      "counter.default",
      "counter.z",
    ]);
  });

  it("serializes SIL reports for CI export", () => {
    const graph: SimulationGraph = {
      nodes: [{ id: "counter", type: COUNTER_BLOCK_TYPE, data: { start: 1, step: 0, mode: "inc" } }],
      edges: [],
    };

    const result = runSilEquivalence({
      modelName: "sil_report",
      graph,
      registry: DEFAULT_BLOCK_REGISTRY,
      ticks: 1,
      probes: [{ nodeId: "counter" }],
      strictMode: "off",
    });

    const reportJson = serializeSilReport(result.report);
    expect(reportJson).toContain("\"modelName\"");
    expect(reportJson).toContain("\"mismatchCount\"");
    expect(reportJson).toContain("\"strictMode\"");
  });
});
