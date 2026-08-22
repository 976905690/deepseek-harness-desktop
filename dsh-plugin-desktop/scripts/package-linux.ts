/** Build verified Linux x64 and arm64 AppImage and DEB artifacts. */

import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prepareInstalledLinuxRuntime } from './linux-runtime.ts'

/** Injectable native Linux packaging boundary used by focused tests. */
export interface LinuxPackageOptions {
  readonly env: NodeJS.ProcessEnv
  readonly platform: NodeJS.Platform
  readonly arch: string
  readonly nodeVersion: string
  readonly workspaceRoot: string
  readonly desktopRoot: string
  readonly outputDir: string
  readonly resetOutput: () => void
  readonly prepareRuntime: () => void
  readonly builderCli: string
  readonly verifier: string
  readonly nodeExecutable: string
  readonly run: (
    command: string,
    args: readonly string[],
    cwd: string,
    env: NodeJS.ProcessEnv,
  ) => void
  readonly log: (message: string) => void
}

function run(
  command: string,
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): void {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' })
  if (result.error !== undefined) throw result.error
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with ${String(result.status)}`)
  }
}

function defaultOptions(): LinuxPackageOptions {
  const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const workspaceRoot = resolve(desktopRoot, '..')
  const outputDir = resolve(desktopRoot, 'dist', 'linux')
  const require = createRequire(import.meta.url)
  return {
    env: process.env,
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.versions.node,
    workspaceRoot,
    desktopRoot,
    outputDir,
    resetOutput: () => rmSync(outputDir, { recursive: true, force: true }),
    prepareRuntime: () => prepareInstalledLinuxRuntime(desktopRoot),
    builderCli: require.resolve('electron-builder/cli.js'),
    verifier: fileURLToPath(new URL('./verify-linux-artifacts.ts', import.meta.url)),
    nodeExecutable: process.execPath,
    run,
    log: message => console.log(message),
  }
}

/** Run Linux release gates, package both CPUs, and verify all four artifacts. */
export function packageLinux(options: LinuxPackageOptions = defaultOptions()): void {
  if (options.platform !== 'linux') {
    throw new Error('Linux AppImage and DEB artifacts must be built on a native Linux host')
  }
  if (options.arch !== 'x64' && options.arch !== 'arm64') {
    throw new Error(`Linux packaging requires x64 or arm64 Node; received ${options.arch}`)
  }
  const versionMatch = /^(\d+)\.(\d+)\./u.exec(options.nodeVersion)
  const major = Number(versionMatch?.[1])
  const minor = Number(versionMatch?.[2])
  if (!((major === 22 && minor >= 19) || major === 24)) {
    throw new Error(
      `Linux packaging requires Node 22.19+ or Node 24.x with bundled Corepack; received ${options.nodeVersion}`,
    )
  }

  options.log('Building Linux x64 and arm64 AppImage and DEB artifacts.')
  if (options.env.DSH_PACKAGE_CHECK_ALREADY_RAN !== '1') {
    options.run(
      'corepack',
      ['yarn', 'workspace', 'dsh-plugin-desktop', 'check:linux-package'],
      options.workspaceRoot,
      options.env,
    )
  } else {
    options.log('Skipping the Linux package preflight; the package gate already passed.')
  }
  options.resetOutput()
  options.prepareRuntime()
  options.run(
    options.nodeExecutable,
    [
      options.builderCli,
      '--linux',
      'AppImage',
      'deb',
      '--x64',
      '--arm64',
      '--publish',
      'never',
      '--config.npmRebuild=false',
      `--config.directories.output=${options.outputDir}`,
    ],
    options.desktopRoot,
    {
      ...options.env,
      CSC_IDENTITY_AUTO_DISCOVERY: 'false',
    },
  )
  options.run(
    options.nodeExecutable,
    [options.verifier, options.outputDir],
    options.desktopRoot,
    options.env,
  )
}

const invokedPath = process.argv[1]
if (invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  try {
    packageLinux()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
