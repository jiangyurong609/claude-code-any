/**
 * ACP stdio server for claude-code-any.
 *
 * Implements a JSON-RPC 2.0 server over stdin/stdout that speaks ACP.
 * Used with: acpx --agent "claude-any acp --stdio"
 *
 * Protocol:
 *   stdin  ← JSON-RPC requests (one per line)
 *   stdout → JSON-RPC responses + notifications (one per line)
 *   stderr → debug logs
 */

import { createInterface } from 'readline'
import { randomUUID } from 'crypto'
import type { AcpRequest, AcpResponse, AcpNotification, AcpEvent } from './types.js'
import { createSession, updateSession, appendTranscript, loadSession } from './sessionStore.js'

function send(msg: AcpResponse | AcpNotification): void {
  process.stdout.write(JSON.stringify(msg) + '\n')
}

function sendResult(id: string | number, result: unknown): void {
  send({ jsonrpc: '2.0', id, result })
}

function sendError(id: string | number | null, code: number, message: string): void {
  send({ jsonrpc: '2.0', id, error: { code, message } })
}

function sendNotification(method: string, params: Record<string, unknown>): void {
  send({ jsonrpc: '2.0', method, params })
}

/**
 * Handle a single JSON-RPC request.
 */
async function handleRequest(req: AcpRequest): Promise<void> {
  switch (req.method) {
    case 'initialize': {
      sendResult(req.id, {
        name: 'claude-code-any',
        version: '2.1.88',
        capabilities: {
          streaming: true,
          tools: true,
          sessions: true,
        },
      })
      break
    }

    case 'session.create': {
      const cwd = (req.params?.cwd as string) || process.cwd()
      const profile = req.params?.profile as string | undefined
      const session = createSession(cwd, profile)
      sendResult(req.id, { sessionId: session.id })
      break
    }

    case 'session.list': {
      const { listSessions } = await import('./sessionStore.js')
      const sessions = listSessions()
      sendResult(req.id, { sessions })
      break
    }

    case 'prompt': {
      const sessionId = req.params?.sessionId as string
      const prompt = req.params?.prompt as string
      const profile = req.params?.profile as string | undefined

      if (!prompt) {
        sendError(req.id, -32602, 'Missing "prompt" parameter')
        return
      }

      // Create or reuse session
      let session = sessionId ? loadSession(sessionId) : null
      if (!session) {
        session = createSession(process.cwd(), profile)
      }

      updateSession(session.id, { state: 'running' })
      appendTranscript(session, { role: 'user', content: prompt })

      // Send session info
      sendNotification('session.info', { sessionId: session.id })

      // Execute using the CLI print path (subprocess)
      try {
        const env: Record<string, string> = { ...process.env as any }
        if (profile) {
          env.CLAUDE_ANY_PROFILE = profile
        }

        const proc = Bun.spawn(
          [process.execPath, process.argv[1]!, '--dangerously-skip-permissions', '--print', prompt],
          {
            env,
            cwd: session.cwd,
            stdout: 'pipe',
            stderr: 'pipe',
          },
        )

        // Stream stdout as text_delta events
        const reader = proc.stdout.getReader()
        const decoder = new TextDecoder()
        let fullText = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const text = decoder.decode(value, { stream: true })
          fullText += text
          sendNotification('event', {
            sessionId: session.id,
            event: { type: 'text_delta', text },
          })
        }

        const exitCode = await proc.exited
        const stderr = await new Response(proc.stderr).text()

        if (exitCode === 0) {
          sendNotification('event', {
            sessionId: session.id,
            event: { type: 'turn_complete', stop_reason: 'end_turn' },
          })
          appendTranscript(session, { role: 'assistant', content: fullText })
          updateSession(session.id, { state: 'idle' })
          sendResult(req.id, { sessionId: session.id, text: fullText })
        } else {
          sendNotification('event', {
            sessionId: session.id,
            event: { type: 'error', message: stderr || `Exit code ${exitCode}` },
          })
          updateSession(session.id, { state: 'failed' })
          sendError(req.id, -32000, stderr || `Process exited with code ${exitCode}`)
        }
      } catch (err: any) {
        updateSession(session.id, { state: 'failed' })
        sendError(req.id, -32000, err.message || String(err))
      }
      break
    }

    case 'shutdown': {
      sendResult(req.id, { ok: true })
      process.exit(0)
    }

    default: {
      sendError(req.id, -32601, `Unknown method: ${req.method}`)
    }
  }
}

/**
 * Start the ACP stdio server.
 */
export async function startAcpServer(): Promise<void> {
  process.stderr.write('[acp] claude-code-any ACP server started\n')

  const rl = createInterface({ input: process.stdin })

  rl.on('line', async (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return

    try {
      const req = JSON.parse(trimmed) as AcpRequest
      if (!req.jsonrpc || req.jsonrpc !== '2.0' || !req.method) {
        sendError(req.id ?? null, -32600, 'Invalid JSON-RPC request')
        return
      }
      await handleRequest(req)
    } catch (err: any) {
      sendError(null, -32700, `Parse error: ${err.message}`)
    }
  })

  rl.on('close', () => {
    process.exit(0)
  })
}
