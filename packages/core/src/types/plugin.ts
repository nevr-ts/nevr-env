import type { StandardSchemaV1, StandardSchemaDictionary } from "../standard";

/**
 * Prompt configuration for the CLI Wizard
 */
export interface PromptConfig {
  /** The message to display to the user */
  message: string;
  /** The type of prompt */
  type: "text" | "password" | "select" | "confirm";
  /** Placeholder text */
  placeholder?: string;
  /** Default value */
  defaultValue?: string;
  /** Options for select prompts */
  options?: Array<{ label: string; value: string }>;
  /** Validation function - return error message or undefined if valid */
  validate?: (value: string) => string | undefined;
}

/**
 * Discovery result from auto-detection
 */
export interface DiscoveryResult {
  /** The discovered value */
  value: string;
  /** Source of the discovery (e.g., "docker", "local", "system") */
  source: string;
  /** Human-readable description */
  description: string;
  /** Confidence level (0-1) */
  confidence: number;
}

/**
 * CLI configuration for a plugin
 */
export interface PluginCliConfig {
  /** Custom prompts for missing variables (keyed by variable name) */
  prompts?: Record<string, PromptConfig>;
  /** Link to documentation for getting values */
  docs?: string;
  /** Custom help text */
  helpText?: string;
}

/**
 * Hooks for plugin lifecycle
 */
export interface PluginHooks {
  /** Called before validation, can transform values */
  beforeValidation?: (
    values: Record<string, unknown>
  ) => Record<string, unknown>;
  /** Called after successful validation */
  afterValidation?: (values: Record<string, unknown>) => void;
  /** Called when validation fails */
  onValidationError?: (issues: readonly StandardSchemaV1.Issue[]) => void;
}

/**
 * NevrEnvPlugin - The core plugin interface
 * 
 * Plugins provide pre-built schemas for common services (Stripe, Postgres, etc.)
 * with auto-discovery, CLI integration, and validation hooks.
 * 
 * ## Creating a Plugin
 * 
 * Plugins follow a factory function pattern. The function receives options
 * and returns a plugin object that satisfies this interface.
 * 
 * @example
 * ```ts
 * import { z } from "zod";
 * import type { NevrEnvPlugin } from "@nevr-env/core";
 * 
 * interface MyServiceOptions {
 *   apiVersion?: string;
 * }
 * 
 * export function myService(options: MyServiceOptions = {}): NevrEnvPlugin {
 *   return {
 *     id: "my-service",
 *     name: "My Service",
 *     schema: {
 *       MY_SERVICE_API_KEY: z.string().min(1),
 *       MY_SERVICE_URL: z.string().url(),
 *     },
 *     prefix: "MY_SERVICE_",
 *     cli: {
 *       docs: "https://my-service.com/docs/api-keys",
 *       prompts: {
 *         MY_SERVICE_API_KEY: {
 *           message: "Enter your My Service API key",
 *           type: "password",
 *         },
 *       },
 *     },
 *   };
 * }
 * ```
 */
export interface NevrEnvPlugin<
  TSchema extends StandardSchemaDictionary = StandardSchemaDictionary
> {
  /** Unique identifier for the plugin (e.g., "stripe", "postgres") */
  id: string;

  /** Human-readable name (displayed in CLI) */
  name: string;

  /** The schema for this plugin's environment variables */
  schema: TSchema;

  /** Environment variable prefix (e.g., "STRIPE_", "DATABASE_") */
  prefix?: string;

  /**
   * Auto-discovery function for the CLI Wizard
   * Returns possible values detected from the local environment
   *
   * @example
   * ```ts
   * async discover() {
   *   // Check for Docker containers, config files, etc.
   *   return {
   *     DATABASE_URL: {
   *       value: "postgres://localhost:5432/mydb",
   *       source: "docker",
   *       description: "Found running Postgres container",
   *       confidence: 0.9,
   *     },
   *   };
   * }
   * ```
   */
  discover?: () => Promise<
    Partial<Record<string, DiscoveryResult | DiscoveryResult[]>>
  >;

  /**
   * Whether auto-discovery is enabled for this plugin.
   * Defaults to true. Set to false to disable auto-discovery
   * in the CLI wizard (e.g. for security-sensitive plugins).
   */
  autoDiscover?: boolean;

  /** Lifecycle hooks */
  hooks?: PluginHooks;

  /** CLI Wizard configuration */
  cli?: PluginCliConfig;

  /**
   * Whether this plugin's variables are sensitive (secrets)
   * Used for the Vault feature and hiding values in logs
   * 
   * Can be a boolean (applies to all) or an object mapping variable names
   */
  sensitive?: boolean | Record<string, boolean>;

  /**
   * Required runtime (e.g., "node", "deno", "bun")
   * If not specified, works in all runtimes
   */
  runtime?: "node" | "deno" | "bun" | "all";

  /**
   * Type inference helper - DO NOT SET MANUALLY
   * This is automatically inferred from the schema
   */
  $Infer?: {
    [K in keyof TSchema]: StandardSchemaV1.InferOutput<TSchema[K]>;
  };
}

/**
 * Helper type to extract schema from a plugin
 */
export type ExtractPluginSchema<T> = T extends NevrEnvPlugin<infer S>
  ? S
  : never;

/**
 * Helper type to merge multiple plugin schemas
 */
export type MergePluginSchemas<T extends readonly NevrEnvPlugin[]> = T extends readonly [
  infer First,
  ...infer Rest
]
  ? First extends NevrEnvPlugin
    ? Rest extends readonly NevrEnvPlugin[]
      ? ExtractPluginSchema<First> & MergePluginSchemas<Rest>
      : ExtractPluginSchema<First>
    : {}
  : {};
