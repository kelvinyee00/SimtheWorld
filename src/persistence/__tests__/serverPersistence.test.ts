import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveServerModel, fetchServerModel, listServerModels } from '../serverApi';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Server Persistence API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockModel = {
    schemaVersion: 3 as const,
    metadata: {
      app: 'web-simulink' as const,
      savedAtMs: Date.now(),
      modelName: 'Test Model',
    },
    timing: {
      simulationTimeMs: 1000,
      stepTimeMs: 10,
    },
    nodes: [],
    edges: [],
  };

  it('lists models from the server', async () => {
    const mockList = [{ id: '1', name: 'Model 1', version: 3, updated_at: '2023-01-01' }];
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockList,
    });

    const result = await listServerModels();
    expect(result).toEqual(mockList);
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/models');
  });

  it('fetches a single model from the server', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockModel }),
    });

    const result = await fetchServerModel('123');
    expect(result.metadata.modelName).toBe('Test Model');
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/models/123');
  });

  it('saves a model to the server (update)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
    });

    await saveServerModel('123', 'Updated Name', mockModel);
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/models/123', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated Name', data: mockModel })
    }));
  });

  it('saves a model to the server (create if not found)', async () => {
    // First call (PUT) returns 404
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });
    // Second call (POST) returns 201
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
    });

    await saveServerModel('123', 'New Model', mockModel);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenLastCalledWith('/api/v1/models', expect.objectContaining({
      method: 'POST'
    }));
  });
});
