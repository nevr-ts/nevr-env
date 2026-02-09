/**
 * AI namespace - All AI/LLM providers
 * 
 * @example Namespace usage (recommended)
 * ```ts
 * import { ai } from "nevr-env/plugins";
 * 
 * createEnv({
 *   plugins: [
 *     ai.openai({ azure: true }),
 *   ]
 * })
 * ```
 */

import openai, { type OpenAIOptions } from "./providers/openai";

// Export types
export type { OpenAIOptions } from "./providers/openai";

// Export individual providers
export { openai };

/**
 * AI namespace containing all AI/LLM providers
 * 
 * @example
 * ```ts
 * import { ai } from "nevr-env/plugins";
 * 
 * // OpenAI
 * ai.openai({ organization: true })
 * 
 * // Azure OpenAI
 * ai.openai({ azure: true })
 * ```
 */
export const ai = {
  /**
   * OpenAI - GPT, DALL-E, Whisper, etc.
   * @see https://platform.openai.com
   */
  openai,
} as const;

export type AINamespace = typeof ai;
