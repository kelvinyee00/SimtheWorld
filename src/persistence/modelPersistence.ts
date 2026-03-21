import { z } from "zod";

export const MODEL_STORAGE_KEY = "web-simulink:model:v3";

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

const PersistedModelV3Schema = z.object({
  schemaVersion: z.literal(3),
  metadata: z.object({
    app: z.literal("web-simulink"),
    savedAtMs: z.number().int().nonnegative(),
    modelName: z.string().optional(),
    description: z.string().optional(),
  }),
  timing: z.object({
    simulationTimeMs: z.number().int().positive(),
    stepTimeMs: z.number().int().positive(),
  }),
  nodes: z.array(PersistedNodeSchema),
  edges: z.array(PersistedEdgeSchema),
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

const PersistedModelV1Schema = z.object({
  nodes: z.array(PersistedNodeSchema),
  edges: z.array(PersistedEdgeSchema),
  simulationTimeMs: z.number().int().positive(),
  stepTimeMs: z.number().int().positive(),
});

export type PersistedModelV3 = z.infer<typeof PersistedModelV3Schema>;

/**
 * Serialize graph and timing into schema v3 document.
 */
export function serializeModelV3(params: {
  nodes: Array<z.infer<typeof PersistedNodeSchema>>;
  edges: Array<z.infer<typeof PersistedEdgeSchema>>;
  timing: { simulationTimeMs: number; stepTimeMs: number };
  modelName?: string;
  description?: string;
}): string {
  const payload: PersistedModelV3 = {
    schemaVersion: 3,
    metadata: {
      app: "web-simulink",
      savedAtMs: Date.now(),
      modelName: params.modelName,
      description: params.description,
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

/**
 * Parse model document and migrate legacy v1/v2 payloads to v3.
 */
export function parseModelDocument(raw: string): PersistedModelV3 {
  const parsed = JSON.parse(raw) as unknown;

  const v3 = PersistedModelV3Schema.safeParse(parsed);
  if (v3.success) {
    return v3.data;
  }

  const v2 = PersistedModelV2Schema.safeParse(parsed);
  if (v2.success) {
    return {
      schemaVersion: 3,
      metadata: {
        ...v2.data.metadata,
        modelName: "Migrated V2 Model",
      },
      timing: v2.data.timing,
      nodes: v2.data.nodes,
      edges: v2.data.edges,
    };
  }

  const v1 = PersistedModelV1Schema.safeParse(parsed);
  if (v1.success) {
    return {
      schemaVersion: 3,
      metadata: {
        app: "web-simulink",
        savedAtMs: Date.now(),
        modelName: "Migrated V1 Model",
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

export function loadModelFromLocalStorage(): PersistedModelV3 | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(MODEL_STORAGE_KEY);
  if (!raw) {
    // Try fallback to v2 if v3 not found yet
    const v2Raw = window.localStorage.getItem("web-simulink:model:v2");
    if (v2Raw) {
      try {
        return parseModelDocument(v2Raw);
      } catch {
        return null;
      }
    }
    return null;
  }

  try {
    return parseModelDocument(raw);
  } catch {
    return null;
  }
}
