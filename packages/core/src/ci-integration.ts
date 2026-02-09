/**
 * CI/CD Integration Helpers
 * 
 * Generate configuration for various CI/CD platforms to validate environment variables
 */

import { getSchemaInfo } from "./generate-example";
import type { StandardSchemaDictionary } from "./standard";

export interface SchemaConfig {
  server?: StandardSchemaDictionary;
  client?: StandardSchemaDictionary;
  shared?: StandardSchemaDictionary;
}

export interface CIConfig {
  /** Required environment variables */
  requiredVars: string[];
  /** Optional environment variables */
  optionalVars: string[];
  /** Secret variables (should be masked in logs) */
  secretVars: string[];
}

/**
 * Extract CI configuration from schema
 */
export function extractCIConfig(schema: SchemaConfig): CIConfig {
  const info = getSchemaInfo(schema);
  
  return {
    requiredVars: info.filter(v => v.required).map(v => v.key),
    optionalVars: info.filter(v => !v.required).map(v => v.key),
    secretVars: info.filter(v => 
      v.key.toLowerCase().includes('secret') ||
      v.key.toLowerCase().includes('password') ||
      v.key.toLowerCase().includes('key') ||
      v.key.toLowerCase().includes('token')
    ).map(v => v.key),
  };
}

/**
 * Generate GitHub Actions workflow for env validation
 */
export function generateGitHubActionsWorkflow(schema: SchemaConfig, options?: {
  name?: string;
  nodeVersion?: string;
  packageManager?: "npm" | "yarn" | "pnpm";
}): string {
  const config = extractCIConfig(schema);
  const { 
    name = "Validate Environment",
    nodeVersion = "20",
    packageManager = "pnpm"
  } = options ?? {};

  const installCmd = packageManager === "pnpm" ? "pnpm install" : 
                    packageManager === "yarn" ? "yarn install" : "npm ci";

  return `name: ${name}

on:
  pull_request:
  push:
    branches: [main, master]

jobs:
  validate-env:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '${nodeVersion}'
          
${packageManager === "pnpm" ? `      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9
          
` : ""}      - name: Install dependencies
        run: ${installCmd}
        
      - name: Validate environment variables
        run: npx nevr-env check
        env:
${config.requiredVars.map(v => `          ${v}: \${{ secrets.${v} }}`).join('\n')}
${config.optionalVars.length > 0 ? `          # Optional variables (uncomment if needed)
${config.optionalVars.map(v => `          # ${v}: \${{ secrets.${v} }}`).join('\n')}` : ""}

      - name: Run tests
        run: ${packageManager === "pnpm" ? "pnpm" : packageManager === "yarn" ? "yarn" : "npm run"} test
        env:
${config.requiredVars.map(v => `          ${v}: \${{ secrets.${v} }}`).join('\n')}
`;
}

/**
 * Generate Vercel environment configuration
 */
export function generateVercelConfig(schema: SchemaConfig): string {
  const config = extractCIConfig(schema);
  
  const envConfig = [
    ...config.requiredVars.map(v => ({
      key: v,
      type: "secret" as const,
      target: ["production", "preview", "development"] as const,
    })),
    ...config.optionalVars.map(v => ({
      key: v,
      type: "plain" as const,
      target: ["production", "preview"] as const,
    })),
  ];

  return JSON.stringify({
    "$schema": "https://openapi.vercel.sh/vercel.json",
    "env": config.requiredVars.reduce((acc, v) => {
      acc[v] = { description: `Required: ${v}` };
      return acc;
    }, {} as Record<string, { description: string }>),
    "buildCommand": "pnpm build",
    "devCommand": "pnpm dev",
    "installCommand": "pnpm install",
  }, null, 2);
}

/**
 * Generate Railway configuration
 */
export function generateRailwayConfig(schema: SchemaConfig): string {
  const config = extractCIConfig(schema);
  
  return JSON.stringify({
    "$schema": "https://railway.app/railway.schema.json",
    "build": {
      "builder": "NIXPACKS"
    },
    "deploy": {
      "restartPolicyType": "ON_FAILURE",
      "restartPolicyMaxRetries": 10
    },
    "variables": config.requiredVars.reduce((acc, v) => {
      // Railway uses references for secrets
      acc[v] = config.secretVars.includes(v) ? `\${{${v}}}` : "";
      return acc;
    }, {} as Record<string, string>),
  }, null, 2);
}

/**
 * Generate GitLab CI configuration
 */
export function generateGitLabCI(schema: SchemaConfig, options?: {
  nodeVersion?: string;
}): string {
  const config = extractCIConfig(schema);
  const { nodeVersion = "20" } = options ?? {};
  
  return `image: node:${nodeVersion}

stages:
  - validate
  - test

variables:
${config.requiredVars.map(v => `  ${v}: "\${${v}}"`).join('\n')}

cache:
  paths:
    - node_modules/
    - .pnpm-store/

before_script:
  - corepack enable
  - corepack prepare pnpm@latest --activate
  - pnpm install

validate-env:
  stage: validate
  script:
    - npx nevr-env check
  rules:
    - if: \$CI_PIPELINE_SOURCE == "merge_request_event"
    - if: \$CI_COMMIT_BRANCH == \$CI_DEFAULT_BRANCH

test:
  stage: test
  script:
    - pnpm test
  coverage: /All files[^|]*\\|[^|]*\\s+([\\d\\.]+)/
  rules:
    - if: \$CI_PIPELINE_SOURCE == "merge_request_event"
    - if: \$CI_COMMIT_BRANCH == \$CI_DEFAULT_BRANCH
`;
}

/**
 * Generate CircleCI configuration
 */
export function generateCircleCI(schema: SchemaConfig, options?: {
  nodeVersion?: string;
}): string {
  const config = extractCIConfig(schema);
  const { nodeVersion = "20" } = options ?? {};
  
  return `version: 2.1

orbs:
  node: circleci/node@5.1

executors:
  node-executor:
    docker:
      - image: cimg/node:${nodeVersion}

jobs:
  validate-and-test:
    executor: node-executor
    steps:
      - checkout
      - run:
          name: Setup pnpm
          command: |
            corepack enable
            corepack prepare pnpm@latest --activate
      - node/install-packages:
          pkg-manager: pnpm
      - run:
          name: Validate environment
          command: npx nevr-env check
      - run:
          name: Run tests
          command: pnpm test

workflows:
  main:
    jobs:
      - validate-and-test:
          context:
            - env-secrets  # Create this context with your secrets
`;
}

/**
 * Generate a comprehensive CI configuration based on platform
 */
export function generateCIConfig(
  schema: SchemaConfig,
  platform: "github" | "vercel" | "railway" | "gitlab" | "circleci",
  options?: Record<string, unknown>
): string {
  switch (platform) {
    case "github":
      return generateGitHubActionsWorkflow(schema, options as Parameters<typeof generateGitHubActionsWorkflow>[1]);
    case "vercel":
      return generateVercelConfig(schema);
    case "railway":
      return generateRailwayConfig(schema);
    case "gitlab":
      return generateGitLabCI(schema, options as Parameters<typeof generateGitLabCI>[1]);
    case "circleci":
      return generateCircleCI(schema, options as Parameters<typeof generateCircleCI>[1]);
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}
