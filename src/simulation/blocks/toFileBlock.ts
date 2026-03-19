import { SignalValue, SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * To File block (P3-2 logging/export sink).
 *
 * Responsibilities:
 * - Capture numeric input snapshots per simulation tick.
 * - Persist deterministic sample history in node-local runtime state.
 * - Expose export-oriented metadata (`format`, `fileName`, `maxRows`) so UI can serialize
 *   either JSON or CSV without introducing side-effects into the simulation engine.
 *
 * Pure-function constraint:
 * - This block DOES NOT perform file I/O or IndexedDB writes directly.
 * - Runtime stepping remains deterministic; export/persistence is handled in UI orchestration.
 */
export const TO_FILE_BLOCK_TYPE = "to-file" as const;

export type ToFileExportFormat = "json" | "csv";

const DEFAULT_TO_FILE_FORMAT: ToFileExportFormat = "json";
const DEFAULT_TO_FILE_FILE_NAME = "simulation-log";
const DEFAULT_TO_FILE_MAX_ROWS = 2_000;
const MAX_TO_FILE_MAX_ROWS = 20_000;

export interface ToFileSample {
  tick: number;
  timeMs: number;
  /**
   * Signal payload keyed by input handle name (`default`, `in1`, `in2`, ...).
   */
  values: Record<string, number>;
}

export interface ToFileBlockState {
  samples: ToFileSample[];
  lastUpdatedTick: number;
  format: ToFileExportFormat;
  fileName: string;
  maxRows: number;
}

interface ToFileParams {
  format: ToFileExportFormat;
  fileName: string;
  maxRows: number;
}

function sanitizeFormat(raw: unknown): ToFileExportFormat {
  return raw === "csv" ? "csv" : DEFAULT_TO_FILE_FORMAT;
}

function sanitizeFileName(raw: unknown): string {
  if (typeof raw !== "string") {
    return DEFAULT_TO_FILE_FILE_NAME;
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return DEFAULT_TO_FILE_FILE_NAME;
  }

  return trimmed.slice(0, 120);
}

function sanitizeMaxRows(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return DEFAULT_TO_FILE_MAX_ROWS;
  }

  const integer = Math.floor(raw);
  if (integer <= 0) {
    return DEFAULT_TO_FILE_MAX_ROWS;
  }

  return Math.min(integer, MAX_TO_FILE_MAX_ROWS);
}

export function parseToFileParams(raw: Record<string, unknown>): ToFileParams {
  return {
    format: sanitizeFormat(raw.format),
    fileName: sanitizeFileName(raw.fileName),
    maxRows: sanitizeMaxRows(raw.maxRows),
  };
}

export function toToFileState(
  previousState: unknown,
  params: Record<string, unknown>
): ToFileBlockState {
  const parsedParams = parseToFileParams(params);

  if (
    typeof previousState === "object" &&
    previousState !== null &&
    "samples" in previousState
  ) {
    const candidate = previousState as {
      samples?: unknown;
      lastUpdatedTick?: unknown;
      format?: unknown;
      fileName?: unknown;
      maxRows?: unknown;
    };

    const samples = Array.isArray(candidate.samples)
      ? candidate.samples
          .map((entry) => {
            if (typeof entry !== "object" || entry === null) {
              return null;
            }

            const sample = entry as {
              tick?: unknown;
              timeMs?: unknown;
              values?: unknown;
            };

            if (
              typeof sample.tick !== "number" ||
              !Number.isFinite(sample.tick) ||
              typeof sample.timeMs !== "number" ||
              !Number.isFinite(sample.timeMs)
            ) {
              return null;
            }

            const valuesSource =
              typeof sample.values === "object" && sample.values !== null
                ? (sample.values as Record<string, unknown>)
                : {};

            const values = Object.keys(valuesSource)
              .sort((a, b) => a.localeCompare(b))
              .reduce<Record<string, number>>((acc, key) => {
                const value = valuesSource[key];
                if (typeof value === "number" && Number.isFinite(value)) {
                  acc[key] = value;
                }
                return acc;
              }, {});

            return {
              tick: sample.tick,
              timeMs: sample.timeMs,
              values,
            } satisfies ToFileSample;
          })
          .filter((entry): entry is ToFileSample => entry !== null)
      : [];

    const maxRows = sanitizeMaxRows(candidate.maxRows ?? parsedParams.maxRows);

    return {
      samples: samples.slice(-maxRows),
      lastUpdatedTick:
        typeof candidate.lastUpdatedTick === "number" &&
        Number.isFinite(candidate.lastUpdatedTick)
          ? candidate.lastUpdatedTick
          : -1,
      format: sanitizeFormat(candidate.format ?? parsedParams.format),
      fileName: sanitizeFileName(candidate.fileName ?? parsedParams.fileName),
      maxRows,
    };
  }

  return {
    samples: [],
    lastUpdatedTick: -1,
    format: parsedParams.format,
    fileName: parsedParams.fileName,
    maxRows: parsedParams.maxRows,
  };
}

function collectNumericInputs(inputs: Record<string, SignalValue>): Record<string, number> {
  return Object.keys(inputs)
    .sort((a, b) => a.localeCompare(b))
    .reduce<Record<string, number>>((acc, key) => {
      const value = inputs[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        acc[key] = value;
      }
      return acc;
    }, {});
}

export function buildToFileJsonPayload(samples: ToFileSample[]): string {
  return JSON.stringify(samples, null, 2);
}

export function buildToFileCsvPayload(samples: ToFileSample[]): string {
  const handleKeys = Array.from(
    new Set(
      samples.flatMap((sample) => Object.keys(sample.values))
    )
  ).sort((a, b) => a.localeCompare(b));

  const header = ["tick", "timeMs", ...handleKeys];

  const rows = samples.map((sample) => {
    const values = handleKeys.map((key) => {
      const value = sample.values[key];
      return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
    });

    return [String(sample.tick), String(sample.timeMs), ...values].join(",");
  });

  return [header.join(","), ...rows].join("\n");
}

export function buildToFilePayload(params: {
  format: ToFileExportFormat;
  samples: ToFileSample[];
}): { mimeType: string; extension: "json" | "csv"; content: string } {
  const { format, samples } = params;

  if (format === "csv") {
    return {
      mimeType: "text/csv;charset=utf-8",
      extension: "csv",
      content: buildToFileCsvPayload(samples),
    };
  }

  return {
    mimeType: "application/json;charset=utf-8",
    extension: "json",
    content: buildToFileJsonPayload(samples),
  };
}

export const ToFileBlock: SimulationBlockDefinition = {
  type: TO_FILE_BLOCK_TYPE,
  initialize: (params) => toToFileState(undefined, params),
  step: ({ tick, timeMs, params, previousState, inputs }) => {
    const state = toToFileState(previousState, params);
    const numericInputs = collectNumericInputs(inputs);

    if (Object.keys(numericInputs).length === 0) {
      return {
        outputs: {},
        nextState: {
          ...state,
        } satisfies ToFileBlockState,
      };
    }

    const appended: ToFileSample[] = [
      ...state.samples,
      {
        tick,
        timeMs,
        values: numericInputs,
      },
    ];

    const windowed = appended.length > state.maxRows ? appended.slice(-state.maxRows) : appended;

    return {
      outputs: {},
      nextState: {
        ...state,
        samples: windowed,
        lastUpdatedTick: tick,
      } satisfies ToFileBlockState,
    };
  },
};
