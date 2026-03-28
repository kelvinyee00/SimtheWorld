/**
 * Block Parameter Expression Evaluator (P10-4)
 *
 * Provides safe arithmetic evaluation for numeric block parameters.
 * Supports: +, -, *, /, parentheses, and common constants (pi, e).
 *
 * Security: No eval() or Function() - uses recursive descent parsing.
 * Deterministic: Error handling is predictable and typed.
 */

export interface ExpressionResult {
  value: number;
  error?: string;
}

type TokenType =
  | "NUMBER"
  | "PLUS"
  | "MINUS"
  | "STAR"
  | "SLASH"
  | "LPAREN"
  | "RPAREN"
  | "IDENT"
  | "EOF";

interface Token {
  type: TokenType;
  value: string;
  position: number;
}

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
  deg2rad: Math.PI / 180,
  rad2deg: 180 / Math.PI,
};

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let position = 0;

  while (position < input.length) {
    const char = input[position];

    if (/\s/.test(char)) {
      position++;
      continue;
    }

    if (/[0-9]/.test(char)) {
      let value = "";
      while (position < input.length && /[0-9.]/.test(input[position])) {
        value += input[position];
        position++;
      }
      tokens.push({ type: "NUMBER", value, position: position - value.length });
      continue;
    }

    if (/[a-zA-Z_]/.test(char)) {
      let value = "";
      while (position < input.length && /[a-zA-Z0-9_]/.test(input[position])) {
        value += input[position];
        position++;
      }
      tokens.push({ type: "IDENT", value, position: position - value.length });
      continue;
    }

    switch (char) {
      case "+":
        tokens.push({ type: "PLUS", value: char, position });
        break;
      case "-":
        tokens.push({ type: "MINUS", value: char, position });
        break;
      case "*":
        tokens.push({ type: "STAR", value: char, position });
        break;
      case "/":
        tokens.push({ type: "SLASH", value: char, position });
        break;
      case "(":
        tokens.push({ type: "LPAREN", value: char, position });
        break;
      case ")":
        tokens.push({ type: "RPAREN", value: char, position });
        break;
      default:
        throw new Error(`Unexpected character '${char}' at position ${position}`);
    }
    position++;
  }

  tokens.push({ type: "EOF", value: "", position });
  return tokens;
}

class Parser {
  private tokens: Token[];
  private current = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private advance(): Token {
    if (this.current < this.tokens.length) {
      this.current++;
    }
    return this.tokens[this.current - 1];
  }

  private expect(type: TokenType): Token {
    const token = this.peek();
    if (token.type !== type) {
      throw new Error(`Expected ${type} but found ${token.type}`);
    }
    return this.advance();
  }

  parseExpression(): number {
    let value = this.parseTerm();

    while (this.peek().type === "PLUS" || this.peek().type === "MINUS") {
      const operator = this.advance();
      const right = this.parseTerm();
      if (operator.type === "PLUS") {
        value += right;
      } else {
        value -= right;
      }
    }

    return value;
  }

  private parseTerm(): number {
    let value = this.parseFactor();

    while (this.peek().type === "STAR" || this.peek().type === "SLASH") {
      const operator = this.advance();
      const right = this.parseFactor();
      if (operator.type === "STAR") {
        value *= right;
      } else {
        if (right === 0) throw new Error("Division by zero");
        value /= right;
      }
    }

    return value;
  }

  private parseFactor(): number {
    const token = this.peek();

    if (token.type === "PLUS") {
      this.advance();
      return this.parseFactor();
    }

    if (token.type === "MINUS") {
      this.advance();
      return -this.parseFactor();
    }

    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const token = this.peek();

    if (token.type === "NUMBER") {
      this.advance();
      const value = parseFloat(token.value);
      if (!Number.isFinite(value)) {
        throw new Error(`Invalid number: ${token.value}`);
      }
      return value;
    }

    if (token.type === "IDENT") {
      this.advance();
      const constant = CONSTANTS[token.value.toLowerCase()];
      if (constant === undefined) {
        throw new Error(`Unknown constant: ${token.value}`);
      }
      return constant;
    }

    if (token.type === "LPAREN") {
      this.advance();
      const value = this.parseExpression();
      this.expect("RPAREN");
      return value;
    }

    throw new Error(`Unexpected token ${token.type}`);
  }
}

export function evaluateExpression(input: string): ExpressionResult {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { value: NaN, error: "Empty expression" };
  }

  try {
    const tokens = tokenize(trimmed);
    const parser = new Parser(tokens);
    const value = parser.parseExpression();
    return { value };
  } catch (error) {
    return {
      value: NaN,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function parseNumericExpression(rawValue: string, fallback: number): number {
  const trimmed = rawValue.trim();
  const plainNumber = Number(trimmed);
  if (Number.isFinite(plainNumber)) return plainNumber;

  const result = evaluateExpression(trimmed);
  if (result.error || !Number.isFinite(result.value)) {
    return fallback;
  }
  return result.value;
}

export function isExpression(input: string): boolean {
  return /[+\-*/()]/.test(input);
}
