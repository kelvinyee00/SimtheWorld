import { GaugeBlock } from "@/src/simulation/blocks/gaugeBlock";
import { LampBlock } from "@/src/simulation/blocks/lampBlock";

describe("Dashboard Sink Blocks (P11-1)", () => {
  describe("GaugeBlock", () => {
    it("persists numeric input in state", () => {
      const result = GaugeBlock.step({
        tick: 0,
        timeMs: 0,
        stepTimeMs: 100,
        nodeId: "g1",
        params: { min: 0, max: 100 },
        inputs: { default: 45 },
        previousState: { value: null },
        registry: {},
        globalSignals: {},
      });

      expect(result.nextState).toEqual({ value: 45 });
    });

    it("handles non-numeric inputs as null", () => {
      const result = GaugeBlock.step({
        tick: 0,
        timeMs: 0,
        stepTimeMs: 100,
        nodeId: "g1",
        params: {},
        inputs: { default: "invalid" as unknown as number },
        previousState: { value: 10 },
        registry: {},
        globalSignals: {},
      });

      expect(result.nextState).toEqual({ value: null });
    });
  });

  describe("LampBlock", () => {
    it("activates on boolean true", () => {
      const result = LampBlock.step({
        tick: 0,
        timeMs: 0,
        stepTimeMs: 100,
        nodeId: "l1",
        params: {},
        inputs: { default: true },
        previousState: { active: false },
        registry: {},
        globalSignals: {},
      });

      expect(result.nextState).toEqual({ active: true });
    });

    it("activates on positive numeric input", () => {
      const result = LampBlock.step({
        tick: 0,
        timeMs: 0,
        stepTimeMs: 100,
        nodeId: "l1",
        params: {},
        inputs: { default: 1 },
        previousState: { active: false },
        registry: {},
        globalSignals: {},
      });

      expect(result.nextState).toEqual({ active: true });
    });

    it("deactivates on numeric 0", () => {
      const result = LampBlock.step({
        tick: 0,
        timeMs: 0,
        stepTimeMs: 100,
        nodeId: "l1",
        params: {},
        inputs: { default: 0 },
        previousState: { active: true },
        registry: {},
        globalSignals: {},
      });

      expect(result.nextState).toEqual({ active: false });
    });
  });
});
