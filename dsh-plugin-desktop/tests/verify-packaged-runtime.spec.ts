import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import AdmZip from 'adm-zip'
import {
  afterPack,
  allowedUnpackedRuntimeEntry,
  FORBIDDEN_WINDOWS_X64_RUNTIME_PREFIXES,
  REQUIRED_LINUX_NATIVE_ENTRIES,
  REQUIRED_MACOS_UNIVERSAL_ENTRIES,
  REQUIRED_PACKAGED_RUNTIME_ENTRIES,
  REQUIRED_UNPACKED_RUNTIME_ENTRIES,
  REQUIRED_WINDOWS_X64_NATIVE_ENTRIES,
  REQUIRED_WINDOWS_X64_NODE_PTY_ENTRIES,
  resolvePackagedAsarPath,
  resolvePackagedUnpackedRoot,
  smokePackagedDiagnosticWorker,
  verifyPackagedRuntime,
  verifyUnpackedRuntimeScope,
  type ArchiveLister,
  type FileProbe,
  type PackagedDiagnosticWorkerLauncher,
  type PackagedRuntimeContext,
} from '../scripts/verify-packaged-runtime.ts'
import { FORBIDDEN_MACOS_UNIVERSAL_ENTRIES } from '../scripts/mac-universal.ts'
import { linuxNativeEntries } from '../scripts/linux-runtime.ts'

function context(
  appOutDir: string,
  electronPlatformName: string,
  arch?: number,
): PackagedRuntimeContext {
  return {
    appOutDir,
    electronPlatformName,
    ...(arch === undefined ? {} : { arch }),
    packager: { appInfo: { productFilename: 'DSH Desktop' } },
  }
}

function completeArchiveEntries(separator = '/'): string[] {
  return REQUIRED_PACKAGED_RUNTIME_ENTRIES.map(entry => `${separator}${entry.replaceAll('/', separator)}`)
}

function requiredPhysicalEntries(runtimeContext: PackagedRuntimeContext): readonly string[] {
  if (runtimeContext.electronPlatformName === 'win32') {
    return [
      ...REQUIRED_UNPACKED_RUNTIME_ENTRIES,
      ...REQUIRED_WINDOWS_X64_NODE_PTY_ENTRIES,
      ...REQUIRED_WINDOWS_X64_NATIVE_ENTRIES,
    ]
  }
  if (runtimeContext.electronPlatformName === 'darwin' && runtimeContext.arch === 4) {
    return [
      ...REQUIRED_UNPACKED_RUNTIME_ENTRIES,
      ...REQUIRED_MACOS_UNIVERSAL_ENTRIES,
    ]
  }
  if (runtimeContext.electronPlatformName === 'linux') {
    const arch = runtimeContext.arch === 1 ? 'x64' : 'arm64'
    return [
      ...REQUIRED_UNPACKED_RUNTIME_ENTRIES,
      ...linuxNativeEntries(arch).map(entry => entry.path),
    ]
  }
  return REQUIRED_UNPACKED_RUNTIME_ENTRIES
}

function physicalProbe(
  runtimeContext: PackagedRuntimeContext,
  options: { readonly missing?: string, readonly extra?: string } = {},
): FileProbe {
  const unpackedRoot = resolvePackagedUnpackedRoot(runtimeContext)
  const present = new Set(requiredPhysicalEntries(runtimeContext)
    .filter(entry => entry !== options.missing)
    .map(entry => join(unpackedRoot, entry)))
  if (options.extra !== undefined) present.add(join(unpackedRoot, options.extra))
  return filename => present.has(filename)
}

describe('packaged desktop runtime verification', () => {
  it('fails the diagnostic Worker smoke when its archive omits the crash dump', async () => {
    const unpackedRoot = resolvePackagedUnpackedRoot(context('/build', 'win32'))
    const launch = vi.fn<PackagedDiagnosticWorkerLauncher>(async (_workerPath, workerData) => {
      const outDir = join(workerData.userDataDir, 'diagnostics')
      mkdirSync(outDir)
      const output = join(outDir, 'diagnostics-smoke.zip')
      const zip = new AdmZip()
      zip.addFile('system-info.txt', Buffer.from('no dump\n'))
      zip.writeZip(output)
      return output
    })

    await expect(smokePackagedDiagnosticWorker(unpackedRoot, launch))
      .rejects.toThrow('packaged diagnostic worker omitted crash-dumps/pending/packaged-smoke.dmp')
  })

  it.each(['darwin', 'linux', 'win32'])(
    'targets the physical diagnostic Worker in the %s unpacked layout and removes smoke files',
    async (platform) => {
      const unpackedRoot = resolvePackagedUnpackedRoot(context('/build', platform))
      let smokeRoot: string | undefined
      const launch = vi.fn<PackagedDiagnosticWorkerLauncher>(async (workerPath, workerData) => {
        smokeRoot = join(workerData.logsDir, '..')
        expect(workerPath).toBe(join(unpackedRoot, 'lib', 'diagnostic-export-worker.js'))
        expect(readFileSync(join(workerData.logsDir, 'dsh-2000-01-01.log'), 'utf8'))
          .toBe('packaged worker smoke\n')
        const crashDump = readFileSync(join(workerData.crashDumpsDir, 'pending', 'packaged-smoke.dmp'))
        const outDir = join(workerData.userDataDir, 'diagnostics')
        mkdirSync(outDir)
        const output = join(outDir, 'diagnostics-smoke.zip')
        const zip = new AdmZip()
        zip.addFile('crash-dumps/pending/packaged-smoke.dmp', crashDump)
        zip.writeZip(output)
        return output
      })

      await smokePackagedDiagnosticWorker(unpackedRoot, launch)

      expect(launch).toHaveBeenCalledOnce()
      expect(smokeRoot).toBeDefined()
      expect(existsSync(smokeRoot as string)).toBe(false)
    },
  )

  it('runs the static package gate before the diagnostic Worker smoke', async () => {
    const runtimeContext = context('/build', 'win32')
    const calls: string[] = []

    await afterPack(
      runtimeContext,
      () => { calls.push('static') },
      async (unpackedRoot) => { calls.push(unpackedRoot) },
    )

    expect(calls).toEqual(['static', resolvePackagedUnpackedRoot(runtimeContext)])
  })

  it.each([
    [
      'darwin',
      join('/build', 'DSH Desktop.app', 'Contents', 'Resources', 'app.asar'),
      undefined,
    ],
    [
      'win32',
      join('/build', 'resources', 'app.asar'),
      undefined,
    ],
    [
      'linux',
      join('/build', 'resources', 'app.asar'),
      1,
    ],
  ] as const)('inspects the %s app.asar path', (platform, expectedPath, arch) => {
    const runtimeContext = context('/build', platform, arch)
    const list = vi.fn<ArchiveLister>(() => completeArchiveEntries(platform === 'win32' ? '\\' : '/'))

    verifyPackagedRuntime(runtimeContext, list, physicalProbe(runtimeContext))

    expect(resolvePackagedAsarPath(runtimeContext)).toBe(expectedPath)
    expect(list).toHaveBeenCalledWith(expectedPath, { isPack: false })
    expect(resolvePackagedUnpackedRoot(runtimeContext)).toBe(`${expectedPath}.unpacked`)
  })

  it('rejects an unsupported platform instead of guessing an archive layout', () => {
    expect(() => resolvePackagedAsarPath(context('/build', 'mas')))
      .toThrow('unsupported Electron afterPack platform "mas"')
  })

  it.each([
    'lib/main.js.map',
    'node_modules/example/index.js.map',
    'node_modules/example/source.ts',
    'node_modules/example/source.mts',
    'node_modules/example/source.cts',
  ])('rejects excluded development source %s', (forbidden) => {
    const runtimeContext = context('/build', 'win32')
    expect(() => verifyPackagedRuntime(
      runtimeContext,
      () => [...completeArchiveEntries(), `/${forbidden}`],
      physicalProbe(runtimeContext),
    )).toThrow(`contains excluded development sources: ${forbidden}`)
  })

  it.each(FORBIDDEN_WINDOWS_X64_RUNTIME_PREFIXES)(
    'rejects forbidden Windows x64 runtime prefix %s',
    (prefix) => {
      const forbidden = `${prefix}payload.bin`
      const runtimeContext = context('/build', 'win32')

      expect(() => verifyPackagedRuntime(
        runtimeContext,
        () => [...completeArchiveEntries(), `/${forbidden}`],
        physicalProbe(runtimeContext),
      )).toThrow(`contains non-x64 or build-only entries: ${forbidden}`)
    },
  )

  it('allows only native, executable, preset, and Worker paths outside ASAR', () => {
    expect(allowedUnpackedRuntimeEntry('lib/diagnostic-export-worker.js')).toBe(true)
    expect(allowedUnpackedRuntimeEntry('node_modules/@deepseek-ai/node-addon-landlock-run-linux-x64/native.node')).toBe(true)
    expect(allowedUnpackedRuntimeEntry('node_modules/@vscode/ripgrep-win32-x64/bin/rg.exe')).toBe(true)
    expect(allowedUnpackedRuntimeEntry('node_modules')).toBe(true)
    expect(allowedUnpackedRuntimeEntry('lib/main.js')).toBe(false)
    expect(allowedUnpackedRuntimeEntry('node_modules/yaml/dist/index.js')).toBe(false)
  })

  it('rejects ordinary JavaScript leaking into app.asar.unpacked', () => {
    const unpackedRoot = join('/build', 'resources', 'app.asar.unpacked')
    const leaked = 'node_modules/yaml/dist/index.js'

    expect(() => verifyUnpackedRuntimeScope(
      new Set(['lib/main.js', leaked]),
      unpackedRoot,
      filename => filename === join(unpackedRoot, leaked),
    )).toThrow(`contains non-whitelisted physical entries: ${leaked}`)
  })

  it('requires both CPU variants from a universal macOS runtime', () => {
    const runtimeContext = context('/build', 'darwin', 4)
    const missing = 'node_modules/@vscode/ripgrep-darwin-x64/bin/rg'

    expect(() => verifyPackagedRuntime(
      runtimeContext,
      () => completeArchiveEntries(),
      physicalProbe(runtimeContext, { missing }),
    )).toThrow(`missing required physical entries: ${missing}`)

    verifyPackagedRuntime(
      runtimeContext,
      () => completeArchiveEntries(),
      physicalProbe(runtimeContext),
    )
  })

  it.each([
    [1, 'x64'],
    [3, 'arm64'],
  ] as const)('requires the Linux %s native runtime', (arch, archName) => {
    const runtimeContext = context('/build', 'linux', arch)
    const required = linuxNativeEntries(archName)
    const missing = required[0]!.path

    expect(() => verifyPackagedRuntime(
      runtimeContext,
      () => completeArchiveEntries(),
      physicalProbe(runtimeContext, { missing }),
    )).toThrow(`missing required physical entries: ${missing}`)

    verifyPackagedRuntime(
      runtimeContext,
      () => completeArchiveEntries(),
      physicalProbe(runtimeContext),
    )
  })

  it('rejects an unknown Linux package architecture', () => {
    const runtimeContext = context('/build', 'linux', 2)

    expect(() => verifyPackagedRuntime(
      runtimeContext,
      () => completeArchiveEntries(),
      physicalProbe(context('/build', 'linux', 1)),
    )).toThrow('unsupported Linux package architecture 2')
  })

  it('rejects a host-architecture node-pty build from a universal app', () => {
    const runtimeContext = context('/build', 'darwin', 4)
    const forbidden = FORBIDDEN_MACOS_UNIVERSAL_ENTRIES[0]

    expect(() => verifyPackagedRuntime(
      runtimeContext,
      () => completeArchiveEntries(),
      physicalProbe(runtimeContext, { extra: forbidden }),
    )).toThrow(`contains host-architecture build output: ${forbidden}`)
  })

  it.each([
    'lib/client.js',
    'lib/desktop-runtime-environment.js',
    'lib/profile-service.js',
    'lib/diagnostics.js',
    'lib/diagnostic-export-worker.js',
    'lib/pnpm.js',
    'lib/update-download.js',
    'lib/windows-agent-presets.js',
  ])('fails loud when required runtime entry %s is absent', (missing) => {
    const runtimeContext = context('/build', 'win32')
    const entries = completeArchiveEntries().filter(entry => entry !== `/${missing}`)

    expect(() => verifyPackagedRuntime(runtimeContext, () => entries, physicalProbe(runtimeContext)))
      .toThrow(`missing required ASAR entries: ${missing}`)
  })

  it.each([
    'lib/diagnostic-export-worker.js',
    'node_modules/@deepseek-ai/dsh/config/agent-presets/cordis/agent.cordis.yml',
    'node_modules/@deepseek-ai/dsh/config/agent-presets/cordis/skills/cordis-plugin-development/SKILL.md',
    'node_modules/@deepseek-ai/dsh/config/agent-presets/cordis/skills/editing-cordis-compositions/SKILL.md',
    'node_modules/@img/sharp-win32-x64/lib/sharp-win32-x64-0.35.3.node',
    'node_modules/@vscode/ripgrep-win32-x64/bin/rg.exe',
    'node_modules/node-pty/prebuilds/win32-x64/conpty.node',
    'node_modules/pnpm/dist/vendor/fastlist-0.3.0-x64.exe',
  ])('fails loud when required physical runtime entry %s is absent', (missing) => {
    const runtimeContext = context('/build', 'win32')

    expect(() => verifyPackagedRuntime(
      runtimeContext,
      () => completeArchiveEntries(),
      physicalProbe(runtimeContext, { missing }),
    )).toThrow(`missing required physical entries: ${missing}`)
  })

  it('tracks every Linux native path in the unpack whitelist', () => {
    expect(REQUIRED_LINUX_NATIVE_ENTRIES).toHaveLength(14)
    for (const entry of REQUIRED_LINUX_NATIVE_ENTRIES) {
      expect(allowedUnpackedRuntimeEntry(entry)).toBe(true)
    }
  })
})
