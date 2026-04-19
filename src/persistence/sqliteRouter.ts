import express from 'express';
import cors from 'cors';
import { getDb } from './sqlite';
import { v4 as uuidv4 } from 'uuid';
import { parseModelDocument } from './modelPersistence';

const router = express.Router();

// Middleware is usually handled in server.ts, but keeping cors/json here for modularity if needed
router.use(cors());
router.use(express.json({ limit: '50mb' }));

/**
 * High-density technical comment: 
 * CRUD endpoints for simulation models. 
 * Uses Zod validation via parseModelDocument to ensure data integrity.
 * SQLite handles persistence with automatic timestamp management.
 */

// GET /api/v1/health
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /api/v1/models (List)
router.get('/models', async (_req, res) => {
  try {
    const db = await getDb();
    const models = await db.all('SELECT id, name, version, created_at, updated_at FROM models ORDER BY updated_at DESC');
    res.json(models);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/v1/models/:id (Fetch)
router.get('/models/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    const model = await db.get('SELECT * FROM models WHERE id = ?', [id]);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    res.json({
      ...model,
      data: JSON.parse(model.data)
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/v1/models (Create)
router.post('/models', async (req, res) => {
  try {
    const { name, data } = req.body;
    if (!name || !data) {
      return res.status(400).json({ error: 'Name and data are required' });
    }

    // Validate data against PersistedModelV3 schema
    try {
      parseModelDocument(JSON.stringify(data));
    } catch (validationError) {
      return res.status(400).json({ error: `Invalid model schema: ${(validationError as Error).message}` });
    }

    const db = await getDb();
    const id = uuidv4();
    await db.run(
      'INSERT INTO models (id, name, data, version) VALUES (?, ?, ?, ?)',
      [id, name, JSON.stringify(data), 3]
    );
    res.status(201).json({ id, name, version: 3 });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// PUT /api/v1/models/:id (Update)
router.put('/models/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, data } = req.body;
    
    if (!name || !data) {
      return res.status(400).json({ error: 'Name and data are required' });
    }

    // Validate data against PersistedModelV3 schema
    try {
      parseModelDocument(JSON.stringify(data));
    } catch (validationError) {
      return res.status(400).json({ error: `Invalid model schema: ${(validationError as Error).message}` });
    }

    const db = await getDb();
    const result = await db.run(
      'UPDATE models SET name = ?, data = ?, version = 3 WHERE id = ?',
      [name, JSON.stringify(data), id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    res.json({ id, name, version: 3 });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// DELETE /api/v1/models/:id (Delete)
router.delete('/models/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    const result = await db.run('DELETE FROM models WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Model not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
