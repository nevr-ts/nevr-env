import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/standard.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  treeshake: true,
});
