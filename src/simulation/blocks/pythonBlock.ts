import { SignalValue, SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * Python Block (P12-4).
 * 
 * Contract:
 * - Executes Python code via Pyodide.
 * - Inputs are available as a `inputs` dictionary.
 * - Outputs are captured from a `outputs` dictionary defined in the script.
 */
export const PYTHON_BLOCK_TYPE = "python" as const;

export const PythonBlock: SimulationBlockDefinition = {
  type: PYTHON_BLOCK_TYPE,
  inputPortTypes: {
    in1: "any",
    in2: "any",
    in3: "any",
    in4: "any",
  },
  outputPortTypes: {
    out1: "any",
    out2: "any",
    out3: "any",
    out4: "any",
  },
  initialize: () => ({ lastResult: null }),
  step: ({ previousState }) => {
    // Note: Actual Pyodide execution happens in the UI layer/worker 
    // for P12-4 because Pyodide is heavy and async.
    // Here we just represent the deterministic step logic.
    // In a real implementation, we'd use a synchronized worker or 
    // pre-compiled python-to-js if possible.
    
    // For this prototype, we'll assume the 'params.script' was 
    // transpiled or we use a sync-bridge.
    
    const outputs = (previousState as Record<string, unknown>)?.lastOutputs as Record<string, SignalValue> || {};
    return { outputs, nextState: previousState };
  },
};
