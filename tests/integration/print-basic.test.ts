/**
 * Integration tests for claude-any print mode.
 * Verifies the OpenClaw contract: stdout output, exit codes, no-PTY.
 *
 * NOTE: The CLI has a cold-start overhead (~10-20s in CI). Timeouts are
 * set generously to avoid flaky failures on slow runners.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { startMockServer } from './mock-server'

const CLI_PATH = `${import.meta.dir}/../../dist/cli.js`
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
  timeoutMs: number = 60000,
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

describe('print-basic', () => {
  test('--version prints version and exits 0', async () => {
    const { stdout, exitCode } = await runCli(['--version'])
    expect(stdout.trim()).toContain('Claude Code')
    expect(exitCode).toBe(0)
  })

  test('--print returns text output', async () => {
    const { stdout, exitCode } = await runCli([
      '--print', 'Say hello',
      '--dangerously-skip-permissions',
    ], {}, 90000) // 90s for CI cold start
    expect(stdout).toContain('MOCK_RESPONSE')
    expect(exitCode).toBe(0)
  }, 95000)

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

describe('print-env-errors', () => {
  test('bad URL fails gracefully', async () => {
    // Use a definitely-unreachable URL that fails fast (connection refused)
    const { stdout, exitCode } = await runCli(
      ['--print', 'hello', '--dangerously-skip-permissions'],
      { OPENAI_BASE_URL: 'http://127.0.0.1:19999/v1' },
      90000, // generous timeout for CI
    )
    // Either non-zero exit or error in output
    expect(exitCode !== 0 || stdout.includes('Error')).toBe(true)
  }, 95000)
})
