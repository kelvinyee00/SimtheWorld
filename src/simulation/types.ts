/**
 * Simulation core type system (P0 foundation).
 *
 * Design intent:
 * - Keep the runtime mathematically deterministic by modeling every value update as a pure
 *   tick transition (`tick -> tick + 1`) using immutable snapshots.
 * - Keep graph/block abstractions generic so Iteration-2 can add richer block families,
 *   multi-port routing, and typed signal domains without rewriting scheduler/store contracts.
 */

/**
 * Runtime lifecycle states used by toolbar/store controls.
 */
export type SimulationStatus = "idle" | "running" | "paused" | "completed";

/**
 * A signal payload for P0.
 *
 * Iteration-2 scalability path:
 * - Lift this to discriminated unions (number | boolean | vector | struct) and enforce
 *   compatibility at wire-connection time with schema validators.
 */
export type SignalType = "number" | "boolean" | "vector" | "any";

export type SignalValue = number | boolean | number[] | null;

/**
 * Node instance metadata owned by the graph layer.
 *
 * NOTE: We intentionally keep `data` loose for P0 because blocks are still minimal;
 * block implementations perform local narrowing/casting. Iteration-2 can introduce
 * per-block zod schemas and infer strong block-specific parameter types.
 */
export interface SimulationNode {
  id: string;
  type: string;
  data?: Record<string, unknown>;
}

/**
 * Directed signal edge from `source` node to `target` node.
 *
 * Port-level routing is optional in P0 but represented now to avoid model churn when
 * multi-input/multi-output blocks are introduced in later iterations.
 */
export interface SimulationEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

/**
 * Graph payload consumed by execution planning and tick stepping.
 */
export interface SimulationGraph {
  nodes: SimulationNode[];
  edges: SimulationEdge[];
}

/**
 * Input packet provided to a single block during one tick.
 */
export interface BlockStepContext {
  /** Current simulation tick index before this block emits outputs. */
  tick: number;
  /** Current simulation time in milliseconds before stepping. */
  timeMs: number;
  /** Configured fixed step duration in milliseconds. */
  stepTimeMs: number;
  /** Node id of this block instance. */
  nodeId: string;
  /** Runtime-configurable block parameters stored on the node. */
  params: Record<string, unknown>;
  /**
   * Incoming signal map keyed by input handle id.
   * `"default"` is used when no explicit handle is present.
   */
  inputs: Record<string, SignalValue>;
  /**
   * Node-local persisted state across ticks.
   *
   * Iteration-2 path:
   * - Optionally split into deterministic state and ephemeral UI state,
   *   where only deterministic state participates in reproducible runs.
   */
  previousState: unknown;
  /**
   * Global block registry for recursive execution (subsystems).
   */
  registry: BlockRegistry;
}

/**
 * Result emitted by a block at the end of a tick.
 */
export interface BlockStepResult {
  /** Outgoing signals keyed by output handle id (or `default`). */
  outputs: Record<string, SignalValue>;
  /** Updated node-local state to persist for the next tick. */
  nextState?: unknown;
}

/**
 * Pluggable block implementation contract.
 */
export interface SimulationBlockDefinition {
  type: string;
  /**
   * Optional initialization hook invoked on reset/start.
   */
  initialize?: (params: Record<string, unknown>) => unknown;
  /**
   * Optional input port type metadata used by validation/connection guardrails.
   * Keys are base handle ids (e.g. `default`, `in`, `in1`, `cond`).
   */
  inputPortTypes?: Record<string, SignalType>;
  /**
   * Optional output port type metadata used by validation/connection guardrails.
   * Keys are output handle ids (usually `default` for current blocks).
   */
  outputPortTypes?: Record<string, SignalType>;
  /**
   * Marks blocks whose outputs are sourced from persisted state (not direct-feedthrough).
   *
   * Scheduling implication:
   * - Outgoing edges from these blocks can be treated as feedback edges during topological
   *   planning, allowing cycle-safe execution for models that include delay/memory operators.
   */
  breaksAlgebraicLoop?: boolean;
  /**
   * Deterministic per-tick step function.
   *
   * Contract:
   * - Must be side-effect free for reproducibility.
   * - Must depend only on provided context.
   */
  step: (context: BlockStepContext) => BlockStepResult;
}

/**
 * Runtime snapshot owned by engine/store.
 */
export interface SimulationRuntimeSnapshot {
  status: SimulationStatus;
  tick: number;
  timeMs: number;
  simulationTimeMs: number;
  stepTimeMs: number;
  /** Latest outputs for each node and output handle. */
  nodeOutputs: Record<string, Record<string, SignalValue>>;
  /** Persisted local state for each node instance. */
  nodeInternalState: Record<string, unknown>;
  /** Error reason populated if scheduler/engine halts abnormally. */
  error?: string;
}

/**
 * Registry of block type -> executable behavior.
 */
export type BlockRegistry = Record<string, SimulationBlockDefinition>;
