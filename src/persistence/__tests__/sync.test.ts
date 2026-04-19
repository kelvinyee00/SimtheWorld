import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncModels } from "../sync";
import * as api from "../api";
import { PersistedModelV3 } from "../modelPersistence";

vi.mock("../api", () => ({
  listModels: vi.fn(),
  fetchModel: vi.fn(),
  persistModel: vi.fn(),
  loadModelFromLocalStorage: vi.fn(),
  saveModelToLocalStorage: vi.fn(),
}));

const mockV3Model = (id: string, savedAtMs: number): PersistedModelV3 => ({
  schemaVersion: 3,
  metadata: {
    app: "web-simulink",
    savedAtMs,
    modelName: `Model ${id}`,
  },
  timing: {
    simulationTimeMs: 1000,
    stepTimeMs: 10,
  },
  nodes: [],
  edges: [],
});

describe("syncModels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should sync a new model from source to target", async () => {
    const sourceModel = mockV3Model("1", 1000);
    
    vi.mocked(api.listModels).mockResolvedValue([{ id: "1", name: "Model 1" }]);
    vi.mocked(api.fetchModel)
      .mockResolvedValueOnce(sourceModel) // source
      .mockResolvedValueOnce(null);        // target (not found)
    
    const result = await syncModels("cloud", "server");
    
    expect(api.persistModel).toHaveBeenCalledWith(sourceModel, expect.objectContaining({
      target: "server",
      modelId: "1"
    }));
    expect(result.synced).toContain("1");
  });

  it("should resolve conflict using 'newer' strategy (source newer)", async () => {
    const sourceModel = mockV3Model("1", 2000);
    const targetModel = mockV3Model("1", 1000);
    
    vi.mocked(api.listModels).mockResolvedValue([{ id: "1", name: "Model 1" }]);
    vi.mocked(api.fetchModel)
      .mockResolvedValueOnce(sourceModel)
      .mockResolvedValueOnce(targetModel);
    
    const result = await syncModels("cloud", "server", { strategy: "newer" });
    
    expect(api.persistModel).toHaveBeenCalledWith(sourceModel, expect.any(Object));
    expect(result.synced).toContain("1");
  });

  it("should resolve conflict using 'newer' strategy (target newer)", async () => {
    const sourceModel = mockV3Model("1", 1000);
    const targetModel = mockV3Model("1", 2000);
    
    vi.mocked(api.listModels).mockResolvedValue([{ id: "1", name: "Model 1" }]);
    vi.mocked(api.fetchModel)
      .mockResolvedValueOnce(sourceModel)
      .mockResolvedValueOnce(targetModel);
    
    const result = await syncModels("cloud", "server", { strategy: "newer" });
    
    expect(api.persistModel).not.toHaveBeenCalled();
    expect(result.skipped).toContain("1");
  });

  it("should handle sync from local to cloud", async () => {
    const localModel = mockV3Model("local", 1000);
    
    vi.mocked(api.loadModelFromLocalStorage).mockReturnValue(localModel);
    vi.mocked(api.fetchModel)
      .mockResolvedValueOnce(localModel) // source (local)
      .mockResolvedValueOnce(null);       // target (cloud)
    
    const result = await syncModels("local", "cloud");
    
    expect(api.persistModel).toHaveBeenCalledWith(localModel, expect.objectContaining({
      target: "cloud",
      modelId: undefined // local-session should translate to undefined modelId for new cloud save
    }));
    expect(result.synced).toContain("local-session");
  });
});
