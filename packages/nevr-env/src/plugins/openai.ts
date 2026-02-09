/**
 * Standalone OpenAI plugin export.
 *
 * Use this entry point for optimal tree-shaking:
 *   import { openai } from "nevr-env/plugins/openai";
 */
export { openai } from "./ai/providers/openai";
export type { OpenAIOptions } from "./ai/providers/openai";
