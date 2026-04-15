import { describe, it, expect } from "vitest";
import { FrequencyResponseSinkBlock } from "../blocks/frequencyResponseSink";
import { BlockStepContext } from "../types";

describe("FrequencyResponseSinkBlock", () => {
  it("estimates magnitude and phase for a gain + delay system", () => {
    const freq = 10; // Hz
    const gain = 2.5;
    const delaySec = 0.01; // 10ms delay
    const params = { frequency: freq, windowSize: 1000 };
    const stepTimeMs = 1; // 1kHz sampling
    
    let state = FrequencyResponseSinkBlock.initialize!(params);
    
    // Theoretical phase: -360 * freq * delay = -360 * 10 * 0.01 = -36 degrees
    const expectedPhase = -36;

    // Buffers for delay implementation
    const delaySamples = Math.round(delaySec / (stepTimeMs / 1000));
    const uBuffer = new Array(delaySamples).fill(0);

    let lastMag = 0;
    let lastPhase = 0;

    // Run for 2 seconds (2000 samples)
    for (let tick = 0; tick < 2000; tick++) {
      const timeMs = tick * stepTimeMs;
      const t = timeMs / 1000;
      
      // Input: sine wave at target frequency
      const u = Math.sin(2 * Math.PI * freq * t);
      
      // Output: delayed and scaled u
      uBuffer.push(u);
      const delayedU = uBuffer.shift();
      const y = gain * (delayedU || 0);

      const context: BlockStepContext = {
        tick,
        timeMs,
        stepTimeMs,
        nodeId: "sink-1",
        params,
        inputs: { u, y },
        previousState: state,
        registry: {},
        globalSignals: {},
      };

      const result = FrequencyResponseSinkBlock.step(context);
      state = result.nextState;
      lastMag = result.outputs.magnitude as number;
      lastPhase = result.outputs.phase as number;
    }

    expect(lastMag).toBeCloseTo(gain, 1);
    expect(lastPhase).toBeCloseTo(expectedPhase, 1);
  });
});
