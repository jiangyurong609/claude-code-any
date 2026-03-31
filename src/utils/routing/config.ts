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
      plan:      { provider: 'openai', model: 'gpt-5.4-pro' },
      code:      { provider: 'openai', model: 'gpt-5.4-pro' },
      fix:       { provider: 'openai', model: 'gpt-5.4' },
      review:    { provider: 'openai', model: 'gpt-5.4' },
      search:    { provider: 'openai', model: 'gpt-5.4' },
      summarize: { provider: 'openai', model: 'gpt-5.4' },
    },
  },
  cheap: {
    routes: {
      plan:      { provider: 'openai', model: 'gpt-5.4-mini' },
      code:      { provider: 'openai', model: 'gpt-5.4-mini' },
      fix:       { provider: 'openai', model: 'gpt-5.4-mini' },
      review:    { provider: 'openai', model: 'gpt-5.4-nano' },
      search:    { provider: 'openai', model: 'gpt-5.4-nano' },
      summarize: { provider: 'openai', model: 'gpt-5.4-nano' },
    },
  },
  private: {
    routes: {
      plan:      { provider: 'ollama', model: 'qwen3.5', baseURL: 'http://localhost:11434/v1' },
      code:      { provider: 'ollama', model: 'qwen3.5', baseURL: 'http://localhost:11434/v1' },
      fix:       { provider: 'ollama', model: 'qwen3.5', baseURL: 'http://localhost:11434/v1' },
      review:    { provider: 'ollama', model: 'qwen3.5', baseURL: 'http://localhost:11434/v1' },
      search:    { provider: 'ollama', model: 'qwen3.5', baseURL: 'http://localhost:11434/v1' },
      summarize: { provider: 'ollama', model: 'qwen3.5', baseURL: 'http://localhost:11434/v1' },
    },
  },
  balanced: {
    routes: {
      plan:      { provider: 'openai', model: 'gpt-5.4' },
      code:      { provider: 'openai', model: 'gpt-5.4' },
      fix:       { provider: 'openai', model: 'gpt-5.4-mini' },
      review:    { provider: 'openai', model: 'gpt-5.4-mini' },
      search:    { provider: 'openai', model: 'gpt-5.4-nano' },
      summarize: { provider: 'openai', model: 'gpt-5.4-nano' },
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
 *
 * Resolution order (lowest → highest priority):
 *   built-in defaults → global config → user config → project config
 *
 * Supports JSONC (JSON with comments) for all config files.
 * Searches for: .claude-any.jsonc, .claude-any.json, claude-any.json
 */
export function loadRoutingConfig(): RoutingConfig {
  if (cachedConfig) return cachedConfig

  const config = { ...DEFAULT_CONFIG, profiles: { ...DEFAULT_CONFIG.profiles } }

  // Global config: ~/.claude-any/config.jsonc or config.json
  const globalDir = join(homedir(), '.claude-any')
  const globalConfig = loadConfigFromDir(globalDir, ['config.jsonc', 'config.json'])
  if (globalConfig) mergeConfig(config, globalConfig)

  // User config: ~/.config/claude-any/ (XDG standard)
  const xdgDir = join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'claude-any')
  const xdgConfig = loadConfigFromDir(xdgDir, ['config.jsonc', 'config.json'])
  if (xdgConfig) mergeConfig(config, xdgConfig)

  // Project config: cwd/.claude-any.jsonc or .claude-any.json
  const projectConfig = loadConfigFromDir(process.cwd(), [
    '.claude-any.jsonc',
    '.claude-any.json',
    'claude-any.jsonc',
    'claude-any.json',
  ])
  if (projectConfig) mergeConfig(config, projectConfig)

  cachedConfig = config
  return config
}

function mergeConfig(target: RoutingConfig, source: RoutingConfig): void {
  if (source.defaultProfile) target.defaultProfile = source.defaultProfile
  if (source.profiles) {
    for (const [name, profile] of Object.entries(source.profiles)) {
      // Deep merge: merge route-level, not replace entire profile
      if (target.profiles[name]) {
        target.profiles[name] = {
          routes: { ...target.profiles[name].routes, ...profile.routes },
        }
      } else {
        target.profiles[name] = profile
      }
    }
  }
}

function loadConfigFromDir(dir: string, filenames: string[]): RoutingConfig | null {
  for (const filename of filenames) {
    const result = loadConfigFile(join(dir, filename))
    if (result) return result
  }
  return null
}

function loadConfigFile(path: string): RoutingConfig | null {
  try {
    if (!existsSync(path)) return null
    const raw = readFileSync(path, 'utf-8')
    return parseJSONC(raw)
  } catch {
    return null
  }
}

// Parse JSONC (JSON with Comments).
// Strips line comments and block comments before parsing.
function parseJSONC(text: string): any {
  // Remove block comments
  let stripped = text.replace(/\/\*[\s\S]*?\*\//g, '')
  // Remove line comments (but not inside strings)
  stripped = stripped.replace(/(?<!["\w])\/\/.*$/gm, '')
  // Remove trailing commas before } or ]
  stripped = stripped.replace(/,\s*([}\]])/g, '$1')
  return JSON.parse(stripped)
}

/**
 * Reset cached config (for testing).
 */
export function resetConfigCache(): void {
  cachedConfig = null
}
