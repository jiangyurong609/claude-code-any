#!/bin/bash
# claude-code-any installer
# One-liner: curl -fsSL https://raw.githubusercontent.com/jiangyurong609/claude-code-any/main/install.sh | bash
#
# Installs claude-code-any globally as `claude-any` / `cca` / `claude-code-any`
# Auto-detects existing API keys from your environment.

set -e

INSTALL_DIR="${CLAUDE_ANY_INSTALL_DIR:-$HOME/.claude-any-src}"
REPO="https://github.com/jiangyurong609/claude-code-any.git"

echo "🌐 Installing claude-code-any..."
echo ""

# Check prerequisites
check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    echo "❌ $1 is required but not installed."
    echo "   Install: $2"
    return 1
  fi
  echo "✅ $1 found"
}

check_cmd "bun" "curl -fsSL https://bun.sh/install | bash" || exit 1
check_cmd "pnpm" "npm i -g pnpm" || exit 1
check_cmd "node" "https://nodejs.org" || exit 1
check_cmd "git" "xcode-select --install (macOS) or apt install git" || exit 1

echo ""

# Clone or update
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "📦 Updating existing installation..."
  cd "$INSTALL_DIR"
  git pull --ff-only 2>/dev/null || git fetch origin main && git reset --hard origin/main
else
  echo "📦 Cloning repository..."
  git clone --depth 1 "$REPO" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# Install deps
echo "📦 Installing dependencies..."
pnpm install --registry https://registry.npmjs.org 2>&1 | tail -3

# Build
echo "🔨 Building..."
bun run build.ts 2>&1 | tail -3

# Link globally
echo "🔗 Linking globally..."
npm link 2>&1 | tail -1

echo ""
echo "✅ claude-code-any installed successfully!"
echo ""

# Verify
echo "Verification:"
echo "  claude-any --version → $(claude-any --version 2>&1)"
echo ""

# Check for existing API keys
echo "Detected API keys:"
[ -n "$OPENAI_API_KEY" ] && echo "  ✅ OPENAI_API_KEY set" || echo "  ⬜ OPENAI_API_KEY not set"
[ -n "$ANTHROPIC_API_KEY" ] && echo "  ✅ ANTHROPIC_API_KEY set" || echo "  ⬜ ANTHROPIC_API_KEY not set"
[ -n "$TOGETHER_API_KEY" ] && echo "  ✅ TOGETHER_API_KEY set" || true
[ -n "$OPENROUTER_API_KEY" ] && echo "  ✅ OPENROUTER_API_KEY set" || true
[ -n "$DEEPSEEK_API_KEY" ] && echo "  ✅ DEEPSEEK_API_KEY set" || true

echo ""
echo "Quick start:"
echo "  claude-any doctor                    # check config"
echo "  claude-any -p 'say hello'            # test it"
echo ""
echo "For OpenClaw: copy skills/coding-agent-any/ to your workspace skills/"
echo "  cp -r $INSTALL_DIR/skills/coding-agent-any ~/.openclaw/skills/"
echo ""
echo "Done! 🎉"
