import { SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * FROM block (P6-4 Global Signal Bus).
 *
 * Reads a signal from the global bus using `tag` and emits it on `default`.
 * If no matching tag exists, emits `null`.
 */
export const FROM_BLOCK_TYPE = "from" as const;

function normalizeTag(raw: unknown): string {
  if (typeof raw !== "string") {
    return "signal";
  }

  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : "signal";
}

export const FromBlock: SimulationBlockDefinition = {
  type: FROM_BLOCK_TYPE,
  outputPortTypes: { default: "any" },
  step: ({ params, globalSignals }) => {
    const tag = normalizeTag(params.tag);

    return {
      outputs: {
        default: globalSignals[tag] ?? null,
      },
    };
  },
};
