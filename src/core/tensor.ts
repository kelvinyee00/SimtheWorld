/**
 * P14-1a: Tensor Foundation — Vectorized Math Core
 *
 * High-performance tensor implementation using Float64Array for deterministic,
 * GC-friendly numeric computation. Provides the foundation for ONNX inference
 * and headless execution.
 */

/** Shape metadata for n-dimensional tensors */
export type TensorShape = readonly number[];

/** Stride configuration for indexed access */
export type TensorStrides = readonly number[];

/**
 * Immutable Tensor class with Float64Array backing.
 *
 * Design principles:
 * - Deterministic: All operations are pure and reproducible.
 * - GC-efficient: Uses shared ArrayBuffers where possible.
 * - BLAS-like: Shape/strides abstraction for zero-copy views.
 */
export class Tensor {
  /** Underlying typed array storage */
  readonly data: Float64Array;

  /** Dimensions (e.g., [3, 4] for 3×4 matrix) */
  readonly shape: TensorShape;

  /** Byte offset into the buffer */
  readonly offset: number;

  /** Strides for each dimension */
  readonly strides: TensorStrides;

  /** Number of dimensions */
  get ndim(): number {
    return this.shape.length;
  }

  /** Total number of elements */
  get size(): number {
    return this.shape.reduce((a, b) => a * b, 1);
  }

  /** Whether this is a scalar (0-dim tensor) */
  get isScalar(): boolean {
    return this.ndim === 0 || (this.ndim === 1 && this.shape[0] === 1);
  }

  constructor(
    data: Float64Array,
    shape: TensorShape,
    strides?: TensorStrides,
    offset: number = 0
  ) {
    if (shape.length === 0) {
      throw new Error("Tensor shape cannot be empty");
    }
    if (shape.some((d) => !Number.isFinite(d) || d < 0 || !Number.isInteger(d))) {
      throw new Error("Tensor shape dimensions must be non-negative integers");
    }

    this.shape = Object.freeze([...shape]);
    this.data = data;
    this.offset = offset;

    if (strides) {
      if (strides.length !== shape.length) {
        throw new Error("Strides length must match shape length");
      }
      this.strides = Object.freeze([...strides]);
    } else {
      const computedStrides: number[] = [];
      let stride = 1;
      for (let i = shape.length - 1; i >= 0; i--) {
        computedStrides[i] = stride;
        stride *= shape[i];
      }
      this.strides = Object.freeze(computedStrides);
    }

    const minIndex = this.offset;
    const maxIndex = this.offset + this.computeMaxFlatIndex();
    if (minIndex < 0 || maxIndex > data.length) {
      throw new Error(
        `Tensor bounds exceed buffer: [${minIndex}, ${maxIndex}) vs buffer length ${data.length}`
      );
    }
  }

  private indexToFlat(indices: readonly number[]): number {
    if (indices.length !== this.ndim) {
      throw new Error(
        `Index dimension mismatch: expected ${this.ndim}, got ${indices.length}`
      );
    }
    let flat = this.offset;
    for (let i = 0; i < this.ndim; i++) {
      const idx = indices[i];
      if (idx < 0 || idx >= this.shape[i]) {
        throw new Error(
          `Index ${i} out of bounds: ${idx} not in [0, ${this.shape[i]})`
        );
      }
      flat += idx * this.strides[i];
    }
    return flat;
  }

  get(...indices: readonly number[]): number {
    return this.data[this.indexToFlat(indices)];
  }

  set(value: number, ...indices: readonly number[]): Tensor {
    const flatIdx = this.indexToFlat(indices);
    const newData = new Float64Array(this.data);
    newData[flatIdx] = value;
    return new Tensor(newData, this.shape, this.strides, this.offset);
  }

  private computeMaxFlatIndex(): number {
    let maxIdx = 0;
    for (let i = 0; i < this.ndim; i++) {
      maxIdx += (this.shape[i] - 1) * this.strides[i];
    }
    return maxIdx + 1;
  }

  static zeros(shape: readonly number[]): Tensor {
    const size = shape.reduce((a, b) => a * b, 1);
    return new Tensor(new Float64Array(size), shape);
  }

  static ones(shape: readonly number[]): Tensor {
    const size = shape.reduce((a, b) => a * b, 1);
    const data = new Float64Array(size);
    data.fill(1);
    return new Tensor(data, shape);
  }

  static fromArray(
    data: number[] | number[][] | Float64Array,
    shape?: readonly number[]
  ): Tensor {
    if (data instanceof Float64Array) {
      return new Tensor(data, shape ?? [data.length]);
    }
    // Handle nested arrays
    if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) {
      const flatData = (data as number[][]).flat();
      const inferredShape = shape ?? [data.length, flatData.length / data.length];
      return new Tensor(new Float64Array(flatData), inferredShape);
    }
    return new Tensor(new Float64Array(data as number[]), shape ?? [data.length]);
  }

  static eye(n: number): Tensor {
    const data = new Float64Array(n * n);
    for (let i = 0; i < n; i++) {
      data[i * n + i] = 1;
    }
    return new Tensor(data, [n, n]);
  }

  view(newShape: readonly number[], offset: number = 0): Tensor {
    const newSize = newShape.reduce((a, b) => a * b, 1);
    if (newSize + offset > this.size) {
      throw new Error(
        `View size ${newSize} + offset ${offset} exceeds tensor size ${this.size}`
      );
    }
    const newStrides: number[] = [];
    let stride = 1;
    for (let i = newShape.length - 1; i >= 0; i--) {
      newStrides[i] = stride;
      stride *= newShape[i];
    }
    return new Tensor(this.data, newShape, newStrides, this.offset + offset);
  }

  reshape(newShape: readonly number[]): Tensor {
    const newSize = newShape.reduce((a, b) => a * b, 1);
    if (newSize !== this.size) {
      throw new Error(`Cannot reshape tensor of size ${this.size} to shape [${newShape.join(", ")})] (size ${newSize})`);
    }
    const newStrides: number[] = [];
    let stride = 1;
    for (let i = newShape.length - 1; i >= 0; i--) {
      newStrides[i] = stride;
      stride *= newShape[i];
    }
    return new Tensor(this.data, newShape, newStrides, this.offset);
  }

  flatten(): Tensor {
    return this.reshape([this.size]);
  }

  toArray(): number[] | number[][] | number[][][] {
    const result: number[] = [];
    if (this.ndim === 1) {
      for (let i = 0; i < this.shape[0]; i++) {
        result.push(this.get(i));
      }
      return result;
    }
    const convert = (indices: number[]): any => {
      const dim = indices.length;
      if (dim === this.ndim - 1) {
        const row: number[] = [];
        for (let i = 0; i < this.shape[dim]; i++) {
          row.push(this.get(...indices, i));
        }
        return row;
      }
      const arr: any[] = [];
      for (let i = 0; i < this.shape[dim]; i++) {
        arr.push(convert([...indices, i]));
      }
      return arr;
    };
    return convert([]);
  }

  toScalar(): number {
    if (this.size !== 1) {
      throw new Error(`Cannot convert tensor of size ${this.size} to scalar`);
    }
    return this.data[this.offset];
  }
}

/** Type guard for Tensor */
export function isTensor(value: unknown): value is Tensor {
  return value instanceof Tensor;
}
