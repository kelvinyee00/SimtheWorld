import { SignalValue, SimulationBlockDefinition } from "@/src/simulation/types";

/**
 * State Machine block scaffold (P7-1).
 *
 * Design constraints:
 * - Deterministic transition firing (first matching transition in list order).
 * - Guard/action expression path must be side-effect free.
 * - Runtime memory is explicit node-local state.
 */
export const STATE_MACHINE_BLOCK_TYPE = "stateMachine" as const;

interface StateMachineTransition {
  from: string;
  to: string;
  guardExpr?: string;
  actionExpr?: string;
  output?: number | boolean;
}

interface StateMachineParams {
  initialState: string;
  states: string[];
  transitions: StateMachineTransition[];
}

interface StateMachineRuntimeState {
  state: string;
  memory: Record<string, unknown>;
}

type ExpressionContext = {
  inputs: Record<string, SignalValue>;
  memory: Record<string, unknown>;
  state: string;
  tick: number;
  timeMs: number;
  stepTimeMs: number;
};

type TokenKind = "identifier" | "number" | "string" | "operator" | "punct" | "eof";

interface Token {
  kind: TokenKind;
  value: string;
}

const MAX_EXPRESSION_LENGTH = 240;
const MAX_EXPRESSION_TOKENS = 256;
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

function parseTransition(value: unknown): StateMachineTransition | null {
  if (!isPlainObject(value)) return null;

  const from = toStateName(value.from);
  const to = toStateName(value.to);
  if (!from || !to) return null;

  const outputNumber = toFiniteNumber(value.output);
  const output = typeof value.output === "boolean" ? value.output : outputNumber ?? undefined;

  return {
    from,
    to,
    guardExpr: sanitizeExpression(value.guardExpr),
    actionExpr: sanitizeExpression(value.actionExpr),
    output,
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

function coerceRuntimeState(previousState: unknown, fallbackState: string): StateMachineRuntimeState {
  if (!isPlainObject(previousState)) {
    return { state: fallbackState, memory: {} };
  }

  return {
    state: toStateName(previousState.state) ?? fallbackState,
    memory: isPlainObject(previousState.memory) ? previousState.memory : {},
  };
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

export const StateMachineBlock: SimulationBlockDefinition = {
  type: STATE_MACHINE_BLOCK_TYPE,
  inputPortTypes: { in: "any", default: "any" },
  outputPortTypes: { default: "any", state: "any" },
  initialize: (rawParams) => {
    const params = parseParams(rawParams);
    return { state: params.initialState, memory: {} } as StateMachineRuntimeState;
  },
  step: ({ params: rawParams, inputs, previousState, tick, timeMs, stepTimeMs }) => {
    const params = parseParams(rawParams);
    const runtimeState = coerceRuntimeState(previousState, params.initialState);

    const context: ExpressionContext = {
      inputs,
      memory: runtimeState.memory,
      state: runtimeState.state,
      tick,
      timeMs,
      stepTimeMs,
    };

    let nextStateName = runtimeState.state;
    let nextMemory = runtimeState.memory;
    let defaultOutput: SignalValue = null;

    for (const transition of params.transitions) {
      if (transition.from !== runtimeState.state) {
        continue;
      }

      const guardResult = transition.guardExpr
        ? evaluateExpression(transition.guardExpr, context)
        : true;
      if (!toBoolean(guardResult)) {
        continue;
      }

      nextStateName = transition.to;

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
      } satisfies StateMachineRuntimeState,
    };
  },
};
