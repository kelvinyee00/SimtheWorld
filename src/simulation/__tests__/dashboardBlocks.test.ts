import { GaugeBlock } from "../blocks/gaugeBlock";
import { LampBlock } from "../blocks/lampBlock";

describe("Dashboard Blocks (P11-1)", () => {
  describe("GaugeBlock", () => {
    it("updates its state with numeric input", () => {
      const result = GaugeBlock.step({
        tick: 0,
        timeMs: 0,
        stepTimeMs: 100,
        nodeId: "g1",
        params: { min: 0, max: 100 },
        inputs: { default: 42 },
        previousState: { value: 0 },
        registry: {},
        globalSignals: {},
      });
      expect(result.nextState).toEqual({ value: 42 });
    });

    it("handles null/invalid input", () => {
      const result = GaugeBlock.step({
        tick: 0,
        timeMs: 0,
        stepTimeMs: 100,
        nodeId: "g1",
        params: { min: 0, max: 100 },
        inputs: { default: null },
        previousState: { value: 42 },
        registry: {},
        globalSignals: {},
      });
      expect(result.nextState).toEqual({ value: null });
    });
  });

  describe("LampBlock", () => {
    it("becomes active with boolean true input", () => {
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

    it("becomes active with numeric positive input", () => {
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

    it("becomes inactive with boolean false input", () => {
      const result = LampBlock.step({
        tick: 0,
        timeMs: 0,
        stepTimeMs: 100,
        nodeId: "l1",
        params: {},
        inputs: { default: false },
        previousState: { active: true },
        registry: {},
        globalSignals: {},
      });
      expect(result.nextState).toEqual({ active: false });
    });
  });
});
