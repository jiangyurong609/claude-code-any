# Claude Code (Multi-LLM Fork)

A fork of [Claude Code](https://github.com/anthropics/claude-code) v2.1.88 with **OpenAI-compatible API support**. Use any LLM backend — OpenAI, Ollama, LM Studio, vLLM, Together AI, or any OpenAI-compatible server.

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.3.11+
- [pnpm](https://pnpm.io) v10+
- Node.js v18+

### Install & Build

```bash
# Install dependencies
pnpm install --registry https://registry.npmjs.org

# Build
bun run build.ts

# Verify
bun dist/cli.js --version
# → 2.1.88 (Claude Code)
```

### Run

```bash
# Interactive mode
bun dist/cli.js

# Non-interactive (print mode)
bun dist/cli.js -p "your prompt here"

# With Node.js instead of Bun
node dist/cli.js
```

---

## LLM Configuration

### Option 1: Anthropic API (Default)

```bash
export ANTHROPIC_API_KEY="sk-ant-api03-..."
bun dist/cli.js
```

Or log in with OAuth:
```bash
bun dist/cli.js auth login
```

### Option 2: OpenAI

```bash
export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_API_KEY="sk-..."
export OPENAI_MODEL="gpt-4.1"        # or gpt-4o, o4-mini, etc.
bun dist/cli.js
```

### Option 3: Ollama (Local, Free)

```bash
# Start Ollama first: ollama serve
# Pull a model: ollama pull llama3

export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_BASE_URL="http://localhost:11434/v1"
export OPENAI_MODEL="llama3"
bun dist/cli.js
```

### Option 4: LM Studio (Local)

```bash
# Start LM Studio server first

export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_BASE_URL="http://localhost:1234/v1"
export OPENAI_MODEL="your-loaded-model"
bun dist/cli.js
```

### Option 5: Any OpenAI-Compatible Server

Works with vLLM, Together AI, Groq, Fireworks, Azure OpenAI, etc.

```bash
export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_BASE_URL="https://your-server/v1"
export OPENAI_API_KEY="your-key"      # empty string OK for local servers
export OPENAI_MODEL="your-model"
bun dist/cli.js
```

### Option 6: AWS Bedrock

```bash
export CLAUDE_CODE_USE_BEDROCK=1
export AWS_REGION="us-east-1"
bun dist/cli.js
```

### Option 7: Google Vertex AI

```bash
export CLAUDE_CODE_USE_VERTEX=1
export CLOUD_ML_REGION="us-east5"
export ANTHROPIC_VERTEX_PROJECT_ID="your-project"
bun dist/cli.js
```

---

## Environment Variables Reference

### OpenAI-Compatible Mode

| Variable | Required | Default | Description |
|---|---|---|---|
| `CLAUDE_CODE_USE_OPENAI` | Yes | - | Set to `1` to enable OpenAI mode |
| `OPENAI_API_KEY` | No | `""` | API key (empty OK for local servers) |
| `OPENAI_BASE_URL` | No | `https://api.openai.com/v1` | API base URL |
| `OPENAI_MODEL` | No | `gpt-4o` | Model name |
| `OPENAI_MAX_TOKENS` | No | `16384` | Max output tokens cap |

### Anthropic Mode (Default)

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `ANTHROPIC_MODEL` | Override model (e.g. `claude-sonnet-4-6`) |
| `ANTHROPIC_BASE_URL` | Custom API endpoint |
| `API_TIMEOUT_MS` | Request timeout (default: 600000ms) |

---

## Persistent Setup

Add to your `~/.zshrc` (or `~/.bashrc`):

```bash
# For OpenAI
export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_API_KEY="sk-..."
export OPENAI_MODEL="gpt-4.1"

# For Ollama
# export CLAUDE_CODE_USE_OPENAI=1
# export OPENAI_BASE_URL="http://localhost:11434/v1"
# export OPENAI_MODEL="llama3"
```

Then create an alias:
```bash
alias ai="bun /path/to/claude-code-source/dist/cli.js"
```

---

## How It Works

The OpenAI adapter (`src/services/api/openaiAdapter.ts`) implements the Anthropic SDK interface but translates requests/responses to OpenAI Chat Completions format:

1. **Request translation**: Anthropic Messages API format → OpenAI Chat Completions format
   - System prompt → system message
   - Tool definitions → function definitions
   - Tool results → tool role messages
2. **Stream translation**: OpenAI SSE chunks → Anthropic `BetaRawMessageStreamEvent` events
   - `delta.content` → `text_delta`
   - `delta.tool_calls` → `tool_use` + `input_json_delta`
   - `finish_reason` → `stop_reason`
3. **Zero changes** to the core streaming loop (`claude.ts`) — the adapter is a drop-in client replacement

### Anthropic-specific features disabled in OpenAI mode:
- Extended thinking / adaptive thinking
- Prompt caching
- Context management
- Effort levels
- Beta headers
- 1M context window

---

## Project Structure

```
claude-code-source/
├── src/                          # TypeScript source (1900+ files)
│   ├── entrypoints/cli.tsx       # Build entry point
│   ├── services/api/
│   │   ├── claude.ts             # Main API streaming loop (unchanged)
│   │   ├── client.ts             # Client creation (modified: OpenAI branch)
│   │   ├── openaiAdapter.ts      # NEW: OpenAI adapter
│   │   └── openaiStreamParser.ts # NEW: SSE parser
│   ├── utils/model/
│   │   ├── providers.ts          # Modified: added 'openai' provider
│   │   ├── configs.ts            # Modified: added openai model strings
│   │   └── model.ts              # Modified: OpenAI model defaults
│   └── ...
├── stubs/                        # Stub packages for private deps
├── patches/                      # Commander multi-char flag patch
├── scripts/                      # Build/test/dev scripts
├── docs/                         # Architecture & subsystem docs
├── prompts/                      # Build guidance prompts
├── web/                          # Web UI (Next.js)
├── mcp-server/                   # Standalone MCP server
├── docker/                       # Docker support
├── dist/                         # Build output
│   └── cli.js                    # Executable (22MB)
├── build.ts                      # Bun build script
├── package.json                  # Dependencies
└── tsconfig.json                 # TypeScript config
```

---

## Additional Features

### Web UI
A Next.js web frontend is included in `web/`. See `web/README.md` for setup.

### MCP Server
A standalone MCP server is in `mcp-server/`. Can be deployed to Vercel or Railway.

### Docker
```bash
docker build -t claude-code-any .
docker run -e OPENAI_API_KEY=sk-... -e CLAUDE_CODE_USE_OPENAI=1 -e OPENAI_MODEL=gpt-4.1 -it claude-code-any
```

---

## Building from Source

### Source Recovery

The source was extracted from `@anthropic-ai/claude-code@2.1.88` npm package's `cli.js.map`:

```bash
npm pack @anthropic-ai/claude-code@2.1.88 --registry https://registry.npmjs.org
tar xzf anthropic-ai-claude-code-2.1.88.tgz

node -e "
const fs = require('fs'), path = require('path');
const map = JSON.parse(fs.readFileSync('package/cli.js.map', 'utf8'));
for (let i = 0; i < map.sources.length; i++) {
  const content = map.sourcesContent[i];
  if (!content) continue;
  let relPath = map.sources[i];
  while (relPath.startsWith('../')) relPath = relPath.slice(3);
  const outPath = path.join('./claude-code-source', relPath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content);
}
"
```

### Build Dependencies

| Tool | Version | Purpose |
|---|---|---|
| [Bun](https://bun.sh) | v1.3.11+ | Bundler (uses `bun:bundle` feature flags) |
| [pnpm](https://pnpm.io) | v10+ | Package manager |
| Node.js | v18+ | Runtime |

### Feature Flags

The build uses 90+ compile-time feature flags for dead code elimination. See `build.ts` for the full list. Key flags:

| Flag | Default | Description |
|---|---|---|
| `BUILTIN_EXPLORE_PLAN_AGENTS` | `true` | Built-in explore/plan agents |
| `MCP_SKILLS` | `true` | MCP skill system |
| `TOKEN_BUDGET` | `true` | Token budget display |
| `BRIDGE_MODE` | `false` | IDE bridge (internal) |
| `COORDINATOR_MODE` | `false` | Multi-agent coordinator |
| `DAEMON` | `false` | Background daemon |

---

## Credits

- Source extracted from [`@anthropic-ai/claude-code`](https://www.npmjs.com/package/@anthropic-ai/claude-code) v2.1.88
- Build setup based on [Janlaywss/cloud-code](https://github.com/Janlaywss/cloud-code)
- OpenAI-compatible adapter: original work in this fork

## License

Based on `@anthropic-ai/claude-code` by Anthropic. See [LICENSE](LICENSE) for details.
