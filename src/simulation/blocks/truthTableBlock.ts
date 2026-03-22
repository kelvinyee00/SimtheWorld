import { SignalValue, SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * Truth Table / Logic Table block (P7-3).
 *
 * Deterministic row-priority semantics:
 * - Evaluate rows in list order.
 * - First matching row emits its `output`.
 * - If no row matches, emit `elseOutput` (or `null`).
 */
export const TRUTH_TABLE_BLOCK_TYPE = "truthTable" as const;

type TruthTableScalar = number | boolean | string;

interface TruthTableRow {
  when: Record<string, TruthTableScalar>;
  output: number | boolean;
}

interface TruthTableParams {
  inputHandles: string[];
  rows: TruthTableRow[];
  elseOutput: number | boolean | null;
}

function toHandleName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toSignalComparable(value: SignalValue): TruthTableScalar | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  return null;
}

function toTableScalar(value: unknown): TruthTableScalar | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value;
  }
  return null;
}

function parseRows(raw: unknown): TruthTableRow[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const rows: TruthTableRow[] = [];

  for (const candidate of raw) {
    if (typeof candidate !== "object" || candidate === null) {
      continue;
    }

    const record = candidate as Record<string, unknown>;
    const output =
      typeof record.output === "boolean"
        ? record.output
        : typeof record.output === "number" && Number.isFinite(record.output)
          ? record.output
          : null;

    if (output === null) {
      continue;
    }

    const whenRaw =
      typeof record.when === "object" && record.when !== null
        ? (record.when as Record<string, unknown>)
        : {};

    const when: Record<string, TruthTableScalar> = {};
    for (const [key, value] of Object.entries(whenRaw)) {
      const normalizedKey = toHandleName(key);
      const normalizedValue = toTableScalar(value);
      if (!normalizedKey || normalizedValue === null) {
        continue;
      }
      when[normalizedKey] = normalizedValue;
    }

    rows.push({ when, output });
  }

  return rows;
}

function parseParams(raw: Record<string, unknown>): TruthTableParams {
  const seenHandles = new Set<string>();
  const inputHandles = Array.isArray(raw.inputHandles)
    ? raw.inputHandles
        .map((entry) => toHandleName(entry))
        .filter((entry): entry is string => {
          if (!entry) {
            return false;
          }

          const normalized = entry.toLowerCase();
          if (seenHandles.has(normalized)) {
            return false;
          }

          seenHandles.add(normalized);
          return true;
        })
    : ["in1", "in2"];

  const elseOutput =
    typeof raw.elseOutput === "boolean"
      ? raw.elseOutput
      : typeof raw.elseOutput === "number" && Number.isFinite(raw.elseOutput)
        ? raw.elseOutput
        : null;

  return {
    inputHandles: inputHandles.length > 0 ? inputHandles : ["in1", "in2"],
    rows: parseRows(raw.rows),
    elseOutput,
  };
}

function rowMatches(params: {
  row: TruthTableRow;
  resolvedInputs: Record<string, TruthTableScalar | null>;
}): boolean {
  const { row, resolvedInputs } = params;

  for (const [handle, expected] of Object.entries(row.when)) {
    if ((resolvedInputs[handle] ?? null) !== expected) {
      return false;
    }
  }

  return true;
}

export const TruthTableBlock: SimulationBlockDefinition = {
  type: TRUTH_TABLE_BLOCK_TYPE,
  inputPortTypes: {
    default: "any",
    in1: "any",
    in2: "any",
    in3: "any",
    in4: "any",
    in5: "any",
    in6: "any",
    in7: "any",
    in8: "any",
  },
  outputPortTypes: {
    default: "any",
    row: "number",
  },
  step: ({ params: rawParams, inputs }) => {
    const params = parseParams(rawParams);

    const resolvedInputs: Record<string, TruthTableScalar | null> = {};
    for (const handle of params.inputHandles) {
      const direct = inputs[handle];
      const fallback = handle === "in1" ? inputs.default : undefined;
      resolvedInputs[handle] = toSignalComparable(typeof direct === "undefined" ? fallback ?? null : direct);
    }

    for (let index = 0; index < params.rows.length; index += 1) {
      const row = params.rows[index];
      if (!rowMatches({ row, resolvedInputs })) {
        continue;
      }

      return {
        outputs: {
          default: row.output,
          row: index,
        },
      };
    }

    return {
      outputs: {
        default: params.elseOutput,
        row: null,
      },
    };
  },
};
