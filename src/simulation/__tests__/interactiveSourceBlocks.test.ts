import { describe, expect, it } from "vitest";
import { KnobBlock, SliderBlock } from "../blocks/interactiveSourceBlocks";
import { BlockStepContext } from "../types";

describe("Interactive Source Blocks (P11-2)", () => {
  describe("KnobBlock", () => {
    it("emits the current parameter value", () => {
      const context = {
        params: { value: 75 },
        inputs: {},
      } as unknown as BlockStepContext;

      const result = KnobBlock.step(context);
      expect(result.outputs.default).toBe(75);
    });

    it("defaults to 0 if parameter is missing", () => {
      const context = {
        params: {},
        inputs: {},
      } as unknown as BlockStepContext;

      const result = KnobBlock.step(context);
      expect(result.outputs.default).toBe(0);
    });
  });

  describe("SliderBlock", () => {
    it("emits the current parameter value", () => {
      const context = {
        params: { value: -12.5 },
        inputs: {},
      } as unknown as BlockStepContext;

      const result = SliderBlock.step(context);
      expect(result.outputs.default).toBe(-12.5);
    });

    it("defaults to 0 if parameter is missing", () => {
      const context = {
        params: {},
        inputs: {},
      } as unknown as BlockStepContext;

      const result = SliderBlock.step(context);
      expect(result.outputs.default).toBe(0);
    });
  });
});
