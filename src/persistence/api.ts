import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { getDb } from './sqlite';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

router.use(cors());
router.use(bodyParser.json());

// GET /models
router.get('/models', async (req, res) => {
  try {
    const db = await getDb();
    const models = await db.all('SELECT id, name, created_at, updated_at FROM models');
    res.json(models);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /models
router.post('/models', async (req, res) => {
  try {
    const { name, data } = req.body;
    if (!name || !data) {
      return res.status(400).json({ error: 'Name and data are required' });
    }
    const db = await getDb();
    const id = uuidv4();
    await db.run(
      'INSERT INTO models (id, name, data) VALUES (?, ?, ?)',
      [id, name, JSON.stringify(data)]
    );
    res.status(201).json({ id, name });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /models/:id
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

// PUT /models/:id
router.put('/models/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, data } = req.body;
    const db = await getDb();
    const existing = await db.get('SELECT id FROM models WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    await db.run(
      'UPDATE models SET name = ?, data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, JSON.stringify(data), id]
    );
    res.json({ id, name });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// DELETE /models/:id
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
