import { SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * Recursive Least Squares (RLS) Estimator Block.
 * 
 * Algorithm:
 * 1. Read input signal u and output signal y.
 * 2. Update prediction error: e[k] = y[k] - phi[k]' * theta[k-1]
 * 3. Update gain vector: K[k] = (P[k-1] * phi[k]) / (lambda + phi[k]' * P[k-1] * phi[k])
 * 4. Update parameter vector: theta[k] = theta[k-1] + K[k] * e[k]
 * 5. Update covariance matrix: P[k] = (1/lambda) * (P[k-1] - K[k] * phi[k]' * P[k-1])
 * 
 * For a simple gain system y = K*u, phi = [u], theta = [K].
 */

export const RLS_ESTIMATOR_BLOCK_TYPE = "rls-estimator" as const;

interface RLSState {
  theta: number[]; // Estimated parameters vector
  P: number[][];   // Covariance matrix
}

interface RLSParams {
  order: number;
  forgettingFactor: number;
  initialP: number;
}

function parseRLSParams(raw: Record<string, unknown>): RLSParams {
  return {
    order: Math.max(1, typeof raw.order === "number" ? raw.order : 1),
    forgettingFactor: typeof raw.forgettingFactor === "number" ? Math.min(1, Math.max(0.1, raw.forgettingFactor)) : 0.98,
    initialP: typeof raw.initialP === "number" ? raw.initialP : 1000,
  };
}

export const RLSEstimatorBlock: SimulationBlockDefinition = {
  type: RLS_ESTIMATOR_BLOCK_TYPE,
  inputPortTypes: { u: "number", y: "number" },
  outputPortTypes: { theta: "vector", error: "number" },
  
  initialize: (params) => {
    const { order, initialP } = parseRLSParams(params);
    const theta = new Array(order).fill(0);
    const P = Array.from({ length: order }, (_, i) => 
      Array.from({ length: order }, (_, j) => (i === j ? initialP : 0))
    );
    return { theta, P };
  },

  step: ({ params, previousState, inputs }) => {
    const { order, forgettingFactor } = parseRLSParams(params);
    const state = (previousState as RLSState) || { 
        theta: new Array(order).fill(0), 
        P: Array.from({ length: order }, (_, i) => 
            Array.from({ length: order }, (_, j) => (i === j ? 1000 : 0))
        ) 
    };
    
    // Inputs: u and y
    const uVal = typeof inputs.u === "number" ? inputs.u : 0;
    const yVal = typeof inputs.y === "number" ? inputs.y : 0;

    const phi = [uVal]; // Current regressor for order 1
    const { theta, P } = state;

    // 1. Prediction error
    // e = y - phi' * theta
    let phiDotTheta = 0;
    for (let i = 0; i < order; i++) {
        phiDotTheta += phi[i] * (theta[i] || 0);
    }
    const error = yVal - phiDotTheta;

    // 2. Gain vector K
    // K = (P * phi) / (lambda + phi' * P * phi)
    const Pphi = new Array(order).fill(0);
    for (let i = 0; i < order; i++) {
        for (let j = 0; j < order; j++) {
            Pphi[i] += P[i][j] * (phi[j] || 0);
        }
    }

    let phiPphi = 0;
    for (let i = 0; i < order; i++) {
        phiPphi += (phi[i] || 0) * Pphi[i];
    }

    const denom = forgettingFactor + phiPphi;
    const K = Pphi.map(v => v / (denom || 1e-10));

    // 3. Update theta
    const nextTheta = theta.map((t, i) => t + K[i] * error);

    // 4. Update P
    // P_next = (1/lambda) * (P - K * phi' * P)
    // K * (phi' * P) -> phi' * P is a 1xN * NxN = 1xN vector
    const phiTP = new Array(order).fill(0);
    for (let j = 0; j < order; j++) {
        for (let i = 0; i < order; i++) {
            phiTP[j] += (phi[i] || 0) * P[i][j];
        }
    }

    const nextP = Array.from({ length: order }, (_, i) =>
        Array.from({ length: order }, (_, j) => {
            const update = K[i] * phiTP[j];
            return (P[i][j] - update) / forgettingFactor;
        })
    );

    return {
      outputs: {
        theta: nextTheta,
        error: error,
      },
      nextState: {
        theta: nextTheta,
        P: nextP,
      },
    };
  },
};
