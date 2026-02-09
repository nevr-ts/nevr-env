/**
 * Performance benchmarks for nevr-env core operations.
 *
 * Two run modes:
 *   pnpm vitest bench              # native vitest bench mode (tinybench)
 *   pnpm vitest run benchmark      # regular test mode (manual timing)
 *
 * The file works as a regular test so CI can assert perf regressions.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createEnv } from "./create-env";
import { urlSchema, portSchema, booleanSchema, enumSchema, stringSchema } from "./plugin-helpers";

// ── Helpers ────────────────────────────────────────────────────

const ITERATIONS = 1_000;
const WARMUP = 10;

interface BenchResult {
  label: string;
  avgMs: number;
  p99Ms: number;
  opsPerSec: number;
  totalMs: number;
}

const results: BenchResult[] = [];

function measure(label: string, fn: () => void, iterations = ITERATIONS): BenchResult {
  // Warm up
  for (let i = 0; i < WARMUP; i++) fn();

  // Collect individual timings for p99
  const timings: number[] = [];
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    fn();
    timings.push(performance.now() - t0);
  }
  const totalMs = performance.now() - start;
  const avgMs = totalMs / iterations;
  const opsPerSec = Math.round(1000 / avgMs);

  // p99
  timings.sort((a, b) => a - b);
  const p99Ms = timings[Math.floor(iterations * 0.99)] ?? avgMs;

  const result: BenchResult = { label, avgMs, p99Ms, opsPerSec, totalMs };
  results.push(result);
  return result;
}

// ── Benchmarks ─────────────────────────────────────────────────

describe("benchmarks", () => {

  it("createEnv — minimal (2 vars, zod)", () => {
    const r = measure("createEnv (2 vars, zod)", () => {
      createEnv({
        server: { NODE_ENV: z.string(), PORT: z.string() },
        runtimeEnv: { NODE_ENV: "development", PORT: "3000" },
      });
    });
    expect(r.avgMs).toBeLessThan(5);
  });

  it("createEnv — medium (10 vars, zod)", () => {
    const r = measure("createEnv (10 vars, zod)", () => {
      createEnv({
        server: {
          NODE_ENV: z.enum(["development", "production", "test"]),
          PORT: z.coerce.number(),
          DATABASE_URL: z.string().url(),
          REDIS_URL: z.string().url(),
          API_SECRET: z.string().min(32),
          STRIPE_KEY: z.string(),
          OPENAI_KEY: z.string(),
          SENTRY_DSN: z.string().url(),
          LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]),
          HOST: z.string().default("0.0.0.0"),
        },
        runtimeEnv: {
          NODE_ENV: "production",
          PORT: "3000",
          DATABASE_URL: "postgres://localhost:5432/db",
          REDIS_URL: "redis://localhost:6379",
          API_SECRET: "a".repeat(32),
          STRIPE_KEY: "sk_test_abc",
          OPENAI_KEY: "sk-abc",
          SENTRY_DSN: "https://sentry.io/123",
          LOG_LEVEL: "info",
          HOST: "0.0.0.0",
        },
      });
    });
    expect(r.avgMs).toBeLessThan(10);
  });

  it("createEnv — large (25 vars, zod)", () => {
    const serverSchema: Record<string, z.ZodType> = {};
    const runtimeEnv: Record<string, string> = {};
    for (let i = 0; i < 25; i++) {
      serverSchema[`VAR_${i}`] = z.string();
      runtimeEnv[`VAR_${i}`] = `value_${i}`;
    }

    const r = measure("createEnv (25 vars, zod)", () => {
      createEnv({ server: serverSchema, runtimeEnv });
    });
    expect(r.avgMs).toBeLessThan(20);
  });

  it("createEnv — built-in schemas (no zod)", () => {
    const r = measure("createEnv (5 vars, built-in)", () => {
      createEnv({
        server: {
          API_URL: urlSchema(),
          PORT: portSchema(),
          DEBUG: booleanSchema(false),
          NODE_ENV: enumSchema(["development", "production", "test"]),
          APP_NAME: stringSchema({ min: 1, max: 100 }),
        },
        runtimeEnv: {
          API_URL: "https://api.example.com",
          PORT: "3000",
          DEBUG: "false",
          NODE_ENV: "production",
          APP_NAME: "my-app",
        },
      });
    });
    expect(r.avgMs).toBeLessThan(5);
  });

  it("createEnv — with plugins", () => {
    const fakePlugin = {
      id: "test",
      name: "Test Plugin",
      schema: {
        PLUGIN_URL: z.string().url(),
        PLUGIN_KEY: z.string().min(1),
        PLUGIN_SECRET: z.string().min(1),
      },
    };
    const fakePlugin2 = {
      id: "test2",
      name: "Test Plugin 2",
      schema: {
        OTHER_URL: z.string().url(),
        OTHER_KEY: z.string(),
      },
    };

    const r = measure("createEnv (2 plugins + 1 var)", () => {
      createEnv({
        plugins: [fakePlugin, fakePlugin2] as any,
        server: {
          NODE_ENV: z.enum(["development", "production", "test"]),
        },
        runtimeEnv: {
          NODE_ENV: "production",
          PLUGIN_URL: "https://example.com",
          PLUGIN_KEY: "key",
          PLUGIN_SECRET: "secret",
          OTHER_URL: "https://other.com",
          OTHER_KEY: "okey",
        },
      });
    });
    expect(r.avgMs).toBeLessThan(10);
  });

  it("Proxy access — warm reads", () => {
    const env = createEnv({
      server: {
        A: z.string(), B: z.string(), C: z.string(),
        D: z.string(), E: z.string(),
      },
      runtimeEnv: { A: "1", B: "2", C: "3", D: "4", E: "5" },
    });

    const r = measure("Proxy access (5 reads)", () => {
      void (env as any).A;
      void (env as any).B;
      void (env as any).C;
      void (env as any).D;
      void (env as any).E;
    }, ITERATIONS * 10);

    expect(r.avgMs).toBeLessThan(0.1);
  });

  it("validation failure — error path", () => {
    let caught = 0;
    const r = measure("Validation failure (1 var)", () => {
      try {
        createEnv({
          server: { REQUIRED: z.string().min(1) },
          runtimeEnv: { REQUIRED: "" },
        });
      } catch {
        caught++;
      }
    });

    // +WARMUP from measure() warm-up phase
    expect(caught).toBe(ITERATIONS + WARMUP);
    expect(r.avgMs).toBeLessThan(5);
  });

  it("memory — createEnv RSS delta", () => {
    // Force GC if exposed (node --expose-gc)
    if (typeof globalThis.gc === "function") globalThis.gc();
    const before = process.memoryUsage().heapUsed;

    const envs: unknown[] = [];
    for (let i = 0; i < 100; i++) {
      envs.push(
        createEnv({
          server: {
            A: z.string(), B: z.string(), C: z.string(),
            D: z.string(), E: z.string(),
          },
          runtimeEnv: { A: "1", B: "2", C: "3", D: "4", E: "5" },
        }),
      );
    }

    const after = process.memoryUsage().heapUsed;
    const deltaKB = Math.round((after - before) / 1024);

    console.log(`  Memory: ${deltaKB} KB for 100 createEnv instances`);
    // Each env proxy + frozen object should be lightweight
    expect(deltaKB).toBeLessThan(2048); // < 2MB for 100 instances
  });

  // ── Summary table ────────────────────────────────────────────

  it("summary", () => {
    const pad = (s: string, n: number) => s.padEnd(n);
    const rpad = (s: string, n: number) => s.padStart(n);

    console.log("");
    console.log("  ┌──────────────────────────────────┬───────────┬───────────┬──────────────┐");
    console.log("  │ Benchmark                        │   avg ms  │   p99 ms  │    ops/sec   │");
    console.log("  ├──────────────────────────────────┼───────────┼───────────┼──────────────┤");

    for (const r of results) {
      const label = pad(r.label, 32);
      const avg = rpad(r.avgMs.toFixed(4), 9);
      const p99 = rpad(r.p99Ms.toFixed(4), 9);
      const ops = rpad(r.opsPerSec.toLocaleString(), 12);
      console.log(`  │ ${label} │ ${avg} │ ${p99} │ ${ops} │`);
    }

    console.log("  └──────────────────────────────────┴───────────┴───────────┴──────────────┘");
    console.log(`  Iterations per test: ${ITERATIONS.toLocaleString()}  |  Warm-up: ${WARMUP}`);
    console.log("");
  });
});
