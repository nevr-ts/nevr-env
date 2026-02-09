/**
 * Standalone AWS plugin export.
 *
 * Use this entry point for optimal tree-shaking:
 *   import { aws } from "nevr-env/plugins/aws";
 *
 * Instead of the barrel which pulls every plugin:
 *   import { cloud } from "nevr-env/plugins";
 */
export { aws } from "./cloud/providers/aws";
export type { AWSOptions } from "./cloud/providers/aws";
