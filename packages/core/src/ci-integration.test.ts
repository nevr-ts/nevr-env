/**
 * Tests for CI/CD integration generators
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  extractCIConfig,
  generateGitHubActionsWorkflow,
  generateVercelConfig,
  generateRailwayConfig,
  generateGitLabCI,
  generateCircleCI,
  generateCIConfig,
} from "./ci-integration";

const testSchema = {
  server: {
    DATABASE_URL: z.string().url(),
    API_SECRET_KEY: z.string(),
    STRIPE_SECRET_KEY: z.string(),
  },
  client: {
    NEXT_PUBLIC_URL: z.string().url(),
  },
};

describe("extractCIConfig", () => {
  it("should extract required and optional vars", () => {
    const config = extractCIConfig(testSchema);
    expect(config.requiredVars).toContain("DATABASE_URL");
    expect(config.requiredVars).toContain("API_SECRET_KEY");
    expect(config.requiredVars).toContain("NEXT_PUBLIC_URL");
  });

  it("should detect secret variables by name", () => {
    const config = extractCIConfig(testSchema);
    expect(config.secretVars).toContain("API_SECRET_KEY");
    expect(config.secretVars).toContain("STRIPE_SECRET_KEY");
  });
});

describe("generateGitHubActionsWorkflow", () => {
  it("should generate valid YAML", () => {
    const yaml = generateGitHubActionsWorkflow(testSchema);
    expect(yaml).toContain("name:");
    expect(yaml).toContain("runs-on: ubuntu-latest");
    expect(yaml).toContain("npx nevr-env check");
    expect(yaml).toContain("DATABASE_URL");
  });

  it("should support custom options", () => {
    const yaml = generateGitHubActionsWorkflow(testSchema, {
      name: "Custom Workflow",
      nodeVersion: "18",
      packageManager: "yarn",
    });
    expect(yaml).toContain("name: Custom Workflow");
    expect(yaml).toContain("node-version: '18'");
    expect(yaml).toContain("yarn install");
  });
});

describe("generateVercelConfig", () => {
  it("should generate valid JSON", () => {
    const json = generateVercelConfig(testSchema);
    const parsed = JSON.parse(json);
    expect(parsed.$schema).toContain("vercel");
    expect(parsed.env).toBeDefined();
  });
});

describe("generateRailwayConfig", () => {
  it("should generate valid JSON", () => {
    const json = generateRailwayConfig(testSchema);
    const parsed = JSON.parse(json);
    expect(parsed.$schema).toContain("railway");
    expect(parsed.variables).toBeDefined();
  });
});

describe("generateGitLabCI", () => {
  it("should generate valid YAML", () => {
    const yaml = generateGitLabCI(testSchema);
    expect(yaml).toContain("image: node:");
    expect(yaml).toContain("stages:");
    expect(yaml).toContain("validate-env:");
    expect(yaml).toContain("npx nevr-env check");
  });
});

describe("generateCircleCI", () => {
  it("should generate valid YAML", () => {
    const yaml = generateCircleCI(testSchema);
    expect(yaml).toContain("version: 2.1");
    expect(yaml).toContain("circleci/node");
    expect(yaml).toContain("npx nevr-env check");
  });
});

describe("generateCIConfig dispatcher", () => {
  it("should dispatch to correct generator", () => {
    expect(generateCIConfig(testSchema, "github")).toContain("runs-on");
    expect(generateCIConfig(testSchema, "vercel")).toContain("vercel");
    expect(generateCIConfig(testSchema, "railway")).toContain("railway");
    expect(generateCIConfig(testSchema, "gitlab")).toContain("stages");
    expect(generateCIConfig(testSchema, "circleci")).toContain("version: 2.1");
  });

  it("should throw on unknown platform", () => {
    expect(() =>
      generateCIConfig(testSchema, "unknown" as "github")
    ).toThrow("Unknown platform");
  });
});
