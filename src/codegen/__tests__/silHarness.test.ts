import { runSilEquivalence } from "@/src/codegen/silHarness";
import { COUNTER_BLOCK_TYPE } from "@/src/simulation/blocks/counterBlock";
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
      edges: [
        { id: "counter->gain", source: "counter", target: "gain", targetHandle: "in" },
      ],
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
});
