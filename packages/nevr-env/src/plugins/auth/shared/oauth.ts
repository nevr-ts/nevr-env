/**
 * Shared OAuth provider schemas and utilities
 * 
 * This module provides reusable OAuth provider configuration that works
 * across different auth libraries (Better-Auth, Clerk, Auth0, NextAuth, etc.)
 */

import { z } from "zod";
import type { StandardSchemaDictionary, PromptConfig, StandardSchemaV1 } from "@nevr-env/core";

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
 * Type helper: Infer OAuth schema keys from a providers tuple.
 * For each provider, creates `{PROVIDER}_CLIENT_ID` and `{PROVIDER}_CLIENT_SECRET`.
 *
 * @example
 * ```ts
 * type Schema = OAuthProviderSchema<readonly ["google", "github"]>;
 * // { GOOGLE_CLIENT_ID: ...; GOOGLE_CLIENT_SECRET: ...; GITHUB_CLIENT_ID: ...; GITHUB_CLIENT_SECRET: ... }
 * ```
 */
export type OAuthProviderSchema<T extends readonly OAuthProvider[]> = {
  [P in T[number] as `${Uppercase<P>}_CLIENT_ID`]: StandardSchemaV1<any, string>;
} & {
  [P in T[number] as `${Uppercase<P>}_CLIENT_SECRET`]: StandardSchemaV1<any, string>;
};

/**
 * Extract providers from an options type, defaulting to empty tuple
 */
export type ExtractProviders<T> = T extends { providers: infer P extends readonly OAuthProvider[] } ? P : readonly [];

/**
 * OAuth provider display info for CLI prompts
 */
export const OAUTH_PROVIDER_INFO: Record<OAuthProvider, { name: string; docsUrl: string }> = {
  google: {
    name: "Google",
    docsUrl: "https://console.cloud.google.com/apis/credentials",
  },
  github: {
    name: "GitHub",
    docsUrl: "https://github.com/settings/developers",
  },
  discord: {
    name: "Discord",
    docsUrl: "https://discord.com/developers/applications",
  },
  twitter: {
    name: "Twitter/X",
    docsUrl: "https://developer.twitter.com/en/portal/dashboard",
  },
  facebook: {
    name: "Facebook",
    docsUrl: "https://developers.facebook.com/apps",
  },
  apple: {
    name: "Apple",
    docsUrl: "https://developer.apple.com/account/resources/identifiers",
  },
  microsoft: {
    name: "Microsoft",
    docsUrl: "https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps",
  },
  linkedin: {
    name: "LinkedIn",
    docsUrl: "https://www.linkedin.com/developers/apps",
  },
  spotify: {
    name: "Spotify",
    docsUrl: "https://developer.spotify.com/dashboard",
  },
  twitch: {
    name: "Twitch",
    docsUrl: "https://dev.twitch.tv/console/apps",
  },
  slack: {
    name: "Slack",
    docsUrl: "https://api.slack.com/apps",
  },
  gitlab: {
    name: "GitLab",
    docsUrl: "https://gitlab.com/-/profile/applications",
  },
  bitbucket: {
    name: "Bitbucket",
    docsUrl: "https://bitbucket.org/account/settings/app-passwords/",
  },
  dropbox: {
    name: "Dropbox",
    docsUrl: "https://www.dropbox.com/developers/apps",
  },
  notion: {
    name: "Notion",
    docsUrl: "https://www.notion.so/my-integrations",
  },
};

/**
 * Generate OAuth schema for given providers
 */
export function createOAuthSchema(
  providers: readonly OAuthProvider[],
  options: {
    prefix?: string;
    clientIdSuffix?: string;
    clientSecretSuffix?: string;
    optional?: boolean;
  } = {}
): StandardSchemaDictionary {
  const {
    prefix = "",
    clientIdSuffix = "_CLIENT_ID",
    clientSecretSuffix = "_CLIENT_SECRET",
    optional = false,
  } = options;

  const schema: StandardSchemaDictionary = {};

  for (const provider of providers) {
    const providerKey = provider.toUpperCase();
    const clientIdKey = `${prefix}${providerKey}${clientIdSuffix}`;
    const clientSecretKey = `${prefix}${providerKey}${clientSecretSuffix}`;

    const clientIdSchema = z.string().min(1, `${OAUTH_PROVIDER_INFO[provider].name} Client ID is required`);
    const clientSecretSchema = z.string().min(1, `${OAUTH_PROVIDER_INFO[provider].name} Client Secret is required`);

    schema[clientIdKey] = optional ? clientIdSchema.optional() : clientIdSchema;
    schema[clientSecretKey] = optional ? clientSecretSchema.optional() : clientSecretSchema;
  }

  return schema;
}

/**
 * Generate CLI prompts for OAuth providers
 */
export function createOAuthPrompts(
  providers: readonly OAuthProvider[],
  options: {
    prefix?: string;
    clientIdSuffix?: string;
    clientSecretSuffix?: string;
  } = {}
): Record<string, PromptConfig> {
  const {
    prefix = "",
    clientIdSuffix = "_CLIENT_ID",
    clientSecretSuffix = "_CLIENT_SECRET",
  } = options;

  const prompts: Record<string, PromptConfig> = {};

  for (const provider of providers) {
    const providerKey = provider.toUpperCase();
    const info = OAUTH_PROVIDER_INFO[provider];
    const clientIdKey = `${prefix}${providerKey}${clientIdSuffix}`;
    const clientSecretKey = `${prefix}${providerKey}${clientSecretSuffix}`;

    prompts[clientIdKey] = {
      message: `Enter your ${info.name} Client ID`,
      placeholder: `${provider}-client-id`,
      type: "text",
    };

    prompts[clientSecretKey] = {
      message: `Enter your ${info.name} Client Secret`,
      placeholder: `${provider}-client-secret`,
      type: "password",
    };
  }

  return prompts;
}

/**
 * Get OAuth provider docs as help text
 */
export function getOAuthDocsText(providers: readonly OAuthProvider[]): string {
  const lines = providers.map(
    (p) => `  • ${OAUTH_PROVIDER_INFO[p].name}: ${OAUTH_PROVIDER_INFO[p].docsUrl}`
  );
  return `Get OAuth credentials from:\n${lines.join("\n")}`;
}

/**
 * Common auth secret schema (32+ chars)
 */
export const authSecretSchema = z
  .string()
  .min(32, "Auth secret must be at least 32 characters for security")
  .describe("Secret key for signing tokens");

/**
 * Common auth URL schema
 */
export const authUrlSchema = z
  .string()
  .url("Must be a valid URL")
  .describe("Base URL of your application");
