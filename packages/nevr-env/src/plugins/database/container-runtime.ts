/**
 * Shared container-runtime helper.
 *
 * Detects Docker or Podman and caches the result so every subsequent
 * call in the same process is instant.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// ── Runtime detection ────────────────────────────────────────

type Runtime = "docker" | "podman";

let cached: Runtime | false | undefined;

/**
 * Returns `"docker"`, `"podman"`, or `null` if neither is available.
 * First call probes the system; subsequent calls use the cached value.
 */
export async function getContainerRuntime(): Promise<Runtime | null> {
  if (cached !== undefined) return cached || null;

  for (const rt of ["docker", "podman"] as const) {
    try {
      await execAsync(`${rt} --version`, { timeout: 3_000 });
      cached = rt;
      return rt;
    } catch {
      /* not installed or not in PATH */
    }
  }

  cached = false;
  return null;
}

// ── Convenience exec ─────────────────────────────────────────

/**
 * Run a container-runtime command, e.g. `containerExec('ps --format ...')`.
 *
 * Automatically prepends the detected runtime (`docker` or `podman`).
 * Throws if no container runtime is available.
 */
export async function containerExec(
  args: string,
  options?: { timeout?: number },
): Promise<string> {
  const runtime = await getContainerRuntime();
  if (!runtime) throw new Error("No container runtime (docker/podman) found");

  const { stdout } = await execAsync(`${runtime} ${args}`, {
    timeout: options?.timeout ?? 5_000,
  });
  return stdout;
}
