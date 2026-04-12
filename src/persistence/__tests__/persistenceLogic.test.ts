import { vi } from 'vitest';
import { transitionLocalToCloud, persistModel } from '../index';
import * as modelPersistence from '../modelPersistence';
import * as supabasePersistence from '../supabasePersistence';

// Mock the dependent modules
vi.mock('../modelPersistence', async () => {
  const actual = await vi.importActual('../modelPersistence');
  return {
    ...actual,
    loadModelFromLocalStorage: vi.fn(),
  };
});

vi.mock('../supabasePersistence', () => ({
  saveModelToSupabase: vi.fn(),
  loadModelFromSupabase: vi.fn(),
  listUserModels: vi.fn(),
}));

describe('Persistence Logic (Transition and Persistence)', () => {
  const mockModel: any = {
    schemaVersion: 3,
    metadata: {
      app: 'web-simulink',
      savedAtMs: 123456789,
      modelName: 'Local Test Model',
    },
    timing: { simulationTimeMs: 1000, stepTimeMs: 100 },
    nodes: [],
    edges: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('persistModel', () => {
    it('should call saveModelToSupabase when cloud option is true', async () => {
      vi.mocked(supabasePersistence.saveModelToSupabase).mockResolvedValue('cloud-id-123');

      const result = await persistModel(mockModel, { cloud: true, modelName: 'Cloud Save' });

      expect(supabasePersistence.saveModelToSupabase).toHaveBeenCalledWith(mockModel, undefined);
      expect(result).toEqual({ success: true, modelId: 'cloud-id-123' });
    });

    it('should return failure if saveModelToSupabase throws', async () => {
      vi.mocked(supabasePersistence.saveModelToSupabase).mockRejectedValue(new Error('Auth required'));

      const result = await persistModel(mockModel, { cloud: true });

      expect(result).toEqual({ success: false, error: 'Auth required' });
    });
  });

  describe('transitionLocalToCloud', () => {
    it('should return error if no local model exists', async () => {
      vi.mocked(modelPersistence.loadModelFromLocalStorage).mockReturnValue(null);

      const result = await transitionLocalToCloud();

      expect(result).toEqual({ success: false, error: 'No local model found to transition.' });
      expect(supabasePersistence.saveModelToSupabase).not.toHaveBeenCalled();
    });

    it('should load local model and save to supabase', async () => {
      vi.mocked(modelPersistence.loadModelFromLocalStorage).mockReturnValue(mockModel);
      vi.mocked(supabasePersistence.saveModelToSupabase).mockResolvedValue('new-cloud-id');

      const result = await transitionLocalToCloud();

      expect(modelPersistence.loadModelFromLocalStorage).toHaveBeenCalled();
      expect(supabasePersistence.saveModelToSupabase).toHaveBeenCalledWith(mockModel, undefined);
      expect(result).toEqual({ success: true, modelId: 'new-cloud-id' });
    });
  });
});
