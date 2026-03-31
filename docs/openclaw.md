# OpenClaw Integration Guide

## Overview

`claude-code-any` is a drop-in replacement for `claude` in OpenClaw's coding-agent workflow. It preserves the same CLI contract (no-PTY, print mode, bash-mode delegate) while routing requests to any OpenAI-compatible LLM backend.

OpenClaw's coding-agent uses Claude Code as a background process via:

```bash
claude --permission-mode bypassPermissions --print 'task description'
```

With `claude-code-any`, the equivalent is:

```bash
claude-any --permission-mode bypassPermissions --print 'task description'
```

## Installation

### Option A: npm link (recommended for development)

```bash
cd /path/to/claude-code-any
pnpm install
bun run build.ts
npm link
```

Verify:

```bash
claude-any --version
```

### Option B: Direct path

Point OpenClaw to the binary directly:

```bash
/path/to/claude-code-any/dist/cli.js --permission-mode bypassPermissions --print 'task'
```

### Option C: Symlink

```bash
ln -sf /path/to/claude-code-any/dist/cli.js /usr/local/bin/claude-any
chmod +x /usr/local/bin/claude-any
```

## Configuration Recipes

### Recipe 1: Local / Private (Ollama)

Best for: privacy-sensitive work, air-gapped environments, free usage.

```bash
# Start Ollama
ollama serve &
ollama pull llama3

# Set environment
export CLAUDE_ANY_PROFILE=ollama
# Or manually:
# export CLAUDE_CODE_USE_OPENAI=1
# export OPENAI_BASE_URL=http://localhost:11434/v1
# export OPENAI_MODEL=llama3
```

Usage:

```bash
claude-any --permission-mode bypassPermissions --print 'Refactor the auth middleware'
```

### Recipe 2: OpenAI Hosted

Best for: best model quality, production use.

```bash
export CLAUDE_ANY_PROFILE=openai
export OPENAI_API_KEY=sk-...
# Default model: gpt-4.1. Override with:
# export OPENAI_MODEL=gpt-4o
```

Usage:

```bash
claude-any --permission-mode bypassPermissions --print 'Add input validation to the API'
```

### Recipe 3: Custom OpenAI-Compatible Gateway

Best for: corporate proxies, self-hosted vLLM/TGI, rate-limited endpoints.

```bash
export CLAUDE_ANY_PROFILE=custom
export OPENAI_BASE_URL=https://your-gateway.internal/v1
export OPENAI_API_KEY=your-key
export OPENAI_MODEL=your-model
export OPENAI_MAX_TOKENS=8192
```

### Recipe 4: Groq (fast inference)

```bash
export CLAUDE_ANY_PROFILE=groq
export OPENAI_API_KEY=gsk_...
```

### Recipe 5: Together AI

```bash
export CLAUDE_ANY_PROFILE=together
export OPENAI_API_KEY=...
export OPENAI_MODEL=meta-llama/Llama-3-70b-chat-hf
```

## Diagnostics

Before integrating with OpenClaw, verify your setup:

```bash
# Check configuration
claude-any doctor

# Dump env vars (secrets redacted)
claude-any env dump --redacted

# Quick connectivity test
claude-any doctor --check
```

Expected output:

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

## OpenClaw Command Contract

OpenClaw expects the following behavior from the coding agent:

| Behavior | Requirement |
|---|---|
| **stdout** | Contains the generated answer/progress |
| **stderr** | Reserved for diagnostics only |
| **Exit code 0** | Success |
| **Non-zero exit** | Failure |
| **No PTY** | Must work in non-interactive subprocess |
| **Print mode** | `--print` flag for non-interactive output |

`claude-any` satisfies all of these. The `--permission-mode bypassPermissions` flag skips interactive permission prompts.

## OpenClaw Configuration

In your OpenClaw coding-agent configuration, replace the `claude` command with `claude-any`:

```yaml
# Before (upstream Claude Code)
coding_agent:
  command: claude --permission-mode bypassPermissions --print

# After (claude-code-any with OpenAI)
coding_agent:
  command: claude-any --permission-mode bypassPermissions --print
```

Ensure the environment variables are set in the shell that runs OpenClaw, or pass them in the command:

```yaml
coding_agent:
  command: >
    CLAUDE_ANY_PROFILE=openai
    OPENAI_API_KEY=${OPENAI_API_KEY}
    claude-any --permission-mode bypassPermissions --print
```

## Troubleshooting

### "API Error: Unable to connect"

The base URL is unreachable. Check:
- Is Ollama/LM Studio/your server running?
- Is the port correct?
- Run `claude-any doctor` to verify connectivity

### "API Error: max_tokens is too large"

Your model has a lower output token limit. Set:
```bash
export OPENAI_MAX_TOKENS=4096  # or whatever your model supports
```

### Child process env mismatch

OpenClaw spawns `claude-any` as a subprocess. Env vars set in your shell may not propagate. Solutions:
1. Set vars in `~/.zshrc` or `~/.bashrc` (not just the current shell)
2. Pass vars inline in the OpenClaw command config
3. Use `claude-any env dump` to debug what the child process sees

### Permission mode confusion

Always use `--permission-mode bypassPermissions` for OpenClaw integration. Without it, the CLI may prompt for interactive permission, which blocks in no-PTY mode.

### "Invalid API key"

This error comes from the upstream API. Check:
- Is `OPENAI_API_KEY` set correctly?
- For local servers (Ollama, LM Studio), set `OPENAI_API_KEY=` (empty) or omit it
- Run `claude-any env dump --redacted` to verify

### Version/config fragmentation

If using multiple instances of claude-any (e.g., different projects with different profiles), use project-level env files or inline vars rather than global `~/.zshrc` settings.
