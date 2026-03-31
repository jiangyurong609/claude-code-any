# ACP Integration Guide

## Overview

`claude-code-any` can run as an ACP (Agent Communication Protocol) server, enabling structured communication with `acpx` and OpenClaw. Instead of scraping stdout from print mode, ACP provides typed JSON-RPC messages for prompts, streaming events, tool calls, and session management.

## Quick Start

```bash
# Direct usage
claude-any acp --stdio

# With acpx
acpx --agent "claude-any acp --stdio" "Reply with exactly ACP_OK"
```

## Protocol

The ACP server communicates over stdin/stdout using JSON-RPC 2.0 (one message per line).

### Methods

#### `initialize`

Handshake to discover capabilities.

```json
→ {"jsonrpc":"2.0","id":1,"method":"initialize"}
← {"jsonrpc":"2.0","id":1,"result":{"name":"claude-code-any","version":"2.1.88","capabilities":{"streaming":true,"tools":true,"sessions":true}}}
```

#### `prompt`

Send a prompt and receive streaming events + final result.

```json
→ {"jsonrpc":"2.0","id":2,"method":"prompt","params":{"prompt":"Fix the auth bug","profile":"balanced"}}

← {"jsonrpc":"2.0","method":"session.info","params":{"sessionId":"abc-123"}}
← {"jsonrpc":"2.0","method":"event","params":{"sessionId":"abc-123","event":{"type":"text_delta","text":"Looking at "}}}
← {"jsonrpc":"2.0","method":"event","params":{"sessionId":"abc-123","event":{"type":"text_delta","text":"the auth module..."}}}
← {"jsonrpc":"2.0","method":"event","params":{"sessionId":"abc-123","event":{"type":"turn_complete","stop_reason":"end_turn"}}}
← {"jsonrpc":"2.0","id":2,"result":{"sessionId":"abc-123","text":"Looking at the auth module..."}}
```

#### `session.create`

Create a new session explicitly.

```json
→ {"jsonrpc":"2.0","id":3,"method":"session.create","params":{"cwd":"/path/to/project","profile":"balanced"}}
← {"jsonrpc":"2.0","id":3,"result":{"sessionId":"def-456"}}
```

#### `session.list`

List all sessions.

```json
→ {"jsonrpc":"2.0","id":4,"method":"session.list"}
← {"jsonrpc":"2.0","id":4,"result":{"sessions":[...]}}
```

#### `shutdown`

Gracefully shut down the server.

```json
→ {"jsonrpc":"2.0","id":5,"method":"shutdown"}
← {"jsonrpc":"2.0","id":5,"result":{"ok":true}}
```

### Event Types

Events are sent as JSON-RPC notifications during prompt execution:

| Event | Description |
|---|---|
| `text_delta` | Incremental text output |
| `tool_call_begin` | Tool invocation started |
| `tool_call_delta` | Tool argument streaming |
| `tool_call_end` | Tool invocation completed |
| `tool_result` | Tool execution result |
| `turn_complete` | Turn finished (with stop_reason) |
| `error` | Error occurred |
| `routing_info` | Routing profile/model info |

## Usage with acpx

### Basic

```bash
acpx --agent "claude-any acp --stdio" "Explain this codebase"
```

### With profile

```bash
CLAUDE_ANY_PROFILE=ollama acpx --agent "claude-any acp --stdio" "Fix the failing tests"
```

### With a wrapper script

```bash
# Use the provided wrapper
acpx --agent ./bin/claude-any-acp "Review this PR"
```

## Session Persistence

Sessions are stored in `~/.claude-any/acp/sessions/`:
- `{id}.json` — Session metadata (cwd, profile, state, timestamps)
- `{id}.transcript.jsonl` — Append-only conversation transcript

## OpenClaw Integration

### Compatibility Matrix

| Mode | Status |
|---|---|
| OpenClaw bash-mode with `claude-any --print` | Stable |
| `acpx --agent "claude-any acp --stdio"` | First ACP target |
| OpenClaw ACP + custom override | Experimental |
| OpenClaw/acpx built-in adapter | Future |

### Recommended Path

1. Start with bash-mode (`claude-any --print`) for stability
2. Move to `acpx --agent` for structured ACP communication
3. Wait for OpenClaw built-in support before using native ACP integration

## Troubleshooting

### Server doesn't start

Check that the build is current:
```bash
bun run build.ts
claude-any acp --stdio
```

### No response to prompts

Ensure your LLM backend is running and configured:
```bash
claude-any doctor
```

### acpx connection issues

Test the server directly first:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize"}' | claude-any acp --stdio
```

### Session state stuck at "running"

Sessions may get stuck if the process was killed. Reset manually:
```bash
rm ~/.claude-any/acp/sessions/*.json
```
