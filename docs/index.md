---
layout: home

hero:
  name: nevr-env
  text: Type-Safe Environment Variables
  tagline: Powerful validation, plugin ecosystem, auto-discovery, and developer-friendly CLI
  image:
    src: /nevr-env.png
    alt: nevr-env
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Why nevr-env?
      link: /guide/why-nevr-env
    - theme: alt
      text: View on GitHub
      link: https://github.com/nevr-ts/nevr-env

features:
  - icon: 🔒
    title: Type-Safe Validation
    details: Full TypeScript inference with Standard Schema V1 support. Works with Zod, Valibot, ArkType, and more.
  - icon: 🔌
    title: Plugin Ecosystem
    details: Pre-built plugins for PostgreSQL, Stripe, Redis, OpenAI, and more. Each handles validation and auto-discovery.
  - icon: �
    title: Encrypted Vault
    details: Share secrets with your team securely. Encrypted vault file in git, key stays with developers.
  - icon: 🔍
    title: Auto-Discovery
    details: Automatically detect database URLs from Docker containers, config files, and local services.
  - icon: 🖥️
    title: Interactive CLI
    details: Wizard-based setup to guide you through configuring environment variables with built-in validation.
  - icon: ⚡
    title: Framework Agnostic
    details: Works with Next.js, Vite, Express, Hono, Bun, Deno, and any Node.js project.
---

<style>
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: -webkit-linear-gradient(120deg, #10b981 30%, #3b82f6);

  --vp-home-hero-image-background-image: linear-gradient(-45deg, #10b981 50%, #3b82f6 50%);
  --vp-home-hero-image-filter: blur(44px);
}

@media (min-width: 640px) {
  :root {
    --vp-home-hero-image-filter: blur(56px);
  }
}

@media (min-width: 960px) {
  :root {
    --vp-home-hero-image-filter: blur(68px);
  }
}
@media (min-width: 600px) {
 .image-container img{
  max-width: 100%!important;
  height: auto;
  margin-top: 2rem;
   box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}}
.heading>.text{
  font-size: 3rem!important;
}
</style>
