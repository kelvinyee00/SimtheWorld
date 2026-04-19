import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSimulationRuntimeStore } from "../../store/simulationRuntimeStore";
import { getSocket } from "../../utils/socket";

// Mock socket.io-client
vi.mock("../../utils/socket", () => {
  const socket = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connected: true,
  };
  return { getSocket: () => socket };
});

describe("P15-2 Real-time Dashboard Sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSimulationRuntimeStore.getState().reset();
  });

  it("should join a room when modelId is set", () => {
    const socket = getSocket();
    const modelId = "test-model-123";
    
    useSimulationRuntimeStore.getState().setModelId(modelId);
    
    expect(socket.emit).toHaveBeenCalledWith("join-room", modelId);
  });

  it("should broadcast simulation-snapshot during stepOnce", () => {
    const socket = getSocket();
    const modelId = "test-model-123";
    const store = useSimulationRuntimeStore.getState();
    
    store.setModelId(modelId);
    store.run(); // status -> running
    store.stepOnce();
    
    expect(socket.emit).toHaveBeenCalledWith("simulation-snapshot", expect.objectContaining({
      modelId,
      snapshot: expect.any(Object)
    }));
  });

  it("should update local state when simulation-update is received in follower mode", () => {
    const modelId = "test-model-123";
    const store = useSimulationRuntimeStore.getState();
    store.setModelId(modelId);
    store.setFollowerMode(true);
    
    const socket = getSocket();
    // socket.on is a vitest mock. We need to find the call for 'simulation-update'.
    const updateHandler = socket.on.mock.calls.find((call: any) => call[0] === "simulation-update")?.[1];
    
    expect(updateHandler).toBeDefined();
    
    const mockSnapshot = { ...store.runtime, tick: 999 };
    updateHandler({ modelId, snapshot: mockSnapshot });
    
    expect(useSimulationRuntimeStore.getState().runtime.tick).toBe(999);
  });

  it("should not execute stepOnce locally in follower mode", () => {
    const store = useSimulationRuntimeStore.getState();
    store.setFollowerMode(true);
    const initialTick = store.runtime.tick;
    
    store.stepOnce();
    
    expect(store.runtime.tick).toBe(initialTick);
  });
});
