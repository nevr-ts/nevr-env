import { defineConfig } from 'vitepress'

export default defineConfig({
  base: '/nevr-env/',
  title: 'nevr-env',
  description: 'Type-safe environment validation with plugin system',
  
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/create-env' },
      { text: 'Plugins', link: '/plugins/overview' },
      {
        text: 'Resources',
        items: [
          { text: 'Changelog', link: '/changelog' },
          { text: 'Migration from t3-env', link: '/guide/migration' },
        ]
      }
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'What is nevr-env?', link: '/guide/what-is-nevr-env' },
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Why nevr-env?', link: '/guide/why-nevr-env' },
          ]
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'Schema Validation', link: '/guide/schema-validation' },
            { text: 'Server vs Client', link: '/guide/server-client' },
            { text: 'Plugins', link: '/guide/plugins' },
            { text: 'Auto-Discovery', link: '/guide/auto-discovery' },
          ]
        },
        {
          text: 'Framework Integration',
          items: [
            { text: 'Next.js', link: '/guide/nextjs' },
            { text: 'Vite', link: '/guide/vite' },
            { text: 'Express', link: '/guide/express' },
            { text: 'Hono', link: '/guide/hono' },
          ]
        },
        {
          text: 'Advanced',
          items: [
            { text: 'Validation Modes', link: '/guide/advanced' },
            { text: 'Creating Plugins', link: '/guide/creating-plugins' },
            { text: 'Monorepo Setup', link: '/guide/monorepo' },
            { text: 'Vault (Team Secrets)', link: '/guide/vault' },
            { text: 'CLI Wizard', link: '/guide/cli-wizard' },
            { text: 'Migration from t3-env', link: '/guide/migration' },
          ]
        },
        {
          text: 'Production',
          items: [
            { text: 'Health Checks', link: '/guide/health-check' },
            { text: 'Secret Rotation', link: '/guide/rotation' },
            { text: 'Secret Scanning', link: '/guide/scanning' },
            { text: 'Schema Diffing', link: '/guide/schema-diff' },
            { text: 'Auto-Migration', link: '/guide/auto-migration' },
            { text: 'CI/CD Integration', link: '/guide/ci-cd' },
            { text: 'Audit Logging', link: '/guide/audit-logging' },
          ]
        }
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'createEnv', link: '/api/create-env' },
            { text: 'createPlugin', link: '/api/create-plugin' },
            { text: 'Schema Helpers', link: '/api/schema-helpers' },
            { text: 'Runtime Utilities', link: '/api/runtime' },
          ]
        },
        {
          text: 'Types',
          items: [
            { text: 'EnvOptions', link: '/api/types/env-options' },
            { text: 'NevrEnvPlugin', link: '/api/types/plugin' },
            { text: 'StandardSchema', link: '/api/types/standard-schema' },
          ]
        }
      ],
      '/plugins/': [
        {
          text: 'Official Plugins',
          items: [
            { text: 'Overview', link: '/plugins/overview' },
            { text: 'Auth', link: '/plugins/auth' },
            { text: 'Payment', link: '/plugins/payment' },
            { text: 'Database', link: '/plugins/database' },
            { text: 'AI', link: '/plugins/ai' },
            { text: 'Email', link: '/plugins/email' },
            { text: 'Cloud', link: '/plugins/cloud' },
          ]
        },
        {
          text: 'Presets',
          items: [
            { text: 'Vercel', link: '/plugins/presets/vercel' },
            { text: 'Railway', link: '/plugins/presets/railway' },
            { text: 'Netlify', link: '/plugins/presets/netlify' },
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/nevr-ts/nevr-env' },
      { icon: 'npm', link: 'https://npmjs.com/package/@nevr-env/core' },
    ],

    search: {
      provider: 'local'
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 nevr-env contributors'
    },

    editLink: {
      pattern: 'https://github.com/nevr-ts/nevr-env/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    }
  }
})
