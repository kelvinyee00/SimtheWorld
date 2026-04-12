import { describe, expect, it } from "vitest";
import { SumBlock, TensorSumBlock } from "@/src/simulation/blocks/sumBlock";
import { GainBlock, TensorGainBlock } from "@/src/simulation/blocks/gainBlock";
import { ProductBlock, TensorProductBlock } from "@/src/simulation/blocks/productBlock";
import { MatrixProductBlock } from "@/src/simulation/blocks/matrixProductBlock";
import { Tensor } from "@/src/core";
import { BlockStepContext } from "@/src/simulation/types";

describe("P14-1c: Core Block Migration (Sum, Gain, Product, MatrixProduct)", () => {
  describe("SumBlock (Tensor-Enhanced)", () => {
    it("should sum scalar values (backward compatible)", () => {
      const ctx: BlockStepContext = {
        tick: 0,
        timeMs: 0,
        stepTimeMs: 1,
        nodeId: "test",
        params: {},
        inputs: { in1: 5, in2: 10, default: 3 },
        previousState: null,
        registry: {},
        globalSignals: {},
      };
      const result = SumBlock.step(ctx);
      expect(result.outputs.default).toBe(18);
    });

    it("should sum Tensor elements (P14-1c feature)", () => {
      const t1 = Tensor.fromArray([1, 2, 3, 4]);
      const ctx: BlockStepContext = {
        tick: 0,
        timeMs: 0,
        stepTimeMs: 1,
        nodeId: "test",
        params: {},
        inputs: { default: t1 },
        previousState: null,
        registry: {},
        globalSignals: {},
      };
      const result = SumBlock.step(ctx);
      expect(result.outputs.default).toBe(10);
    });

    it("should sum mixed scalar and Tensor inputs", () => {
      const tensor = Tensor.fromArray([10, 20, 30]);
      const ctx: BlockStepContext = {
        tick: 0,
        timeMs: 0,
        stepTimeMs: 1,
        nodeId: "test",
        params: {},
        inputs: { scalar: 5, tensor: tensor },
        previousState: null,
        registry: {},
        globalSignals: {},
      };
      const result = SumBlock.step(ctx);
      expect(result.outputs.default).toBe(65);
    });

    it("should return null for empty inputs", () => {
      const ctx: BlockStepContext = {
        tick: 0,
        timeMs: 0,
        stepTimeMs: 1,
        nodeId: "test",
        params: {},
        inputs: {},
        previousState: null,
        registry: {},
        globalSignals: {},
      };
      const result = SumBlock.step(ctx);
      expect(result.outputs.default).toBeNull();
    });
  });

  describe("TensorSumBlock (Dedicated)", () => {
    it("should sum all elements from multiple tensors", () => {
      const t1 = Tensor.fromArray([1, 2]);
      const t2 = Tensor.fromArray([3, 4, 5]);
      const ctx: BlockStepContext = {
        tick: 0,
        timeMs: 0,
        stepTimeMs: 1,
        nodeId: "test",
        params: {},
        inputs: { in1: t1, in2: t2 },
        previousState: null,
        registry: {},
        globalSignals: {},
      };
      const result = TensorSumBlock.step(ctx);
      expect(result.outputs.default).toBe(15);
    });
  });

  describe("GainBlock (Tensor-Enhanced)", () => {
    it("should scale scalar value (backward compatible)", () => {
      const ctx: BlockStepContext = {
        tick: 0,
        timeMs: 0,
        stepTimeMs: 1,
        nodeId: "test",
        params: { gain: 2.5 },
        inputs: { default: 10 },
        previousState: null,
        registry: {},
        globalSignals: {},
      };
      const result = GainBlock.step(ctx);
      expect(result.outputs.default).toBe(25);
    });

    it("should scale Tensor elements", () => {
      const tensor = Tensor.fromArray([2, 4, 6]);
      const ctx: BlockStepContext = {
        tick: 0,
        timeMs: 0,
        stepTimeMs: 1,
        nodeId: "test",
        params: { gain: 3 },
        inputs: { default: tensor },
        previousState: null,
        registry: {},
        globalSignals: {},
      };
      const result = GainBlock.step(ctx);
      const output = result.outputs.default as Tensor;
      expect(output.get(0)).toBe(6);
      expect(output.get(1)).toBe(12);
      expect(output.get(2)).toBe(18);
    });
  });

  describe("TensorGainBlock (Dedicated)", () => {
    it("should scale 2D tensor", () => {
      const tensor = Tensor.fromArray([[1, 2], [3, 4]], [2, 2]);
      const ctx: BlockStepContext = {
        tick: 0,
        timeMs: 0,
        stepTimeMs: 1,
        nodeId: "test",
        params: { gain: 2 },
        inputs: { default: tensor },
        previousState: null,
        registry: {},
        globalSignals: {},
      };
      const result = TensorGainBlock.step(ctx);
      const output = result.outputs.default as Tensor;
      expect(output.get(0, 0)).toBe(2);
      expect(output.get(1, 1)).toBe(8);
    });
  });

  describe("ProductBlock (Tensor-Enhanced)", () => {
    it("should multiply scalar values (backward compatible)", () => {
      const ctx: BlockStepContext = {
        tick: 0,
        timeMs: 0,
        stepTimeMs: 1,
        nodeId: "test",
        params: {},
        inputs: { in1: 2, in2: 3, default: 4 },
        previousState: null,
        registry: {},
        globalSignals: {},
      };
      const result = ProductBlock.step(ctx);
      expect(result.outputs.default).toBe(24);
    });

    it("should perform element-wise multiplication on Tensors", () => {
      const t1 = Tensor.fromArray([2, 3]);
      const t2 = Tensor.fromArray([4, 5]);
      const ctx: BlockStepContext = {
        tick: 0,
        timeMs: 0,
        stepTimeMs: 1,
        nodeId: "test",
        params: {},
        inputs: { a: t1, b: t2 },
        previousState: null,
        registry: {},
        globalSignals: {},
      };
      const result = ProductBlock.step(ctx);
      const output = result.outputs.default as Tensor;
      expect(output.get(0)).toBe(8);
      expect(output.get(1)).toBe(15);
    });
  });

  describe("MatrixProductBlock (Tensor-Enhanced)", () => {
    it("should perform matrix multiplication using Tensors", () => {
      const a = Tensor.fromArray([[1, 2], [3, 4]], [2, 2]);
      const b = Tensor.fromArray([[5, 6], [7, 8]], [2, 2]);
      const ctx: BlockStepContext = {
        tick: 0,
        timeMs: 0,
        stepTimeMs: 1,
        nodeId: "test",
        params: {},
        inputs: { a, b },
        previousState: null,
        registry: {},
        globalSignals: {},
      };
      // @ts-ignore
      const result = MatrixProductBlock.step(ctx);
      const output = result.outputs.default as Tensor;
      expect(output.get(0, 0)).toBe(19);
      expect(output.get(0, 1)).toBe(22);
      expect(output.get(1, 0)).toBe(43);
      expect(output.get(1, 1)).toBe(50);
    });

    it("should scale Tensor by scalar in MatrixProductBlock", () => {
      const b = Tensor.fromArray([1, 2, 3]);
      const ctx: BlockStepContext = {
        tick: 0,
        timeMs: 0,
        stepTimeMs: 1,
        nodeId: "test",
        params: {},
        inputs: { a: 10, b },
        previousState: null,
        registry: {},
        globalSignals: {},
      };
      // @ts-ignore
      const result = MatrixProductBlock.step(ctx);
      const output = result.outputs.default as Tensor;
      expect(output.get(0)).toBe(10);
      expect(output.get(2)).toBe(30);
    });
  });
});
