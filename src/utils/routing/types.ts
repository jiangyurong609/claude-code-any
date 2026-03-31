/**
 * Types for the task routing system.
 */

export type TaskClass = 'plan' | 'code' | 'fix' | 'review' | 'search' | 'summarize'

export type RoutingProfile = 'best' | 'cheap' | 'private' | 'balanced'

export interface RouteTarget {
  provider: string
  model: string
  baseURL?: string
  apiKeyEnv?: string
}

export interface RoutingProfileConfig {
  routes: Partial<Record<TaskClass, RouteTarget>>
}

export interface RoutingConfig {
  defaultProfile: string
  profiles: Record<string, RoutingProfileConfig>
}

export interface ResolvedExecutionTarget {
  provider: 'anthropic' | 'openai-compatible'
  model: string
  baseURL?: string
  apiKeyEnv?: string
  routeClass: TaskClass
  profile: string
}
