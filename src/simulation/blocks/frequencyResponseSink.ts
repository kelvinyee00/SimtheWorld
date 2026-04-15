import { SimulationBlockDefinition, BlockStepContext, BlockStepResult } from "../types";

/**
 * FrequencyResponseSinkBlock performs online frequency response estimation (Magnitude/Phase).
 * 
 * Algorithm: Recursive correlation (Discrete Fourier Transform at a single frequency).
 * We maintain rolling sums of (signal * sin) and (signal * cos) for both input (u) and response (y).
 * 
 * Inputs:
 * - u: Input stimulus
 * - y: System response
 * 
 * Outputs:
 * - magnitude: |G(jw)| = |Y(jw)| / |U(jw)|
 * - phase: arg(G(jw)) = arg(Y(jw)) - arg(U(jw)) (in degrees)
 * 
 * Parameters:
 * - frequency: Target frequency in Hz
 * - windowSize: Number of samples to average (integration window)
 */

interface FreqState {
  u_cos_sum: number;
  u_sin_sum: number;
  y_cos_sum: number;
  y_sin_sum: number;
  count: number;
}

export const FrequencyResponseSinkBlock: SimulationBlockDefinition = {
  type: "frequencyResponseSink",

  initialize: () => ({
    u_cos_sum: 0,
    u_sin_sum: 0,
    y_cos_sum: 0,
    y_sin_sum: 0,
    count: 0,
  }),

  step: (ctx: BlockStepContext): BlockStepResult => {
    const frequency = (ctx.params.frequency as number) || 1.0; // Hz
    const windowSize = (ctx.params.windowSize as number) || 1000;
    
    const u = (ctx.inputs.u as number) || 0;
    const y = (ctx.inputs.y as number) || 0;

    const state = (ctx.previousState as FreqState) || {
      u_cos_sum: 0,
      u_sin_sum: 0,
      y_cos_sum: 0,
      y_sin_sum: 0,
      count: 0,
    };

    // Current time in seconds for the oscillators
    const t = ctx.timeMs / 1000.0;
    const omega = 2 * Math.PI * frequency;

    const cos_ref = Math.cos(omega * t);
    const sin_ref = Math.sin(omega * t);

    let next_u_cos = state.u_cos_sum + u * cos_ref;
    let next_u_sin = state.u_sin_sum + u * sin_ref;
    let next_y_cos = state.y_cos_sum + y * cos_ref;
    let next_y_sin = state.y_sin_sum + y * sin_ref;
    let next_count = state.count + 1;

    let magnitude = 0;
    let phase = 0;

    // Use current accumulation for estimation
    const U_re = next_u_cos / next_count;
    const U_im = -next_u_sin / next_count;
    const Y_re = next_y_cos / next_count;
    const Y_im = -next_y_sin / next_count;

    const U_mag = Math.sqrt(U_re * U_re + U_im * U_im);
    const Y_mag = Math.sqrt(Y_re * Y_re + Y_im * Y_im);

    if (U_mag > 1e-12) {
      magnitude = Y_mag / U_mag;
      
      const U_phase = Math.atan2(U_im, U_re);
      const Y_phase = Math.atan2(Y_im, Y_re);
      
      phase = ((Y_phase - U_phase) * 180) / Math.PI;
      // Normalize phase to [-180, 180]
      while (phase > 180) phase -= 360;
      while (phase < -180) phase += 360;
    }

    if (next_count >= windowSize) {
      // Reset for next window
      next_u_cos = 0;
      next_u_sin = 0;
      next_y_cos = 0;
      next_y_sin = 0;
      next_count = 0;
    }

    return {
      outputs: {
        magnitude,
        phase,
      },
      nextState: {
        u_cos_sum: next_u_cos,
        u_sin_sum: next_u_sin,
        y_cos_sum: next_y_cos,
        y_sin_sum: next_y_sin,
        count: next_count,
      },
    };
  },
};
