import { describe, expect, it } from "vitest";
import {
  evaluateExpression,
  isExpression,
  parseNumericExpression,
} from "../expressions";

describe("P10-4: Block Parameter Expressions", () => {
  describe("evaluateExpression", () => {
    it("evaluates simple numbers", () => {
      expect(evaluateExpression("42").value).toBe(42);
      expect(evaluateExpression("3.14").value).toBe(3.14);
    });

    it("evaluates addition", () => {
      expect(evaluateExpression("1 + 2").value).toBe(3);
      expect(evaluateExpression("10 + 20 + 5").value).toBe(35);
    });

    it("evaluates subtraction", () => {
      expect(evaluateExpression("10 - 3").value).toBe(7);
      expect(evaluateExpression("5 - 10").value).toBe(-5);
    });

    it("evaluates multiplication", () => {
      expect(evaluateExpression("4 * 5").value).toBe(20);
      expect(evaluateExpression("2 * 3 * 4").value).toBe(24);
    });

    it("evaluates division", () => {
      expect(evaluateExpression("20 / 4").value).toBe(5);
      expect(evaluateExpression("1 / 2").value).toBe(0.5);
    });

    it("respects operator precedence", () => {
      expect(evaluateExpression("2 + 3 * 4").value).toBe(14);
      expect(evaluateExpression("10 - 2 * 3").value).toBe(4);
      expect(evaluateExpression("20 / 4 + 3").value).toBe(8);
    });

    it("evaluates parenthesized expressions", () => {
      expect(evaluateExpression("(2 + 3) * 4").value).toBe(20);
      expect(evaluateExpression("10 / (5 - 3)").value).toBe(5);
    });

    it("evaluates negation", () => {
      expect(evaluateExpression("-5").value).toBe(-5);
      expect(evaluateExpression("--5").value).toBe(5);
      expect(evaluateExpression("-(3 + 2)").value).toBe(-5);
    });

    it("evaluates constants", () => {
      expect(evaluateExpression("pi").value).toBeCloseTo(Math.PI, 10);
      expect(evaluateExpression("e").value).toBeCloseTo(Math.E, 10);
      expect(evaluateExpression("180 * deg2rad").value).toBeCloseTo(Math.PI, 10);
    });

    it("handles complex expressions", () => {
      expect(evaluateExpression("2 * (3 + 4) - 5 / 2").value).toBe(11.5);
      expect(evaluateExpression("pi * 2 + 1").value).toBeCloseTo(2 * Math.PI + 1, 10);
    });

    it("ignores whitespace", () => {
      expect(evaluateExpression("  1  +   2  ").value).toBe(3);
    });

    it("returns error for division by zero", () => {
      const result = evaluateExpression("1 / 0");
      expect(result.error).toContain("Division by zero");
    });

    it("returns error for unknown constants", () => {
      const result = evaluateExpression("unknown");
      expect(result.error).toContain("Unknown constant");
    });

    it("returns error for empty input", () => {
      const result = evaluateExpression("");
      expect(result.error).toContain("Empty expression");
    });
  });

  describe("parseNumericExpression", () => {
    it("parses plain numbers", () => {
      expect(parseNumericExpression("42", 0)).toBe(42);
      expect(parseNumericExpression("3.14", 0)).toBe(3.14);
    });

    it("parses expressions and falls back on error", () => {
      expect(parseNumericExpression("2 + 2", 0)).toBe(4);
      expect(parseNumericExpression("1 / 0", 99)).toBe(99); // falls back
    });

    it("trims input", () => {
      expect(parseNumericExpression("  5  ", 0)).toBe(5);
    });
  });

  describe("isExpression", () => {
    it("returns true for expressions with operators", () => {
      expect(isExpression("1 + 2")).toBe(true);
      expect(isExpression("3 * 4")).toBe(true);
      expect(isExpression("(5)")).toBe(true);
    });

    it("returns false for plain numbers", () => {
      expect(isExpression("42")).toBe(false);
      expect(isExpression("3.14")).toBe(false);
      expect(isExpression("")).toBe(false);
    });
  });
});
