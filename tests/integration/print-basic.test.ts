/**
 * Integration tests for claude-any.
 *
 * Fast-path commands (doctor, env, version) are lightweight and test quickly.
 * The --print test is skipped in CI because the full CLI boot takes 60-90s
 * on cold GitHub runners, making it flaky. Run it locally with:
 *   INCLUDE_SLOW_TESTS=1 bun test tests/integration/print-basic.test.ts
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { startMockServer } from './mock-server'

const CLI_PATH = `${import.meta.dir}/../../dist/cli.js`
const IS_CI = !!process.env.CI || !!process.env.GITHUB_ACTIONS
const INCLUDE_SLOW = !!process.env.INCLUDE_SLOW_TESTS

let mockServer: ReturnType<typeof startMockServer>

beforeAll(() => {
  mockServer = startMockServer(18240)
})

afterAll(() => {
  mockServer.stop()
})

function runCli(
  args: string[],
  env: Record<string, string> = {},
  timeoutMs: number = 30000,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise(async (resolve) => {
    const timer = setTimeout(() => {
      resolve({ stdout: '', stderr: 'TEST TIMEOUT', exitCode: 124 })
    }, timeoutMs)

    try {
      const proc = Bun.spawn(['bun', CLI_PATH, ...args], {
        env: {
          ...process.env,
          CLAUDE_CODE_USE_OPENAI: '1',
          OPENAI_API_KEY: 'test',
          OPENAI_BASE_URL: `http://localhost:${mockServer.port}/v1`,
          OPENAI_MODEL: 'test-model',
          OPENAI_MAX_TOKENS: '4096',
          DISABLE_DOCTOR_COMMAND: '1',
          ...env,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      })

      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      clearTimeout(timer)
      resolve({ stdout, stderr, exitCode })
    } catch (e: any) {
      clearTimeout(timer)
      resolve({ stdout: '', stderr: e.message, exitCode: 1 })
    }
  })
}

describe('fast-path commands', () => {
  test('--version prints version and exits 0', async () => {
    const { stdout, exitCode } = await runCli(['--version'])
    expect(stdout.trim()).toContain('Claude Code')
    expect(exitCode).toBe(0)
  })

  test('doctor command works', async () => {
    const { stdout, exitCode } = await runCli(['doctor'])
    expect(stdout).toContain('Claude Code Any - Diagnostics')
    expect(stdout).toContain('Provider:')
    expect(exitCode).toBe(0)
  }, 30000)

  test('env dump works', async () => {
    const { stdout, exitCode } = await runCli(['env', 'dump', '--redacted'])
    expect(stdout).toContain('Claude Code Any - Environment')
    expect(stdout).toContain('OPENAI_BASE_URL')
    expect(exitCode).toBe(0)
  })

  test('doctor with profile shows correct provider', async () => {
    const { stdout, exitCode } = await runCli(['doctor'], {
      CLAUDE_ANY_PROFILE: 'ollama',
      CLAUDE_CODE_USE_OPENAI: '',
      OPENAI_BASE_URL: '',
      OPENAI_MODEL: '',
    })
    expect(stdout).toContain('Profile:      ollama')
    expect(exitCode).toBe(0)
  }, 30000)
})

describe('adapter unit test', () => {
  test('mock server responds to chat completions', async () => {
    const resp = await fetch(`http://localhost:${mockServer.port}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'test',
        messages: [{ role: 'user', content: 'Say hello' }],
        stream: false,
      }),
    })
    expect(resp.ok).toBe(true)
    const json = await resp.json() as any
    expect(json.choices[0].message.content).toContain('MOCK_RESPONSE')
  })

  test('mock server streams SSE', async () => {
    const resp = await fetch(`http://localhost:${mockServer.port}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'test',
        messages: [{ role: 'user', content: 'Say hello' }],
        stream: true,
      }),
    })
    expect(resp.ok).toBe(true)
    const text = await resp.text()
    expect(text).toContain('data: ')
    expect(text).toContain('MOCK_RESPONSE')
    expect(text).toContain('[DONE]')
  })
})

// Full --print test: only run locally or when explicitly requested.
// The full CLI boot takes 60-90s on CI runners, making this flaky.
const printDescribe = (IS_CI && !INCLUDE_SLOW) ? describe.skip : describe

printDescribe('print-mode (slow)', () => {
  test('--print returns text output via mock server', async () => {
    const { stdout, exitCode } = await runCli([
      '--print', 'Say hello',
      '--dangerously-skip-permissions',
    ], {}, 120000)
    expect(stdout).toContain('MOCK_RESPONSE')
    expect(exitCode).toBe(0)
  }, 125000)
})
