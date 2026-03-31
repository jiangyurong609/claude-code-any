/**
 * Deterministic task classifier using keyword heuristics.
 * Does NOT rewrite user intent — only selects model/provider defaults.
 */

import type { TaskClass } from './types.js'

const PATTERNS: Array<{ taskClass: TaskClass; keywords: string[] }> = [
  { taskClass: 'plan', keywords: ['plan', 'design', 'approach', 'architect', 'strategy', 'proposal', 'rfc'] },
  { taskClass: 'fix', keywords: ['fix', 'bug', 'error', 'failing', 'broken', 'crash', 'debug', 'issue', 'wrong', 'not working'] },
  { taskClass: 'review', keywords: ['review', 'pr', 'audit', 'check', 'inspect', 'critique', 'feedback'] },
  { taskClass: 'search', keywords: ['find', 'search', 'grep', 'where', 'locate', 'which file', 'look for'] },
  { taskClass: 'summarize', keywords: ['summarize', 'explain', 'describe', 'what does', 'how does', 'overview', 'tldr'] },
]

/**
 * Classify a user prompt into a task class.
 * Returns 'code' as the default if no patterns match.
 */
export function classifyTask(prompt: string): TaskClass {
  const lower = prompt.toLowerCase()

  for (const { taskClass, keywords } of PATTERNS) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        return taskClass
      }
    }
  }

  return 'code'
}
