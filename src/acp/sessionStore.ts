/**
 * ACP session persistence.
 * Stores session metadata in ~/.claude-any/acp/sessions/
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { randomUUID } from 'crypto'
import type { SessionRecord } from './types.js'

const SESSIONS_DIR = join(homedir(), '.claude-any', 'acp', 'sessions')

function ensureDir(): void {
  if (!existsSync(SESSIONS_DIR)) {
    mkdirSync(SESSIONS_DIR, { recursive: true })
  }
}

function sessionPath(id: string): string {
  return join(SESSIONS_DIR, `${id}.json`)
}

export function createSession(cwd: string, profile?: string): SessionRecord {
  ensureDir()
  const id = randomUUID()
  const now = new Date().toISOString()
  const session: SessionRecord = {
    id,
    cwd,
    createdAt: now,
    updatedAt: now,
    profile,
    transcriptPath: join(SESSIONS_DIR, `${id}.transcript.jsonl`),
    state: 'idle',
  }
  writeFileSync(sessionPath(id), JSON.stringify(session, null, 2))
  return session
}

export function loadSession(id: string): SessionRecord | null {
  const path = sessionPath(id)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return null
  }
}

export function updateSession(id: string, updates: Partial<SessionRecord>): void {
  const session = loadSession(id)
  if (!session) return
  Object.assign(session, updates, { updatedAt: new Date().toISOString() })
  writeFileSync(sessionPath(id), JSON.stringify(session, null, 2))
}

export function appendTranscript(session: SessionRecord, entry: Record<string, unknown>): void {
  ensureDir()
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n'
  const { appendFileSync } = require('fs')
  appendFileSync(session.transcriptPath, line)
}

export function listSessions(): SessionRecord[] {
  ensureDir()
  const files = readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json') && !f.includes('.transcript.'))
  return files.map(f => {
    try {
      return JSON.parse(readFileSync(join(SESSIONS_DIR, f), 'utf-8'))
    } catch {
      return null
    }
  }).filter(Boolean) as SessionRecord[]
}
