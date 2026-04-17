import { describe, it, expect, vi, beforeEach } from "vitest";
import { persistModel, fetchModel, transitionLocalToCloud } from "../index";
import * as modelPersistence from "../modelPersistence";
import * as supabasePersistence from "../supabasePersistence";

vi.mock("../modelPersistence", async (importOriginal) => {
  const actual = await importOriginal<typeof modelPersistence>();
  return {
    ...actual,
    saveModelToLocalStorage: vi.fn(),
    loadModelFromLocalStorage: vi.fn(),
  };
});

vi.mock("../supabasePersistence", () => ({
  saveModelToSupabase: vi.fn(),
  loadModelFromSupabase: vi.fn(),
  listUserModels: vi.fn(),
}));

describe("Persistence Verification", () => {
  const mockModel: modelPersistence.PersistedModelV3 = {
    schemaVersion: 3,
    metadata: {
      app: "web-simulink",
      savedAtMs: Date.now(),
      modelName: "Test Model",
    },
    timing: {
      simulationTimeMs: 1000,
      stepTimeMs: 10,
    },
    nodes: [],
    edges: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("persistModel", () => {
    it("should save to local storage by default", async () => {
      const result = await persistModel(mockModel);
      
      expect(result.success).toBe(true);
      expect(modelPersistence.saveModelToLocalStorage).toHaveBeenCalledWith(JSON.stringify(mockModel));
      expect(supabasePersistence.saveModelToSupabase).not.toHaveBeenCalled();
    });

    it("should save to cloud when requested", async () => {
      vi.mocked(supabasePersistence.saveModelToSupabase).mockResolvedValue("cloud-id-123");
      
      const result = await persistModel(mockModel, { cloud: true });
      
      expect(result.success).toBe(true);
      expect(result.modelId).toBe("cloud-id-123");
      expect(supabasePersistence.saveModelToSupabase).toHaveBeenCalledWith(mockModel, undefined);
      expect(modelPersistence.saveModelToLocalStorage).not.toHaveBeenCalled();
    });

    it("should return error if cloud save fails", async () => {
      vi.mocked(supabasePersistence.saveModelToSupabase).mockRejectedValue(new Error("Cloud error"));
      
      const result = await persistModel(mockModel, { cloud: true });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("Cloud error");
    });
  });

  describe("fetchModel", () => {
    it("should load from local storage if no modelId is provided", async () => {
      vi.mocked(modelPersistence.loadModelFromLocalStorage).mockReturnValue(mockModel);
      
      const result = await fetchModel();
      
      expect(result).toEqual(mockModel);
      expect(modelPersistence.loadModelFromLocalStorage).toHaveBeenCalled();
      expect(supabasePersistence.loadModelFromSupabase).not.toHaveBeenCalled();
    });

    it("should load from cloud if modelId is provided", async () => {
      vi.mocked(supabasePersistence.loadModelFromSupabase).mockResolvedValue(mockModel);
      
      const result = await fetchModel("cloud-id-123", "cloud");
      
      expect(result).toEqual(mockModel);
      expect(supabasePersistence.loadModelFromSupabase).toHaveBeenCalledWith("cloud-id-123");
      expect(modelPersistence.loadModelFromLocalStorage).not.toHaveBeenCalled();
    });

    it("should return null and log error if cloud load fails", async () => {
      vi.mocked(supabasePersistence.loadModelFromSupabase).mockRejectedValue(new Error("Cloud load error"));
      
      const result = await fetchModel("cloud-id-123", "cloud");
      
      expect(result).toBeNull();
    });
  });

  describe("transitionLocalToCloud", () => {
    it("should read from local storage and save to cloud", async () => {
      vi.mocked(modelPersistence.loadModelFromLocalStorage).mockReturnValue(mockModel);
      vi.mocked(supabasePersistence.saveModelToSupabase).mockResolvedValue("new-cloud-id");
      
      const result = await transitionLocalToCloud();
      
      expect(result.success).toBe(true);
      expect(result.modelId).toBe("new-cloud-id");
      expect(modelPersistence.loadModelFromLocalStorage).toHaveBeenCalled();
      expect(supabasePersistence.saveModelToSupabase).toHaveBeenCalledWith(mockModel, undefined);
    });

    it("should return error if no local model found", async () => {
      vi.mocked(modelPersistence.loadModelFromLocalStorage).mockReturnValue(null);
      
      const result = await transitionLocalToCloud();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("No local model found to transition.");
    });
  });
});
