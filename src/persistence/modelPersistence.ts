import { z } from "zod";

export const MODEL_STORAGE_KEY = "web-simulink:model:v2";

const PersistedNodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: z.record(z.string(), z.unknown()).default({}),
});

const PersistedEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
  type: z.string().optional(),
});

const PersistedModelV2Schema = z.object({
  schemaVersion: z.literal(2),
  metadata: z.object({
    app: z.literal("web-simulink"),
    savedAtMs: z.number().int().nonnegative(),
  }),
  timing: z.object({
    simulationTimeMs: z.number().int().positive(),
    stepTimeMs: z.number().int().positive(),
  }),
  nodes: z.array(PersistedNodeSchema),
  edges: z.array(PersistedEdgeSchema),
});

/**
 * Legacy model schema (v1) migration shape.
 *
 * v1 payload did not contain explicit `schemaVersion` or `metadata`.
 */
const PersistedModelV1Schema = z.object({
  nodes: z.array(PersistedNodeSchema),
  edges: z.array(PersistedEdgeSchema),
  simulationTimeMs: z.number().int().positive(),
  stepTimeMs: z.number().int().positive(),
});

export type PersistedModelV2 = z.infer<typeof PersistedModelV2Schema>;

export function serializeModelV2(params: {
  nodes: Array<z.infer<typeof PersistedNodeSchema>>;
  edges: Array<z.infer<typeof PersistedEdgeSchema>>;
  timing: { simulationTimeMs: number; stepTimeMs: number };
}): string {
  const payload: PersistedModelV2 = {
    schemaVersion: 2,
    metadata: {
      app: "web-simulink",
      savedAtMs: Date.now(),
    },
    timing: {
      simulationTimeMs: Math.max(1, Math.floor(params.timing.simulationTimeMs)),
      stepTimeMs: Math.max(1, Math.floor(params.timing.stepTimeMs)),
    },
    nodes: params.nodes,
    edges: params.edges,
  };

  return JSON.stringify(payload, null, 2);
}

export function parseModelDocument(raw: string): PersistedModelV2 {
  const parsed = JSON.parse(raw) as unknown;

  const v2 = PersistedModelV2Schema.safeParse(parsed);
  if (v2.success) {
    return v2.data;
  }

  const v1 = PersistedModelV1Schema.safeParse(parsed);
  if (v1.success) {
    return {
      schemaVersion: 2,
      metadata: {
        app: "web-simulink",
        savedAtMs: Date.now(),
      },
      timing: {
        simulationTimeMs: v1.data.simulationTimeMs,
        stepTimeMs: v1.data.stepTimeMs,
      },
      nodes: v1.data.nodes,
      edges: v1.data.edges,
    };
  }

  throw new Error("Invalid model document: unsupported schema or malformed payload.");
}

export function saveModelToLocalStorage(rawModel: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(MODEL_STORAGE_KEY, rawModel);
}

export function loadModelFromLocalStorage(): PersistedModelV2 | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(MODEL_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return parseModelDocument(raw);
  } catch {
    return null;
  }
}
