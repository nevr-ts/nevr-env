/**
 * Tests for Standard Schema implementation
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

// We test that Zod works with the Standard Schema interface
// Since Zod 3.22+ supports Standard Schema V1

describe("Zod Standard Schema compliance", () => {
  it("Zod schemas should have ~standard property", () => {
    const schema = z.string();
    // Zod 3.22+ implements Standard Schema V1
    expect(schema["~standard"]).toBeDefined();
    expect(schema["~standard"].version).toBe(1);
  });

  it("should validate valid input", () => {
    const schema = z.string().min(1);
    const result = schema["~standard"].validate("hello");

    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe("hello");
    }
  });

  it("should return issues for invalid input", () => {
    const schema = z.string().min(5);
    const result = schema["~standard"].validate("hi");

    expect("issues" in result).toBe(true);
    if ("issues" in result && result.issues) {
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });

  it("should handle schema transformations", () => {
    const schema = z.string().transform((s) => s.toUpperCase());
    const result = schema["~standard"].validate("hello");

    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe("HELLO");
    }
  });

  it("should coerce values", () => {
    const schema = z.coerce.number();
    const result = schema["~standard"].validate("42");

    expect("value" in result).toBe(true);
    if ("value" in result) {
      expect(result.value).toBe(42);
    }
  });
});
