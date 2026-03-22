import { TruthTableBlock } from "@/src/simulation/blocks/truthTableBlock";

describe("TruthTableBlock", () => {
  it("selects first matching row by deterministic priority", () => {
    const result = TruthTableBlock.step({
      tick: 0,
      timeMs: 0,
      stepTimeMs: 100,
      nodeId: "tt",
      params: {
        inputHandles: ["in1", "in2"],
        rows: [
          { when: { in1: true }, output: 1 },
          { when: { in1: true, in2: true }, output: 2 },
        ],
        elseOutput: 0,
      },
      inputs: { in1: true, in2: true },
      previousState: null,
      registry: {},
      globalSignals: {},
    });

    expect(result.outputs.default).toBe(1);
    expect(result.outputs.row).toBe(0);
  });

  it("falls back to elseOutput when no row matches", () => {
    const result = TruthTableBlock.step({
      tick: 0,
      timeMs: 0,
      stepTimeMs: 100,
      nodeId: "tt",
      params: {
        inputHandles: ["in1", "in2"],
        rows: [{ when: { in1: true, in2: true }, output: 1 }],
        elseOutput: false,
      },
      inputs: { in1: true, in2: false },
      previousState: null,
      registry: {},
      globalSignals: {},
    });

    expect(result.outputs.default).toBe(false);
    expect(result.outputs.row).toBeNull();
  });

  it("supports string and numeric matching", () => {
    const result = TruthTableBlock.step({
      tick: 0,
      timeMs: 0,
      stepTimeMs: 100,
      nodeId: "tt",
      params: {
        inputHandles: ["mode", "value"],
        rows: [
          { when: { mode: "AUTO", value: 5 }, output: true },
          { when: { mode: "MANUAL" }, output: false },
        ],
        elseOutput: null,
      },
      inputs: { mode: "AUTO", value: 5 },
      previousState: null,
      registry: {},
      globalSignals: {},
    });

    expect(result.outputs.default).toBe(true);
    expect(result.outputs.row).toBe(0);
  });

  it("uses default input as fallback for in1", () => {
    const result = TruthTableBlock.step({
      tick: 0,
      timeMs: 0,
      stepTimeMs: 100,
      nodeId: "tt",
      params: {
        inputHandles: ["in1"],
        rows: [{ when: { in1: 7 }, output: 77 }],
        elseOutput: 0,
      },
      inputs: { default: 7 },
      previousState: null,
      registry: {},
      globalSignals: {},
    });

    expect(result.outputs.default).toBe(77);
    expect(result.outputs.row).toBe(0);
  });
});
