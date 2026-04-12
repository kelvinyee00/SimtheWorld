import { describe, expect, it } from "vitest";
import { Tensor } from "@/src/simulation/tensor";

describe("Tensor", () => {
  describe("creation", () => {
    it("should create a scalar tensor from number", () => {
      const t = Tensor.fromArray(5.0);
      expect(t.shape.rank).toBe(0);
      expect(t.shape.size).toBe(1);
      expect(t.toArray()).toBe(5.0);
    });

    it("should create a 1D tensor from array", () => {
      const t = Tensor.fromArray([1, 2, 3, 4]);
      expect(t.shape.dims).toEqual([4]);
      expect(t.shape.rank).toBe(1);
      expect(t.toArray()).toEqual([1, 2, 3, 4]);
    });

    it("should create a 2D tensor", () => {
      const t = Tensor.fromArray([
        [1, 2, 3],
        [4, 5, 6],
      ]);
      expect(t.shape.dims).toEqual([2, 3]);
      expect(t.shape.rank).toBe(2);
      expect(t.toArray()).toEqual([
        [1, 2, 3],
        [4, 5, 6],
      ]);
    });

    it("should create zeros tensor", () => {
      const t = Tensor.zeros([2, 3]);
      expect(t.shape.dims).toEqual([2, 3]);
      expect([...t.data]).toEqual([0, 0, 0, 0, 0, 0]);
    });

    it("should create ones tensor", () => {
      const t = Tensor.ones([2, 2]);
      expect([...t.data]).toEqual([1, 1, 1, 1]);
    });
  });

  describe("arithmetic", () => {
    it("should add same-shaped tensors", () => {
      const a = Tensor.fromArray([1, 2, 3]);
      const b = Tensor.fromArray([4, 5, 6]);
      const result = a.add(b);
      expect(result.toArray()).toEqual([5, 7, 9]);
    });

    it("should multiply tensors element-wise", () => {
      const a = Tensor.fromArray([2, 3, 4]);
      const b = Tensor.fromArray([5, 6, 7]);
      const result = a.multiply(b);
      expect(result.toArray()).toEqual([10, 18, 28]);
    });

    it("should scale a tensor", () => {
      const t = Tensor.fromArray([1, 2, 3]);
      const result = t.scale(2.5);
      expect(result.toArray()).toEqual([2.5, 5, 7.5]);
    });

    it("should support broadcasting (scalar + vector)", () => {
      const scalar = Tensor.fromArray(2, "float32");
      const vector = Tensor.fromArray([1, 2, 3, 4]);
      
      const result = vector.add(scalar);
      expect(result.toArray()).toEqual([3, 4, 5, 6]);
    });

    it("should support broadcasting (row vector + matrix)", () => {
      const matrix = Tensor.fromArray([
        [1, 2, 3],
        [4, 5, 6],
      ]);
      const row = Tensor.fromArray([[10, 20, 30]]);
      
      const result = matrix.add(row);
      expect(result.toArray()).toEqual([
        [11, 22, 33],
        [14, 25, 36],
      ]);
    });

    it("should support broadcasting (column vector + matrix)", () => {
      const matrix = Tensor.fromArray([
        [1, 2, 3],
        [4, 5, 6],
      ]);
      const col = Tensor.fromArray([[10], [20]]);
      
      const result = matrix.add(col);
      expect(result.toArray()).toEqual([
        [11, 12, 13],
        [24, 25, 26],
      ]);
    });

    it("should fail on incompatible shapes", () => {
      const a = Tensor.fromArray([1, 2, 3]);
      const b = Tensor.fromArray([1, 2]);
      expect(() => a.add(b)).toThrow("Incompatible broadcast shapes");
    });
  });

  describe("reshaping", () => {
    it("should reshape 1D to 2D", () => {
      const t = Tensor.fromArray([1, 2, 3, 4, 5, 6]);
      const reshaped = t.reshape([2, 3]);
      expect(reshaped.shape.dims).toEqual([2, 3]);
      expect(reshaped.toArray()).toEqual([
        [1, 2, 3],
        [4, 5, 6],
      ]);
    });

    it("should get values by indices", () => {
      const t = Tensor.fromArray([
        [1, 2, 3],
        [4, 5, 6],
      ]);
      expect(t.get(0, 0)).toBe(1);
      expect(t.get(0, 2)).toBe(3);
      expect(t.get(1, 1)).toBe(5);
    });
  });

  describe("different dtypes", () => {
    it("should create float32 tensor", () => {
      const t = Tensor.fromArray([1, 2, 3], "float32");
      expect(t.dtype).toBe("float32");
      expect(t.data).toBeInstanceOf(Float32Array);
    });

    it("should create float64 tensor", () => {
      const t = Tensor.fromArray([1, 2, 3], "float64");
      expect(t.dtype).toBe("float64");
      expect(t.data).toBeInstanceOf(Float64Array);
    });

    it("should create int32 tensor", () => {
      const t = Tensor.fromArray([1, 2, 3], "int32");
      expect(t.dtype).toBe("int32");
      expect(t.data).toBeInstanceOf(Int32Array);
    });
  });
});
