# Claude Code Any

**Claude Code's AI coding agent, but with any LLM.**

One CLI. Any backend. Full agent toolchain — file editing, bash, grep, glob, multi-file planning.

```bash
# Install
curl -fsSL https://raw.githubusercontent.com/jiangyurong609/claude-code-any/main/install.sh | bash

# Run with any provider (use that provider's own API key)
CLAUDE_ANY_PROFILE=openai   OPENAI_API_KEY=sk-...     claude-any
CLAUDE_ANY_PROFILE=deepseek DEEPSEEK_API_KEY=sk-...   claude-any
CLAUDE_ANY_PROFILE=ollama   claude-any                 # free, local
```

## Supported Providers

| Profile | Provider | Default Model | API Key |
|---|---|---|---|
| `openai` | OpenAI | `gpt-5.4` | Required |
| `deepseek` | DeepSeek | `deepseek-chat` | Required |
| `kimi` | Moonshot AI | `kimi-k2.5` | Required |
| `xai` | xAI | `grok-4.20-beta` | Required |
| `openrouter` | OpenRouter | `openai/gpt-5.4` | Required |
| `groq` | Groq | `llama-3.3-70b` | Required |
| `together` | Together AI | `Qwen3.5-72B` | Required |
| `mistral` | Mistral AI | `mistral-small-latest` | Required |
| `cohere` | Cohere | `command-a-03-2025` | Required |
| `perplexity` | Perplexity | `sonar-pro` | Required |
| `deepinfra` | DeepInfra | `Qwen3.5-72B` | Required |
| `cerebras` | Cerebras | `llama-3.3-70b` | Required |
| `fireworks` | Fireworks AI | `qwen3p5-72b` | Required |
| `sambanova` | SambaNova | `Llama-3.3-70B` | Required |
| `azure` | Azure OpenAI | `gpt-5.4` | Required |
| `github-copilot` | GitHub Copilot | `gpt-5.4` | Required |
| `ollama` | Ollama (local) | `qwen3.5` | Not needed |
| `lmstudio` | LM Studio (local) | `local-model` | Not needed |
| `vllm` | vLLM (self-hosted) | `default` | Not needed |
| `anthropic` | Anthropic | Claude default | Required |
| `custom` | Any OpenAI-compatible | (you choose) | Varies |

Set `CLAUDE_ANY_PROFILE` and an API key — that's it. Explicit env vars (`OPENAI_MODEL`, `OPENAI_BASE_URL`) always override profile defaults.

## Auto-Detection

If you already have API keys in your environment (e.g. from OpenClaw), `claude-any` picks them up automatically — no config needed:

- `OPENAI_API_KEY` → uses OpenAI
- `DEEPSEEK_API_KEY` → routes to DeepSeek
- `OPENROUTER_API_KEY` → routes to OpenRouter
- `TOGETHER_API_KEY` → routes to Together AI
- `OLLAMA_HOST` → detects local Ollama
- `OPENCLAW_LIVE_OPENAI_KEY` → bridges from OpenClaw

## Smart Routing

Route different task types to different models automatically:

```bash
claude-any --profile balanced --print "fix the auth bug"
# → routes to gpt-5.4-mini (cheaper for fixes)

claude-any --profile balanced --print "design the new API"
# → routes to gpt-5.4 (best for planning)
```

| Routing Profile | Plan/Code | Fix/Review | Search/Summarize |
|---|---|---|---|
| `best` | gpt-5.4-pro | gpt-5.4 | gpt-5.4 |
| `balanced` | gpt-5.4 | gpt-5.4-mini | gpt-5.4-nano |
| `cheap` | gpt-5.4-mini | gpt-5.4-nano | gpt-5.4-nano |
| `private` | qwen3.5 (local) | qwen3.5 (local) | qwen3.5 (local) |

Task type is detected from keywords: "fix"/"bug" → fix route, "plan"/"design" → plan route, "review"/"PR" → review route, etc. Override with `--route`:

```bash
claude-any --route review --print "check this code"
```

## Diagnostics

```bash
claude-any doctor              # check config + connectivity
claude-any env dump --redacted # show all env vars (secrets masked)
```

```
Claude Code Any - Diagnostics
  Version:      2.1.88
  Profile:      openai
  Provider:     openai-compatible
  Base URL:     https://api.openai.com/v1
  Model:        gpt-5.4
  API Key:      present
  Max Tokens:   16384
  Print mode:   available
  Connectivity: OK
  Model catalog: 4108 models from models.dev
  Model info:   GPT-5.4
    Tools:      yes
    Reasoning:  yes
    Context:    1,050,000 tokens
    Max output: 128,000 tokens
    Cost:       $2.5/$15 per 1M tokens
```

The doctor command auto-fetches model metadata from [models.dev](https://models.dev) (4,108 models) and shows capabilities, context window, pricing, and tool support for your selected model.

## OpenClaw Integration

Drop-in replacement for Claude Code in OpenClaw's coding-agent workflow:

```bash
# Before
claude --permission-mode bypassPermissions --print 'task'

# After
claude-any --permission-mode bypassPermissions --print 'task'
```

Also ships as an OpenClaw skill (`skills/coding-agent-any/`) and speaks ACP:

```bash
acpx --agent "claude-any acp --stdio" "Fix the failing tests"
```

See [docs/openclaw.md](docs/openclaw.md) and [docs/acp.md](docs/acp.md) for details.

## Install

### One-liner

```bash
curl -fsSL https://raw.githubusercontent.com/jiangyurong609/claude-code-any/main/install.sh | bash
```

### Manual

Requires [Bun](https://bun.sh) v1.3.11+, [pnpm](https://pnpm.io) v10+, Node.js v18+.

```bash
git clone https://github.com/jiangyurong609/claude-code-any.git
cd claude-code-any
pnpm install --registry https://registry.npmjs.org
bun run build.ts
npm link
```

### Docker

```bash
docker build -t claude-code-any .
docker run -e CLAUDE_ANY_PROFILE=openai -e OPENAI_API_KEY=sk-... -it claude-code-any
```

### Binary Aliases

After install: `claude-any`, `claude-code-any`, and `cca` all work.

## How It Works

- **OpenAI adapter** translates between Anthropic's SDK and OpenAI Chat Completions at the client boundary. Zero changes to Claude Code's core streaming loop — drop-in replacement.
- **Model catalog** fetches 4,108 models from [models.dev](https://models.dev) with capabilities, pricing, and limits. Cached locally, refreshed hourly.
- **JSONC config** supports comments and trailing commas. Multi-level merge: global (`~/.claude-any/`) → XDG (`~/.config/claude-any/`) → project (`.claude-any.jsonc`).
- **Per-chunk SSE timeout** detects stalled streams (default 60s, configurable via `OPENAI_CHUNK_TIMEOUT_MS`).

## Credits

- Source: [`@anthropic-ai/claude-code`](https://www.npmjs.com/package/@anthropic-ai/claude-code) v2.1.88
- Build setup: [Janlaywss/cloud-code](https://github.com/Janlaywss/cloud-code)
- Multi-LLM adapter, routing, profiles, ACP: original work in this fork

## License

Based on `@anthropic-ai/claude-code` by Anthropic. See [LICENSE](LICENSE).
