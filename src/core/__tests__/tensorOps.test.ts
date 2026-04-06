import { describe, expect, it } from "vitest";
import { Tensor } from "../tensor";
import { add, sub, mul, div, scale, matmul, transpose, dot, sum, mean, bmm } from "../tensorOps";

describe("P14-1b: Optimized Linear Algebra Operators", () => {
  describe("Element-wise Operations", () => {
    it("should add two 1D tensors", () => {
      const a = Tensor.fromArray([1, 2, 3]);
      const b = Tensor.fromArray([4, 5, 6]);
      const result = add(a, b);
      expect(result.shape).toEqual([3]);
      expect(result.get(0)).toBe(5);
      expect(result.get(1)).toBe(7);
      expect(result.get(2)).toBe(9);
    });

    it("should add two 2D tensors (matrices)", () => {
      const a = Tensor.fromArray([[1, 2], [3, 4]], [2, 2]);
      const b = Tensor.fromArray([[5, 6], [7, 8]], [2, 2]);
      const result = add(a, b);
      expect(result.shape).toEqual([2, 2]);
      expect(result.get(0, 0)).toBe(6);
      expect(result.get(1, 1)).toBe(12);
    });

    it("should subtract tensors", () => {
      const a = Tensor.fromArray([10, 20, 30]);
      const b = Tensor.fromArray([1, 2, 3]);
      const result = sub(a, b);
      expect(result.get(0)).toBe(9);
      expect(result.get(1)).toBe(18);
      expect(result.get(2)).toBe(27);
    });

    it("should multiply tensors element-wise", () => {
      const a = Tensor.fromArray([2, 3, 4]);
      const b = Tensor.fromArray([5, 6, 7]);
      const result = mul(a, b);
      expect(result.get(0)).toBe(10);
      expect(result.get(1)).toBe(18);
      expect(result.get(2)).toBe(28);
    });

    it("should divide tensors element-wise", () => {
      const a = Tensor.fromArray([10, 20, 30]);
      const b = Tensor.fromArray([2, 4, 5]);
      const result = div(a, b);
      expect(result.get(0)).toBe(5);
      expect(result.get(1)).toBe(5);
      expect(result.get(2)).toBe(6);
    });

    it("should throw on division by zero", () => {
      const a = Tensor.fromArray([1, 2]);
      const b = Tensor.fromArray([0, 1]);
      expect(() => div(a, b)).toThrow("Division by zero");
    });

    it("should throw on shape mismatch", () => {
      const a = Tensor.fromArray([1, 2, 3]);
      const b = Tensor.fromArray([4, 5]);
      expect(() => add(a, b)).toThrow("Shape dimension mismatch");
    });

    it("should scale tensor by scalar", () => {
      const t = Tensor.fromArray([1, 2, 3, 4]);
      const result = scale(t, 2.5);
      expect(result.get(0)).toBe(2.5);
      expect(result.get(1)).toBe(5);
      expect(result.get(2)).toBe(7.5);
      expect(result.get(3)).toBe(10);
    });
  });

  describe("Matrix Multiplication", () => {
    it("should multiply 2x2 matrices", () => {
      // [[1, 2], [3, 4]] @ [[5, 6], [7, 8]] = [[19, 22], [43, 50]]
      const a = Tensor.fromArray([[1, 2], [3, 4]], [2, 2]);
      const b = Tensor.fromArray([[5, 6], [7, 8]], [2, 2]);
      const result = matmul(a, b);
      expect(result.shape).toEqual([2, 2]);
      expect(result.get(0, 0)).toBe(19); // 1*5 + 2*7
      expect(result.get(0, 1)).toBe(22); // 1*6 + 2*8
      expect(result.get(1, 0)).toBe(43); // 3*5 + 4*7
      expect(result.get(1, 1)).toBe(50); // 3*6 + 4*8
    });

    it("should multiply non-square matrices", () => {
      // [2x3] @ [3x4] = [2x4]
      const a = Tensor.fromArray([[1, 2, 3], [4, 5, 6]], [2, 3]);
      const b = Tensor.fromArray([[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]], [3, 4]);
      const result = matmul(a, b);
      expect(result.shape).toEqual([2, 4]);
      // First row: [38, 44, 50, 56]
      expect(result.get(0, 0)).toBe(38); // 1*1 + 2*5 + 3*9
      expect(result.get(0, 1)).toBe(44); // 1*2 + 2*6 + 3*10
      // Second row: [83, 98, 113, 128]
      expect(result.get(1, 0)).toBe(83); // 4*1 + 5*5 + 6*9
      expect(result.get(1, 1)).toBe(98); // 4*2 + 5*6 + 6*10
    });

    it("should throw on incompatible shapes", () => {
      const a = Tensor.fromArray([[1, 2]], [1, 2]);
      const b = Tensor.fromArray([[1, 2, 3]], [1, 3]);
      expect(() => matmul(a, b)).toThrow("Incompatible shapes");
    });

    it("should throw on non-2D tensors", () => {
      const a = Tensor.fromArray([1, 2, 3]);
      const b = Tensor.fromArray([4, 5, 6]);
      expect(() => matmul(a, b)).toThrow("Both tensors must be 2D");
    });
  });

  describe("Transpose", () => {
    it("should transpose 2x3 to 3x2", () => {
      const t = Tensor.fromArray([[1, 2, 3], [4, 5, 6]], [2, 3]);
      const result = transpose(t);
      expect(result.shape).toEqual([3, 2]);
      expect(result.get(0, 0)).toBe(1); // was [0,0]
      expect(result.get(0, 1)).toBe(4); // was [1,0]
      expect(result.get(1, 0)).toBe(2); // was [0,1]
      expect(result.get(2, 1)).toBe(6); // was [1,2]
    });

    it("should throw on non-2D tensor", () => {
      const t = Tensor.fromArray([1, 2, 3]);
      expect(() => transpose(t)).toThrow("Expected 2D tensor");
    });
  });

  describe("Dot Product", () => {
    it("should compute dot product of 1D vectors", () => {
      const a = Tensor.fromArray([1, 2, 3]);
      const b = Tensor.fromArray([4, 5, 6]);
      const result = dot(a, b);
      expect(result).toBe(32); // 1*4 + 2*5 + 3*6
    });

    it("should throw on non-1D tensors", () => {
      const a = Tensor.fromArray([[1, 2], [3, 4]], [2, 2]);
      const b = Tensor.fromArray([[5, 6], [7, 8]], [2, 2]);
      expect(() => dot(a, b)).toThrow("Expected 1D tensors");
    });

    it("should throw on size mismatch", () => {
      const a = Tensor.fromArray([1, 2, 3]);
      const b = Tensor.fromArray([4, 5]);
      expect(() => dot(a, b)).toThrow("Size mismatch");
    });
  });

  describe("Reductions", () => {
    it("should sum all elements", () => {
      const t = Tensor.fromArray([1, 2, 3, 4, 5]);
      expect(sum(t)).toBe(15);
    });

    it("should compute mean of all elements", () => {
      const t = Tensor.fromArray([10, 20, 30]);
      expect(mean(t)).toBe(20);
    });

    it("should sum 2D tensor", () => {
      const t = Tensor.fromArray([[1, 2], [3, 4]], [2, 2]);
      expect(sum(t)).toBe(10);
    });
  });

  describe("Batch Matrix Multiplication", () => {
    it("should handle batch multiplication", () => {
      // Batch of 2: each [2x3] @ [3x4] = [2x4]
      const a = Tensor.fromArray([
        [[1, 2, 3], [4, 5, 6]], // Batch 0
        [[7, 8, 9], [10, 11, 12]] // Batch 1
      ], [2, 2, 3]);
      const b = Tensor.fromArray([
        [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]], // Batch 0
        [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]] // Batch 1
      ], [2, 3, 4]);
      
      const result = bmm(a, b);
      expect(result.shape).toEqual([2, 2, 4]);
      
      // First batch, first row should match single batch result
      expect(result.get(0, 0, 0)).toBe(38);
      expect(result.get(0, 1, 0)).toBe(83);
    });

    it("should throw on batch size mismatch", () => {
      const a = Tensor.fromArray([[[1, 2], [3, 4]], [[5, 6], [7, 8]]], [2, 2, 2]);
      const b = Tensor.fromArray([[[1, 2], [3, 4]]], [1, 2, 2]);
      expect(() => bmm(a, b)).toThrow("Batch size mismatch");
    });
  });
});
