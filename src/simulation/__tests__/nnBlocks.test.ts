import { describe, it, expect } from "vitest";
import { NnDenseBlock, NnActivationBlock } from "@/src/simulation/blocks/nnBlocks";
import { StepContext } from "@/src/simulation/types";

describe("Neural Network Blocks (P13-2)", () => {
  describe("NnDenseBlock (Linear/Dense Layer)", () => {
    it("should perform identity transformation with default parameters", () => {
      const ctx: StepContext = {
        params: {},
        inputs: { in: [1, 2, 3] },
        state: {},
      };
      const result = NnDenseBlock.step(ctx);
      expect(result.outputs.default).toEqual([1, 2, 3]);
    });

    it("should perform matrix multiplication with custom weights and bias", () => {
      const ctx: StepContext = {
        params: {
          weights: [
            [1, 2],
            [3, 4],
          ],
          bias: [10, 20],
        },
        inputs: { in: [1, 2] },
        state: {},
      };
      const result = NnDenseBlock.step(ctx);
      expect(result.outputs.default).toEqual([15, 31]);
    });

    it("should accept input from default handle", () => {
      const ctx: StepContext = {
        params: {},
        inputs: { default: [5, 10] },
        state: {},
      };
      const result = NnDenseBlock.step(ctx);
      expect(result.outputs.default).toEqual([5, 10]);
    });

    it("should return null for non-array input", () => {
      const ctx: StepContext = {
        params: {},
        inputs: { in: "not an array" as unknown as number[] },
        state: {},
      };
      const result = NnDenseBlock.step(ctx);
      expect(result.outputs.default).toBeNull();
    });

    it("should handle single input/output", () => {
      const ctx: StepContext = {
        params: {
          weights: [[2]],
          bias: [5],
        },
        inputs: { in: [3] },
        state: {},
      };
      const result = NnDenseBlock.step(ctx);
      expect(result.outputs.default).toEqual([11]);
    });

    it("should handle negative weights and bias", () => {
      const ctx: StepContext = {
        params: {
          weights: [[-1, -2]],
          bias: [-5],
        },
        inputs: { in: [2, 3] },
        state: {},
      };
      const result = NnDenseBlock.step(ctx);
      expect(result.outputs.default).toEqual([-13]);
    });

    it("should handle fractional weights and bias", () => {
      const ctx: StepContext = {
        params: {
          weights: [[0.5, 0.25]],
          bias: [1.5],
        },
        inputs: { in: [4, 8] },
        state: {},
      };
      const result = NnDenseBlock.step(ctx);
      expect(result.outputs.default).toEqual([5.5]);
    });

    it("should handle mismatched input dimensions gracefully", () => {
      const ctx: StepContext = {
        params: {
          weights: [[1, 2, 3]],
          bias: [0],
        },
        inputs: { in: [1, 2] },
        state: {},
      };
      const result = NnDenseBlock.step(ctx);
      expect(result.outputs.default).toEqual([5]);
    });

    it("should handle empty input array", () => {
      const ctx: StepContext = {
        params: {
          weights: [[1]],
          bias: [5],
        },
        inputs: { in: [] },
        state: {},
      };
      const result = NnDenseBlock.step(ctx);
      expect(result.outputs.default).toEqual([5]);
    });
  });

  describe("NnActivationBlock", () => {
    describe("ReLU activation (default)", () => {
      it("should pass positive values unchanged", () => {
        const ctx: StepContext = {
          params: {},
          inputs: { in: [1, 2, 5] },
          state: {},
        };
        const result = NnActivationBlock.step(ctx);
        expect(result.outputs.default).toEqual([1, 2, 5]);
      });

      it("should zero out negative values", () => {
        const ctx: StepContext = {
          params: {},
          inputs: { in: [-1, -5, 0] },
          state: {},
        };
        const result = NnActivationBlock.step(ctx);
        expect(result.outputs.default).toEqual([0, 0, 0]);
      });

      it("should handle mixed positive and negative values", () => {
        const ctx: StepContext = {
          params: {},
          inputs: { in: [-2, 3, -1, 4, 0] },
          state: {},
        };
        const result = NnActivationBlock.step(ctx);
        expect(result.outputs.default).toEqual([0, 3, 0, 4, 0]);
      });
    });

    describe("Sigmoid activation", () => {
      it("should squash values to [0, 1] range", () => {
        const ctx: StepContext = {
          params: { activation: "sigmoid" },
          inputs: { in: [0] },
          state: {},
        };
        const result = NnActivationBlock.step(ctx);
        expect((result.outputs.default as number[])[0]).toBeCloseTo(0.5, 5);
      });

      it("should handle large positive inputs", () => {
        const ctx: StepContext = {
          params: { activation: "sigmoid" },
          inputs: { in: [10] },
          state: {},
        };
        const result = NnActivationBlock.step(ctx);
        expect((result.outputs.default as number[])[0]).toBeCloseTo(1, 3);
      });

      it("should handle large negative inputs", () => {
        const ctx: StepContext = {
          params: { activation: "sigmoid" },
          inputs: { in: [-10] },
          state: {},
        };
        const result = NnActivationBlock.step(ctx);
        expect((result.outputs.default as number[])[0]).toBeCloseTo(0, 3);
      });

      it("should handle array of values", () => {
        const ctx: StepContext = {
          params: { activation: "sigmoid" },
          inputs: { in: [0, 1, -1] },
          state: {},
        };
        const result = NnActivationBlock.step(ctx);
        const out = result.outputs.default as number[];
        expect(out[0]).toBeCloseTo(0.5, 5);
        expect(out[1]).toBeGreaterThan(0.5);
        expect(out[1]).toBeLessThan(1);
        expect(out[2]).toBeLessThan(0.5);
        expect(out[2]).toBeGreaterThan(0);
      });
    });

    describe("Tanh activation", () => {
      it("should squash values to [-1, 1] range", () => {
        const ctx: StepContext = {
          params: { activation: "tanh" },
          inputs: { in: [0] },
          state: {},
        };
        const result = NnActivationBlock.step(ctx);
        expect((result.outputs.default as number[])[0]).toBeCloseTo(0, 10);
      });

      it("should handle large positive inputs", () => {
        const ctx: StepContext = {
          params: { activation: "tanh" },
          inputs: { in: [10] },
          state: {},
        };
        const result = NnActivationBlock.step(ctx);
        expect((result.outputs.default as number[])[0]).toBeCloseTo(1, 3);
      });

      it("should handle large negative inputs", () => {
        const ctx: StepContext = {
          params: { activation: "tanh" },
          inputs: { in: [-10] },
          state: {},
        };
        const result = NnActivationBlock.step(ctx);
        expect((result.outputs.default as number[])[0]).toBeCloseTo(-1, 3);
      });
    });

    it("should handle scalar input", () => {
      const ctx: StepContext = {
        params: {},
        inputs: { in: 5 },
        state: {},
      };
      const result = NnActivationBlock.step(ctx);
      expect(result.outputs.default).toEqual([5]);
    });

    it("should handle scalar negative input", () => {
      const ctx: StepContext = {
        params: {},
        inputs: { in: -3 },
        state: {},
      };
      const result = NnActivationBlock.step(ctx);
      expect(result.outputs.default).toEqual([0]);
    });

    it("should handle null input", () => {
      const ctx: StepContext = {
        params: {},
        inputs: { in: null },
        state: {},
      };
      const result = NnActivationBlock.step(ctx);
      expect(result.outputs.default).toBeNull();
    });
  });
});
