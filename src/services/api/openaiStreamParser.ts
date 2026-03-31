/**
 * SSE (Server-Sent Events) parser for OpenAI-compatible streaming responses.
 * Parses a ReadableStream<Uint8Array> into parsed JSON chunks.
 */

export interface OpenAIChatCompletionChunk {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: string
      content?: string | null
      tool_calls?: Array<{
        index: number
        id?: string
        type?: string
        function?: {
          name?: string
          arguments?: string
        }
      }>
    }
    finish_reason: string | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  } | null
}

/**
 * Parse an SSE stream from an OpenAI-compatible API into chat completion chunks.
 * Includes per-chunk idle timeout (borrowed from OpenCode's approach) to detect
 * stalled streams that would otherwise hang indefinitely.
 *
 * @param body - ReadableStream from fetch response
 * @param chunkTimeoutMs - Max ms to wait between chunks before aborting (default: 60s)
 */
export async function* parseSSEStream(
  body: ReadableStream<Uint8Array>,
  chunkTimeoutMs: number = parseInt(process.env.OPENAI_CHUNK_TIMEOUT_MS || '60000', 10),
): AsyncGenerator<OpenAIChatCompletionChunk> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      // Per-chunk timeout: abort if no data arrives within the window
      const readPromise = reader.read()
      const timeoutPromise = chunkTimeoutMs > 0
        ? new Promise<{ done: true; value: undefined }>((_, reject) =>
            setTimeout(() => reject(new Error(`Stream stalled: no data received for ${chunkTimeoutMs}ms`)), chunkTimeoutMs),
          )
        : null
      const { done, value } = await (timeoutPromise
        ? Promise.race([readPromise, timeoutPromise])
        : readPromise)
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Split on double newlines (SSE event boundary)
      const parts = buffer.split('\n\n')
      // Keep the last incomplete part in the buffer
      buffer = parts.pop() || ''

      for (const part of parts) {
        const trimmed = part.trim()
        if (!trimmed) continue

        // Extract data lines
        for (const line of trimmed.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') return
            try {
              yield JSON.parse(data) as OpenAIChatCompletionChunk
            } catch {
              // Skip malformed JSON lines
            }
          }
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      for (const line of buffer.trim().split('\n')) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') return
          try {
            yield JSON.parse(data) as OpenAIChatCompletionChunk
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
