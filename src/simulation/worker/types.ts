import { 
  SimulationGraph, 
  SimulationRuntimeSnapshot, 
  } from "../types";

export type WorkerMessageType = 
  | "INIT" 
  | "START" 
  | "PAUSE" 
  | "RESET" 
  | "STEP" 
  | "UPDATE_GRAPH" 
  | "UPDATE_PARAMS";

export interface WorkerRequest {
  type: WorkerMessageType;
  graph?: SimulationGraph;
  snapshot?: SimulationRuntimeSnapshot;
  batchSize?: number;
  params?: Record<string, unknown>;
}

export interface WorkerResponse {
  type: "STATE_UPDATE" | "ERROR" | "COMPLETED";
  snapshot?: SimulationRuntimeSnapshot;
  error?: string;
  metrics?: {
    batchDurationMs: number;
    stepsExecuted: number;
  };
}
