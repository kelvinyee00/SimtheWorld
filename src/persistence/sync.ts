import { PersistedModelV3 } from "./modelPersistence";
import { 
  listModels, 
  fetchModel, 
  persistModel, 
  loadModelFromLocalStorage,
  saveModelToLocalStorage
} from "./api";

export type SyncTarget = 'local' | 'cloud' | 'server';

export interface SyncResult {
  synced: string[];
  skipped: string[];
  conflicts: string[];
  errors: Array<{ id: string; error: string }>;
}

export type ConflictResolutionStrategy = 'newer' | 'source' | 'target' | 'manual';

/**
 * Sync models from source to target.
 */
export async function syncModels(
  source: SyncTarget,
  target: SyncTarget,
  options: {
    strategy?: ConflictResolutionStrategy;
    onConflict?: (source: PersistedModelV3, target: PersistedModelV3) => Promise<PersistedModelV3>;
  } = {}
): Promise<SyncResult> {
  const { strategy = 'newer', onConflict } = options;
  const result: SyncResult = {
    synced: [],
    skipped: [],
    conflicts: [],
    errors: []
  };

  try {
    const sourceModels = await getAllModelsFromTarget(source);
    
    for (const sourceModelMeta of sourceModels) {
      const modelId = sourceModelMeta.id;
      try {
        const sourceData = await fetchModel(modelId, source);
        if (!sourceData) {
          result.errors.push({ id: modelId, error: "Failed to fetch source data" });
          continue;
        }

        const targetData = await fetchModel(modelId, target);

        if (!targetData) {
          // New model in target
          await persistToTarget(target, sourceData, modelId);
          result.synced.push(modelId);
          continue;
        }

        // Conflict detection
        const resolution = await resolveConflict(sourceData, targetData, strategy, onConflict);
        
        if (resolution === 'skip') {
          result.skipped.push(modelId);
        } else if (resolution === 'source') {
          await persistToTarget(target, sourceData, modelId);
          result.synced.push(modelId);
        } else if (resolution === 'target') {
          result.skipped.push(modelId);
        } else {
          // resolved data
          if (typeof resolution === 'object') {
            await persistToTarget(target, resolution, modelId);
            result.synced.push(modelId);
          } else {
             result.skipped.push(modelId);
          }
        }
      } catch (err) {
        result.errors.push({ id: modelId, error: err instanceof Error ? err.message : String(err) });
      }
    }
  } catch (err) {
    throw new Error(`Sync failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}

async function getAllModelsFromTarget(target: SyncTarget): Promise<Array<{ id: string; name: string }>> {
  if (target === 'local') {
    const local = loadModelFromLocalStorage();
    if (local) {
      return [{ id: 'local-session', name: local.metadata.modelName || 'Local Model' }];
    }
    return [];
  }
  return await listModels(target);
}

async function persistToTarget(target: SyncTarget, model: PersistedModelV3, modelId: string) {
  if (target === 'local') {
    saveModelToLocalStorage(JSON.stringify(model));
    return;
  }
  await persistModel(model, {
    target,
    modelId: modelId === 'local-session' ? undefined : modelId,
    modelName: model.metadata.modelName,
    description: model.metadata.description
  });
}

async function resolveConflict(
  source: PersistedModelV3,
  target: PersistedModelV3,
  strategy: ConflictResolutionStrategy,
  onConflict?: (source: PersistedModelV3, target: PersistedModelV3) => Promise<PersistedModelV3>
): Promise<PersistedModelV3 | 'source' | 'target' | 'skip'> {
  if (strategy === 'source') return 'source';
  if (strategy === 'target') return 'target';
  
  if (strategy === 'newer') {
    const sourceTime = source.metadata.savedAtMs;
    const targetTime = target.metadata.savedAtMs;
    
    if (sourceTime > targetTime) return 'source';
    if (targetTime > sourceTime) return 'target';
    return 'skip';
  }

  if (strategy === 'manual' && onConflict) {
    return await onConflict(source, target);
  }

  return 'skip';
}
