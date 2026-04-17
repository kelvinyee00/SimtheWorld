import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

let db: Database | null = null;

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

    CREATE TRIGGER IF NOT EXISTS update_models_updated_at 
    AFTER UPDATE ON models
    BEGIN
      UPDATE models SET updated_at = CURRENT_TIMESTAMP WHERE id = old.id;
    END;
  `);

  return db;
}
