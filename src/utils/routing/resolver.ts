/**
 * Route resolver: determines which provider/model to use for a given task.
 *
 * Resolution precedence:
 *   1. CLI flags (--model, explicit env OPENAI_MODEL)
 *   2. Route override env (CLAUDE_ANY_ROUTE_MODEL)
 *   3. Named profile + task class
 *   4. Current env defaults
 */

import { classifyTask } from './classifier.js'
import { loadRoutingConfig } from './config.js'
import type { ResolvedExecutionTarget, TaskClass } from './types.js'

/**
 * Resolve the execution target for a prompt.
 */
export function resolveRoute(options: {
  prompt: string
  profileOverride?: string
  routeOverride?: TaskClass
  modelOverride?: string
}): ResolvedExecutionTarget {
  const config = loadRoutingConfig()

  // Determine profile: CLI flag > env > config default
  const profile = options.profileOverride
    || process.env.CLAUDE_ANY_ROUTING_PROFILE
    || config.defaultProfile
    || 'balanced'

  // Determine task class: CLI flag > classifier
  const routeClass = options.routeOverride || classifyTask(options.prompt)

  // Look up route in profile
  const profileConfig = config.profiles[profile]
  const route = profileConfig?.routes[routeClass]

  // If we have a route, use it
  if (route) {
    return {
      provider: route.provider === 'ollama' ? 'openai-compatible' : (
        route.provider === 'openai' ? 'openai-compatible' :
        route.provider === 'anthropic' ? 'anthropic' : 'openai-compatible'
      ),
      model: options.modelOverride || route.model,
      baseURL: route.baseURL || process.env.OPENAI_BASE_URL,
      apiKeyEnv: route.apiKeyEnv,
      routeClass,
      profile,
    }
  }

  // Fallback: use current env settings
  const isOpenAI = process.env.CLAUDE_CODE_USE_OPENAI === '1'
  return {
    provider: isOpenAI ? 'openai-compatible' : 'anthropic',
    model: options.modelOverride || process.env.OPENAI_MODEL || process.env.ANTHROPIC_MODEL || 'gpt-4o',
    baseURL: process.env.OPENAI_BASE_URL,
    routeClass,
    profile,
  }
}

/**
 * Apply a resolved route to the environment.
 * This sets env vars so the existing client.ts / providers.ts flow picks them up.
 */
export function applyRoute(target: ResolvedExecutionTarget): void {
  if (target.provider === 'openai-compatible') {
    process.env.CLAUDE_CODE_USE_OPENAI = '1'
    if (target.model) process.env.OPENAI_MODEL = target.model
    if (target.baseURL) process.env.OPENAI_BASE_URL = target.baseURL
    if (target.apiKeyEnv) {
      const key = process.env[target.apiKeyEnv]
      if (key) process.env.OPENAI_API_KEY = key
    }
  } else {
    // Anthropic - clear OpenAI flags
    delete process.env.CLAUDE_CODE_USE_OPENAI
    if (target.model) process.env.ANTHROPIC_MODEL = target.model
  }

  // Debug logging
  if (process.env.CLAUDE_ANY_DEBUG_ROUTING === '1') {
    process.stderr.write(
      `[routing] profile=${target.profile} route=${target.routeClass} ` +
      `provider=${target.provider} model=${target.model}` +
      (target.baseURL ? ` baseURL=${target.baseURL}` : '') +
      '\n',
    )
  }
}

/**
 * Write a run manifest for observability.
 */
export function writeRunManifest(target: ResolvedExecutionTarget): void {
  const logDir = process.env.CLAUDE_ANY_RUN_LOG_DIR
  if (!logDir) return

  try {
    const fs = require('fs')
    const path = require('path')
    fs.mkdirSync(logDir, { recursive: true })
    const manifest = {
      timestamp: new Date().toISOString(),
      profile: target.profile,
      routeClass: target.routeClass,
      provider: target.provider,
      model: target.model,
      baseURL: target.baseURL || null,
    }
    const file = path.join(logDir, `run-${Date.now()}.json`)
    fs.writeFileSync(file, JSON.stringify(manifest, null, 2))
  } catch {
    // Non-critical, silently ignore
  }
}
