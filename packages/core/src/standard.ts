/**
 * Standard Schema V1 Interface
 * 
 * This interface provides interoperability between different validation libraries
 * (Zod, Valibot, ArkType, etc.) using the Standard Schema specification.
 * 
 * @see https://github.com/standard-schema/standard-schema
 */

export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}

export declare namespace StandardSchemaV1 {
  export interface Props<Input = unknown, Output = Input> {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown
    ) => Result<Output> | Promise<Result<Output>>;
    readonly types?: Types<Input, Output> | undefined;
  }

  export type Result<Output> = SuccessResult<Output> | FailureResult;

  export interface SuccessResult<Output> {
    readonly value: Output;
    readonly issues?: undefined;
  }

  export interface FailureResult {
    readonly issues: ReadonlyArray<Issue>;
  }

  export interface Issue {
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
  }

  export interface PathSegment {
    readonly key: PropertyKey;
  }

  export interface Types<Input = unknown, Output = Input> {
    readonly input: Input;
    readonly output: Output;
  }

  export type InferInput<Schema extends StandardSchemaV1> =
    NonNullable<Schema["~standard"]["types"]>["input"];

  export type InferOutput<Schema extends StandardSchemaV1> =
    NonNullable<Schema["~standard"]["types"]>["output"];
}

/**
 * A dictionary of Standard Schema validators
 */
export type StandardSchemaDictionary = Record<string, StandardSchemaV1>;

/**
 * Infer the output type from a Standard Schema dictionary
 */
export type InferDictionary<TDict extends StandardSchemaDictionary> = {
  [K in keyof TDict]: StandardSchemaV1.InferOutput<TDict[K]>;
};

/**
 * Ensures a result is synchronous (not a Promise)
 */
export function ensureSynchronous<T>(
  result: T | Promise<T>,
  message: string
): asserts result is T {
  if (result instanceof Promise) {
    throw new Error(message);
  }
}

/**
 * Parses a dictionary of Standard Schema validators against a value object
 */
export function parseWithDictionary<TDict extends StandardSchemaDictionary>(
  dictionary: TDict,
  value: Record<string, unknown>
): StandardSchemaV1.Result<InferDictionary<TDict>> {
  const result: Record<string, unknown> = {};
  const issues: StandardSchemaV1.Issue[] = [];

  for (const key in dictionary) {
    const schema = dictionary[key];
    const propResult = schema["~standard"].validate(value[key]);
    
    ensureSynchronous(
      propResult,
      `Validation for "${key}" must be synchronous. Async validators are not supported.`
    );

    if (propResult.issues) {
      issues.push(
        ...propResult.issues.map((issue) => ({
          ...issue,
          path: [key, ...(issue.path ?? [])],
        }))
      );
      continue;
    }
    
    result[key] = propResult.value;
  }

  if (issues.length > 0) {
    return { issues };
  }

  return { value: result as InferDictionary<TDict> };
}
