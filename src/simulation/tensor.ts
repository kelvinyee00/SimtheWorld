/**
 * Tensor Foundation (P14-1a)
 * Provides TypedArray-based storage for high-performance numerical computing.
 * 
 * Design goals:
 * - Efficient memory usage via TypedArrays (Float32Array/Float64Array)
 * - Support for N-dimensional tensors with shape metadata
 * - Deterministic broadcasting semantics compatible with P0-P13 blocks
 * - Immutable snapshot semantics for reproducible simulation
 */

export type TensorDtype = "float32" | "float64" | "int32" | "int16";

export interface TensorShape {
  readonly dims: readonly number[];
  readonly rank: number;
  readonly size: number;
}

/**
 * Immutable Tensor representation using TypedArray storage.
 * 
 * Note: This is a value-type object. All operations return new Tensors
 * to maintain deterministic snapshot semantics.
 */
export class Tensor {
  readonly data: Float32Array | Float64Array | Int32Array | Int16Array;
  readonly shape: TensorShape;
  readonly dtype: TensorDtype;

  constructor(params: {
    data: Float32Array | Float64Array | Int32Array | Int16Array;
    shape: readonly number[];
    dtype?: TensorDtype;
  }) {
    this.data = params.data;
    this.shape = {
      dims: [...params.shape],
      rank: params.shape.length,
      size: params.shape.reduce((a, b) => a * b, 1),
    };
    this.dtype = params.dtype ?? "float32";

    // Validate shape matches data length
    if (this.data.length !== this.shape.size) {
      throw new Error(
        `Tensor shape size ${this.shape.size} does not match data length ${this.data.length}`
      );
    }
  }

  /**
   * Create a Tensor from a nested number array.
   * Infers shape from array structure.
   */
  static fromArray(
    arr: number | number[] | number[][] | number[][][],
    dtype: TensorDtype = "float32"
  ): Tensor {
    const { flat, shape } = flattenArray(arr);
    const data = createTypedArray(flat, dtype);
    return new Tensor({ data, shape, dtype });
  }

  /**
   * Create a Tensor filled with zeros.
   */
  static zeros(shape: readonly number[], dtype: TensorDtype = "float32"): Tensor {
    const size = shape.reduce((a, b) => a * b, 1);
    const data = createTypedArray(new Array(size).fill(0), dtype);
    return new Tensor({ data, shape, dtype });
  }

  /**
   * Create a Tensor filled with ones.
   */
  static ones(shape: readonly number[], dtype: TensorDtype = "float32"): Tensor {
    const size = shape.reduce((a, b) => a * b, 1);
    const data = createTypedArray(new Array(size).fill(1), dtype);
    return new Tensor({ data, shape, dtype });
  }

  /**
   * Element-wise addition with broadcasting support.
   */
  add(other: Tensor): Tensor {
    const { shape: resultShape, stridesA, stridesB } = broadcastShapes(this.shape.dims, other.shape.dims);
    const result = createTypedArray(new Array(resultShape.reduce((a, b) => a * b, 1)).fill(0), this.dtype);
    
    // Optimize for same-shape case (most common)
    if (shapesEqual(this.shape.dims, other.shape.dims)) {
      for (let i = 0; i < this.data.length; i++) {
        result[i] = this.data[i] + other.data[i];
      }
    } else {
      // Broadcasted addition
      const resultSize = result.length;
      const indices = new Array(resultShape.length).fill(0);
      
      for (let i = 0; i < resultSize; i++) {
        const idxA = computeBroadcastIndex(indices, stridesA, this.shape.dims);
        const idxB = computeBroadcastIndex(indices, stridesB, other.shape.dims);
        result[i] = this.data[idxA] + other.data[idxB];
        
        // Increment indices
        for (let d = resultShape.length - 1; d >= 0; d--) {
          indices[d]++;
          if (indices[d] < resultShape[d]) break;
          indices[d] = 0;
        }
      }
    }

    return new Tensor({ data: result, shape: resultShape, dtype: this.dtype });
  }

  /**
   * Element-wise multiplication with broadcasting support.
   */
  multiply(other: Tensor): Tensor {
    const { shape: resultShape, stridesA, stridesB } = broadcastShapes(this.shape.dims, other.shape.dims);
    const result = createTypedArray(new Array(resultShape.reduce((a, b) => a * b, 1)).fill(0), this.dtype);
    
    if (shapesEqual(this.shape.dims, other.shape.dims)) {
      for (let i = 0; i < this.data.length; i++) {
        result[i] = this.data[i] * other.data[i];
      }
    } else {
      const resultSize = result.length;
      const indices = new Array(resultShape.length).fill(0);
      
      for (let i = 0; i < resultSize; i++) {
        const idxA = computeBroadcastIndex(indices, stridesA, this.shape.dims);
        const idxB = computeBroadcastIndex(indices, stridesB, other.shape.dims);
        result[i] = this.data[idxA] * other.data[idxB];
        
        for (let d = resultShape.length - 1; d >= 0; d--) {
          indices[d]++;
          if (indices[d] < resultShape[d]) break;
          indices[d] = 0;
        }
      }
    }

    return new Tensor({ data: result, shape: resultShape, dtype: this.dtype });
  }

  /**
   * Scale by a scalar value.
   */
  scale(scalar: number): Tensor {
    const result = new (this.data.constructor as new (length: number) => typeof this.data)(this.data.length);
    for (let i = 0; i < this.data.length; i++) {
      result[i] = this.data[i] * scalar;
    }
    return new Tensor({ data: result, shape: this.shape.dims, dtype: this.dtype });
  }

  /**
   * Convert to nested JavaScript array.
   */
  toArray(): unknown {
    return reshapeArray([...this.data], this.shape.dims);
  }

  /**
   * Get value at specific indices.
   */
  get(...indices: number[]): number {
    const flatIndex = computeFlatIndex(indices, this.shape.dims);
    return this.data[flatIndex];
  }

  /**
   * Create a view with new shape (same underlying data).
   */
  reshape(newShape: readonly number[]): Tensor {
    const newSize = newShape.reduce((a, b) => a * b, 1);
    if (newSize !== this.shape.size) {
      throw new Error(`Cannot reshape tensor of size ${this.shape.size} to shape [${newShape.join(", ")}] with size ${newSize}`);
    }
    return new Tensor({ data: this.data, shape: newShape, dtype: this.dtype });
  }
}

// Helper functions

function createTypedArray(
  values: number[],
  dtype: TensorDtype
): Float32Array | Float64Array | Int32Array | Int16Array {
  switch (dtype) {
    case "float32":
      return new Float32Array(values);
    case "float64":
      return new Float64Array(values);
    case "int32":
      return new Int32Array(values);
    case "int16":
      return new Int16Array(values);
    default:
      return new Float32Array(values);
  }
}

function flattenArray(
  arr: number | number[] | number[][] | number[][][]
): { flat: number[]; shape: number[] } {
  const flat: number[] = [];
  const shape: number[] = [];

  function traverse(current: unknown, depth: number): void {
    if (Array.isArray(current)) {
      if (shape.length <= depth) {
        shape.push(current.length);
      } else if (shape[depth] !== current.length) {
        throw new Error("Irregular array structure");
      }
      current.forEach((item) => traverse(item, depth + 1));
    } else if (typeof current === "number") {
      flat.push(current);
    }
  }

  if (typeof arr === "number") {
    return { flat: [arr], shape: [] };
  }

  traverse(arr, 0);
  return { flat, shape };
}

function reshapeArray(data: number[], shape: number[]): unknown {
  if (shape.length === 0) {
    return data[0] ?? 0;
  }

  if (shape.length === 1) {
    return [...data];
  }

  const [dim, ...rest] = shape;
  const result: unknown[] = [];
  const stride = rest.reduce((a, b) => a * b, 1);
  
  for (let i = 0; i < dim; i++) {
    result.push(reshapeArray(data.slice(i * stride, (i + 1) * stride), rest));
  }
  
  return result;
}

function computeFlatIndex(indices: number[], shape: number[]): number {
  let index = 0;
  let stride = 1;
  for (let i = shape.length - 1; i >= 0; i--) {
    index += indices[i] * stride;
    stride *= shape[i];
  }
  return index;
}

function shapesEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((dim, i) => dim === b[i]);
}

interface BroadcastResult {
  shape: number[];
  stridesA: number[];
  stridesB: number[];
}

function broadcastShapes(shapeA: number[], shapeB: number[]): BroadcastResult {
  const rankA = shapeA.length;
  const rankB = shapeB.length;
  const resultRank = Math.max(rankA, rankB);
  
  const paddedA = new Array(resultRank - rankA).fill(1).concat(shapeA);
  const paddedB = new Array(resultRank - rankB).fill(1).concat(shapeB);
  
  const resultShape: number[] = [];
  const stridesA: number[] = [];
  const stridesB: number[] = [];
  
  for (let i = 0; i < resultRank; i++) {
    const dimA = paddedA[i];
    const dimB = paddedB[i];
    
    if (dimA === dimB) {
      resultShape.push(dimA);
    } else if (dimA === 1) {
      resultShape.push(dimB);
    } else if (dimB === 1) {
      resultShape.push(dimA);
    } else {
      throw new Error(`Incompatible broadcast shapes: [${shapeA.join(", ")}] and [${shapeB.join(", ")}]`);
    }
    
    stridesA.push(dimA === resultShape[i] ? 1 : 0);
    stridesB.push(dimB === resultShape[i] ? 1 : 0);
  }
  
  return { shape: resultShape, stridesA, stridesB };
}

function computeBroadcastIndex(
  indices: number[],
  strides: number[],
  shape: number[]
): number {
  let index = 0;
  let stride = 1;
  const offset = indices.length - shape.length;
  
  for (let i = shape.length - 1; i >= 0; i--) {
    const idx = strides[i] === 0 ? 0 : indices[i + offset];
    index += idx * stride;
    stride *= shape[i];
  }
  
  return index;
}