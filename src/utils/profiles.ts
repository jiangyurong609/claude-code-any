/**
 * Provider profiles for claude-code-any.
 * Sets env var defaults based on CLAUDE_ANY_PROFILE, then lets explicit env vars override.
 */

export type ProfileName =
  | 'anthropic'
  | 'openai'
  | 'ollama'
  | 'lmstudio'
  | 'vllm'
  | 'together'
  | 'groq'
  | 'deepseek'
  | 'kimi'
  | 'openrouter'
  | 'xai'
  | 'mistral'
  | 'custom'

const PROFILES: Record<ProfileName, Record<string, string>> = {
  anthropic: {},
  openai: {
    CLAUDE_CODE_USE_OPENAI: '1',
    OPENAI_BASE_URL: 'https://api.openai.com/v1',
    OPENAI_MODEL: 'gpt-5.4',
  },
  ollama: {
    CLAUDE_CODE_USE_OPENAI: '1',
    OPENAI_BASE_URL: 'http://localhost:11434/v1',
    OPENAI_MODEL: 'qwen3.5',
    OPENAI_API_KEY: '',
    OPENAI_MAX_TOKENS: '4096',
  },
  lmstudio: {
    CLAUDE_CODE_USE_OPENAI: '1',
    OPENAI_BASE_URL: 'http://localhost:1234/v1',
    OPENAI_MODEL: 'local-model',
    OPENAI_API_KEY: '',
    OPENAI_MAX_TOKENS: '4096',
  },
  vllm: {
    CLAUDE_CODE_USE_OPENAI: '1',
    OPENAI_BASE_URL: 'http://localhost:8000/v1',
    OPENAI_MODEL: 'default',
    OPENAI_API_KEY: '',
  },
  together: {
    CLAUDE_CODE_USE_OPENAI: '1',
    OPENAI_BASE_URL: 'https://api.together.xyz/v1',
    OPENAI_MODEL: 'Qwen/Qwen3.5-72B',
  },
  groq: {
    CLAUDE_CODE_USE_OPENAI: '1',
    OPENAI_BASE_URL: 'https://api.groq.com/openai/v1',
    OPENAI_MODEL: 'llama-3.3-70b-versatile',
    OPENAI_MAX_TOKENS: '8192',
  },
  deepseek: {
    CLAUDE_CODE_USE_OPENAI: '1',
    OPENAI_BASE_URL: 'https://api.deepseek.com/v1',
    OPENAI_MODEL: 'deepseek-chat',
  },
  kimi: {
    CLAUDE_CODE_USE_OPENAI: '1',
    OPENAI_BASE_URL: 'https://api.moonshot.cn/v1',
    OPENAI_MODEL: 'kimi-k2.5',
  },
  openrouter: {
    CLAUDE_CODE_USE_OPENAI: '1',
    OPENAI_BASE_URL: 'https://openrouter.ai/api/v1',
    OPENAI_MODEL: 'openai/gpt-5.4',
  },
  xai: {
    CLAUDE_CODE_USE_OPENAI: '1',
    OPENAI_BASE_URL: 'https://api.x.ai/v1',
    OPENAI_MODEL: 'grok-4.20-beta',
  },
  mistral: {
    CLAUDE_CODE_USE_OPENAI: '1',
    OPENAI_BASE_URL: 'https://api.mistral.ai/v1',
    OPENAI_MODEL: 'mistral-small-latest',
  },
  custom: {
    CLAUDE_CODE_USE_OPENAI: '1',
  },
}

export const PROFILE_NAMES = Object.keys(PROFILES) as ProfileName[]

/**
 * Auto-detect OpenClaw's native LLM API keys and bridge them to claude-any config.
 *
 * OpenClaw sets standard env vars (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)
 * and OpenClaw-specific ones (OPENCLAW_LIVE_OPENAI_KEY, TOGETHER_API_KEY, etc.).
 * This function detects them and auto-configures the provider.
 *
 * Priority:
 *   1. Explicit CLAUDE_ANY_PROFILE (user chose a profile)
 *   2. CLAUDE_CODE_USE_OPENAI already set (user configured manually)
 *   3. Auto-detect from OpenClaw env vars
 */
function autoDetectOpenClawKeys(): void {
  // Skip if user already configured explicitly
  if (process.env.CLAUDE_ANY_PROFILE || process.env.CLAUDE_CODE_USE_OPENAI) return

  // OpenClaw-specific "live" keys (highest priority for auto-detect)
  if (process.env.OPENCLAW_LIVE_OPENAI_KEY && !process.env.OPENAI_API_KEY) {
    process.env.OPENAI_API_KEY = process.env.OPENCLAW_LIVE_OPENAI_KEY
  }
  if (process.env.OPENCLAW_LIVE_ANTHROPIC_KEY && !process.env.ANTHROPIC_API_KEY) {
    process.env.ANTHROPIC_API_KEY = process.env.OPENCLAW_LIVE_ANTHROPIC_KEY
  }

  // Auto-detect provider from available keys (if no Anthropic key and no explicit config)
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    // Try providers in preference order
    const autoProviders: Array<{
      keyVar: string
      altKeyVars?: string[]
      profile: ProfileName
      baseURL?: string
    }> = [
      { keyVar: 'OPENAI_API_KEY', profile: 'openai' },
      { keyVar: 'OPENROUTER_API_KEY', profile: 'custom', baseURL: 'https://openrouter.ai/api/v1' },
      { keyVar: 'TOGETHER_API_KEY', profile: 'together' },
      { keyVar: 'DEEPSEEK_API_KEY', profile: 'custom', baseURL: 'https://api.deepseek.com/v1' },
      { keyVar: 'MISTRAL_API_KEY', profile: 'custom', baseURL: 'https://api.mistral.ai/v1' },
      { keyVar: 'XAI_API_KEY', profile: 'custom', baseURL: 'https://api.x.ai/v1' },
    ]

    for (const { keyVar, altKeyVars, profile, baseURL } of autoProviders) {
      const key = process.env[keyVar] || altKeyVars?.map(v => process.env[v]).find(Boolean)
      if (key) {
        process.env.CLAUDE_CODE_USE_OPENAI = '1'
        if (!process.env.OPENAI_API_KEY) process.env.OPENAI_API_KEY = key
        if (baseURL && !process.env.OPENAI_BASE_URL) process.env.OPENAI_BASE_URL = baseURL
        // Apply profile defaults for model etc.
        const profileDefaults = PROFILES[profile]
        if (profileDefaults) {
          for (const [k, v] of Object.entries(profileDefaults)) {
            if (process.env[k] === undefined) process.env[k] = v
          }
        }
        return
      }
    }

    // Check for Ollama (local, no key needed) — detect by OLLAMA_HOST or common port
    if (process.env.OLLAMA_HOST || process.env.OLLAMA_API_KEY) {
      process.env.CLAUDE_CODE_USE_OPENAI = '1'
      process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
      const host = process.env.OLLAMA_HOST || 'http://localhost:11434'
      if (!process.env.OPENAI_BASE_URL) process.env.OPENAI_BASE_URL = `${host}/v1`
      if (!process.env.OPENAI_MODEL) process.env.OPENAI_MODEL = 'llama3'
      if (!process.env.OPENAI_MAX_TOKENS) process.env.OPENAI_MAX_TOKENS = '4096'
      return
    }
  }
}

/**
 * Apply CLAUDE_ANY_PROFILE defaults to process.env.
 * Only sets env vars that are NOT already set, so explicit values always win.
 * Must be called very early in the boot sequence.
 */
export function applyProfile(): void {
  // First: auto-detect OpenClaw's native API keys
  autoDetectOpenClawKeys()

  const profileName = process.env.CLAUDE_ANY_PROFILE?.toLowerCase()
  if (!profileName) return

  const profile = PROFILES[profileName as ProfileName]
  if (!profile) {
    process.stderr.write(
      `Warning: Unknown profile "${profileName}". Valid profiles: ${PROFILE_NAMES.join(', ')}\n`,
    )
    return
  }

  for (const [key, value] of Object.entries(profile)) {
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

/**
 * Get the currently active profile name (if any).
 */
export function getActiveProfile(): ProfileName | null {
  const name = process.env.CLAUDE_ANY_PROFILE?.toLowerCase()
  if (!name) return null
  return PROFILE_NAMES.includes(name as ProfileName) ? (name as ProfileName) : null
}

/**
 * Get the resolved provider configuration for diagnostics.
 */
export function getResolvedConfig(): {
  profile: string
  provider: string
  baseUrl: string
  model: string
  apiKeyPresent: boolean
  maxTokens: string
} {
  const profile = getActiveProfile() || (process.env.CLAUDE_CODE_USE_OPENAI ? 'custom' : 'anthropic')
  const isOpenAI = process.env.CLAUDE_CODE_USE_OPENAI === '1'

  return {
    profile,
    provider: isOpenAI ? 'openai-compatible' : (
      process.env.CLAUDE_CODE_USE_BEDROCK ? 'bedrock' :
      process.env.CLAUDE_CODE_USE_VERTEX ? 'vertex' :
      process.env.CLAUDE_CODE_USE_FOUNDRY ? 'foundry' : 'anthropic'
    ),
    baseUrl: isOpenAI
      ? (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1')
      : (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com'),
    model: isOpenAI
      ? (process.env.OPENAI_MODEL || process.env.ANTHROPIC_MODEL || 'gpt-4o')
      : (process.env.ANTHROPIC_MODEL || '(default)'),
    apiKeyPresent: isOpenAI
      ? !!process.env.OPENAI_API_KEY
      : !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
    maxTokens: process.env.OPENAI_MAX_TOKENS || '16384',
  }
}

/**
 * Dump all relevant env vars with API keys redacted.
 */
export function getRedactedEnvDump(): string {
  const vars = [
    'CLAUDE_ANY_PROFILE',
    'CLAUDE_CODE_USE_OPENAI',
    'CLAUDE_CODE_USE_BEDROCK',
    'CLAUDE_CODE_USE_VERTEX',
    'CLAUDE_CODE_USE_FOUNDRY',
    'OPENAI_API_KEY',
    'OPENAI_BASE_URL',
    'OPENAI_MODEL',
    'OPENAI_MAX_TOKENS',
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_AUTH_TOKEN',
    'ANTHROPIC_BASE_URL',
    'ANTHROPIC_MODEL',
    'API_TIMEOUT_MS',
    'AWS_REGION',
    'AWS_DEFAULT_REGION',
    'CLOUD_ML_REGION',
    'ANTHROPIC_VERTEX_PROJECT_ID',
    // OpenClaw native keys (auto-detected)
    'OPENCLAW_LIVE_OPENAI_KEY',
    'OPENCLAW_LIVE_ANTHROPIC_KEY',
    'OPENCLAW_STATE_DIR',
    'OPENROUTER_API_KEY',
    'TOGETHER_API_KEY',
    'DEEPSEEK_API_KEY',
    'MISTRAL_API_KEY',
    'XAI_API_KEY',
    'OLLAMA_HOST',
  ]

  const lines: string[] = []
  for (const key of vars) {
    const val = process.env[key]
    if (val === undefined) {
      lines.push(`  ${key}: (not set)`)
    } else if (key.includes('KEY') || key.includes('TOKEN')) {
      // Redact secrets
      if (val.length > 8) {
        lines.push(`  ${key}: ${val.slice(0, 4)}...${val.slice(-4)}`)
      } else if (val.length > 0) {
        lines.push(`  ${key}: ****`)
      } else {
        lines.push(`  ${key}: (empty)`)
      }
    } else {
      lines.push(`  ${key}: ${val}`)
    }
  }
  return lines.join('\n')
}
