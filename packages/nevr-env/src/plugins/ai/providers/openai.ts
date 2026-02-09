/**
 * OpenAI plugin for nevr-env with API key validation,
 * organization support, and model configuration.
 */

import { z } from "zod";
import { createPlugin } from "@nevr-env/core";
import type { DiscoveryResult, PromptConfig } from "@nevr-env/core";

/**
 * OpenAI plugin options (non-flag options only)
 */
export interface OpenAIOptions {
  /**
   * Default model to use
   * @default "gpt-4o"
   */
  defaultModel?: string;

  /**
   * Custom variable names
   */
  variableNames?: {
    apiKey?: string;
    organization?: string;
    project?: string;
    model?: string;
    baseUrl?: string;
    embeddingModel?: string;
    maxTokens?: string;
    temperature?: string;
    azureEndpoint?: string;
    azureApiVersion?: string;
    azureDeployment?: string;
  };
}

/**
 * Supported OpenAI models
 */
const OPENAI_MODELS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-4",
  "gpt-3.5-turbo",
  "o1",
  "o1-mini",
  "o1-preview",
] as const;

/**
 * Create an OpenAI API key schema
 */
function createApiKeySchema(): z.ZodEffects<z.ZodString, string, string> {
  return z
    .string()
    .min(1, "OpenAI API key is required")
    .refine(
      (val) => val.startsWith("sk-"),
      {
        message: "OpenAI API key must start with 'sk-'",
      }
    );
}

/**
 * Create an organization ID schema (optional)
 */
function createOrgSchema() {
  return z
    .string()
    .refine(
      (val) => val.startsWith("org-"),
      {
        message: "OpenAI Organization ID must start with 'org-'",
      }
    )
    .optional();
}

/**
 * OpenAI plugin for nevr-env
 *
 * @example Basic usage
 * ```ts
 * import { createEnv } from "nevr-env";
 * import { openai } from "nevr-env/plugins";
 *
 * export const env = createEnv({
 *   plugins: [openai()],
 * });
 *
 * // Access: env.OPENAI_API_KEY
 * ```
 *
 * @example With organization and model
 * ```ts
 * openai({
 *   organization: true,
 *   model: true,
 *   defaultModel: "gpt-4o",
 * })
 * // Access: env.OPENAI_API_KEY, env.OPENAI_ORG_ID, env.OPENAI_MODEL
 * ```
 *
 * @example Azure OpenAI
 * ```ts
 * openai({ azure: true })
 * // Access: env.AZURE_OPENAI_ENDPOINT, env.AZURE_OPENAI_API_KEY
 * ```
 */
export const openai = createPlugin({
  id: "openai",
  name: "OpenAI",
  prefix: "OPENAI_",

  $options: {} as OpenAIOptions,

  base: {},

  either: {
    azure: {
      true: {
        AZURE_OPENAI_ENDPOINT: z
          .string()
          .url("Azure OpenAI endpoint must be a valid URL")
          .refine(
            (val) => val.includes(".openai.azure.com"),
            { message: "Azure OpenAI endpoint should be an Azure OpenAI resource URL" }
          ),
        AZURE_OPENAI_API_KEY: z
          .string()
          .min(1, "Azure OpenAI API key is required"),
        AZURE_OPENAI_API_VERSION: z
          .string()
          .default("2024-02-15-preview")
          .describe("Azure OpenAI API version"),
        AZURE_OPENAI_DEPLOYMENT: z
          .string()
          .min(1)
          .optional()
          .describe("Azure OpenAI deployment name"),
      },
      false: {
        OPENAI_API_KEY: createApiKeySchema(),
      },
    },
  },

  when: {
    organization: {
      OPENAI_ORG_ID: createOrgSchema(),
    },
    project: {
      OPENAI_PROJECT_ID: z
        .string()
        .optional()
        .refine(
          (val) => !val || val.startsWith("proj_"),
          { message: "OpenAI Project ID must start with 'proj_'" }
        ),
    },
    model: {
      OPENAI_MODEL: z
        .enum(OPENAI_MODELS)
        .default("gpt-4o")
        .describe("OpenAI model to use"),
    },
    baseUrl: {
      OPENAI_BASE_URL: z.string().url().optional(),
    },
    embedding: {
      OPENAI_EMBEDDING_MODEL: z
        .enum(["text-embedding-3-small", "text-embedding-3-large", "text-embedding-ada-002"])
        .default("text-embedding-3-small")
        .optional(),
    },
    parameters: {
      OPENAI_MAX_TOKENS: z.coerce.number().min(1).max(128000).optional(),
      OPENAI_TEMPERATURE: z.coerce.number().min(0).max(2).optional(),
    },
  },

  runtimeSchema: (opts, schema) => {
    // Apply default model override
    if (opts.model && opts.defaultModel) {
      schema.OPENAI_MODEL = z
        .enum(OPENAI_MODELS)
        .default(opts.defaultModel as typeof OPENAI_MODELS[number])
        .describe("OpenAI model to use");
    }

    // Handle variable name remapping
    const varNames = opts.variableNames;
    if (!varNames) return;

    const remappings: [string, string | undefined][] = [
      ["OPENAI_API_KEY", varNames.apiKey],
      ["OPENAI_ORG_ID", varNames.organization],
      ["OPENAI_PROJECT_ID", varNames.project],
      ["OPENAI_MODEL", varNames.model],
      ["OPENAI_BASE_URL", varNames.baseUrl],
      ["OPENAI_EMBEDDING_MODEL", varNames.embeddingModel],
      ["OPENAI_MAX_TOKENS", varNames.maxTokens],
      ["OPENAI_TEMPERATURE", varNames.temperature],
      ["AZURE_OPENAI_ENDPOINT", varNames.azureEndpoint],
      ["AZURE_OPENAI_API_VERSION", varNames.azureApiVersion],
      ["AZURE_OPENAI_DEPLOYMENT", varNames.azureDeployment],
    ];

    for (const [defaultKey, customKey] of remappings) {
      if (customKey && customKey !== defaultKey && schema[defaultKey]) {
        schema[customKey] = schema[defaultKey];
        delete schema[defaultKey];
      }
    }
  },

  cli: (opts) => {
    const azure = opts.azure ?? false;
    const variableNames = opts.variableNames ?? {};

    const apiKeyVar = variableNames.apiKey || "OPENAI_API_KEY";
    const orgVar = variableNames.organization || "OPENAI_ORG_ID";
    const projectVar = variableNames.project || "OPENAI_PROJECT_ID";
    const azureEndpointVar = variableNames.azureEndpoint || "AZURE_OPENAI_ENDPOINT";

    const prompts: Record<string, PromptConfig> = {
      [apiKeyVar]: {
        message: "Enter your OpenAI API key",
        placeholder: "sk-...",
        type: "password",
        validate: (val) => {
          if (!val.startsWith("sk-")) {
            return "API key must start with 'sk-'";
          }
          if (val.length < 20) {
            return "API key seems too short";
          }
          return undefined;
        },
      },
      [orgVar]: {
        message: "Enter your OpenAI Organization ID (optional)",
        placeholder: "org-...",
        type: "text",
        validate: (val) => {
          if (val && !val.startsWith("org-")) {
            return "Organization ID must start with 'org-'";
          }
          return undefined;
        },
      },
      [projectVar]: {
        message: "Enter your OpenAI Project ID (optional)",
        placeholder: "proj_...",
        type: "text",
        validate: (val) => {
          if (val && !val.startsWith("proj_")) {
            return "Project ID must start with 'proj_'";
          }
          return undefined;
        },
      },
      [azureEndpointVar]: {
        message: "Enter your Azure OpenAI endpoint",
        placeholder: "https://your-resource.openai.azure.com/",
        type: "text",
        validate: (val) => {
          try {
            new URL(val);
            if (!val.includes(".openai.azure.com")) {
              return "Should be an Azure OpenAI resource URL";
            }
            return undefined;
          } catch {
            return "Invalid URL format";
          }
        },
      },
      ["AZURE_OPENAI_API_KEY"]: {
        message: "Enter your Azure OpenAI API key",
        type: "password",
      },
    };

    return {
      docs: azure
        ? "https://learn.microsoft.com/azure/ai-services/openai/"
        : "https://platform.openai.com/api-keys",
      helpText: azure
        ? "Azure OpenAI provides OpenAI models via Azure"
        : "OpenAI provides GPT-4, GPT-3.5, and other AI models",
      prompts,
    };
  },

  discover: (opts) => async () => {
    const azure = opts.azure ?? false;
    const variableNames = opts.variableNames ?? {};

    const apiKeyVar = variableNames.apiKey || "OPENAI_API_KEY";
    const orgVar = variableNames.organization || "OPENAI_ORG_ID";

    const results: Partial<Record<string, DiscoveryResult>> = {};

    if (!azure && process.env.OPENAI_API_KEY) {
      results[apiKeyVar] = {
        value: process.env.OPENAI_API_KEY,
        source: "Environment variable",
        confidence: 1.0,
        description: "Found existing OPENAI_API_KEY",
      };
    }

    if (opts.organization && process.env.OPENAI_ORG_ID) {
      results[orgVar] = {
        value: process.env.OPENAI_ORG_ID,
        source: "Environment variable",
        confidence: 1.0,
        description: "Found existing OPENAI_ORG_ID",
      };
    }

    return results;
  },

  hooks: (opts) => {
    const azure = opts.azure ?? false;
    const variableNames = opts.variableNames ?? {};

    const apiKeyVar = variableNames.apiKey || "OPENAI_API_KEY";
    const azureEndpointVar = variableNames.azureEndpoint || "AZURE_OPENAI_ENDPOINT";

    return {
      afterValidation(values) {
        if (azure) {
          const endpoint = values[azureEndpointVar];
          if (endpoint && typeof endpoint === "string") {
            console.log(`✓ Azure OpenAI: ${new URL(endpoint).host}`);
          }
        } else {
          const key = values[apiKeyVar];
          if (key && typeof key === "string") {
            const masked = key.slice(0, 7) + "..." + key.slice(-4);
            console.log(`✓ OpenAI: API key configured (${masked})`);
          }
        }
      },
    };
  },
});

export default openai;
