/**
 * ACP (Agent Communication Protocol) types for claude-code-any.
 * Based on the structured messaging protocol used by acpx.
 */

export interface AcpRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: Record<string, unknown>
}

export interface AcpResponse {
  jsonrpc: '2.0'
  id: string | number | null
  result?: unknown
  error?: AcpError
}

export interface AcpError {
  code: number
  message: string
  data?: unknown
}

export interface AcpNotification {
  jsonrpc: '2.0'
  method: string
  params?: Record<string, unknown>
}

// ACP event types for streaming
export type AcpEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_call_begin'; id: string; name: string }
  | { type: 'tool_call_delta'; id: string; arguments: string }
  | { type: 'tool_call_end'; id: string }
  | { type: 'tool_result'; id: string; content: string }
  | { type: 'turn_complete'; stop_reason: string }
  | { type: 'error'; message: string; code?: number }
  | { type: 'routing_info'; profile: string; routeClass: string; provider: string; model: string }

export interface SessionRecord {
  id: string
  cwd: string
  createdAt: string
  updatedAt: string
  profile?: string
  routeProfile?: string
  transcriptPath: string
  state: 'idle' | 'running' | 'failed'
}
