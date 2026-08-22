import { describe, expect, it, vi } from 'vitest'
import { packageLinux, type LinuxPackageOptions } from '../scripts/package-linux.ts'

interface CommandCall {
  readonly command: string
  readonly args: readonly string[]
  readonly cwd: string
  readonly env: NodeJS.ProcessEnv
}

function options(calls: CommandCall[], logs: string[] = []): LinuxPackageOptions {
  return {
    env: { PATH: '/usr/bin', SAFE_VALUE: 'kept' },
    platform: 'linux',
    arch: 'x64',
    nodeVersion: '22.23.2',
    workspaceRoot: '/repo',
    desktopRoot: '/repo/dsh-plugin-desktop',
    outputDir: '/repo/dsh-plugin-desktop/dist/linux',
    resetOutput: vi.fn(),
    prepareRuntime: vi.fn(),
    builderCli: '/repo/node_modules/electron-builder/cli.js',
    verifier: '/repo/dsh-plugin-desktop/scripts/verify-linux-artifacts.ts',
    nodeExecutable: '/usr/bin/node',
    run: (command, args, cwd, env) => {
      calls.push({ command, args: [...args], cwd, env: { ...env } })
    },
    log: message => logs.push(message),
  }
}

describe('Linux package command boundary', () => {
  it('runs the package gate, builds both formats and CPUs, then verifies them', () => {
    const calls: CommandCall[] = []
    const logs: string[] = []
    const value = options(calls, logs)

    packageLinux(value)

    expect(value.resetOutput).toHaveBeenCalledOnce()
    expect(value.prepareRuntime).toHaveBeenCalledOnce()
    expect(calls).toEqual([
      {
        command: 'corepack',
        args: ['yarn', 'workspace', 'dsh-plugin-desktop', 'check:linux-package'],
        cwd: '/repo',
        env: { PATH: '/usr/bin', SAFE_VALUE: 'kept' },
      },
      {
        command: '/usr/bin/node',
        args: [
          '/repo/node_modules/electron-builder/cli.js',
          '--linux',
          'AppImage',
          'deb',
          '--x64',
          '--arm64',
          '--publish',
          'never',
          '--config.npmRebuild=false',
          '--config.directories.output=/repo/dsh-plugin-desktop/dist/linux',
        ],
        cwd: '/repo/dsh-plugin-desktop',
        env: {
          PATH: '/usr/bin',
          SAFE_VALUE: 'kept',
          CSC_IDENTITY_AUTO_DISCOVERY: 'false',
        },
      },
      {
        command: '/usr/bin/node',
        args: [
          '/repo/dsh-plugin-desktop/scripts/verify-linux-artifacts.ts',
          '/repo/dsh-plugin-desktop/dist/linux',
        ],
        cwd: '/repo/dsh-plugin-desktop',
        env: { PATH: '/usr/bin', SAFE_VALUE: 'kept' },
      },
    ])
    expect(logs).toEqual(['Building Linux x64 and arm64 AppImage and DEB artifacts.'])
  })

  it('reuses a completed package gate when explicitly requested', () => {
    const calls: CommandCall[] = []
    const logs: string[] = []
    const value = options(calls, logs)
    value.env.DSH_PACKAGE_CHECK_ALREADY_RAN = '1'

    packageLinux(value)

    expect(calls).toHaveLength(2)
    expect(logs).toEqual([
      'Building Linux x64 and arm64 AppImage and DEB artifacts.',
      'Skipping the Linux package preflight; the package gate already passed.',
    ])
  })

  it.each([
    ['win32', 'x64', '22.23.2', 'native Linux host'],
    ['linux', 'ia32', '22.23.2', 'x64 or arm64 Node'],
    ['linux', 'x64', '25.0.0', 'Node 22.19+ or Node 24.x'],
  ] as const)(
    'rejects unsupported host %s/%s with Node %s',
    (platform, arch, nodeVersion, message) => {
      const calls: CommandCall[] = []
      const value = { ...options(calls), platform, arch, nodeVersion }

      expect(() => packageLinux(value)).toThrow(message)
      expect(calls).toEqual([])
    },
  )
})
