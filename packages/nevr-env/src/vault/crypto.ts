/**
 * Vault Cryptography — re-exported from @nevr-env/core
 *
 * Single source of truth lives in packages/core/src/vault-crypto.ts.
 * This file re-exports everything so umbrella consumers see no API change.
 */

export {
  generateKey,
  encrypt,
  decrypt,
  parseEnv,
  stringifyEnv,
  mergeEnv,
  validateKey,
  getKeyFromEnv,
  VaultError,
  type VaultFile,
} from "@nevr-env/core";
