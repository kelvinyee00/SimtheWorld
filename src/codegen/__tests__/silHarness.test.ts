import { runSilEquivalence, serializeSilReport } from "@/src/codegen/silHarness";
import { COUNTER_BLOCK_TYPE } from "@/src/simulation/blocks/counterBlock";
import { DISPLAY_BLOCK_TYPE } from "@/src/simulation/blocks/displayBlock";
import { GAIN_BLOCK_TYPE } from "@/src/simulation/blocks/gainBlock";
import { INTEGRATOR_BLOCK_TYPE } from "@/src/simulation/blocks/integratorBlock";
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
