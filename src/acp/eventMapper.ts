/**
 * Maps internal stream events to ACP structured events.
 * Reuses knowledge from the OpenAI adapter's stream translation.
 */

import type { AcpEvent } from './types.js'

/**
 * Convert an Anthropic-format stream event to ACP events.
 * May return 0 or more events per input event.
 */
export function toAcpEvents(event: any): AcpEvent[] {
  const events: AcpEvent[] = []

  switch (event.type) {
    case 'content_block_start': {
      const block = event.content_block
      if (block?.type === 'tool_use') {
        events.push({
          type: 'tool_call_begin',
          id: block.id,
          name: block.name,
        })
      }
      break
    }

    case 'content_block_delta': {
      const delta = event.delta
      if (delta?.type === 'text_delta' && delta.text) {
        events.push({ type: 'text_delta', text: delta.text })
      } else if (delta?.type === 'input_json_delta' && delta.partial_json) {
        // Need to find the tool call ID from the content block index
        events.push({
          type: 'tool_call_delta',
          id: '', // Will be enriched by the server
          arguments: delta.partial_json,
        })
      }
      break
    }

    case 'content_block_stop': {
      // The server layer tracks which block index maps to which tool call
      break
    }

    case 'message_delta': {
      if (event.delta?.stop_reason) {
        events.push({
          type: 'turn_complete',
          stop_reason: event.delta.stop_reason,
        })
      }
      break
    }

    default:
      break
  }

  return events
}
