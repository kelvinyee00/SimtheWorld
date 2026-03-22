import { SignalValue, SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * State Machine block scaffold (P7-1/P7-2).
 *
 * P7-1:
 * - Deterministic transition firing (first matching transition in list order).
 * - Guard/action expression path is side-effect free.
 * - Runtime memory is explicit node-local state.
 *
 * P7-2:
 * - Temporal and event semantics (`afterMs`, `event` + `eventInput`).
 * - Deterministic per-tick edge-event queue derived from prior/current inputs.
 */
export const STATE_MACHINE_BLOCK_TYPE = "stateMachine" as const;

type StateMachineEventType = "rising" | "falling";

interface StateMachineTransition {
  from: string;
  to: string;
  guardExpr?: string;
  actionExpr?: string;
  output?: number | boolean;
  /** Optional temporal guard: transition enabled when elapsed-in-state >= afterMs. */
  afterMs?: number;
  /** Optional edge-event filter. */
  event?: StateMachineEventType;
  /** Optional event input handle (defaults to `in`). */
  eventInput?: string;
}

interface StateMachineParams {
  initialState: string;
  states: string[];
  transitions: StateMachineTransition[];
}

interface StateMachineEvent {
  type: StateMachineEventType;
  input: string;
  tick: number;
  timeMs: number;
  sequence: number;
}

interface StateMachineRuntimeState {
  state: string;
  memory: Record<string, unknown>;
  stateEnteredTimeMs: number;
  previousInputs: Record<string, SignalValue>;
  lastEvents: StateMachineEvent[];
}

type ExpressionContext = {
  inputs: Record<string, SignalValue>;
  memory: Record<string, unknown>;
  state: string;
  tick: number;
  timeMs: number;
  stepTimeMs: number;
  elapsedInStateMs: number;
  events: StateMachineEvent[];
};

type TokenKind = "identifier" | "number" | "string" | "operator" | "punct" | "eof";

interface Token {
  kind: TokenKind;
  value: string;
}

const MAX_EXPRESSION_LENGTH = 240;
const MAX_EXPRESSION_TOKENS = 256;
const DEFAULT_EVENT_INPUT = "in";
const FORBIDDEN_PROPERTY_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

const DISALLOWED_EXPR_PATTERNS: RegExp[] = [
  /;/,
  /`/,
  /\b(?:new|function|class|while|for|try|catch|throw|return|import|export|window|document|globalThis)\b/,
  /(^|[^=!<>])=([^=]|$)/,
  /\?\./,
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStateName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  if (typeof value === "string") return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (isPlainObject(value)) return true;
  return false;
}

function coerceSignalValue(value: unknown): SignalValue {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.filter(
      (entry): entry is number => typeof entry === "number" && Number.isFinite(entry)
    );
  }
  return null;
}

function sanitizeExpression(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_EXPRESSION_LENGTH) {
    return undefined;
  }
  if (DISALLOWED_EXPR_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return undefined;
  }
  return trimmed;
}

function parseEdgeEventType(value: unknown): StateMachineEventType | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "rising" || normalized === "falling") {
    return normalized;
  }

  return undefined;
}

function parseTransition(value: unknown): StateMachineTransition | null {
  if (!isPlainObject(value)) return null;

  const from = toStateName(value.from);
  const to = toStateName(value.to);
  if (!from || !to) return null;

  const outputNumber = toFiniteNumber(value.output);
  const output = typeof value.output === "boolean" ? value.output : outputNumber ?? undefined;
  const afterMsRaw = toFiniteNumber(value.afterMs);

  return {
    from,
    to,
    guardExpr: sanitizeExpression(value.guardExpr),
    actionExpr: sanitizeExpression(value.actionExpr),
    output,
    afterMs: typeof afterMsRaw === "number" && afterMsRaw >= 0 ? afterMsRaw : undefined,
    event: parseEdgeEventType(value.event),
    eventInput: toStateName(value.eventInput) ?? undefined,
  };
}

function parseParams(raw: Record<string, unknown>): StateMachineParams {
  const seenStates = new Set<string>();
  const states = Array.isArray(raw.states)
    ? raw.states
        .map((entry) => toStateName(entry))
        .filter((entry): entry is string => {
          if (!entry) {
            return false;
          }
          const normalized = entry.toLowerCase();
          if (seenStates.has(normalized)) {
            return false;
          }
          seenStates.add(normalized);
          return true;
        })
    : [];

  const transitions = Array.isArray(raw.transitions)
    ? raw.transitions
        .map((entry) => parseTransition(entry))
        .filter((entry): entry is StateMachineTransition => entry !== null)
    : [];

  const initialState = toStateName(raw.initialState) ?? states[0] ?? "idle";

  return {
    initialState,
    states,
    transitions,
  };
}

function coerceInputRecord(raw: unknown): Record<string, SignalValue> {
  if (!isPlainObject(raw)) {
    return {};
  }

  const normalized: Record<string, SignalValue> = {};
  for (const [key, value] of Object.entries(raw)) {
    normalized[key] = coerceSignalValue(value);
  }
  return normalized;
}

function coerceEventQueue(raw: unknown): StateMachineEvent[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry, index) => {
      if (!isPlainObject(entry)) {
        return null;
      }

      const type = parseEdgeEventType(entry.type);
      const input = toStateName(entry.input);
      if (!type || !input) {
        return null;
      }

      return {
        type,
        input,
        tick: toFiniteNumber(entry.tick) ?? 0,
        timeMs: toFiniteNumber(entry.timeMs) ?? 0,
        sequence: toFiniteNumber(entry.sequence) ?? index,
      } satisfies StateMachineEvent;
    })
    .filter((event): event is StateMachineEvent => event !== null)
    .sort((left, right) => left.sequence - right.sequence);
}

function coerceRuntimeState(params: {
  previousState: unknown;
  fallbackState: string;
  currentTimeMs: number;
}): StateMachineRuntimeState {
  const { previousState, fallbackState, currentTimeMs } = params;

  if (!isPlainObject(previousState)) {
    return {
      state: fallbackState,
      memory: {},
      stateEnteredTimeMs: currentTimeMs,
      previousInputs: {},
      lastEvents: [],
    };
  }

  const resolvedState = toStateName(previousState.state);
  const hasResolvedState = typeof resolvedState === "string";

  return {
    state: resolvedState ?? fallbackState,
    memory: isPlainObject(previousState.memory) ? previousState.memory : {},
    stateEnteredTimeMs:
      hasResolvedState && typeof previousState.stateEnteredTimeMs === "number"
        ? previousState.stateEnteredTimeMs
        : currentTimeMs,
    previousInputs: coerceInputRecord(previousState.previousInputs),
    lastEvents: coerceEventQueue(previousState.lastEvents),
  };
}

function buildEventQueue(params: {
  previousInputs: Record<string, SignalValue>;
  currentInputs: Record<string, SignalValue>;
  tick: number;
  timeMs: number;
}): StateMachineEvent[] {
  const { previousInputs, currentInputs, tick, timeMs } = params;

  const handles = new Set<string>([
    ...Object.keys(previousInputs),
    ...Object.keys(currentInputs),
  ]);

  const orderedHandles = Array.from(handles).sort((left, right) => left.localeCompare(right));
  const events: StateMachineEvent[] = [];
  let sequence = 0;

  for (const input of orderedHandles) {
    const previous = previousInputs[input] ?? null;
    const current = currentInputs[input] ?? null;
    const previousBool = toBoolean(previous);
    const currentBool = toBoolean(current);

    if (!previousBool && currentBool) {
      events.push({ type: "rising", input, tick, timeMs, sequence });
      sequence += 1;
      continue;
    }

    if (previousBool && !currentBool) {
      events.push({ type: "falling", input, tick, timeMs, sequence });
      sequence += 1;
    }
  }

  return events;
}

function tokenizeExpression(expression: string): Token[] | null {
  const tokens: Token[] = [];
  let index = 0;

  const multiCharOps = ["===", "!==", "<=", ">=", "&&", "||", "==", "!="];
  const singleCharOps = new Set(["+", "-", "*", "/", "%", "!", "<", ">"]);
  const punct = new Set(["(", ")", "{", "}", ":", ",", "."]);

  while (index < expression.length) {
    const current = expression[index];

    if (/\s/.test(current)) {
      index += 1;
      continue;
    }

    const remaining = expression.slice(index);
    const matchedOp = multiCharOps.find((op) => remaining.startsWith(op));
    if (matchedOp) {
      tokens.push({ kind: "operator", value: matchedOp });
      index += matchedOp.length;
      continue;
    }

    if (singleCharOps.has(current)) {
      tokens.push({ kind: "operator", value: current });
      index += 1;
      continue;
    }

    if (punct.has(current)) {
      tokens.push({ kind: "punct", value: current });
      index += 1;
      continue;
    }

    if (current === "\"" || current === "'") {
      const quote = current;
      index += 1;
      let literal = "";

      while (index < expression.length) {
        const ch = expression[index];
        if (ch === "\\") {
          const next = expression[index + 1];
          if (typeof next === "undefined") {
            return null;
          }
          literal += next;
          index += 2;
          continue;
        }

        if (ch === quote) {
          index += 1;
          break;
        }

        literal += ch;
        index += 1;
      }

      if (expression[index - 1] !== quote) {
        return null;
      }

      tokens.push({ kind: "string", value: literal });
      continue;
    }

    if (/\d/.test(current)) {
      const start = index;
      index += 1;
      while (index < expression.length && /[\d.]/.test(expression[index])) {
        index += 1;
      }
      const raw = expression.slice(start, index);
      if (!/^\d+(?:\.\d+)?$/.test(raw)) {
        return null;
      }
      tokens.push({ kind: "number", value: raw });
      continue;
    }

    if (/[A-Za-z_]/.test(current)) {
      const start = index;
      index += 1;
      while (index < expression.length && /[A-Za-z0-9_]/.test(expression[index])) {
        index += 1;
      }
      tokens.push({ kind: "identifier", value: expression.slice(start, index) });
      continue;
    }

    return null;
  }

  tokens.push({ kind: "eof", value: "" });
  if (tokens.length > MAX_EXPRESSION_TOKENS) {
    return null;
  }
  return tokens;
}

class ExpressionParser {
  private index = 0;
  private valid = true;

  constructor(
    private readonly tokens: Token[],
    private readonly context: ExpressionContext
  ) {}

  parse(): unknown {
    const value = this.parseLogicalOr();
    if (!this.valid || this.peek().kind !== "eof") {
      return undefined;
    }
    return value;
  }

  private parseLogicalOr(): unknown {
    let value = this.parseLogicalAnd();
    while (this.match("operator", "||")) {
      const right = this.parseLogicalAnd();
      value = toBoolean(value) ? value : right;
    }
    return value;
  }

  private parseLogicalAnd(): unknown {
    let value = this.parseEquality();
    while (this.match("operator", "&&")) {
      const right = this.parseEquality();
      value = toBoolean(value) ? right : value;
    }
    return value;
  }

  private parseEquality(): unknown {
    let value = this.parseComparison();
    while (true) {
      if (this.match("operator", "==") || this.match("operator", "===")) {
        const right = this.parseComparison();
        value = value === right;
        continue;
      }
      if (this.match("operator", "!=") || this.match("operator", "!==")) {
        const right = this.parseComparison();
        value = value !== right;
        continue;
      }
      break;
    }
    return value;
  }

  private parseComparison(): unknown {
    let value = this.parseAdditive();
    while (true) {
      if (this.match("operator", "<")) {
        const right = this.parseAdditive();
        value = this.asNumber(value) < this.asNumber(right);
        continue;
      }
      if (this.match("operator", "<=")) {
        const right = this.parseAdditive();
        value = this.asNumber(value) <= this.asNumber(right);
        continue;
      }
      if (this.match("operator", ">")) {
        const right = this.parseAdditive();
        value = this.asNumber(value) > this.asNumber(right);
        continue;
      }
      if (this.match("operator", ">=")) {
        const right = this.parseAdditive();
        value = this.asNumber(value) >= this.asNumber(right);
        continue;
      }
      break;
    }
    return value;
  }

  private parseAdditive(): unknown {
    let value = this.parseMultiplicative();
    while (true) {
      if (this.match("operator", "+")) {
        const right = this.parseMultiplicative();
        if (typeof value === "string" || typeof right === "string") {
          value = `${String(value ?? "")}${String(right ?? "")}`;
        } else {
          value = this.asNumber(value) + this.asNumber(right);
        }
        continue;
      }
      if (this.match("operator", "-")) {
        const right = this.parseMultiplicative();
        value = this.asNumber(value) - this.asNumber(right);
        continue;
      }
      break;
    }
    return value;
  }

  private parseMultiplicative(): unknown {
    let value = this.parseUnary();
    while (true) {
      if (this.match("operator", "*")) {
        const right = this.parseUnary();
        value = this.asNumber(value) * this.asNumber(right);
        continue;
      }
      if (this.match("operator", "/")) {
        const right = this.parseUnary();
        value = this.asNumber(value) / this.asNumber(right);
        continue;
      }
      if (this.match("operator", "%")) {
        const right = this.parseUnary();
        value = this.asNumber(value) % this.asNumber(right);
        continue;
      }
      break;
    }
    return value;
  }

  private parseUnary(): unknown {
    if (this.match("operator", "!")) {
      return !toBoolean(this.parseUnary());
    }

    if (this.match("operator", "-")) {
      return -this.asNumber(this.parseUnary());
    }

    if (this.match("operator", "+")) {
      return this.asNumber(this.parseUnary());
    }

    return this.parsePrimary();
  }

  private parsePrimary(): unknown {
    const token = this.peek();

    if (this.match("number")) {
      return Number(token.value);
    }

    if (this.match("string")) {
      return token.value;
    }

    if (this.match("identifier")) {
      if (token.value === "true") return true;
      if (token.value === "false") return false;
      if (token.value === "null") return null;

      const base = this.resolveContextRoot(token.value);
      return this.parseMemberChain(base);
    }

    if (this.match("punct", "(")) {
      const inner = this.parseLogicalOr();
      this.expect("punct", ")");
      return inner;
    }

    if (this.match("punct", "{")) {
      return this.parseObjectLiteral();
    }

    this.valid = false;
    return undefined;
  }

  private parseObjectLiteral(): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if (this.match("punct", "}")) {
      return result;
    }

    while (this.valid) {
      const keyToken = this.peek();
      if (!(this.match("identifier") || this.match("string"))) {
        this.valid = false;
        break;
      }

      const key = keyToken.value;
      this.expect("punct", ":");
      const value = this.parseLogicalOr();

      if (!FORBIDDEN_PROPERTY_SEGMENTS.has(key)) {
        result[key] = value;
      }

      if (this.match("punct", "}")) {
        break;
      }

      this.expect("punct", ",");
    }

    return result;
  }

  private parseMemberChain(base: unknown): unknown {
    let current = base;

    if (this.peek().kind === "punct" && this.peek().value === "(") {
      // Function calls are explicitly disallowed in scaffold-safe expressions.
      this.valid = false;
      return undefined;
    }

    while (this.match("punct", ".")) {
      const segment = this.peek();
      if (!this.match("identifier")) {
        this.valid = false;
        return undefined;
      }

      if (FORBIDDEN_PROPERTY_SEGMENTS.has(segment.value)) {
        this.valid = false;
        return undefined;
      }

      if (isPlainObject(current) || Array.isArray(current)) {
        current = (current as Record<string, unknown>)[segment.value];
      } else {
        current = undefined;
      }

      if (this.peek().kind === "punct" && this.peek().value === "(") {
        this.valid = false;
        return undefined;
      }
    }

    return current;
  }

  private resolveContextRoot(name: string): unknown {
    if (FORBIDDEN_PROPERTY_SEGMENTS.has(name)) {
      this.valid = false;
      return undefined;
    }

    switch (name) {
      case "inputs":
        return this.context.inputs;
      case "memory":
        return this.context.memory;
      case "state":
        return this.context.state;
      case "tick":
        return this.context.tick;
      case "timeMs":
        return this.context.timeMs;
      case "stepTimeMs":
        return this.context.stepTimeMs;
      case "elapsedInStateMs":
        return this.context.elapsedInStateMs;
      case "events":
        return this.context.events;
      default:
        return undefined;
    }
  }

  private asNumber(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  }

  private peek(): Token {
    return this.tokens[this.index] ?? { kind: "eof", value: "" };
  }

  private match(kind: TokenKind, value?: string): boolean {
    const token = this.peek();
    if (token.kind !== kind) {
      return false;
    }
    if (typeof value !== "undefined" && token.value !== value) {
      return false;
    }
    this.index += 1;
    return true;
  }

  private expect(kind: TokenKind, value?: string): void {
    if (!this.match(kind, value)) {
      this.valid = false;
    }
  }
}

function evaluateExpression(expression: string, context: ExpressionContext): unknown {
  const sanitized = sanitizeExpression(expression);
  if (!sanitized) {
    return undefined;
  }

  const tokens = tokenizeExpression(sanitized);
  if (!tokens) {
    return undefined;
  }

  const parser = new ExpressionParser(tokens, context);
  return parser.parse();
}

function transitionMatchesEvent(params: {
  transition: StateMachineTransition;
  eventQueue: StateMachineEvent[];
}): boolean {
  const { transition, eventQueue } = params;
  if (!transition.event) {
    return true;
  }

  const requiredInput = transition.eventInput ?? DEFAULT_EVENT_INPUT;
  return eventQueue.some(
    (event) => event.type === transition.event && event.input === requiredInput
  );
}

export const StateMachineBlock: SimulationBlockDefinition = {
  type: STATE_MACHINE_BLOCK_TYPE,
  inputPortTypes: { in: "any", default: "any" },
  outputPortTypes: { default: "any", state: "any" },
  initialize: (rawParams) => {
    const params = parseParams(rawParams);
    return {
      state: params.initialState,
      memory: {},
      stateEnteredTimeMs: 0,
      previousInputs: {},
      lastEvents: [],
    } satisfies StateMachineRuntimeState;
  },
  step: ({ params: rawParams, inputs, previousState, tick, timeMs, stepTimeMs }) => {
    const params = parseParams(rawParams);
    const runtimeState = coerceRuntimeState({
      previousState,
      fallbackState: params.initialState,
      currentTimeMs: timeMs,
    });

    const normalizedInputs = coerceInputRecord(inputs);
    const eventQueue = buildEventQueue({
      previousInputs: runtimeState.previousInputs,
      currentInputs: normalizedInputs,
      tick,
      timeMs,
    });

    const elapsedInStateMs = Math.max(0, timeMs - runtimeState.stateEnteredTimeMs);
    const context: ExpressionContext = {
      inputs: normalizedInputs,
      memory: runtimeState.memory,
      state: runtimeState.state,
      tick,
      timeMs,
      stepTimeMs,
      elapsedInStateMs,
      events: eventQueue,
    };

    let nextStateName = runtimeState.state;
    let nextMemory = runtimeState.memory;
    let defaultOutput: SignalValue = null;
    let transitionFired = false;

    for (const transition of params.transitions) {
      if (transition.from !== runtimeState.state) {
        continue;
      }

      const temporalSatisfied =
        typeof transition.afterMs === "number" ? elapsedInStateMs >= transition.afterMs : true;
      if (!temporalSatisfied) {
        continue;
      }

      if (!transitionMatchesEvent({ transition, eventQueue })) {
        continue;
      }

      const guardResult = transition.guardExpr
        ? evaluateExpression(transition.guardExpr, context)
        : true;
      if (!toBoolean(guardResult)) {
        continue;
      }

      nextStateName = transition.to;
      transitionFired = true;

      if (transition.actionExpr) {
        const actionResult = evaluateExpression(transition.actionExpr, context);
        if (isPlainObject(actionResult)) {
          nextMemory = {
            ...runtimeState.memory,
            ...actionResult,
          };
        }
      }

      if (typeof transition.output === "number" || typeof transition.output === "boolean") {
        defaultOutput = transition.output;
      }

      break;
    }

    return {
      outputs: {
        default: defaultOutput,
        state: nextStateName,
      },
      nextState: {
        state: nextStateName,
        memory: nextMemory,
        stateEnteredTimeMs: transitionFired ? timeMs : runtimeState.stateEnteredTimeMs,
        previousInputs: normalizedInputs,
        lastEvents: eventQueue,
      } satisfies StateMachineRuntimeState,
    };
  },
};
