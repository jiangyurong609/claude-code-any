/**
 * Model catalog: fetches, caches, and queries model metadata from models.dev.
 *
 * Features:
 * - Auto-fetches from models.dev/api.json on first use
 * - Caches to ~/.claude-any/models-cache.json
 * - Background hourly refresh
 * - Lazy loading with memoization
 * - Graceful fallback if fetch fails
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { ModelInfo, ModelCatalog, ResolvedModel } from './types.js'

const MODELS_API_URL = 'https://models.dev/api.json'
const CACHE_DIR = join(homedir(), '.claude-any')
const CACHE_FILE = join(CACHE_DIR, 'models-cache.json')
const CACHE_MAX_AGE_MS = 60 * 60 * 1000 // 1 hour
const FETCH_TIMEOUT_MS = 10_000

let catalog: ModelCatalog | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Get the model catalog, fetching if needed.
 */
export async function getModelCatalog(): Promise<ModelCatalog> {
  if (catalog) return catalog

  // Try loading from cache first
  catalog = loadFromCache()
  if (catalog && !isCacheStale(catalog)) return catalog

  // Fetch fresh data (non-blocking if cache exists)
  if (catalog) {
    // Cache exists but stale — use it immediately, refresh in background
    refreshInBackground()
    return catalog
  }

  // No cache — must fetch synchronously
  try {
    catalog = await fetchCatalog()
    saveTocache(catalog)
  } catch (err) {
    // Last resort: return empty catalog
    catalog = { models: {}, fetchedAt: new Date().toISOString() }
  }

  return catalog
}

/**
 * Look up a model by ID across all providers.
 */
export async function resolveModelInfo(modelId: string, providerHint?: string): Promise<ResolvedModel> {
  const cat = await getModelCatalog()
  let info: ModelInfo | null = null

  // Search with provider hint first
  if (providerHint) {
    const providerModels = cat.models[providerHint]
    if (providerModels) {
      info = providerModels.find(m => m.id === modelId) || null
    }
  }

  // Search all providers
  if (!info) {
    for (const [provider, models] of Object.entries(cat.models)) {
      const match = models.find(m => m.id === modelId)
      if (match) {
        info = { ...match, provider }
        break
      }
    }
  }

  // Fuzzy match: try prefix matching (e.g. "gpt-5.4" matches "gpt-5.4-20260305")
  if (!info) {
    for (const [provider, models] of Object.entries(cat.models)) {
      const match = models.find(m => m.id.startsWith(modelId) || modelId.startsWith(m.id))
      if (match) {
        info = { ...match, provider }
        break
      }
    }
  }

  return {
    info,
    id: modelId,
    provider: info?.provider || providerHint || 'unknown',
    supportsTools: info?.tool_call ?? true, // assume true if unknown
    supportsReasoning: info?.reasoning ?? false,
    maxOutputTokens: info?.limit?.output || parseInt(process.env.OPENAI_MAX_TOKENS || '16384', 10),
    contextWindow: info?.limit?.context || 128000,
  }
}

/**
 * Get the max output tokens for a model (used by the adapter).
 */
export async function getModelMaxOutputTokens(modelId: string): Promise<number> {
  const resolved = await resolveModelInfo(modelId)
  return resolved.maxOutputTokens
}

/**
 * Check if a model supports tool calling.
 */
export async function modelSupportsToolCalling(modelId: string): Promise<boolean> {
  const resolved = await resolveModelInfo(modelId)
  return resolved.supportsTools
}

// ─── Cache Management ────────────────────────────────────────────────────────

function loadFromCache(): ModelCatalog | null {
  try {
    if (!existsSync(CACHE_FILE)) return null
    const raw = readFileSync(CACHE_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveTocache(cat: ModelCatalog): void {
  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true })
    writeFileSync(CACHE_FILE, JSON.stringify(cat))
  } catch {
    // Non-critical
  }
}

function isCacheStale(cat: ModelCatalog): boolean {
  if (process.env.OPENCODE_DISABLE_MODELS_FETCH === '1') return false
  try {
    const age = Date.now() - new Date(cat.fetchedAt).getTime()
    return age > CACHE_MAX_AGE_MS
  } catch {
    return true
  }
}

// ─── Fetching ────────────────────────────────────────────────────────────────

async function fetchCatalog(): Promise<ModelCatalog> {
  const resp = await fetch(MODELS_API_URL, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'Accept': 'application/json' },
  })
  if (!resp.ok) throw new Error(`models.dev returned ${resp.status}`)
  const raw = await resp.json() as Record<string, any>

  // Transform raw API response into our catalog format.
  // API shape: { provider_id: { id, name, env, models: { model_id: {...} } } }
  const models: Record<string, ModelInfo[]> = {}
  for (const [providerId, providerData] of Object.entries(raw)) {
    if (!providerData || typeof providerData !== 'object') continue
    const providerModels = providerData.models
    if (!providerModels || typeof providerModels !== 'object') continue

    models[providerId] = Object.values(providerModels).map((m: any) => ({
      id: m.id || '',
      name: m.name,
      family: m.family,
      provider: providerId,
      release_date: m.release_date,
      knowledge: m.knowledge,
      tool_call: m.tool_call ?? false,
      reasoning: m.reasoning ?? false,
      attachment: m.attachment ?? false,
      structured_output: m.structured_output ?? false,
      temperature: m.temperature ?? true,
      input: m.modalities?.input,
      output: m.modalities?.output,
      cost: m.cost ? {
        input: m.cost.input ?? 0,
        output: m.cost.output ?? 0,
        cache_read: m.cost.cache_read,
        cache_write: m.cost.cache_write,
      } : undefined,
      limit: {
        context: m.limit?.context ?? 128000,
        input: m.limit?.input,
        output: m.limit?.output,
      },
    }))
  }

  return {
    models,
    fetchedAt: new Date().toISOString(),
  }
}

function refreshInBackground(): void {
  if (refreshTimer) return
  refreshTimer = setTimeout(async () => {
    try {
      const fresh = await fetchCatalog()
      catalog = fresh
      saveTocache(fresh)
    } catch {
      // Non-critical
    }
    refreshTimer = null
  }, 100) // Start quickly, just non-blocking
}

/**
 * Start periodic background refresh (call once at boot).
 */
export function startPeriodicRefresh(): void {
  if (process.env.OPENCODE_DISABLE_MODELS_FETCH === '1') return
  setInterval(async () => {
    try {
      const fresh = await fetchCatalog()
      catalog = fresh
      saveTocache(fresh)
    } catch {
      // Non-critical
    }
  }, CACHE_MAX_AGE_MS)
}

/**
 * Force refresh (for doctor command).
 */
export async function forceRefresh(): Promise<{ ok: boolean; modelCount: number; error?: string }> {
  try {
    const fresh = await fetchCatalog()
    catalog = fresh
    saveTocache(fresh)
    const count = Object.values(fresh.models).reduce((sum, arr) => sum + arr.length, 0)
    return { ok: true, modelCount: count }
  } catch (err: any) {
    return { ok: false, modelCount: 0, error: err.message }
  }
}
