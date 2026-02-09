/**
 * Plugin helper utilities for creating nevr-env plugins
 *
 * Provides a declarative factory function for creating plugins with
 * automatic type inference — no manual type wrappers needed.
 */

import type { StandardSchemaV1, StandardSchemaDictionary } from "./standard";
import type {
  NevrEnvPlugin,
  PromptConfig,
  DiscoveryResult,
  PluginHooks,
  PluginCliConfig,
} from "./types/plugin";

// ─── OAuth Types (for oauthProviders support) ──────────────────

/**
 * Supported OAuth providers
 */
export type OAuthProvider =
  | "google"
  | "github"
  | "discord"
  | "twitter"
  | "facebook"
  | "apple"
  | "microsoft"
  | "linkedin"
  | "spotify"
  | "twitch"
  | "slack"
  | "gitlab"
  | "bitbucket"
  | "dropbox"
  | "notion";

/**
 * Generate CLIENT_ID + CLIENT_SECRET schema types for each provider in the tuple.
 *
 * @example
 * ```ts
 * type S = OAuthProviderSchema<readonly ["google", "github"]>;
 * // { GOOGLE_CLIENT_ID: ...; GOOGLE_CLIENT_SECRET: ...; GITHUB_CLIENT_ID: ...; GITHUB_CLIENT_SECRET: ... }
 * ```
 */
export type OAuthProviderSchema<T extends readonly OAuthProvider[]> = {
  [P in T[number] as `${Uppercase<P>}_CLIENT_ID`]: StandardSchemaV1<any, string>;
} & {
  [P in T[number] as `${Uppercase<P>}_CLIENT_SECRET`]: StandardSchemaV1<any, string>;
};

/**
 * Extract providers tuple from an options type
 */
export type ExtractProviders<T> = T extends {
  providers: infer P extends readonly OAuthProvider[];
}
  ? P
  : readonly [];

// ─── Type Utilities ────────────────────────────────────────────

/**
 * Convert a union type to an intersection.
 * (A | B | C) → A & B & C
 */
type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

/**
 * Pick when-branches where the corresponding flag is `true` in TOpts.
 *
 * Given `TWhen = { directUrl: { DIRECT_URL: S }, pool: { POOL_SIZE: S } }`
 * and `TOpts = { directUrl: true }`, returns `{ DIRECT_URL: S }`.
 */
type PickWhenTrue<
  TWhen extends Record<string, StandardSchemaDictionary>,
  TOpts,
> = UnionToIntersection<
  {
    [K in keyof TWhen & string]: K extends keyof TOpts
      ? TOpts[K] extends true
        ? TWhen[K]
        : {}
      : {};
  }[keyof TWhen & string]
>;

/**
 * Pick either-branch (true or false) based on flag value.
 *
 * Given `TEither = { azure: { true: AzureSchema, false: StandardSchema } }`
 * and `TOpts = { azure: true }`, returns `AzureSchema`.
 * Defaults to the `false` branch when the flag is absent.
 */
type PickEither<
  TEither extends Record<
    string,
    { true: StandardSchemaDictionary; false: StandardSchemaDictionary }
  >,
  TOpts,
> = UnionToIntersection<
  {
    [K in keyof TEither & string]: K extends keyof TOpts
      ? TOpts[K] extends true
        ? TEither[K]["true"]
        : TEither[K]["false"]
      : TEither[K]["false"];
  }[keyof TEither & string]
>;

/**
 * Resolve OAuth provider schemas from an array option.
 *
 * Given `TOAuthKey = "providers"` and `TOpts = { providers: readonly ["google", "github"] }`,
 * returns `{ GOOGLE_CLIENT_ID: S, GOOGLE_CLIENT_SECRET: S, GITHUB_CLIENT_ID: S, GITHUB_CLIENT_SECRET: S }`.
 */
type ResolveOAuth<TOAuthKey, TOpts> = TOAuthKey extends string
  ? TOAuthKey extends keyof TOpts
    ? TOpts[TOAuthKey] extends readonly OAuthProvider[]
      ? OAuthProviderSchema<TOpts[TOAuthKey]>
      : {}
    : {}
  : {};

/**
 * The fully resolved schema for a plugin given base, when, either, oauth, and extend.
 */
type ResolvedSchema<
  TBase extends StandardSchemaDictionary,
  TWhen extends Record<string, StandardSchemaDictionary>,
  TEither extends Record<
    string,
    { true: StandardSchemaDictionary; false: StandardSchemaDictionary }
  >,
  TOAuthKey,
  TOpts,
> = TBase &
  PickWhenTrue<TWhen, TOpts> &
  PickEither<TEither, TOpts> &
  ResolveOAuth<TOAuthKey, TOpts> &
  (TOpts extends { extend: infer E extends StandardSchemaDictionary }
    ? E
    : {});

/**
 * Merged options type: extra options + when-flags + either-flags + oauth + built-ins
 */
type MergedOptions<
  TWhen extends Record<string, StandardSchemaDictionary>,
  TEither extends Record<
    string,
    { true: StandardSchemaDictionary; false: StandardSchemaDictionary }
  >,
  TOAuthKey extends string | undefined,
  TOptions extends Record<string, any>,
> = TOptions &
  Partial<{ [K in keyof TWhen]: boolean }> &
  Partial<{ [K in keyof TEither]: boolean }> &
  (TOAuthKey extends string
    ? Partial<Record<TOAuthKey, readonly OAuthProvider[]>>
    : {}) & {
    autoDiscover?: boolean;
    extend?: StandardSchemaDictionary;
  };

// ─── Plugin Config Interface ───────────────────────────────────

/**
 * Configuration for defining a plugin with automatic type inference.
 *
 * Use `base` for always-present schemas, `when` for additive flags,
 * `either` for mutually exclusive flags, and `oauthProviders` for
 * dynamic OAuth provider schemas.
 */
export interface DefinePluginConfig<
  TBase extends StandardSchemaDictionary,
  TWhen extends Record<string, StandardSchemaDictionary> = {},
  TEither extends Record<
    string,
    { true: StandardSchemaDictionary; false: StandardSchemaDictionary }
  > = {},
  TOAuthKey extends string | undefined = undefined,
  TOptions extends Record<string, any> = {},
> {
  /** Unique identifier for the plugin */
  id: string;
  /** Human-readable name */
  name: string;
  /** Prefix for environment variables */
  prefix?: string;
  /** Whether variables are sensitive */
  sensitive?: boolean | Record<string, boolean>;
  /** Required runtime */
  runtime?: "node" | "deno" | "bun" | "all";

  /** Base schema — always included regardless of options */
  base: TBase;

  /** Conditional schemas — included when the corresponding boolean flag is `true` */
  when?: TWhen;

  /**
   * Mutually exclusive schemas — selects `true` or `false` branch based on flag.
   * Defaults to the `false` branch when the flag is absent.
   *
   * @example
   * ```ts
   * either: {
   *   azure: {
   *     true: { AZURE_OPENAI_ENDPOINT: z.string().url() },
   *     false: { OPENAI_API_KEY: z.string().min(1) },
   *   },
   * }
   * ```
   */
  either?: TEither;

  /**
   * Name of the option key that holds an OAuth providers array.
   * Enables automatic OAuth schema generation (CLIENT_ID + CLIENT_SECRET per provider).
   *
   * @example
   * ```ts
   * oauthProviders: "providers",
   * $options: {} as { providers?: readonly OAuthProvider[] },
   * ```
   */
  oauthProviders?: TOAuthKey;

  /**
   * Phantom field for extra option types beyond boolean flags.
   * Use `{} as YourType` to provide type information.
   *
   * @example
   * ```ts
   * $options: {} as { variableNames?: { url?: string }; defaultPort?: number }
   * ```
   */
  $options?: TOptions;

  /**
   * Runtime-only schema adjustments (e.g., variable name remapping).
   * Called after base/when/either schemas are merged. Can mutate the schema object.
   */
  runtimeSchema?: (
    options: MergedOptions<TWhen, TEither, TOAuthKey, TOptions>,
    schema: Record<string, unknown>,
  ) => void;

  /**
   * Runtime function to build dynamic schemas from options (e.g., OAuth provider schemas).
   * The result is merged into the schema at runtime.
   */
  dynamicSchema?: (
    options: MergedOptions<TWhen, TEither, TOAuthKey, TOptions>,
  ) => StandardSchemaDictionary;

  /** Optional CLI configuration factory */
  cli?: (
    options: MergedOptions<TWhen, TEither, TOAuthKey, TOptions>,
  ) => PluginCliConfig;

  /** Optional hooks factory */
  hooks?: (
    options: MergedOptions<TWhen, TEither, TOAuthKey, TOptions>,
  ) => PluginHooks;

  /** Optional discovery factory */
  discover?: (
    options: MergedOptions<TWhen, TEither, TOAuthKey, TOptions>,
  ) => () => Promise<Partial<Record<string, DiscoveryResult | DiscoveryResult[]>>>;

  /**
   * Whether auto-discovery is enabled.
   * Defaults to true. Can be a boolean or a function of options.
   */
  autoDiscover?:
    | boolean
    | ((
        options: MergedOptions<TWhen, TEither, TOAuthKey, TOptions>,
      ) => boolean);
}

// ─── createPlugin ──────────────────────────────────────────────

/**
 * Create a plugin factory with automatic type inference.
 *
 * All type parameters are inferred from the config — no explicit generics needed.
 *
 * @example Simple additive plugin
 * ```ts
 * export const postgres = createPlugin({
 *   id: "postgres",
 *   name: "PostgreSQL",
 *   base: { DATABASE_URL: z.string().url() },
 *   when: {
 *     directUrl: { DIRECT_URL: z.string().url() },
 *     pool: { DATABASE_POOL_SIZE: z.coerce.number().optional() },
 *   },
 * });
 *
 * postgres()                    // → { DATABASE_URL }
 * postgres({ directUrl: true }) // → { DATABASE_URL, DIRECT_URL }
 * ```
 *
 * @example Mutually exclusive
 * ```ts
 * export const openai = createPlugin({
 *   id: "openai",
 *   name: "OpenAI",
 *   either: {
 *     azure: {
 *       true: { AZURE_OPENAI_ENDPOINT: z.string().url(), AZURE_OPENAI_API_KEY: z.string() },
 *       false: { OPENAI_API_KEY: z.string() },
 *     },
 *   },
 *   when: { model: { OPENAI_MODEL: z.string() } },
 * });
 * ```
 *
 * @example With OAuth providers
 * ```ts
 * export const betterAuth = createPlugin({
 *   id: "better-auth",
 *   name: "Better Auth",
 *   base: { BETTER_AUTH_SECRET: z.string().min(32) },
 *   oauthProviders: "providers",
 *   $options: {} as { providers?: readonly OAuthProvider[] },
 *   dynamicSchema: (opts) => createOAuthSchema(opts?.providers ?? []),
 * });
 *
 * betterAuth({ providers: ["google", "github"] })
 * // → { BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET }
 * ```
 */
export function createPlugin<
  TBase extends StandardSchemaDictionary,
  TWhen extends Record<string, StandardSchemaDictionary> = {},
  TEither extends Record<
    string,
    { true: StandardSchemaDictionary; false: StandardSchemaDictionary }
  > = {},
  TOAuthKey extends string | undefined = undefined,
  TOptions extends Record<string, any> = {},
>(
  config: DefinePluginConfig<TBase, TWhen, TEither, TOAuthKey, TOptions>,
): <
  const T extends MergedOptions<TWhen, TEither, TOAuthKey, TOptions>,
>(
  options?: T,
) => NevrEnvPlugin<ResolvedSchema<TBase, TWhen, TEither, TOAuthKey, T>> {
  return ((options?: Record<string, unknown>) => {
    const opts = (options ?? {}) as Record<string, unknown>;

    // 1. Start with base schema
    const schema: Record<string, StandardSchemaV1> = { ...config.base };

    // 2. Add when-branches where flag is true
    if (config.when) {
      for (const key of Object.keys(config.when)) {
        if (opts[key] === true) {
          Object.assign(schema, (config.when as Record<string, StandardSchemaDictionary>)[key]);
        }
      }
    }

    // 3. Add either-branches (true branch or false branch)
    if (config.either) {
      for (const key of Object.keys(config.either)) {
        const branch = (config.either as Record<string, { true: StandardSchemaDictionary; false: StandardSchemaDictionary }>)[key];
        if (opts[key] === true) {
          Object.assign(schema, branch.true);
        } else {
          Object.assign(schema, branch.false);
        }
      }
    }

    // 4. Add dynamic schemas (e.g., OAuth provider schemas)
    if (config.dynamicSchema) {
      const dynamic = config.dynamicSchema(opts as any);
      Object.assign(schema, dynamic);
    }

    // 5. Apply runtime schema adjustments
    if (config.runtimeSchema) {
      config.runtimeSchema(opts as any, schema);
    }

    // 6. Merge user's extend option
    if (opts.extend && typeof opts.extend === "object") {
      Object.assign(schema, opts.extend);
    }

    // 7. Resolve autoDiscover: user option > config-level > default true
    let autoDiscover: boolean;
    if (typeof opts.autoDiscover === "boolean") {
      autoDiscover = opts.autoDiscover;
    } else if (typeof config.autoDiscover === "function") {
      autoDiscover = config.autoDiscover(opts as any);
    } else {
      autoDiscover = config.autoDiscover ?? true;
    }

    return {
      id: config.id,
      name: config.name,
      schema: schema as StandardSchemaDictionary,
      prefix: config.prefix,
      sensitive: config.sensitive,
      runtime: config.runtime,
      cli: config.cli?.(opts as any),
      hooks: config.hooks?.(opts as any),
      discover: config.discover?.(opts as any),
      autoDiscover,
    };
  }) as any;
}

// ─── Schema Utilities (unchanged) ──────────────────────────────

/**
 * Utility to create a URL schema with protocol validation
 */
export function urlSchema(
  protocols: string[] = ["http", "https"],
): StandardSchemaV1<string, string> {
  return {
    "~standard": {
      version: 1,
      vendor: "nevr-env",
      validate: (value) => {
        if (typeof value !== "string") {
          return {
            issues: [{ message: "Expected string", path: [] }],
          };
        }
        try {
          const url = new URL(value);
          const protocol = url.protocol.slice(0, -1);
          if (!protocols.includes(protocol)) {
            return {
              issues: [
                {
                  message: `URL must use one of these protocols: ${protocols.join(", ")}`,
                  path: [],
                },
              ],
            };
          }
          return { value };
        } catch {
          return {
            issues: [{ message: "Invalid URL format", path: [] }],
          };
        }
      },
    },
  };
}

/**
 * Utility to create a port number schema
 */
export function portSchema(
  min = 1,
  max = 65535,
): StandardSchemaV1<string | number, number> {
  return {
    "~standard": {
      version: 1,
      vendor: "nevr-env",
      validate: (value) => {
        const num = typeof value === "string" ? parseInt(value, 10) : value;
        if (typeof num !== "number" || isNaN(num)) {
          return {
            issues: [{ message: "Expected a number", path: [] }],
          };
        }
        if (num < min || num > max) {
          return {
            issues: [
              {
                message: `Port must be between ${min} and ${max}`,
                path: [],
              },
            ],
          };
        }
        return { value: num };
      },
    },
  };
}

/**
 * Utility to create a boolean schema that handles string values
 */
export function booleanSchema(
  defaultValue?: boolean,
): StandardSchemaV1<string | boolean | undefined, boolean> {
  return {
    "~standard": {
      version: 1,
      vendor: "nevr-env",
      validate: (value) => {
        if (value === undefined && defaultValue !== undefined) {
          return { value: defaultValue };
        }
        if (typeof value === "boolean") {
          return { value };
        }
        if (typeof value === "string") {
          const lower = value.toLowerCase();
          if (["true", "1", "yes", "on"].includes(lower)) {
            return { value: true };
          }
          if (["false", "0", "no", "off", ""].includes(lower)) {
            return { value: false };
          }
        }
        return {
          issues: [
            {
              message: "Expected boolean or truthy/falsy string",
              path: [],
            },
          ],
        };
      },
    },
  };
}

/**
 * Utility to create an optional schema wrapper
 */
export function optionalSchema<T>(
  schema: StandardSchemaV1<unknown, T>,
): StandardSchemaV1<unknown, T | undefined> {
  return {
    "~standard": {
      version: 1,
      vendor: "nevr-env",
      validate: (value) => {
        if (value === undefined || value === null || value === "") {
          return { value: undefined };
        }
        return schema["~standard"].validate(value) as
          | { value: T | undefined }
          | { issues: readonly StandardSchemaV1.Issue[] };
      },
    },
  };
}

/**
 * Utility to create a string schema with constraints
 */
export function stringSchema(options?: {
  min?: number;
  max?: number;
  pattern?: RegExp;
  message?: string;
}): StandardSchemaV1<string, string> {
  return {
    "~standard": {
      version: 1,
      vendor: "nevr-env",
      validate: (value) => {
        if (typeof value !== "string") {
          return {
            issues: [{ message: "Expected string", path: [] }],
          };
        }
        if (options?.min !== undefined && value.length < options.min) {
          return {
            issues: [
              {
                message:
                  options.message ||
                  `String must be at least ${options.min} characters`,
                path: [],
              },
            ],
          };
        }
        if (options?.max !== undefined && value.length > options.max) {
          return {
            issues: [
              {
                message:
                  options.message ||
                  `String must be at most ${options.max} characters`,
                path: [],
              },
            ],
          };
        }
        if (options?.pattern && !options.pattern.test(value)) {
          return {
            issues: [
              {
                message: options.message || `String must match pattern`,
                path: [],
              },
            ],
          };
        }
        return { value };
      },
    },
  };
}

/**
 * Utility to create an enum schema
 */
export function enumSchema<T extends string>(
  values: readonly T[],
): StandardSchemaV1<string, T> {
  return {
    "~standard": {
      version: 1,
      vendor: "nevr-env",
      validate: (value) => {
        if (typeof value !== "string") {
          return {
            issues: [{ message: "Expected string", path: [] }],
          };
        }
        if (!values.includes(value as T)) {
          return {
            issues: [
              {
                message: `Expected one of: ${values.join(", ")}`,
                path: [],
              },
            ],
          };
        }
        return { value: value as T };
      },
    },
  };
}

/**
 * Docker discovery config interface
 */
export interface DockerDiscoveryConfig {
  /** Container name patterns to look for */
  containerNames: string[];
  /** Port numbers to check */
  ports?: number[];
  /** Environment variables to extract */
  envVars?: string[];
}

/**
 * Helper to create CLI prompts configuration
 */
export function createPrompts<T extends Record<string, PromptConfig>>(
  prompts: T,
): T {
  return prompts;
}

/**
 * Helper to merge multiple schemas
 */
export function mergeSchemas<T extends StandardSchemaDictionary[]>(
  ...schemas: T
): T[number] {
  return Object.assign({}, ...schemas);
}

/**
 * Transform a schema to make all fields optional
 */
export function makeOptional<T extends StandardSchemaDictionary>(schema: T): {
  [K in keyof T]: StandardSchemaV1<
    unknown,
    StandardSchemaV1.InferOutput<T[K]> | undefined
  >;
} {
  const result: Record<string, StandardSchemaV1> = {};

  for (const [key, value] of Object.entries(schema)) {
    result[key] = optionalSchema(value as StandardSchemaV1);
  }

  return result as {
    [K in keyof T]: StandardSchemaV1<
      unknown,
      StandardSchemaV1.InferOutput<T[K]> | undefined
    >;
  };
}
