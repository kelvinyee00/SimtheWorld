/**
 * P14-1b: Optimized Linear Algebra Operators
 *
 * High-performance tensor operations using Float64Array with cache-aware loops.
 * Provides BLAS-like performance for matrix operations needed by ONNX inference.
 */

import { Tensor, TensorShape } from "./tensor";

/** Validate that two shapes are equal for broadcasting */
function assertSameShape(a: TensorShape, b: TensorShape, operation: string): void {
  if (a.length !== b.length) {
    throw new Error(`${operation}: Shape rank mismatch ${a.length} vs ${b.length}`);
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      throw new Error(`${operation}: Shape dimension mismatch at ${i}: ${a[i]} vs ${b[i]}`);
    }
  }
}

/** Validate matrix multiplication shapes */
function assertMatMulShapes(a: Tensor, b: Tensor): void {
  if (a.ndim !== 2 || b.ndim !== 2) {
    throw new Error(`matmul: Both tensors must be 2D, got ${a.ndim}D and ${b.ndim}D`);
  }
  const aCols = a.shape[1];
  const bRows = b.shape[0];
  if (aCols !== bRows) {
    throw new Error(`matmul: Incompatible shapes [${a.shape.join(", ")}] and [${b.shape.join(", ")}] - ${aCols} != ${bRows}`);
  }
}

/**
 * Element-wise addition: a + b
 * Cache-friendly: sequential access through flat arrays
 */
export function add(a: Tensor, b: Tensor): Tensor {
  assertSameShape(a.shape, b.shape, "add");
  const size = a.size;
  const result = new Float64Array(size);
  const aData = a.data;
  const bData = b.data;
  
  // Cache-friendly sequential access
  for (let i = 0; i < size; i++) {
    result[i] = aData[a.offset + i] + bData[b.offset + i];
  }
  
  return new Tensor(result, a.shape);
}

/**
 * Element-wise subtraction: a - b
 */
export function sub(a: Tensor, b: Tensor): Tensor {
  assertSameShape(a.shape, b.shape, "sub");
  const size = a.size;
  const result = new Float64Array(size);
  const aData = a.data;
  const bData = b.data;
  
  for (let i = 0; i < size; i++) {
    result[i] = aData[a.offset + i] - bData[b.offset + i];
  }
  
  return new Tensor(result, a.shape);
}

/**
 * Element-wise multiplication: a * b (Hadamard product)
 */
export function mul(a: Tensor, b: Tensor): Tensor {
  assertSameShape(a.shape, b.shape, "mul");
  const size = a.size;
  const result = new Float64Array(size);
  const aData = a.data;
  const bData = b.data;
  
  for (let i = 0; i < size; i++) {
    result[i] = aData[a.offset + i] * bData[b.offset + i];
  }
  
  return new Tensor(result, a.shape);
}

/**
 * Element-wise division: a / b
 */
export function div(a: Tensor, b: Tensor): Tensor {
  assertSameShape(a.shape, b.shape, "div");
  const size = a.size;
  const result = new Float64Array(size);
  const aData = a.data;
  const bData = b.data;
  
  for (let i = 0; i < size; i++) {
    const divisor = bData[b.offset + i];
    if (divisor === 0) {
      throw new Error(`div: Division by zero at index ${i}`);
    }
    result[i] = aData[a.offset + i] / divisor;
  }
  
  return new Tensor(result, a.shape);
}

/**
 * Scalar multiplication: tensor * scalar
 */
export function scale(tensor: Tensor, scalar: number): Tensor {
  const size = tensor.size;
  const result = new Float64Array(size);
  const data = tensor.data;
  
  for (let i = 0; i < size; i++) {
    result[i] = data[tensor.offset + i] * scalar;
  }
  
  return new Tensor(result, tensor.shape);
}

/**
 * Matrix multiplication: a @ b
 * Optimized with cache-aware access patterns (loop ordering: i-k-j)
 * This minimizes cache misses by accessing B row-wise
 */
export function matmul(a: Tensor, b: Tensor): Tensor {
  assertMatMulShapes(a, b);
  
  const aRows = a.shape[0];
  const aCols = a.shape[1];
  const bCols = b.shape[1];
  
  // Result shape: [aRows, bCols]
  const result = new Float64Array(aRows * bCols);
  result.fill(0);
  
  const aData = a.data;
  const bData = b.data;
  const aOffset = a.offset;
  const bOffset = b.offset;
  
  // Cache-optimized: i-k-j ordering (better cache locality for B)
  // Default row-major strides: stride[0] = cols, stride[1] = 1
  const aStrideRow = aCols;
  const bStrideRow = bCols;
  
  for (let i = 0; i < aRows; i++) {
    for (let k = 0; k < aCols; k++) {
      const aVal = aData[aOffset + i * aStrideRow + k];
      // Inner loop accesses B sequentially (cache-friendly)
      for (let j = 0; j < bCols; j++) {
        result[i * bCols + j] += aVal * bData[bOffset + k * bStrideRow + j];
      }
    }
  }
  
  return new Tensor(result, [aRows, bCols]);
}

/**
 * Matrix transpose: swaps rows and columns
 * Creates a new tensor with data copied in transposed order
 */
export function transpose(tensor: Tensor): Tensor {
  if (tensor.ndim !== 2) {
    throw new Error(`transpose: Expected 2D tensor, got ${tensor.ndim}D`);
  }
  
  const rows = tensor.shape[0];
  const cols = tensor.shape[1];
  const result = new Float64Array(rows * cols);
  const data = tensor.data;
  
  // Copy with index swapping: result[j, i] = tensor[i, j]
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[j * rows + i] = data[tensor.offset + i * cols + j];
    }
  }
  
  return new Tensor(result, [cols, rows]);
}

/**
 * Dot product of two 1D tensors
 */
export function dot(a: Tensor, b: Tensor): number {
  if (a.ndim !== 1 || b.ndim !== 1) {
    throw new Error(`dot: Expected 1D tensors, got ${a.ndim}D and ${b.ndim}D`);
  }
  if (a.shape[0] !== b.shape[0]) {
    throw new Error(`dot: Size mismatch ${a.shape[0]} vs ${b.shape[0]}`);
  }
  
  let sum = 0;
  const size = a.shape[0];
  const aData = a.data;
  const bData = b.data;
  
  for (let i = 0; i < size; i++) {
    sum += aData[a.offset + i] * bData[b.offset + i];
  }
  
  return sum;
}

/**
 * Sum all elements (reduction)
 */
export function sum(tensor: Tensor): number {
  let result = 0;
  const data = tensor.data;
  const size = tensor.size;
  
  for (let i = 0; i < size; i++) {
    result += data[tensor.offset + i];
  }
  
  return result;
}

/**
 * Mean of all elements
 */
export function mean(tensor: Tensor): number {
  return sum(tensor) / tensor.size;
}

/**
 * Batch matrix multiplication for 3D tensors
 * Input: [batch, m, k] @ [batch, k, n] -> [batch, m, n]
 */
export function bmm(a: Tensor, b: Tensor): Tensor {
  if (a.ndim !== 3 || b.ndim !== 3) {
    throw new Error(`bmm: Expected 3D tensors, got ${a.ndim}D and ${b.ndim}D`);
  }
  if (a.shape[0] !== b.shape[0]) {
    throw new Error(`bmm: Batch size mismatch ${a.shape[0]} vs ${b.shape[0]}`);
  }
  if (a.shape[2] !== b.shape[1]) {
    throw new Error(`bmm: Incompatible inner dimensions ${a.shape[2]} vs ${b.shape[1]}`);
  }
  
  const batch = a.shape[0];
  const m = a.shape[1];
  const k = a.shape[2];
  const n = b.shape[2];
  
  const result = new Float64Array(batch * m * n);
  const aData = a.data;
  const bData = b.data;
  
  for (let batchIdx = 0; batchIdx < batch; batchIdx++) {
    const batchOffset = batchIdx * m * k;
    const bBatchOffset = batchIdx * k * n;
    const rBatchOffset = batchIdx * m * n;
    
    for (let i = 0; i < m; i++) {
      for (let l = 0; l < k; l++) {
        const aVal = aData[a.offset + batchOffset + i * k + l];
        for (let j = 0; j < n; j++) {
          result[rBatchOffset + i * n + j] += aVal * bData[b.offset + bBatchOffset + l * n + j];
        }
      }
    }
  }
  
  return new Tensor(result, [batch, m, n]);
}
