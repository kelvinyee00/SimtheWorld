import { PersistedModelV3, parseModelDocument, saveModelToLocalStorage, loadModelFromLocalStorage } from "./modelPersistence";
import { saveModelToSupabase, loadModelFromSupabase, listUserModels, type SupabaseModelMetadata } from "./supabasePersistence";

/**
 * Unified persistence interface for web-simulink models.
 * Handles LocalStorage (anonymous) and Supabase (cloud) storage.
 */

export interface ModelSaveOptions {
  cloud?: boolean;
  modelId?: string;
  modelName?: string;
  description?: string;
}

/**
 * Transition a model from LocalStorage to Cloud.
 * This is useful for P15-1e when an anonymous user logs in.
 */
export async function transitionLocalToCloud(): Promise<{ success: boolean; modelId?: string; error?: string }> {
  const localModel = loadModelFromLocalStorage();
  if (!localModel) {
    return { success: false, error: "No local model found to transition." };
  }

  return persistModel(localModel, { cloud: true, modelName: localModel.metadata.modelName });
}

/**
 * Persist a model to either cloud or local storage.
 * If cloud is requested but fails (e.g. not logged in), it does NOT fallback to local automatically
 * to ensure user intent for cloud storage is respected or explicitly handled.
 */
export async function persistModel(
  model: PersistedModelV3,
  options: ModelSaveOptions = {}
): Promise<{ success: boolean; modelId?: string; error?: string }> {
  try {
    if (options.cloud) {
      const modelId = await saveModelToSupabase(model, options.modelId);
      return { success: true, modelId };
    } else {
      const raw = JSON.stringify(model);
      saveModelToLocalStorage(raw);
      return { success: true };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Load a model from cloud or local storage.
 */
export async function fetchModel(
  modelId?: string
): Promise<PersistedModelV3 | null> {
  if (modelId) {
    try {
      return await loadModelFromSupabase(modelId);
    } catch (err) {
      console.error("Failed to load model from cloud:", err);
      return null;
    }
  }

  return loadModelFromLocalStorage();
}

export {
  saveModelToLocalStorage,
  loadModelFromLocalStorage,
  saveModelToSupabase,
  loadModelFromSupabase,
  listUserModels,
  parseModelDocument,
  type SupabaseModelMetadata,
  type PersistedModelV3
};
