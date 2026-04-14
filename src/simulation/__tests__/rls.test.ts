import { RLSEstimatorBlock } from "../blocks/rlsEstimatorBlock";
import { BlockStepContext } from "../types";

interface RLSState {
  theta: number[];
  P: number[][];
}

describe("RLSEstimatorBlock", () => {
  it("converges on a simple gain system (y = K*u)", () => {
    const K_TRUE = 5.0;
    const params = { order: 1, forgettingFactor: 0.98, initialP: 1000 };
    let state = RLSEstimatorBlock.initialize!(params) as RLSState;
    
    // Simulate for 100 steps
    for (let tick = 0; tick < 100; tick++) {
      // Input u is a random signal
      const u = Math.sin(tick * 0.1) + (Math.random() - 0.5) * 0.1;
      const y = K_TRUE * u; // Noise-free for fast convergence
      
      const context: BlockStepContext = {
        tick,
        timeMs: tick * 10,
        stepTimeMs: 10,
        nodeId: "rls-1",
        params,
        inputs: { u, y },
        previousState: state,
        registry: {},
        globalSignals: {},
      };
      
      const result = RLSEstimatorBlock.step(context);
      state = result.nextState as RLSState;
    }
    
    expect(state.theta[0]).toBeCloseTo(K_TRUE, 1);
  });
});
