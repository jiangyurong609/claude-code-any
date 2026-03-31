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
  | 'custom'

const PROFILES: Record<ProfileName, Record<string, string>> = {
  anthropic: {},
  openai: {
    CLAUDE_CODE_USE_OPENAI: '1',
    OPENAI_BASE_URL: 'https://api.openai.com/v1',
    OPENAI_MODEL: 'gpt-4.1',
  },
  ollama: {
    CLAUDE_CODE_USE_OPENAI: '1',
    OPENAI_BASE_URL: 'http://localhost:11434/v1',
    OPENAI_MODEL: 'llama3',
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
    OPENAI_MODEL: 'meta-llama/Llama-3-70b-chat-hf',
  },
  groq: {
    CLAUDE_CODE_USE_OPENAI: '1',
    OPENAI_BASE_URL: 'https://api.groq.com/openai/v1',
    OPENAI_MODEL: 'llama-3.3-70b-versatile',
    OPENAI_MAX_TOKENS: '8192',
  },
  custom: {
    CLAUDE_CODE_USE_OPENAI: '1',
  },
}

export const PROFILE_NAMES = Object.keys(PROFILES) as ProfileName[]

/**
 * Apply CLAUDE_ANY_PROFILE defaults to process.env.
 * Only sets env vars that are NOT already set, so explicit values always win.
 * Must be called very early in the boot sequence.
 */
export function applyProfile(): void {
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
