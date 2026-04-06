import { describe, expect, it } from "vitest";
import { Tensor } from "../tensor";

describe("Tensor Foundation (P14-1a)", () => {
  describe("Construction", () => {
    it("should create a 1D tensor from Float64Array", () => {
      const data = new Float64Array([1, 2, 3, 4, 5]);
      const t = new Tensor(data, [5]);
      expect(t.shape).toEqual([5]);
      expect(t.ndim).toBe(1);
      expect(t.size).toBe(5);
    });

    it("should create a 2D tensor (matrix)", () => {
      const data = new Float64Array([1, 2, 3, 4, 5, 6]);
      const t = new Tensor(data, [2, 3]);
      expect(t.shape).toEqual([2, 3]);
      expect(t.ndim).toBe(2);
      expect(t.size).toBe(6);
    });

    it("should compute row-major strides automatically", () => {
      const data = new Float64Array(6);
      const t = new Tensor(data, [2, 3]);
      expect(t.strides).toEqual([3, 1]); // Row-major: stride[0]=3, stride[1]=1
    });

    it("should throw on invalid shape (negative dimension)", () => {
      expect(() => new Tensor(new Float64Array(5), [-2, 3])).toThrow();
    });

    it("should throw on invalid shape (non-integer)", () => {
      expect(() => new Tensor(new Float64Array(5), [2.5, 3])).toThrow();
    });

    it("should throw on empty shape", () => {
      expect(() => new Tensor(new Float64Array(1), [])).toThrow();
    });
  });

  describe("Static Factory Methods", () => {
    it("should create zero tensor", () => {
      const t = Tensor.zeros([2, 3]);
      expect(t.shape).toEqual([2, 3]);
      expect(t.size).toBe(6);
      expect(t.data.every((v) => v === 0)).toBe(true);
    });

    it("should create ones tensor", () => {
      const t = Tensor.ones([3, 3]);
      expect(t.data.every((v) => v === 1)).toBe(true);
    });

    it("should wrap array with inferred shape", () => {
      const t = Tensor.fromArray([1, 2, 3, 4]);
      expect(t.shape).toEqual([4]);
      expect(t.ndim).toBe(1);
    });

    it("should wrap array with explicit shape", () => {
      const t = Tensor.fromArray([1, 2, 3, 4, 5, 6], [2, 3]);
      expect(t.shape).toEqual([2, 3]);
    });

    it("should create identity matrix", () => {
      const eye = Tensor.eye(3);
      expect(eye.shape).toEqual([3, 3]);
      expect(eye.get(0, 0)).toBe(1);
      expect(eye.get(1, 1)).toBe(1);
      expect(eye.get(2, 2)).toBe(1);
      expect(eye.get(0, 1)).toBe(0);
      expect(eye.get(1, 0)).toBe(0);
    });
  });

  describe("Element Access", () => {
    it("should get 1D elements", () => {
      const t = Tensor.fromArray([10, 20, 30, 40, 50]);
      expect(t.get(0)).toBe(10);
      expect(t.get(2)).toBe(30);
      expect(t.get(4)).toBe(50);
    });

    it("should get 2D elements", () => {
      // [[1, 2, 3], [4, 5, 6]]
      const t = Tensor.fromArray([1, 2, 3, 4, 5, 6], [2, 3]);
      expect(t.get(0, 0)).toBe(1);
      expect(t.get(0, 1)).toBe(2);
      expect(t.get(0, 2)).toBe(3);
      expect(t.get(1, 0)).toBe(4);
      expect(t.get(1, 1)).toBe(5);
      expect(t.get(1, 2)).toBe(6);
    });

    it("should throw on out-of-bounds access", () => {
      const t = Tensor.fromArray([1, 2, 3], [3]);
      expect(() => t.get(5)).toThrow();
      expect(() => t.get(-1)).toThrow();
    });

    it("should throw on dimension mismatch", () => {
      const t = Tensor.zeros([2, 3]);
      expect(() => t.get(0)).toThrow();
      expect(() => t.get(0, 0, 0)).toThrow();
    });
  });

  describe("View Operations", () => {
    it("should reshape 1D to 2D", () => {
      const t = Tensor.fromArray([1, 2, 3, 4, 5, 6]);
      const reshaped = t.reshape([2, 3]);
      expect(reshaped.shape).toEqual([2, 3]);
      expect(reshaped.get(0, 0)).toBe(1);
      expect(reshaped.get(1, 2)).toBe(6);
    });

    it("should flatten 2D to 1D", () => {
      const t = Tensor.fromArray([[1, 2], [3, 4], [5, 6]], [3, 2]);
      const flat = t.flatten();
      expect(flat.shape).toEqual([6]);
      expect(flat.get(0)).toBe(1);
      expect(flat.get(5)).toBe(6);
    });

    it("should throw on invalid reshape (size mismatch)", () => {
      const t = Tensor.fromArray([1, 2, 3, 4, 5]);
      expect(() => t.reshape([2, 3])).toThrow();
    });

    it("should create view with offset", () => {
      const t = Tensor.fromArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const view = t.view([3], 2);
      expect(view.shape).toEqual([3]);
      expect(view.get(0)).toBe(3);
      expect(view.get(2)).toBe(5);
    });
  });

  describe("Serialization", () => {
    it("should convert 1D to JS array", () => {
      const t = Tensor.fromArray([1, 2, 3, 4, 5]);
      const arr = t.toArray();
      expect(Array.isArray(arr)).toBe(true);
      expect(arr).toEqual([1, 2, 3, 4, 5]);
    });

    it("should convert 2D to nested JS array", () => {
      const t = Tensor.fromArray([1, 2, 3, 4, 5, 6], [2, 3]);
      const arr = t.toArray() as number[][];
      expect(arr).toEqual([
        [1, 2, 3],
        [4, 5, 6],
      ]);
    });

    it("should convert scalar to number", () => {
      const t = Tensor.fromArray([42], [1]);
      expect(t.toScalar()).toBe(42);
    });

    it("should throw converting non-scalar", () => {
      const t = Tensor.fromArray([1, 2, 3]);
      expect(() => t.toScalar()).toThrow();
    });
  });

  describe("Immutability", () => {
    it("should create new tensor on set", () => {
      const t1 = Tensor.fromArray([1, 2, 3]);
      const t2 = t1.set(99, 1);
      expect(t1.get(1)).toBe(2);
      expect(t2.get(1)).toBe(99);
      expect(t1.data).not.toBe(t2.data);
    });
  });

  describe("Custom Strides (Advanced)", () => {
    it("should support column-major strides", () => {
      // [[1, 2], [3, 4]] stored column-major: [1, 3, 2, 4]
      const data = new Float64Array([1, 3, 2, 4]);
      const t = new Tensor(data, [2, 2], [1, 2]); // strides[0]=1, strides[1]=2
      expect(t.get(0, 0)).toBe(1);
      expect(t.get(0, 1)).toBe(2);
      expect(t.get(1, 0)).toBe(3);
      expect(t.get(1, 1)).toBe(4);
    });
  });
});
