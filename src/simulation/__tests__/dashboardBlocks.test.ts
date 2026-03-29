import { GaugeBlock, LampBlock } from "../blocks/dashboardBlocks";
import { BlockStepContext } from "../types";

describe("Dashboard Blocks", () => {
  describe("GaugeBlock", () => {
    it("captures numeric input into state", () => {
      const context = {
        inputs: { in: 42 },
      } as unknown as BlockStepContext;

      const result = GaugeBlock.step(context);
      expect(result.nextState).toEqual({ value: 42 });
    });

    it("handles null/non-finite inputs", () => {
      const context = {
        inputs: { in: NaN },
      } as unknown as BlockStepContext;

      const result = GaugeBlock.step(context);
      expect(result.nextState).toEqual({ value: null });
    });
  });

  describe("LampBlock", () => {
    it("activates when numeric input exceeds threshold", () => {
      const context = {
        params: { threshold: 10 },
        inputs: { in: 11 },
      } as unknown as BlockStepContext;

      const result = LampBlock.step(context);
      expect(result.nextState).toEqual({ active: true });
    });

    it("remains inactive when numeric input is below threshold", () => {
      const context = {
        params: { threshold: 10 },
        inputs: { in: 9 },
      } as unknown as BlockStepContext;

      const result = LampBlock.step(context);
      expect(result.nextState).toEqual({ active: false });
    });

    it("respects boolean inputs directly", () => {
      const contextTrue = {
        params: {},
        inputs: { in: true },
      } as unknown as BlockStepContext;

      const contextFalse = {
        params: {},
        inputs: { in: false },
      } as unknown as BlockStepContext;

      expect(LampBlock.step(contextTrue).nextState).toEqual({ active: true });
      expect(LampBlock.step(contextFalse).nextState).toEqual({ active: false });
    });
  });
});
