/**
 * Reusable mock OpenAI-compatible server for integration tests.
 * Responds to /v1/chat/completions with streaming SSE.
 */

export function startMockServer(port: number = 18234): { stop: () => void; port: number } {
  const server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url)

      if (url.pathname === '/v1/models' && req.method === 'GET') {
        return Response.json({ data: [{ id: 'test-model', object: 'model' }] })
      }

      if (url.pathname === '/v1/chat/completions' && req.method === 'POST') {
        const body = await req.json() as any
        const isStreaming = body.stream === true

        const lastUserMsg = [...body.messages].reverse().find((m: any) => m.role === 'user')
        const userText = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : ''

        // Check for tool results
        const hasToolResult = body.messages.some((m: any) => m.role === 'tool')
        const hasTools = body.tools && body.tools.length > 0
        const wantsToolUse = userText.toLowerCase().includes('read file') || userText.toLowerCase().includes('run command')

        if (isStreaming) {
          const encoder = new TextEncoder()
          const msgId = `chatcmpl-test-${Date.now()}`

          const stream = new ReadableStream({
            start(controller) {
              const chunks: string[] = []

              if (wantsToolUse && hasTools && !hasToolResult) {
                // Tool call response
                chunks.push(JSON.stringify({
                  id: msgId, object: 'chat.completion.chunk', created: Date.now(), model: body.model,
                  choices: [{ index: 0, delta: { role: 'assistant', content: null, tool_calls: [{ index: 0, id: 'call_test1', type: 'function', function: { name: 'Bash', arguments: '' } }] }, finish_reason: null }]
                }))
                const args = JSON.stringify({ command: 'echo test_output', description: 'test' })
                chunks.push(JSON.stringify({
                  id: msgId, object: 'chat.completion.chunk', created: Date.now(), model: body.model,
                  choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: args } }] }, finish_reason: null }]
                }))
                chunks.push(JSON.stringify({
                  id: msgId, object: 'chat.completion.chunk', created: Date.now(), model: body.model,
                  choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }],
                  usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 }
                }))
              } else {
                // Text response — echo back a sentinel
                const text = hasToolResult ? 'Tool executed successfully.' : `MOCK_RESPONSE: ${userText}`
                chunks.push(JSON.stringify({
                  id: msgId, object: 'chat.completion.chunk', created: Date.now(), model: body.model,
                  choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }]
                }))
                chunks.push(JSON.stringify({
                  id: msgId, object: 'chat.completion.chunk', created: Date.now(), model: body.model,
                  choices: [{ index: 0, delta: { content: text }, finish_reason: null }]
                }))
                chunks.push(JSON.stringify({
                  id: msgId, object: 'chat.completion.chunk', created: Date.now(), model: body.model,
                  choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
                  usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 }
                }))
              }

              for (const chunk of chunks) {
                controller.enqueue(encoder.encode(`data: ${chunk}\n\n`))
              }
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              controller.close()
            }
          })

          return new Response(stream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'x-request-id': `req-${Date.now()}`,
            },
          })
        }

        return Response.json({
          id: `chatcmpl-test-${Date.now()}`,
          object: 'chat.completion',
          created: Date.now(),
          model: body.model,
          choices: [{ index: 0, message: { role: 'assistant', content: `MOCK_RESPONSE: ${userText}` }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        })
      }

      return new Response('Not Found', { status: 404 })
    },
  })

  return {
    stop: () => server.stop(),
    port: server.port,
  }
}

// Run standalone if executed directly
if (import.meta.main) {
  const server = startMockServer()
  console.log(`Mock OpenAI server on port ${server.port}`)
}
