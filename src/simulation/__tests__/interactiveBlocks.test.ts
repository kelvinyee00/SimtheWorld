import { KnobBlock } from "../blocks/knobBlock";
import { SliderBlock } from "../blocks/sliderBlock";

describe("Interactive Blocks (P11-2)", () => {
  describe("KnobBlock", () => {
    it("initializes with parameter value", () => {
      const state = KnobBlock.initialize!({ initialValue: 42 });
      expect(state).toEqual({ value: 42 });
    });

    it("emits current value from state", () => {
      const result = KnobBlock.step({
        tick: 0,
        timeMs: 0,
        stepTimeMs: 100,
        nodeId: "k1",
        params: {},
        inputs: {},
        previousState: { value: 3.14 },
        registry: {},
        globalSignals: {},
      });
      expect(result.outputs.default).toBe(3.14);
      expect(result.nextState).toEqual({ value: 3.14 });
    });
  });

  describe("SliderBlock", () => {
    it("initializes with parameter value", () => {
      const state = SliderBlock.initialize!({ initialValue: 10 });
      expect(state).toEqual({ value: 10 });
    });

    it("emits current value from state", () => {
      const result = SliderBlock.step({
        tick: 0,
        timeMs: 0,
        stepTimeMs: 100,
        nodeId: "s1",
        params: {},
        inputs: {},
        previousState: { value: 0.5 },
        registry: {},
        globalSignals: {},
      });
      expect(result.outputs.default).toBe(0.5);
      expect(result.nextState).toEqual({ value: 0.5 });
    });
  });
});
