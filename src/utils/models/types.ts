/**
 * Model metadata types, aligned with models.dev schema.
 */

export interface ModelInfo {
  id: string
  name?: string
  family?: string
  provider: string
  release_date?: string
  knowledge?: string

  // Capabilities
  tool_call: boolean
  reasoning: boolean
  attachment: boolean
  structured_output: boolean
  temperature: boolean

  // Modalities
  input?: string[]   // ['text', 'image', 'pdf', 'audio', 'video']
  output?: string[]  // ['text', 'image']

  // Pricing (per 1M tokens, in USD)
  cost?: {
    input: number
    output: number
    cache_read?: number
    cache_write?: number
  }

  // Limits (token counts)
  limit: {
    context: number
    input?: number
    output?: number
  }
}

export interface ModelCatalog {
  models: Record<string, ModelInfo[]>  // provider → models
  fetchedAt: string
  version?: string
}

export interface ResolvedModel {
  info: ModelInfo | null
  id: string
  provider: string
  supportsTools: boolean
  supportsReasoning: boolean
  maxOutputTokens: number
  contextWindow: number
}
