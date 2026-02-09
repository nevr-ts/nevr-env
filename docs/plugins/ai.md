# AI Namespace

The `ai` namespace provides AI/LLM service providers.

```ts
import { ai } from "nevr-env/plugins";
```

## Providers

| Provider | Description |
|----------|-------------|
| `ai.openai()` | OpenAI - GPT, DALL-E, Whisper, Embeddings |

---

## OpenAI

Full-featured OpenAI integration with organization support, Azure OpenAI, and model configuration.

### Basic Usage

```ts
import { createEnv } from "nevr-env";
import { ai } from "nevr-env/plugins";

const env = createEnv({
  plugins: [ai.openai()],
  runtimeEnv: process.env,
});

// env.OPENAI_API_KEY
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `organization` | `boolean` | `false` | Include organization ID |
| `project` | `boolean` | `false` | Include project ID |
| `model` | `boolean` | `false` | Include model configuration |
| `defaultModel` | `string` | `"gpt-4o"` | Default model name |
| `azure` | `boolean` | `false` | Include Azure OpenAI config |
| `baseUrl` | `boolean` | `false` | Include custom base URL |
| `embedding` | `boolean` | `false` | Include embedding model config |
| `parameters` | `boolean` | `false` | Include default parameters |
| `variableNames` | `object` | - | Custom variable names |
| `extend` | `object` | - | Extend schema with custom fields |

### Environment Variables by Option

#### Default (no options)

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `OPENAI_API_KEY` | ✅ | `sk-*` | OpenAI API key |

#### `organization: true`

| Variable | Required | Format | Description |
|----------|----------|--------|-------------|
| `OPENAI_ORG_ID` | ❌ | `org-*` | Organization ID |

#### `project: true`

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_PROJECT_ID` | ❌ | Project ID for newer OpenAI projects |

#### `model: true`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_MODEL` | ❌ | `gpt-4o` | Default model to use |

Supported models:
- `gpt-4o`, `gpt-4o-mini`
- `gpt-4-turbo`, `gpt-4`
- `gpt-3.5-turbo`
- `o1`, `o1-mini`, `o1-preview`

#### `azure: true`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AZURE_OPENAI_ENDPOINT` | ✅ | - | Azure OpenAI endpoint URL |
| `AZURE_OPENAI_API_VERSION` | ❌ | `2024-02-01` | API version |
| `AZURE_OPENAI_DEPLOYMENT` | ❌ | - | Deployment name |

#### `baseUrl: true`

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_BASE_URL` | ❌ | Custom base URL (proxies, alternative endpoints) |

#### `embedding: true`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_EMBEDDING_MODEL` | ❌ | `text-embedding-3-small` | Embedding model |

#### `parameters: true`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_MAX_TOKENS` | ❌ | `4096` | Maximum tokens per request |
| `OPENAI_TEMPERATURE` | ❌ | `0.7` | Sampling temperature (0-2) |

### Examples

```ts
// With organization and model selection
ai.openai({
  organization: true,
  model: true,
  defaultModel: "gpt-4o",
})

// Azure OpenAI
ai.openai({
  azure: true,
})

// RAG application with embeddings
ai.openai({
  model: true,
  embedding: true,
  parameters: true,
})

// With custom OpenAI-compatible endpoint
ai.openai({
  baseUrl: true,
})

// Extend with assistant configuration
ai.openai({
  extend: {
    OPENAI_ASSISTANT_ID: z.string().startsWith("asst_"),
    OPENAI_VECTOR_STORE_ID: z.string().startsWith("vs_").optional(),
    OPENAI_THREAD_ID: z.string().startsWith("thread_").optional(),
  }
})
```

### Integration Example

```ts
// env.ts
import { createEnv } from "nevr-env";
import { ai } from "nevr-env/plugins";

export const env = createEnv({
  plugins: [
    ai.openai({
      organization: true,
      model: true,
    }),
  ],
  runtimeEnv: process.env,
});

// openai.ts
import OpenAI from "openai";
import { env } from "./env";

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  organization: env.OPENAI_ORG_ID,
});

// chat.ts
import { env } from "./env";
import { openai } from "./openai";

export async function chat(prompt: string) {
  const response = await openai.chat.completions.create({
    model: env.OPENAI_MODEL ?? "gpt-4o",
    messages: [{ role: "user", content: prompt }],
  });
  return response.choices[0].message.content;
}
```

### Azure OpenAI Example

```ts
// env.ts
import { createEnv } from "nevr-env";
import { ai } from "nevr-env/plugins";

export const env = createEnv({
  plugins: [
    ai.openai({ azure: true }),
  ],
  runtimeEnv: process.env,
});

// azure-openai.ts
import { AzureOpenAI } from "openai";
import { env } from "./env";

export const openai = new AzureOpenAI({
  endpoint: env.AZURE_OPENAI_ENDPOINT,
  apiVersion: env.AZURE_OPENAI_API_VERSION,
  deployment: env.AZURE_OPENAI_DEPLOYMENT,
});
```
