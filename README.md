# Claude Code Any

A fork of [Claude Code](https://github.com/anthropics/claude-code) v2.1.88 with **multi-LLM support**, **provider profiles**, **smart task routing**, and **ACP protocol** for OpenClaw integration.

Use any LLM backend — OpenAI, Ollama, LM Studio, vLLM, Together AI, Groq, or any OpenAI-compatible server — with the full Claude Code agent toolchain (file editing, bash, grep, glob, multi-file planning).

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.3.11+
- [pnpm](https://pnpm.io) v10+
- Node.js v18+

### One-Liner Install

```bash
curl -fsSL https://raw.githubusercontent.com/jiangyurong609/claude-code-any/main/install.sh | bash
```

### Manual Install

```bash
git clone https://github.com/jiangyurong609/claude-code-any.git
cd claude-code-any

pnpm install --registry https://registry.npmjs.org
bun run build.ts

# Install globally as `claude-any`
npm link
```

### Verify

```bash
claude-any --version          # 2.1.88 (Claude Code)
claude-any doctor             # show diagnostics
```

---

## Provider Profiles

The fastest way to configure a backend. Set one env var and go:

```bash
# OpenAI
CLAUDE_ANY_PROFILE=openai OPENAI_API_KEY=sk-... claude-any

# DeepSeek
CLAUDE_ANY_PROFILE=deepseek OPENAI_API_KEY=sk-... claude-any

# Kimi K2.5
CLAUDE_ANY_PROFILE=kimi OPENAI_API_KEY=sk-... claude-any

# Ollama (local, free)
CLAUDE_ANY_PROFILE=ollama claude-any

# Groq (fast)
CLAUDE_ANY_PROFILE=groq OPENAI_API_KEY=gsk_... claude-any

# xAI Grok
CLAUDE_ANY_PROFILE=xai OPENAI_API_KEY=xai-... claude-any

# OpenRouter (access any model)
CLAUDE_ANY_PROFILE=openrouter OPENAI_API_KEY=sk-or-... claude-any

# Together AI / Mistral / LM Studio / vLLM
CLAUDE_ANY_PROFILE=together OPENAI_API_KEY=... claude-any
CLAUDE_ANY_PROFILE=mistral OPENAI_API_KEY=... claude-any
CLAUDE_ANY_PROFILE=lmstudio claude-any
CLAUDE_ANY_PROFILE=vllm claude-any

# Custom endpoint
CLAUDE_ANY_PROFILE=custom OPENAI_BASE_URL=https://your-server/v1 OPENAI_MODEL=your-model claude-any
```

Each profile sets sensible defaults. Explicit env vars always override profile defaults.

| Profile | Base URL | Default Model | API Key |
|---|---|---|---|
| `openai` | `api.openai.com` | `gpt-5.4` | Required |
| `deepseek` | `api.deepseek.com` | `deepseek-chat` | Required |
| `kimi` | `api.moonshot.cn` | `kimi-k2.5` | Required |
| `xai` | `api.x.ai` | `grok-4.20-beta` | Required |
| `openrouter` | `openrouter.ai` | `openai/gpt-5.4` | Required |
| `ollama` | `localhost:11434` | `qwen3.5` | Not needed |
| `lmstudio` | `localhost:1234` | `local-model` | Not needed |
| `vllm` | `localhost:8000` | `default` | Not needed |
| `together` | `api.together.xyz` | `Qwen3.5-72B` | Required |
| `groq` | `api.groq.com` | `llama-3.3-70b` | Required |
| `mistral` | `api.mistral.ai` | `mistral-small-latest` | Required |
| `anthropic` | `api.anthropic.com` | Claude default | Required |

---

## Manual Configuration

If you prefer explicit env vars over profiles:

### OpenAI

```bash
export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_API_KEY="sk-..."
export OPENAI_MODEL="gpt-4.1"
claude-any
```

### Ollama (Local, Free)

```bash
export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_BASE_URL="http://localhost:11434/v1"
export OPENAI_MODEL="llama3"
claude-any
```

### Anthropic API (Default)

```bash
export ANTHROPIC_API_KEY="sk-ant-api03-..."
claude-any
```

### AWS Bedrock / Google Vertex / Azure Foundry

```bash
# Bedrock
export CLAUDE_CODE_USE_BEDROCK=1
export AWS_REGION="us-east-1"

# Vertex
export CLAUDE_CODE_USE_VERTEX=1
export CLOUD_ML_REGION="us-east5"
export ANTHROPIC_VERTEX_PROJECT_ID="your-project"

# Foundry
export CLAUDE_CODE_USE_FOUNDRY=1
export ANTHROPIC_FOUNDRY_BASE_URL="https://your-resource.services.ai.azure.com"
```

---

## Smart Task Routing

Route different task types to different models/providers automatically.

### Built-in Profiles

```bash
claude-any --profile balanced --print "fix the failing tests"
claude-any --profile cheap --print "summarize this file"
claude-any --profile private --print "review sensitive code"
claude-any --profile best --print "design the new architecture"
```

| Profile | Plan/Code | Fix/Review/Search |
|---|---|---|
| `best` | gpt-4.1 | gpt-4.1 |
| `cheap` | gpt-4.1-mini | gpt-4.1-mini |
| `private` | qwen2.5-coder (local) | qwen2.5-coder (local) |
| `balanced` | gpt-4.1 | gpt-4.1-mini |

### Task Classification

The router automatically detects task type from your prompt:

| Keywords | Route |
|---|---|
| plan, design, approach | `plan` |
| fix, bug, error, failing | `fix` |
| review, PR, audit | `review` |
| find, search, grep, where | `search` |
| summarize, explain | `summarize` |
| (default) | `code` |

### Override Route

```bash
claude-any --route review --print "check this code"
```

### Debug Routing

```bash
CLAUDE_ANY_DEBUG_ROUTING=1 claude-any --profile balanced --print "fix auth bug"
# stderr: [routing] profile=balanced route=fix provider=openai-compatible model=gpt-4.1-mini
```

### Custom Routing Config

Create `~/.claude-any/config.json` or `.claude-any.json` in your project:

```json
{
  "defaultProfile": "balanced",
  "profiles": {
    "my-team": {
      "routes": {
        "plan": { "provider": "openai", "model": "gpt-4.1" },
        "code": { "provider": "openai", "model": "gpt-4.1" },
        "fix": { "provider": "ollama", "model": "qwen2.5-coder", "baseURL": "http://localhost:11434/v1" }
      }
    }
  }
}
```

---

## ACP Protocol (OpenClaw / acpx)

`claude-code-any` speaks ACP (Agent Communication Protocol) for structured integration with [acpx](https://github.com/openclaw/acpx) and [OpenClaw](https://github.com/openclaw/openclaw).

### Quick Start

```bash
# Direct ACP server
claude-any acp --stdio

# With acpx
acpx --agent "claude-any acp --stdio" "Fix the failing tests"
```

### Protocol

JSON-RPC 2.0 over stdin/stdout:

```bash
# Initialize
echo '{"jsonrpc":"2.0","id":1,"method":"initialize"}' | claude-any acp --stdio

# Send prompt
echo '{"jsonrpc":"2.0","id":2,"method":"prompt","params":{"prompt":"Fix auth","profile":"balanced"}}' | claude-any acp --stdio
```

Methods: `initialize`, `prompt`, `session.create`, `session.list`, `shutdown`

See [docs/acp.md](docs/acp.md) for the full protocol spec.

### OpenClaw Integration

Replace `claude` with `claude-any` in OpenClaw's coding-agent config:

```bash
# Before
claude --permission-mode bypassPermissions --print 'task'

# After
claude-any --permission-mode bypassPermissions --print 'task'
```

See [docs/openclaw.md](docs/openclaw.md) for detailed recipes.

---

## Diagnostics

```bash
# Check configuration and connectivity
claude-any doctor

# Dump environment (secrets redacted)
claude-any env dump --redacted
```

Example output:

```
Claude Code Any - Diagnostics
  Version:      2.1.88
  Profile:      ollama
  Provider:     openai-compatible
  Base URL:     http://localhost:11434/v1
  Model:        llama3
  API Key:      (not set)
  Max Tokens:   4096
  Print mode:   available
  Connectivity: OK
```

---

## Environment Variables

### OpenAI-Compatible Mode

| Variable | Required | Default | Description |
|---|---|---|---|
| `CLAUDE_CODE_USE_OPENAI` | Yes | - | Set to `1` to enable |
| `OPENAI_API_KEY` | No | `""` | API key (empty OK for local) |
| `OPENAI_BASE_URL` | No | `https://api.openai.com/v1` | Base URL |
| `OPENAI_MODEL` | No | `gpt-4o` | Model name |
| `OPENAI_MAX_TOKENS` | No | `16384` | Max output tokens |

### Profiles & Routing

| Variable | Description |
|---|---|
| `CLAUDE_ANY_PROFILE` | Provider profile (openai, ollama, groq, etc.) |
| `CLAUDE_ANY_ROUTING_PROFILE` | Routing profile (best, cheap, private, balanced) |
| `CLAUDE_ANY_DEBUG_ROUTING` | Set to `1` for routing debug logs |
| `CLAUDE_ANY_RUN_LOG_DIR` | Directory for run manifest JSON files |

### Anthropic Mode

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `ANTHROPIC_MODEL` | Override model |
| `ANTHROPIC_BASE_URL` | Custom API endpoint |

---

## Binary Aliases

After `npm link`, all of these work:

```bash
claude-any --version
claude-code-any --version
cca --version
```

---

## Project Structure

```
claude-code-any/
├── src/
│   ├── entrypoints/cli.tsx          # CLI entry (profiles, doctor, routing, ACP)
│   ├── services/api/
│   │   ├── claude.ts                # Core streaming loop (unchanged)
│   │   ├── client.ts                # Client creation (+ OpenAI branch)
│   │   ├── openaiAdapter.ts         # OpenAI ↔ Anthropic translation
│   │   └── openaiStreamParser.ts    # SSE parser
│   ├── utils/
│   │   ├── profiles.ts              # Provider profiles (CLAUDE_ANY_PROFILE)
│   │   ├── model/providers.ts       # Provider types (+ 'openai')
│   │   └── routing/                 # Task routing system
│   │       ├── classifier.ts        # Keyword-based task classification
│   │       ├── config.ts            # Routing config loading
│   │       ├── resolver.ts          # Route resolution + env application
│   │       └── types.ts             # Routing types
│   ├── acp/                         # ACP protocol server
│   │   ├── server.ts                # JSON-RPC stdio server
│   │   ├── sessionStore.ts          # Session persistence
│   │   ├── eventMapper.ts           # Internal → ACP event mapping
│   │   └── types.ts                 # ACP types
│   └── ...                          # 1900+ original Claude Code source files
├── tests/integration/               # Integration tests
├── docs/
│   ├── openclaw.md                  # OpenClaw integration guide
│   ├── acp.md                       # ACP protocol spec
│   └── ...                          # Architecture docs
├── bin/claude-any-acp               # Wrapper for acpx --agent
├── web/                             # Web UI (Next.js)
├── mcp-server/                      # Standalone MCP server
├── docker/                          # Docker support
├── build.ts                         # Bun build script
└── package.json                     # Dependencies + bin aliases
```

---

## How the OpenAI Adapter Works

The adapter (`src/services/api/openaiAdapter.ts`) implements the Anthropic SDK interface but translates to OpenAI Chat Completions format internally:

1. **Request**: Anthropic Messages API → OpenAI Chat Completions
2. **Streaming**: OpenAI SSE → Anthropic `BetaRawMessageStreamEvent`
3. **Tools**: Anthropic `tool_use`/`tool_result` ↔ OpenAI `function`/`tool_calls`
4. **Zero changes** to the core streaming loop — drop-in client replacement

Anthropic-specific features (thinking, caching, effort, betas, 1M context) are gracefully disabled in OpenAI mode.

---

## Docker

```bash
docker build -t claude-code-any .
docker run -e CLAUDE_ANY_PROFILE=openai -e OPENAI_API_KEY=sk-... -it claude-code-any
```

---

## Credits

- Source extracted from [`@anthropic-ai/claude-code`](https://www.npmjs.com/package/@anthropic-ai/claude-code) v2.1.88
- Build setup based on [Janlaywss/cloud-code](https://github.com/Janlaywss/cloud-code)
- Multi-LLM adapter, routing, profiles, and ACP: original work in this fork

## License

Based on `@anthropic-ai/claude-code` by Anthropic. See [LICENSE](LICENSE) for details.
