/**
 * OpenAI-compatible API adapter for Claude Code.
 *
 * Implements the Anthropic SDK interface (`beta.messages.create().withResponse()`)
 * but translates requests/responses to/from the OpenAI Chat Completions API format.
 * This allows Claude Code to work with any OpenAI-compatible backend:
 * OpenAI, Ollama, LM Studio, vLLM, Together AI, etc.
 */

import { randomUUID } from 'crypto'
import {
  type OpenAIChatCompletionChunk,
  parseSSEStream,
} from './openaiStreamParser.js'

// ─── Types ───────────────────────────────────────────────────────────────────

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  tool_calls?: OpenAIToolCall[]
  tool_call_id?: string
  name?: string
}

interface OpenAIToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

interface OpenAITool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

interface OpenAIChatCompletionRequest {
  model: string
  messages: OpenAIMessage[]
  tools?: OpenAITool[]
  tool_choice?: 'auto' | 'required' | 'none' | { type: 'function'; function: { name: string } }
  max_tokens?: number
  temperature?: number
  stream?: boolean
  stream_options?: { include_usage: boolean }
}

interface OpenAIChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string | null
      tool_calls?: OpenAIToolCall[]
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// Anthropic-compatible types (subset we need to produce)
interface AnthropicUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

// ─── Request Translation ─────────────────────────────────────────────────────

/**
 * Convert Anthropic Messages API params to OpenAI Chat Completions params.
 */
export function translateRequest(params: Record<string, any>): OpenAIChatCompletionRequest {
  const messages: OpenAIMessage[] = []

  // 1. System prompt → system message
  if (params.system) {
    let systemText = ''
    if (typeof params.system === 'string') {
      systemText = params.system
    } else if (Array.isArray(params.system)) {
      systemText = params.system
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('\n\n')
    }
    if (systemText) {
      messages.push({ role: 'system', content: systemText })
    }
  }

  // 2. Convert message history
  if (params.messages) {
    for (const msg of params.messages) {
      const converted = translateMessage(msg)
      messages.push(...converted)
    }
  }

  // 3. Convert tools
  let tools: OpenAITool[] | undefined
  if (params.tools && params.tools.length > 0) {
    tools = params.tools.map((t: any) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description || '',
        parameters: t.input_schema || { type: 'object', properties: {} },
      },
    }))
  }

  // 4. Convert tool_choice
  let toolChoice: OpenAIChatCompletionRequest['tool_choice']
  if (params.tool_choice) {
    if (params.tool_choice.type === 'auto') {
      toolChoice = 'auto'
    } else if (params.tool_choice.type === 'any') {
      toolChoice = 'required'
    } else if (params.tool_choice.type === 'tool' && params.tool_choice.name) {
      toolChoice = { type: 'function', function: { name: params.tool_choice.name } }
    }
  }

  // Resolve max_tokens: env override > model catalog > fallback 16384
  const envMaxTokens = process.env.OPENAI_MAX_TOKENS
    ? parseInt(process.env.OPENAI_MAX_TOKENS, 10)
    : null
  const maxTokensCap = envMaxTokens || 16384

  // Strip tools if model doesn't support tool calling (checked lazily via catalog)
  // The catalog check is async but we can't block here — rely on the cached catalog
  // If unknown, we optimistically send tools (most modern models support them)

  const request: OpenAIChatCompletionRequest = {
    model: params.model,
    messages,
    ...(tools && tools.length > 0 && { tools }),
    ...(toolChoice && { tool_choice: toolChoice }),
    ...(params.max_tokens && { max_tokens: Math.min(params.max_tokens, maxTokensCap) }),
    ...(params.temperature !== undefined && { temperature: params.temperature }),
  }

  return request
}

/**
 * Convert a single Anthropic message to one or more OpenAI messages.
 * A single Anthropic message can contain both text and tool_use/tool_result blocks,
 * which need to be split into separate OpenAI messages.
 */
function translateMessage(msg: Record<string, any>): OpenAIMessage[] {
  const role = msg.role as string
  const content = msg.content

  // Simple string content
  if (typeof content === 'string') {
    return [{ role: role as any, content }]
  }

  if (!Array.isArray(content)) {
    return [{ role: role as any, content: '' }]
  }

  const result: OpenAIMessage[] = []

  if (role === 'user') {
    // Collect text blocks and tool_result blocks separately
    const textParts: string[] = []
    const toolResults: OpenAIMessage[] = []

    for (const block of content) {
      if (block.type === 'text') {
        textParts.push(block.text)
      } else if (block.type === 'tool_result') {
        let resultContent = ''
        if (typeof block.content === 'string') {
          resultContent = block.content
        } else if (Array.isArray(block.content)) {
          resultContent = block.content
            .filter((b: any) => b.type === 'text')
            .map((b: any) => b.text)
            .join('\n')
        }
        toolResults.push({
          role: 'tool',
          tool_call_id: block.tool_use_id,
          content: resultContent,
        })
      }
      // Skip image/document blocks for now
    }

    // Tool results must come before any user text in OpenAI format
    result.push(...toolResults)
    if (textParts.length > 0) {
      result.push({ role: 'user', content: textParts.join('\n\n') })
    }
  } else if (role === 'assistant') {
    // Collect text and tool_use blocks
    const textParts: string[] = []
    const toolCalls: OpenAIToolCall[] = []

    for (const block of content) {
      if (block.type === 'text') {
        textParts.push(block.text)
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: typeof block.input === 'string'
              ? block.input
              : JSON.stringify(block.input),
          },
        })
      }
      // Skip thinking/redacted_thinking blocks
    }

    const assistantMsg: OpenAIMessage = {
      role: 'assistant',
      content: textParts.length > 0 ? textParts.join('\n\n') : null,
    }
    if (toolCalls.length > 0) {
      assistantMsg.tool_calls = toolCalls
    }
    result.push(assistantMsg)
  }

  return result
}

// ─── Response Stream Translation ─────────────────────────────────────────────

/**
 * Map OpenAI finish_reason to Anthropic stop_reason.
 */
function mapFinishReason(reason: string | null): string {
  switch (reason) {
    case 'stop': return 'end_turn'
    case 'tool_calls': return 'tool_use'
    case 'length': return 'max_tokens'
    case 'content_filter': return 'end_turn'
    default: return 'end_turn'
  }
}

/**
 * Translate an OpenAI SSE stream into Anthropic BetaRawMessageStreamEvent objects.
 * This is the core streaming translation that makes claude.ts work unchanged.
 */
export async function* translateStream(
  chunks: AsyncGenerator<OpenAIChatCompletionChunk>,
): AsyncGenerator<any> {
  let messageStarted = false
  let messageId = ''
  let model = ''
  let textBlockStarted = false
  let textBlockIndex = 0
  // Track tool call blocks: openai index → our content block index
  const toolBlockIndices = new Map<number, number>()
  const toolBlockStarted = new Map<number, boolean>()
  let nextContentBlockIndex = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0

  for await (const chunk of chunks) {
    // Emit message_start on first chunk
    if (!messageStarted) {
      messageStarted = true
      messageId = chunk.id || `msg_${randomUUID()}`
      model = chunk.model || ''
      yield {
        type: 'message_start',
        message: {
          id: messageId,
          type: 'message',
          role: 'assistant',
          content: [],
          model,
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        },
      }
    }

    // Track usage if provided
    if (chunk.usage) {
      totalInputTokens = chunk.usage.prompt_tokens || 0
      totalOutputTokens = chunk.usage.completion_tokens || 0
    }

    for (const choice of chunk.choices || []) {
      const delta = choice.delta

      // Handle text content
      if (delta.content !== undefined && delta.content !== null) {
        if (!textBlockStarted) {
          textBlockStarted = true
          textBlockIndex = nextContentBlockIndex++
          yield {
            type: 'content_block_start',
            index: textBlockIndex,
            content_block: { type: 'text', text: '' },
          }
        }
        yield {
          type: 'content_block_delta',
          index: textBlockIndex,
          delta: { type: 'text_delta', text: delta.content },
        }
      }

      // Handle tool calls
      if (delta.tool_calls) {
        // Close text block before tool calls if open
        if (textBlockStarted && !toolBlockIndices.size) {
          yield { type: 'content_block_stop', index: textBlockIndex }
          textBlockStarted = false
        }

        for (const tc of delta.tool_calls) {
          const tcIndex = tc.index

          // New tool call — emit content_block_start
          if (!toolBlockStarted.get(tcIndex) && tc.id) {
            const blockIndex = nextContentBlockIndex++
            toolBlockIndices.set(tcIndex, blockIndex)
            toolBlockStarted.set(tcIndex, true)
            yield {
              type: 'content_block_start',
              index: blockIndex,
              content_block: {
                type: 'tool_use',
                id: tc.id,
                name: tc.function?.name || '',
                input: '',
              },
            }
          }

          // Tool call arguments delta
          if (tc.function?.arguments) {
            const blockIndex = toolBlockIndices.get(tcIndex)
            if (blockIndex !== undefined) {
              yield {
                type: 'content_block_delta',
                index: blockIndex,
                delta: {
                  type: 'input_json_delta',
                  partial_json: tc.function.arguments,
                },
              }
            }
          }
        }
      }

      // Handle finish_reason
      if (choice.finish_reason) {
        // Close any open text block
        if (textBlockStarted) {
          yield { type: 'content_block_stop', index: textBlockIndex }
          textBlockStarted = false
        }
        // Close any open tool blocks
        for (const [, blockIndex] of toolBlockIndices) {
          yield { type: 'content_block_stop', index: blockIndex }
        }

        // If no content blocks were emitted, emit an empty text block
        if (nextContentBlockIndex === 0) {
          yield {
            type: 'content_block_start',
            index: 0,
            content_block: { type: 'text', text: '' },
          }
          yield {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: '' },
          }
          yield { type: 'content_block_stop', index: 0 }
        }

        yield {
          type: 'message_delta',
          delta: { stop_reason: mapFinishReason(choice.finish_reason) },
          usage: { output_tokens: totalOutputTokens },
        }
        yield { type: 'message_stop' }
      }
    }
  }

  // If stream ended without a finish_reason (some backends do this)
  if (messageStarted) {
    if (textBlockStarted) {
      yield { type: 'content_block_stop', index: textBlockIndex }
    }
    for (const [tcIdx, blockIndex] of toolBlockIndices) {
      if (toolBlockStarted.get(tcIdx)) {
        yield { type: 'content_block_stop', index: blockIndex }
      }
    }
    // Ensure we always have at least message_delta + message_stop
    yield {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn' },
      usage: { output_tokens: totalOutputTokens },
    }
    yield { type: 'message_stop' }
  }
}

// ─── Non-Streaming Response Translation ──────────────────────────────────────

/**
 * Convert a non-streaming OpenAI response to an Anthropic BetaMessage-shaped object.
 */
function translateNonStreamingResponse(response: OpenAIChatCompletionResponse): any {
  const choice = response.choices?.[0]
  if (!choice) {
    return {
      id: response.id || `msg_${randomUUID()}`,
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: '' }],
      model: response.model || '',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    }
  }

  const content: any[] = []
  if (choice.message.content) {
    content.push({ type: 'text', text: choice.message.content })
  }
  if (choice.message.tool_calls) {
    for (const tc of choice.message.tool_calls) {
      let parsedInput: any = {}
      try {
        parsedInput = JSON.parse(tc.function.arguments)
      } catch {
        parsedInput = {}
      }
      content.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.function.name,
        input: parsedInput,
      })
    }
  }
  if (content.length === 0) {
    content.push({ type: 'text', text: '' })
  }

  return {
    id: response.id || `msg_${randomUUID()}`,
    type: 'message',
    role: 'assistant',
    content,
    model: response.model || '',
    stop_reason: mapFinishReason(choice.finish_reason),
    stop_sequence: null,
    usage: {
      input_tokens: response.usage?.prompt_tokens || 0,
      output_tokens: response.usage?.completion_tokens || 0,
    },
  }
}

// ─── Async Iterable Stream Wrapper ───────────────────────────────────────────

/**
 * Wraps the translated event generator into an object that looks like
 * Anthropic SDK's Stream<BetaRawMessageStreamEvent>.
 * The key contract: it must be async-iterable and have a `controller` property.
 */
class AnthropicCompatibleStream {
  private generator: AsyncGenerator<any>
  // claude.ts line 1853 checks for 'controller' property to distinguish
  // streams from error messages
  controller: AbortController

  constructor(generator: AsyncGenerator<any>, signal?: AbortSignal) {
    this.generator = generator
    this.controller = new AbortController()
    // Forward external abort to our controller
    if (signal) {
      signal.addEventListener('abort', () => this.controller.abort(), { once: true })
    }
  }

  async *[Symbol.asyncIterator]() {
    yield* this.generator
  }
}

// ─── Client Class ────────────────────────────────────────────────────────────

/**
 * OpenAI-compatible client that implements the Anthropic SDK interface
 * consumed by claude.ts:
 *   anthropic.beta.messages.create({...params, stream: true}, {signal}).withResponse()
 */
export class OpenAICompatibleClient {
  private apiKey: string
  private baseUrl: string
  private timeout: number

  constructor(options: { apiKey: string; baseUrl: string; timeout: number }) {
    this.apiKey = options.apiKey
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')  // strip trailing slashes
    this.timeout = options.timeout
  }

  beta = {
    messages: {
      create: (params: any, options?: any) => {
        const isStreaming = params.stream === true
        const self = this

        // Return an object with .withResponse() — matching Anthropic SDK pattern
        const promise = (async () => {
          const openaiParams = translateRequest(params)
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          }
          if (self.apiKey) {
            headers['Authorization'] = `Bearer ${self.apiKey}`
          }

          const body: any = {
            ...openaiParams,
            stream: isStreaming,
          }
          if (isStreaming) {
            // Request usage info in stream (OpenAI supports this)
            body.stream_options = { include_usage: true }
          }

          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), self.timeout)

          // Forward caller's signal
          if (options?.signal) {
            options.signal.addEventListener(
              'abort',
              () => controller.abort(),
              { once: true },
            )
          }

          try {
            const response = await fetch(
              `${self.baseUrl}/chat/completions`,
              {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                signal: controller.signal,
              },
            )

            clearTimeout(timeoutId)

            if (!response.ok) {
              const errorBody = await response.text()
              let errorMessage = `OpenAI API error ${response.status}`
              try {
                const parsed = JSON.parse(errorBody)
                errorMessage = parsed.error?.message || errorMessage
              } catch {}
              const err = new Error(errorMessage) as any
              err.status = response.status
              err.error = { message: errorMessage }
              throw err
            }

            if (isStreaming) {
              if (!response.body) {
                throw new Error('No response body for streaming request')
              }
              const sseChunks = parseSSEStream(response.body)
              const anthropicEvents = translateStream(sseChunks)
              const stream = new AnthropicCompatibleStream(
                anthropicEvents,
                options?.signal,
              )
              return {
                data: stream,
                request_id: response.headers.get('x-request-id') || randomUUID(),
                response,
              }
            } else {
              const json = await response.json() as OpenAIChatCompletionResponse
              return translateNonStreamingResponse(json)
            }
          } catch (err: any) {
            clearTimeout(timeoutId)
            throw err
          }
        })()

        if (isStreaming) {
          // For streaming, return object with .withResponse()
          return {
            withResponse: () => promise,
          }
        } else {
          // For non-streaming, return the promise directly
          return promise
        }
      },
    },
  }
}
