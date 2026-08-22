/** Verify Linux AppImage, DEB, and unpacked application artifacts. */

import { execFileSync } from 'node:child_process'
import { closeSync, openSync, readFileSync, readSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { LinuxPackageArch } from './linux-runtime.ts'

const PACKAGE_ARCHES = [
  { arch: 'x64', artifactArch: 'x86_64', debArch: 'amd64', elfMachine: 0x3e, unpacked: 'linux-unpacked' },
  { arch: 'arm64', artifactArch: 'arm64', debArch: 'arm64', elfMachine: 0xb7, unpacked: 'linux-arm64-unpacked' },
] as const satisfies readonly {
  readonly arch: LinuxPackageArch
  readonly artifactArch: string
  readonly debArch: string
  readonly elfMachine: number
  readonly unpacked: string
}[]

const ELF_HEADER_BYTES = 20
const AR_MAGIC = Buffer.from('!<arch>\n', 'ascii')

export interface LinuxArtifactVerificationOptions {
  readonly distDir: string
  readonly version: string
  readonly stat: (path: string) => {
    readonly isFile: boolean
    readonly mode: number
    readonly size: number
  }
  readonly readHeader: (path: string, length: number) => Buffer
  readonly run: (command: string, args: readonly string[]) => string
}

export interface VerifiedLinuxArtifact {
  readonly appImagePath: string
  readonly arch: LinuxPackageArch
  readonly debPath: string
  readonly executablePath: string
}

function defaultOptions(): LinuxArtifactVerificationOptions {
  const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const manifest = JSON.parse(readFileSync(join(desktopRoot, 'package.json'), 'utf8')) as {
    version?: unknown
  }
  if (typeof manifest.version !== 'string') {
    throw new Error('Linux artifact verification requires a package version')
  }
  return {
    distDir: process.argv[2] === undefined
      ? join(desktopRoot, 'dist', 'linux')
      : resolve(process.argv[2]),
    version: manifest.version,
    stat: path => {
      const result = statSync(path)
      return { isFile: result.isFile(), mode: result.mode, size: result.size }
    },
    readHeader: (path, length) => {
      const handle = openSync(path, 'r')
      try {
        const header = Buffer.alloc(length)
        const bytesRead = readSync(handle, header, 0, length, 0)
        return header.subarray(0, bytesRead)
      } finally {
        closeSync(handle)
      }
    },
    run: (command, args) => execFileSync(command, args, { encoding: 'utf8' }),
  }
}

function assertRegularFile(
  options: LinuxArtifactVerificationOptions,
  path: string,
  executable = false,
): void {
  let result: ReturnType<LinuxArtifactVerificationOptions['stat']>
  try {
    result = options.stat(path)
  } catch (cause) {
    throw new Error(`Linux artifact is missing ${path}`, { cause })
  }
  if (!result.isFile || result.size === 0) {
    throw new Error(`Linux artifact is not a non-empty regular file: ${path}`)
  }
  if (executable && (result.mode & 0o111) === 0) {
    throw new Error(`Linux artifact is not executable: ${path}`)
  }
}

function assertElf(
  path: string,
  machine: number,
  readHeader: (path: string, length: number) => Buffer,
): void {
  const header = readHeader(path, ELF_HEADER_BYTES)
  if (
    header.byteLength < ELF_HEADER_BYTES
    || header[0] !== 0x7f
    || header.subarray(1, 4).toString('ascii') !== 'ELF'
    || header[4] !== 2
    || header[5] !== 1
  ) {
    throw new Error(`Linux executable does not have a 64-bit little-endian ELF header: ${path}`)
  }
  if (header.readUInt16LE(18) !== machine) {
    throw new Error(`Linux executable has the wrong CPU architecture: ${path}`)
  }
}

function assertDebianArchive(
  path: string,
  readHeader: (path: string, length: number) => Buffer,
): void {
  if (!readHeader(path, AR_MAGIC.byteLength).equals(AR_MAGIC)) {
    throw new Error(`Linux DEB does not have an ar archive header: ${path}`)
  }
}

/** Verify both architecture-specific AppImages, DEBs, and staging applications. */
export function verifyLinuxArtifacts(
  options: LinuxArtifactVerificationOptions = defaultOptions(),
): readonly VerifiedLinuxArtifact[] {
  const verified: VerifiedLinuxArtifact[] = []
  for (const entry of PACKAGE_ARCHES) {
    const appImagePath = join(
      options.distDir,
      `DSH-Desktop-${options.version}-${entry.artifactArch}.AppImage`,
    )
    const debPath = join(
      options.distDir,
      `DSH-Desktop-${options.version}-${entry.debArch}.deb`,
    )
    const unpackedRoot = join(options.distDir, entry.unpacked)
    const executablePath = join(unpackedRoot, 'dsh-desktop')
    const appAsarPath = join(unpackedRoot, 'resources', 'app.asar')

    assertRegularFile(options, appImagePath, true)
    assertElf(appImagePath, entry.elfMachine, options.readHeader)
    assertRegularFile(options, debPath)
    assertDebianArchive(debPath, options.readHeader)
    assertRegularFile(options, executablePath, true)
    assertElf(executablePath, entry.elfMachine, options.readHeader)
    assertRegularFile(options, appAsarPath)

    const debPackage = options.run('dpkg-deb', ['--field', debPath, 'Package']).trim()
    const debVersion = options.run('dpkg-deb', ['--field', debPath, 'Version']).trim()
    const debArchitecture = options.run('dpkg-deb', ['--field', debPath, 'Architecture']).trim()
    if (debPackage !== 'dsh-desktop') {
      throw new Error(`Linux DEB has unexpected package name ${JSON.stringify(debPackage)}: ${debPath}`)
    }
    if (debVersion !== options.version) {
      throw new Error(`Linux DEB has unexpected version ${JSON.stringify(debVersion)}: ${debPath}`)
    }
    if (debArchitecture !== entry.debArch) {
      throw new Error(
        `Linux DEB has unexpected architecture ${JSON.stringify(debArchitecture)}: ${debPath}`,
      )
    }
    const contents = options.run('dpkg-deb', ['--contents', debPath])
    for (const required of [
      './opt/DSH Desktop/dsh-desktop',
      './opt/DSH Desktop/resources/app.asar',
    ]) {
      if (!contents.includes(required)) {
        throw new Error(`Linux DEB is missing ${required}: ${debPath}`)
      }
    }

    verified.push({ appImagePath, arch: entry.arch, debPath, executablePath })
  }
  return verified
}

const invokedPath = process.argv[1]
if (invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  try {
    const verified = verifyLinuxArtifacts()
    console.log(`Linux artifact verification passed for ${String(verified.length)} architectures.`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
