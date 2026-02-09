/**
 * Tests for auto-migration utilities
 */
import { describe, it, expect } from "vitest";
import {
  renameVar,
  transformVar,
  splitVar,
  mergeVars,
  deleteVar,
  addVar,
  createMigrationPlan,
  previewMigration,
  patterns as migrationPatterns,
} from "./auto-migration";

describe("renameVar", () => {
  it("should create a rename rule", () => {
    const rule = renameVar("OLD_KEY", "NEW_KEY");
    expect(rule.type).toBe("rename");
    expect(rule.from).toBe("OLD_KEY");
    expect(rule.to).toBe("NEW_KEY");
  });
});

describe("transformVar", () => {
  it("should create a transform rule", () => {
    const rule = transformVar("PORT", (val) => String(Number(val) + 1));
    expect(rule.type).toBe("transform");
    expect(rule.from).toBe("PORT");
  });
});

describe("splitVar", () => {
  it("should create a split rule", () => {
    const rule = splitVar("FULL_URL", ["HOST", "PORT"], (val) => {
      try {
        const url = new URL(val);
        return { HOST: url.hostname, PORT: url.port || "3000" };
      } catch {
        return { HOST: val, PORT: "3000" };
      }
    });
    expect(rule.type).toBe("split");
    expect(rule.from).toBe("FULL_URL");
    expect(rule.to).toEqual(["HOST", "PORT"]);
  });
});

describe("mergeVars", () => {
  it("should create a merge rule", () => {
    const rule = mergeVars(
      ["DB_HOST", "DB_PORT", "DB_NAME"],
      "DATABASE_URL",
      (vals) => `postgres://${vals.DB_HOST}:${vals.DB_PORT}/${vals.DB_NAME}`
    );
    expect(rule.type).toBe("merge");
    expect(rule.from).toEqual(["DB_HOST", "DB_PORT", "DB_NAME"]);
    expect(rule.to).toBe("DATABASE_URL");
  });
});

describe("deleteVar", () => {
  it("should create a delete rule", () => {
    const rule = deleteVar("DEPRECATED_KEY");
    expect(rule.type).toBe("delete");
    expect(rule.from).toBe("DEPRECATED_KEY");
  });
});

describe("addVar", () => {
  it("should create an add rule with string default", () => {
    const rule = addVar("NEW_KEY", "default-value");
    expect(rule.type).toBe("add");
    expect(rule.to).toBe("NEW_KEY");
    expect(rule.defaultValue).toBe("default-value");
  });

  it("should create an add rule with function default", () => {
    const rule = addVar("NEW_KEY", () => "computed");
    expect(rule.type).toBe("add");
    expect(typeof rule.defaultValue).toBe("function");
  });
});

describe("createMigrationPlan", () => {
  it("should create a plan from rules", () => {
    const plan = createMigrationPlan(
      [renameVar("OLD", "NEW"), addVar("EXTRA", "val")],
      { fromVersion: "1.0", toVersion: "2.0" }
    );
    expect(plan.rules).toHaveLength(2);
    expect(plan.toVersion).toBe("2.0");
    expect(plan.fromVersion).toBe("1.0");
  });
});

describe("previewMigration", () => {
  it("should preview rename migration", () => {
    const plan = createMigrationPlan([renameVar("OLD", "NEW")]);
    const preview = previewMigration(plan, { OLD: "value" });
    expect(preview).toBeDefined();
  });
});

describe("migration patterns", () => {
  it("should export common patterns", () => {
    expect(migrationPatterns).toBeDefined();
    expect(typeof migrationPatterns).toBe("object");
  });
});
