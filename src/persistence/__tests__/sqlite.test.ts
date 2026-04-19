import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb, createModel, getModel, listModels, updateModel, deleteModel } from '../sqlite';
import fs from 'fs';

describe('SQLite Persistence Adapter', () => {
  const TEST_DB_FILE = './database.sqlite';

  beforeAll(async () => {
    // Ensure we start with a clean state if needed, 
    // but getDb handles CREATE TABLE IF NOT EXISTS.
  });

  it('should create and retrieve a model', async () => {
    const modelName = 'Test Model';
    const modelData = { schemaVersion: 3, nodes: [], edges: [] };
    
    const id = await createModel(modelName, modelData);
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');

    const model = await getModel(id);
    expect(model).not.toBeNull();
    expect(model?.name).toBe(modelName);
    expect(JSON.parse(model!.data)).toEqual(modelData);
  });

  it('should list models', async () => {
    const models = await listModels();
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);
    expect(models[0]).toHaveProperty('id');
    expect(models[0]).toHaveProperty('name');
    expect(models[0]).not.toHaveProperty('data');
  });

  it('should update a model', async () => {
    const models = await listModels();
    const id = models[0].id;
    const newName = 'Updated Model Name';
    const newData = { schemaVersion: 3, nodes: [{ id: '1' }], edges: [] };

    const success = await updateModel(id, newName, newData);
    expect(success).toBe(true);

    const updatedModel = await getModel(id);
    expect(updatedModel?.name).toBe(newName);
    expect(JSON.parse(updatedModel!.data)).toEqual(newData);
  });

  it('should delete a model', async () => {
    const id = await createModel('To Be Deleted', {});
    const success = await deleteModel(id);
    expect(success).toBe(true);

    const model = await getModel(id);
    expect(model).toBeNull();
  });
});
