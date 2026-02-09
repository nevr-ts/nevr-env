import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/cli.ts",
    "src/vault.ts",
    // Plugin barrel + standalone shims for tree-shaking
    "src/plugins/index.ts",
    "src/plugins/postgres.ts",
    "src/plugins/stripe.ts",
    "src/plugins/redis.ts",
    "src/plugins/openai.ts",
    "src/plugins/resend.ts",
    "src/plugins/supabase.ts",
    "src/plugins/clerk.ts",
    "src/plugins/auth0.ts",
    "src/plugins/aws.ts",
    "src/plugins/better-auth.ts",
    "src/plugins/nextauth.ts",
    // Presets
    "src/presets/index.ts",
    "src/presets/vercel.ts",
    "src/presets/netlify.ts",
    "src/presets/railway.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
  // Bundle core + vault + presets into dist.
  // CLI is kept external — installed as optionalDep, resolved at runtime.
  noExternal: [
    "@nevr-env/core",
    "@nevr-env/vault",
    "@nevr-env/presets",
  ],
  external: ["zod", "@nevr-env/cli"],
  treeshake: true,
});
