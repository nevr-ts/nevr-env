/**
 * Cloud namespace - All cloud providers
 * 
 * @example Namespace usage (recommended)
 * ```ts
 * import { cloud } from "nevr-env/plugins";
 * 
 * createEnv({
 *   plugins: [
 *     cloud.aws({ s3: true, ses: true }),
 *   ]
 * })
 * ```
 */

import aws, { type AWSOptions } from "./providers/aws";

// Export types
export type { AWSOptions } from "./providers/aws";

// Export individual providers
export { aws };

/**
 * Cloud namespace containing all cloud providers
 * 
 * @example
 * ```ts
 * import { cloud } from "nevr-env/plugins";
 * 
 * // AWS with S3 and SES
 * cloud.aws({ s3: true, ses: true, sqs: true })
 * ```
 */
export const cloud = {
  /**
   * AWS - Amazon Web Services
   * @see https://aws.amazon.com
   */
  aws,
} as const;

export type CloudNamespace = typeof cloud;
