---
name: coding-agent-any
description: 'Delegate coding tasks to claude-code-any — a multi-LLM coding agent supporting OpenAI, Ollama, Groq, Together, LM Studio, vLLM, and Anthropic backends. Use when: (1) building/creating new features, (2) reviewing PRs, (3) refactoring codebases, (4) iterative coding with file exploration. Supports provider profiles and smart task routing. Use --print --permission-mode bypassPermissions (no PTY). NOT for: simple one-liner fixes (just edit), reading code (use read tool), ACP harness requests (use sessions_spawn with runtime:"acp").'
metadata:
  {
    "openclaw":
      {
        "emoji": "🌐",
        "requires": { "anyBins": ["claude-any", "cca", "claude-code-any"] },
        "install":
          [
            {
              "id": "node-claude-any",
              "kind": "node",
              "package": "claude-code-any",
              "bins": ["claude-any", "cca", "claude-code-any"],
              "label": "Install claude-code-any via npm",
            },
          ],
      },
  }
---

# Coding Agent Any — Multi-LLM Coding Agent for OpenClaw

Use **claude-code-any** (`claude-any`) as your coding agent backend with any LLM provider. Same Claude Code agent toolchain (file editing, bash, grep, glob, planning), any model.

## Why This Skill?

The default `coding-agent` skill requires Anthropic API access. This skill lets you use:

| Provider | Profile | Cost |
|---|---|---|
| **Ollama** (local) | `ollama` | Free |
| **OpenAI** | `openai` | Pay-per-use |
| **Groq** | `groq` | Free tier available |
| **Together AI** | `together` | Pay-per-use |
| **LM Studio** (local) | `lmstudio` | Free |
| **vLLM** (self-hosted) | `vllm` | Free |
| **Anthropic** | `anthropic` | Pay-per-use |
| **Any OpenAI-compatible** | `custom` | Varies |

## Setup

### 1. Install (one-liner)

```bash
curl -fsSL https://raw.githubusercontent.com/jiangyurong609/claude-code-any/main/install.sh | bash
```

This clones, builds, and links `claude-any` globally. It also copies the skill into your OpenClaw workspace.

Or manually:

```bash
git clone https://github.com/jiangyurong609/claude-code-any.git ~/.claude-any-src
cd ~/.claude-any-src && pnpm install && bun run build.ts && npm link
cp -r skills/coding-agent-any ~/.openclaw/skills/
```

### 2. Configure Provider

Set environment variables (add to `~/.zshrc` for persistence):

```bash
# Option A: Profile (easiest)
export CLAUDE_ANY_PROFILE=ollama     # or openai, groq, together, etc.
export OPENAI_API_KEY=sk-...         # if needed for your provider

# Option B: Manual
export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_BASE_URL=http://localhost:11434/v1
export OPENAI_MODEL=llama3
```

### 3. Verify

```bash
claude-any doctor
claude-any --permission-mode bypassPermissions --print "Say OK"
```

## Usage in OpenClaw

### Basic: One-Shot Task

```bash
# Foreground
bash workdir:~/project command:"claude-any --permission-mode bypassPermissions --print 'Add input validation to the signup form'"

# Background
bash workdir:~/project background:true command:"claude-any --permission-mode bypassPermissions --print 'Refactor the auth module to use JWT'"
```

### With Provider Profile

```bash
# Use Ollama (free, local)
bash workdir:~/project command:"CLAUDE_ANY_PROFILE=ollama claude-any --permission-mode bypassPermissions --print 'Fix the failing tests'"

# Use OpenAI (best quality)
bash workdir:~/project command:"CLAUDE_ANY_PROFILE=openai claude-any --permission-mode bypassPermissions --print 'Design a caching layer'"

# Use Groq (fast inference)
bash workdir:~/project command:"CLAUDE_ANY_PROFILE=groq claude-any --permission-mode bypassPermissions --print 'Summarize the codebase'"
```

### With Smart Routing

Route different tasks to different models automatically:

```bash
# Balanced: uses gpt-5.4 for planning/coding, gpt-5.4-mini for fixes/reviews
bash workdir:~/project command:"claude-any --profile balanced --permission-mode bypassPermissions --print 'Fix the null pointer in auth.ts'"

# Cheap: all tasks use gpt-5.4-mini/nano
bash workdir:~/project command:"claude-any --profile cheap --permission-mode bypassPermissions --print 'Add docstrings to utils/'"

# Private: all tasks use local Ollama
bash workdir:~/project command:"claude-any --profile private --permission-mode bypassPermissions --print 'Review this sensitive code'"
```

### PR Review

```bash
# Clone to temp for safe review
REVIEW_DIR=$(mktemp -d)
git clone https://github.com/user/repo.git $REVIEW_DIR
cd $REVIEW_DIR && gh pr checkout 42
bash workdir:$REVIEW_DIR command:"claude-any --permission-mode bypassPermissions --print 'Review this PR. Summarize changes, flag issues, suggest improvements.'"
```

### Parallel Issue Fixing

```bash
# Create worktrees
git worktree add -b fix/issue-10 /tmp/issue-10 main
git worktree add -b fix/issue-11 /tmp/issue-11 main

# Launch agents in parallel
bash workdir:/tmp/issue-10 background:true command:"claude-any --permission-mode bypassPermissions --print 'Fix issue #10: Auth tokens expire too early'"
bash workdir:/tmp/issue-11 background:true command:"claude-any --permission-mode bypassPermissions --print 'Fix issue #11: Missing input sanitization'"

# Monitor
process action:list
process action:log sessionId:XXX
```

### ACP Mode (Structured Protocol)

For structured communication instead of stdout scraping:

```bash
# Via acpx
acpx --agent "claude-any acp --stdio" "Fix the failing tests"
```

## Diagnostics

When things go wrong:

```bash
# Check config
bash command:"claude-any doctor"

# Dump env (redacted)
bash command:"claude-any env dump --redacted"

# Debug routing
bash command:"CLAUDE_ANY_DEBUG_ROUTING=1 claude-any --profile balanced --permission-mode bypassPermissions --print 'test'"
```

## Rules

1. **No PTY needed** — `claude-any` uses `--print` mode, not interactive terminal
2. **Always use** `--permission-mode bypassPermissions` for unattended execution
3. **Respect provider choice** — if user wants local/private, use `--profile private`
4. **Monitor background tasks** — use `process action:log` to check progress
5. **Never run in OpenClaw state dir** — always use `workdir:` to target the project
6. **Be patient** — local models (Ollama) are slower than cloud APIs

## Auto-Notify on Completion

For long background tasks, append a notification trigger:

```bash
bash workdir:~/project background:true command:"claude-any --permission-mode bypassPermissions --print 'Build the feature. When done, run: openclaw system event --text \"Done: built feature\" --mode now'"
```

## Comparison with Default Coding Agent

| Feature | `coding-agent` | `coding-agent-any` |
|---|---|---|
| Anthropic models | Yes | Yes |
| OpenAI models | No | **Yes** |
| Local models (Ollama) | No | **Yes** |
| Groq/Together/vLLM | No | **Yes** |
| Provider profiles | No | **Yes** |
| Smart routing | No | **Yes** |
| ACP support | No | **Yes** |
| PTY required | Claude: No | No |
| Install | `npm i -g @anthropic-ai/claude-code` | `git clone + build` |
