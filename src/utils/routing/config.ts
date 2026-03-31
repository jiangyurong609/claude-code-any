/**
 * Routing config loading and built-in presets.
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { RoutingConfig, RoutingProfileConfig } from './types.js'

const BUILT_IN_PROFILES: Record<string, RoutingProfileConfig> = {
  best: {
    routes: {
      plan:      { provider: 'openai', model: 'gpt-4.1' },
      code:      { provider: 'openai', model: 'gpt-4.1' },
      fix:       { provider: 'openai', model: 'gpt-4.1' },
      review:    { provider: 'openai', model: 'gpt-4.1' },
      search:    { provider: 'openai', model: 'gpt-4.1' },
      summarize: { provider: 'openai', model: 'gpt-4.1' },
    },
  },
  cheap: {
    routes: {
      plan:      { provider: 'openai', model: 'gpt-4.1-mini' },
      code:      { provider: 'openai', model: 'gpt-4.1-mini' },
      fix:       { provider: 'openai', model: 'gpt-4.1-mini' },
      review:    { provider: 'openai', model: 'gpt-4.1-mini' },
      search:    { provider: 'openai', model: 'gpt-4.1-mini' },
      summarize: { provider: 'openai', model: 'gpt-4.1-mini' },
    },
  },
  private: {
    routes: {
      plan:      { provider: 'ollama', model: 'qwen2.5-coder', baseURL: 'http://localhost:11434/v1' },
      code:      { provider: 'ollama', model: 'qwen2.5-coder', baseURL: 'http://localhost:11434/v1' },
      fix:       { provider: 'ollama', model: 'qwen2.5-coder', baseURL: 'http://localhost:11434/v1' },
      review:    { provider: 'ollama', model: 'qwen2.5-coder', baseURL: 'http://localhost:11434/v1' },
      search:    { provider: 'ollama', model: 'qwen2.5-coder', baseURL: 'http://localhost:11434/v1' },
      summarize: { provider: 'ollama', model: 'qwen2.5-coder', baseURL: 'http://localhost:11434/v1' },
    },
  },
  balanced: {
    routes: {
      plan:      { provider: 'openai', model: 'gpt-4.1' },
      code:      { provider: 'openai', model: 'gpt-4.1' },
      fix:       { provider: 'openai', model: 'gpt-4.1-mini' },
      review:    { provider: 'openai', model: 'gpt-4.1-mini' },
      search:    { provider: 'openai', model: 'gpt-4.1-mini' },
      summarize: { provider: 'openai', model: 'gpt-4.1-mini' },
    },
  },
}

const DEFAULT_CONFIG: RoutingConfig = {
  defaultProfile: 'balanced',
  profiles: BUILT_IN_PROFILES,
}

let cachedConfig: RoutingConfig | null = null

/**
 * Load routing config from file system, merged with built-in defaults.
 * Resolution order: project (.claude-any.json) > global (~/.claude-any/config.json) > built-in
 */
export function loadRoutingConfig(): RoutingConfig {
  if (cachedConfig) return cachedConfig

  const config = { ...DEFAULT_CONFIG, profiles: { ...DEFAULT_CONFIG.profiles } }

  // Load global config
  const globalPath = join(homedir(), '.claude-any', 'config.json')
  const globalConfig = loadConfigFile(globalPath)
  if (globalConfig) {
    if (globalConfig.defaultProfile) config.defaultProfile = globalConfig.defaultProfile
    if (globalConfig.profiles) {
      for (const [name, profile] of Object.entries(globalConfig.profiles)) {
        config.profiles[name] = profile
      }
    }
  }

  // Load project config (overrides global)
  const projectPath = join(process.cwd(), '.claude-any.json')
  const projectConfig = loadConfigFile(projectPath)
  if (projectConfig) {
    if (projectConfig.defaultProfile) config.defaultProfile = projectConfig.defaultProfile
    if (projectConfig.profiles) {
      for (const [name, profile] of Object.entries(projectConfig.profiles)) {
        config.profiles[name] = profile
      }
    }
  }

  cachedConfig = config
  return config
}

function loadConfigFile(path: string): RoutingConfig | null {
  try {
    if (!existsSync(path)) return null
    const raw = readFileSync(path, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Reset cached config (for testing).
 */
export function resetConfigCache(): void {
  cachedConfig = null
}
