import type {
  StandardSchemaV1,
  StandardSchemaDictionary,
  InferDictionary,
} from "../standard";
import type { NevrEnvPlugin, MergePluginSchemas } from "./plugin";

// ─── Type Utilities ──────────────────────────────────────────────

/**
 * Compile-time error message for invalid configurations.
 */
export type ErrorMessage<TMessage extends string> = TMessage;

/**
 * Flatten an intersection type for cleaner IDE tooltips.
 * Without this, hovering shows `A & B & C` instead of the merged shape.
 */
type Simplify<T> = {
  [P in keyof T]: T[P];
} & {};

/**
 * Identify keys whose values can be `undefined`.
 */
type PossiblyUndefinedKeys<T> = {
  [K in keyof T]: undefined extends T[K] ? K : never;
}[keyof T];

/**
 * Make keys that can be `undefined` optional (shows `?` in IDE).
 * `{ a: string; b: string | undefined }` → `{ a: string; b?: string | undefined }`
 */
type UndefinedOptional<T> = Partial<Pick<T, PossiblyUndefinedKeys<T>>> &
  Omit<T, PossiblyUndefinedKeys<T>>;

/**
 * Make all keys of a record impossible (Partial<Record<K, never>>).
 * Used to enforce that server-only configs can't include client options and vice versa.
 */
type Impossible<T> = Partial<
  Record<keyof T, never>
>;

/**
 * Reverse a Readonly to mutable.
 */
type Mutable<T> = T extends Readonly<infer U> ? U : T;

/**
 * Reduce an array of records to a single object where earlier keys take precedence.
 * This gives proper override semantics for the `extends` option.
 */
type Reduce<TArr extends Record<string, unknown>[], TAcc = object> =
  TArr extends []
    ? TAcc
    : TArr extends [infer Head, ...infer Tail]
      ? Tail extends Record<string, unknown>[]
        ? Mutable<Head> & Omit<Reduce<Tail, TAcc>, keyof Head>
        : never
      : never;

// ─── Format Aliases ──────────────────────────────────────────────

type TPrefixFormat = string | undefined;
type TServerFormat = StandardSchemaDictionary;
type TClientFormat = StandardSchemaDictionary;
type TSharedFormat = StandardSchemaDictionary;
type TExtendsFormat = Record<string, unknown>[];
type TPluginsFormat = readonly NevrEnvPlugin[];

// ─── Runtime Env Options ─────────────────────────────────────────

/**
 * Loose runtime env — doesn't enforce that all declared variables are listed.
 * Good for environments where `process.env` has all variables available.
 */
interface LooseOptions<
  TShared extends TSharedFormat,
  TExtends extends TExtendsFormat,
> {
  runtimeEnvStrict?: never;
  runtimeEnv: Record<string, string | boolean | number | undefined>;
  experimental__runtimeEnv?: never;
}

/**
 * Experimental runtime env for Next.js 13.4.4+.
 * Only client-side and shared variables need explicit destructuring;
 * server variables are automatically available from full `process.env`.
 */
interface ExperimentalRuntimeEnvOptions<
  TPrefix extends TPrefixFormat,
  TClient extends TClientFormat,
  TShared extends TSharedFormat,
> {
  runtimeEnvStrict?: never;
  runtimeEnv?: never;
  experimental__runtimeEnv: Record<
    | {
        [TKey in keyof TClient]: TPrefix extends undefined
          ? never
          : TKey extends `${TPrefix}${string}`
            ? TKey
            : never;
      }[keyof TClient]
    | keyof TShared,
    string | boolean | number | undefined
  >;
}

/**
 * Strict runtime env — type-checks that every declared variable is listed.
 * Required for frameworks that tree-shake unused `process.env.*` references
 * (Next.js Edge, Client runtimes).
 */
interface StrictOptions<
  TPrefix extends TPrefixFormat,
  TServer extends TServerFormat,
  TClient extends TClientFormat,
  TShared extends TSharedFormat,
  TExtends extends TExtendsFormat,
  TPlugins extends TPluginsFormat,
> {
  runtimeEnvStrict: Record<
    | {
        [TKey in keyof TClient]: TPrefix extends undefined
          ? never
          : TKey extends `${TPrefix}${string}`
            ? TKey
            : never;
      }[keyof TClient]
    | {
        [TKey in keyof TServer]: TPrefix extends undefined
          ? TKey
          : TKey extends `${TPrefix}${string}`
            ? never
            : TKey;
      }[keyof TServer]
    | {
        [TKey in keyof TShared]: TKey extends string ? TKey : never;
      }[keyof TShared]
    | keyof MergePluginSchemas<TPlugins>,
    string | boolean | number | undefined
  >;
  runtimeEnv?: never;
  experimental__runtimeEnv?: never;
}

// ─── Schema Options ──────────────────────────────────────────────

/**
 * Client schema with prefix enforcement.
 * All client variables MUST start with `clientPrefix` at both type and runtime level.
 */
interface ClientOptions<
  TPrefix extends TPrefixFormat,
  TClient extends TClientFormat,
> {
  clientPrefix: TPrefix;
  client: Partial<{
    [TKey in keyof TClient]: TKey extends `${TPrefix}${string}`
      ? TClient[TKey]
      : ErrorMessage<`${TKey extends string ? TKey : never} is not prefixed with ${TPrefix}.`>;
  }>;
}

/**
 * Server schema with prefix rejection.
 * Server variables MUST NOT start with `clientPrefix` (they'd leak to the client).
 */
interface ServerOptions<
  TPrefix extends TPrefixFormat,
  TServer extends TServerFormat,
> {
  server: Partial<{
    [TKey in keyof TServer]: TPrefix extends undefined
      ? TServer[TKey]
      : TPrefix extends ""
        ? TServer[TKey]
        : TKey extends `${TPrefix}${string}`
          ? ErrorMessage<`${TKey extends `${TPrefix}${string}` ? TKey : never} should not be prefixed with ${TPrefix}.`>
          : TServer[TKey];
  }>;
}

/**
 * Discriminated union enforcing valid combinations:
 * - Client + Server (both with prefix rules)
 * - Server only (no client/clientPrefix allowed)
 * - Client only (no server allowed)
 */
type ServerClientOptions<
  TPrefix extends TPrefixFormat,
  TServer extends TServerFormat,
  TClient extends TClientFormat,
> =
  | (ClientOptions<TPrefix, TClient> & ServerOptions<TPrefix, TServer>)
  | (ServerOptions<TPrefix, TServer> & Impossible<ClientOptions<never, never>>)
  | (ClientOptions<TPrefix, TClient> & Impossible<ServerOptions<never, never>>);

// ─── Base Options ────────────────────────────────────────────────

/**
 * Options shared by all configurations.
 */
interface BaseOptions<
  TShared extends TSharedFormat,
  TExtends extends TExtendsFormat,
  TPlugins extends TPluginsFormat,
> {
  /**
   * Plugins to include (e.g., postgres(), stripe()).
   * Plugin schemas are merged with server/client/shared schemas.
   */
  plugins?: TPlugins;

  /**
   * Shared variables accessible on both client and server.
   * Common examples: NODE_ENV, VERCEL_URL.
   */
  shared?: TShared;

  /**
   * Extend from existing env configurations (presets).
   * Types from extended configs are merged into the output.
   */
  extends?: TExtends;

  /**
   * Treat empty strings as undefined.
   * Solves the issue where `PORT=""` doesn't apply default values.
   * @default false
   */
  emptyStringAsUndefined?: boolean;

  /**
   * Skip validation entirely (useful for build time or CI).
   * When true, also propagates to all extended presets.
   * @default false
   */
  skipValidation?: boolean;

  /**
   * Override server/client detection.
   * @default typeof window === "undefined"
   */
  isServer?: boolean;

  /**
   * Validation mode.
   * - "strict": throws on validation error (default)
   * - "warn": logs warnings and continues with potentially invalid env
   * @default "strict"
   */
  validationMode?: "strict" | "warn";

  /**
   * Enable debug logging for troubleshooting.
   * Logs schema keys, available env keys, and server detection result.
   * @default false
   */
  debug?: boolean;

  /**
   * Custom error handler for validation failures.
   * Must throw or exit — return type is `never`.
   */
  onValidationError?: (issues: readonly StandardSchemaV1.Issue[]) => never;

  /**
   * Custom error handler when a server-side variable is accessed on the client.
   * Must throw or exit — return type is `never`.
   */
  onInvalidAccess?: (variableName: string) => never;

  /**
   * Called after successful validation.
   * Useful for logging, telemetry, or rotation checking.
   */
  onSuccess?: (env: Record<string, unknown>) => void;

  /**
   * Custom function to combine and transform the final schema.
   * Receives all schema shapes and whether running on server.
   * Return a single Standard Schema validator (e.g., `z.object(shape).refine(...)`).
   */
  createFinalSchema?: <TSchema extends StandardSchemaV1>(
    shape: StandardSchemaDictionary,
    isServer: boolean
  ) => TSchema;
}

// ─── Combined Options ────────────────────────────────────────────

/**
 * Full options type for `createEnv()`.
 */
export type EnvOptions<
  TPrefix extends TPrefixFormat,
  TServer extends TServerFormat,
  TClient extends TClientFormat,
  TShared extends TSharedFormat,
  TExtends extends TExtendsFormat,
  TPlugins extends TPluginsFormat,
> = BaseOptions<TShared, TExtends, TPlugins> &
  ServerClientOptions<TPrefix, TServer, TClient> &
  (
    | LooseOptions<TShared, TExtends>
    | StrictOptions<TPrefix, TServer, TClient, TShared, TExtends, TPlugins>
    | ExperimentalRuntimeEnvOptions<TPrefix, TClient, TShared>
  );

// ─── Output Types ────────────────────────────────────────────────

/**
 * The output type of `createEnv()`.
 *
 * - Merges server + client + shared + plugin + extends schemas
 * - Makes possibly-undefined keys optional (`?`)
 * - Simplifies the intersection for clean IDE display
 * - Marks the result as Readonly
 */
export type CreateEnvResult<
  TServer extends TServerFormat,
  TClient extends TClientFormat,
  TShared extends TSharedFormat,
  TExtends extends TExtendsFormat,
  TPlugins extends TPluginsFormat = readonly [],
> = Readonly<
  Simplify<
    UndefinedOptional<
      Reduce<
        [
          InferDictionary<TServer> &
            InferDictionary<TClient> &
            InferDictionary<TShared> &
            InferDictionary<MergePluginSchemas<TPlugins>>,
          ...TExtends,
        ]
      >
    >
  >
>;
