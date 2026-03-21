import { SignalValue, SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * Compare block (P4-2 boolean signal source).
 *
 * Supported operators:
 * - gt  : in1 >  in2
 * - gte : in1 >= in2
 * - lt  : in1 <  in2
 * - lte : in1 <= in2
 * - eq  : in1 === in2
 * - neq : in1 !== in2
 */
export const COMPARE_BLOCK_TYPE = "compare" as const;

export type CompareOperator = "gt" | "gte" | "lt" | "lte" | "eq" | "neq";

function parseOperator(value: unknown): CompareOperator {
  switch (value) {
    case "gte":
    case "lt":
    case "lte":
    case "eq":
    case "neq":
    case "gt":
      return value;
    default:
      return "gt";
  }
}

function toNumberOrNull(value: SignalValue): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readPair(inputs: Record<string, SignalValue>): [number | null, number | null] {
  const left = toNumberOrNull(inputs.in1 ?? inputs.default ?? null);
  const right = toNumberOrNull(inputs.in2 ?? inputs.default__2 ?? null);
  return [left, right];
}

function compare(operator: CompareOperator, left: number, right: number): boolean {
  switch (operator) {
    case "gte":
      return left >= right;
    case "lt":
      return left < right;
    case "lte":
      return left <= right;
    case "eq":
      return left === right;
    case "neq":
      return left !== right;
    case "gt":
    default:
      return left > right;
  }
}

export const CompareBlock: SimulationBlockDefinition = {
  type: COMPARE_BLOCK_TYPE,
  inputPortTypes: {
    in1: "number",
    in2: "number",
    default: "number",
  },
  outputPortTypes: {
    default: "boolean",
  },
  step: ({ params, inputs }) => {
    const [left, right] = readPair(inputs);
    const operator = parseOperator(params.operator);

    if (left === null || right === null) {
      return {
        outputs: {
          default: null,
        },
      };
    }

    return {
      outputs: {
        default: compare(operator, left, right),
      },
    };
  },
};
