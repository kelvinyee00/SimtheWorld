import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { v4 as uuidv4 } from 'uuid';

let db: Database | null = null;

export interface ModelRecord {
  id: string;
  name: string;
  data: string;
  version: number;
  created_at: string;
  updated_at: string;
}

/**
 * High-density technical comment: 
 * Ensures a single shared SQLite connection and initializes the schema if necessary.
 * Includes 'version' for schema versioning and a trigger for automatic 'updated_at' management.
 */
export async function getDb() {
  if (db) return db;

  db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS models (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      data TEXT NOT NULL,
      version INTEGER DEFAULT 3,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS simulation_runs (
      id TEXT PRIMARY KEY,
      model_id TEXT NOT NULL,
      model_name TEXT NOT NULL,
      model_snapshot TEXT NOT NULL, 
      status TEXT NOT NULL,
      tick_count INTEGER NOT NULL,
      final_time_ms REAL NOT NULL,
      results TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(model_id) REFERENCES models(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_runs_model_id ON simulation_runs(model_id);

    CREATE TRIGGER IF NOT EXISTS update_models_updated_at 
    AFTER UPDATE ON models
    BEGIN
      UPDATE models SET updated_at = CURRENT_TIMESTAMP WHERE id = old.id;
    END;
  `);

  return db;
}

/**
 * List all models (excluding the heavy 'data' field for performance).
 */
export async function listModels(): Promise<Omit<ModelRecord, 'data'>[]> {
  const db = await getDb();
  return db.all('SELECT id, name, version, created_at, updated_at FROM models ORDER BY updated_at DESC');
}

/**
 * Fetch a single model by ID.
 */
export async function getModel(id: string): Promise<ModelRecord | null> {
  const db = await getDb();
  const row = await db.get('SELECT * FROM models WHERE id = ?', [id]);
  return row || null;
}

/**
 * Create a new model document.
 */
export async function createModel(name: string, data: any): Promise<string> {
  const db = await getDb();
  const id = uuidv4();
  await db.run(
    'INSERT INTO models (id, name, data, version) VALUES (?, ?, ?, ?)',
    [id, name, JSON.stringify(data), 3]
  );
  return id;
}

/**
 * Update an existing model document.
 */
export async function updateModel(id: string, name: string, data: any): Promise<boolean> {
  const db = await getDb();
  const result = await db.run(
    'UPDATE models SET name = ?, data = ?, version = 3 WHERE id = ?',
    [name, JSON.stringify(data), id]
  );
  return (result.changes ?? 0) > 0;
}

/**
 * Delete a model document.
 */
export async function deleteModel(id: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.run('DELETE FROM models WHERE id = ?', [id]);
  return (result.changes ?? 0) > 0;
}
