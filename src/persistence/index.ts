import { PersistedModelV3, parseModelDocument, saveModelToLocalStorage, loadModelFromLocalStorage } from "./modelPersistence";
import { saveModelToSupabase, loadModelFromSupabase, listUserModels, type SupabaseModelMetadata } from "./supabasePersistence";
import { saveServerModel, fetchServerModel, listServerModels, deleteServerModel } from "./serverApi";

/**
 * Unified persistence interface for web-simulink models.
 * Handles LocalStorage (anonymous), Supabase (cloud auth), and Server (SQLite/Express).
 */

export interface ModelSaveOptions {
  cloud?: boolean;
  target?: 'local' | 'cloud' | 'server';
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

  return persistModel(localModel, { target: 'cloud', modelName: localModel.metadata.modelName });
}

/**
 * Persist a model to the specified target.
 * Defaults to 'local' if no target is specified.
 */
export async function persistModel(
  model: PersistedModelV3,
  options: ModelSaveOptions = {}
): Promise<{ success: boolean; modelId?: string; error?: string }> {
  try {
    const target = options.target || (options.cloud ? 'cloud' : (options.modelId ? 'cloud' : 'local'));

    if (target === 'cloud') {
      const modelId = await saveModelToSupabase(model, options.modelId);
      return { success: true, modelId };
    } else if (target === 'server') {
      const id = options.modelId || crypto.randomUUID();
      await saveServerModel(id, options.modelName || 'Untitled Model', model);
      return { success: true, modelId: id };
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
 * Load a model from a specific target or fallback chain.
 */
export async function fetchModel(
  modelId?: string,
  target: 'local' | 'cloud' | 'server' = 'local'
): Promise<PersistedModelV3 | null> {
  try {
    if (target === 'cloud' && modelId) {
      return await loadModelFromSupabase(modelId);
    } else if (target === 'server' && modelId) {
      return await fetchServerModel(modelId);
    }
  } catch (err) {
    console.error(`Failed to load model from ${target}:`, err);
    return null;
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
  saveServerModel,
  fetchServerModel,
  listServerModels,
  deleteServerModel,
  type SupabaseModelMetadata,
  type PersistedModelV3
};
