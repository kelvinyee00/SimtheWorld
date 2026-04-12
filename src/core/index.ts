/**
 * P14 Core Module - Vectorized Math Core exports
 *
 * Exports the Tensor foundation and optimized operators
 * for use by simulation blocks and ONNX integration.
 */

export { Tensor, isTensor, type TensorShape, type TensorStrides } from "./tensor";
export {
  add,
  sub,
  mul,
  div,
  scale,
  matmul,
  transpose,
  dot,
  sum,
  mean,
  bmm,
} from "./tensorOps";
