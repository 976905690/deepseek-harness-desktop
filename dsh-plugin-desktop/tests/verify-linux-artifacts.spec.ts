import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  verifyLinuxArtifacts,
  type LinuxArtifactVerificationOptions,
} from '../scripts/verify-linux-artifacts.ts'

const temporaryRoots: string[] = []

function elf(machine: number): Buffer {
  const header = Buffer.alloc(20)
  header.set([0x7f, 0x45, 0x4c, 0x46, 2, 1], 0)
  header.writeUInt16LE(machine, 18)
  return header
}

function fixture(): {
  readonly options: LinuxArtifactVerificationOptions
  readonly paths: Map<string, string>
} {
  const root = mkdtempSync(join(tmpdir(), 'dsh-linux-artifacts-'))
  temporaryRoots.push(root)
  const modeOverrides = new Map<string, number>()
  const paths = new Map<string, string>()
  for (const entry of [
    { arch: 'x64', artifactArch: 'x86_64', debArch: 'amd64', machine: 0x3e, unpacked: 'linux-unpacked' },
    { arch: 'arm64', artifactArch: 'arm64', debArch: 'arm64', machine: 0xb7, unpacked: 'linux-arm64-unpacked' },
  ] as const) {
    const appImage = join(root, `DSH-Desktop-2.0.2-${entry.artifactArch}.AppImage`)
    const deb = join(root, `DSH-Desktop-2.0.2-${entry.debArch}.deb`)
    const executable = join(root, entry.unpacked, 'dsh-desktop')
    const appAsar = join(root, entry.unpacked, 'resources', 'app.asar')
    mkdirSync(join(appAsar, '..'), { recursive: true })
    writeFileSync(appImage, elf(entry.machine))
    writeFileSync(deb, Buffer.concat([Buffer.from('!<arch>\n'), Buffer.from('package')]))
    writeFileSync(executable, elf(entry.machine))
    writeFileSync(appAsar, 'asar')
    modeOverrides.set(appImage, 0o755)
    modeOverrides.set(executable, 0o755)
    paths.set(`${entry.arch}:appImage`, appImage)
    paths.set(`${entry.arch}:deb`, deb)
    paths.set(`${entry.arch}:executable`, executable)
  }

  return {
    paths,
    options: {
      distDir: root,
      version: '2.0.2',
      stat: path => {
        const result = statSync(path)
        return {
          isFile: result.isFile(),
          mode: modeOverrides.get(path) ?? result.mode,
          size: result.size,
        }
      },
      readHeader: (path, length) => readFileSync(path).subarray(0, length),
      run: (_command, args) => {
        const deb = args[1] ?? ''
        const arch = deb.includes('-arm64.deb') ? 'arm64' : 'amd64'
        if (args[0] === '--contents') {
          return './opt/DSH Desktop/dsh-desktop\n./opt/DSH Desktop/resources/app.asar\n'
        }
        if (args[2] === 'Package') return 'dsh-desktop\n'
        if (args[2] === 'Version') return '2.0.2\n'
        if (args[2] === 'Architecture') return `${arch}\n`
        throw new Error(`unexpected dpkg-deb call: ${args.join(' ')}`)
      },
    },
  }
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('Linux artifact verification', () => {
  it('accepts exact x64 and arm64 AppImage, DEB, and staging artifacts', () => {
    const value = fixture()

    expect(verifyLinuxArtifacts(value.options)).toEqual([
      {
        appImagePath: value.paths.get('x64:appImage'),
        arch: 'x64',
        debPath: value.paths.get('x64:deb'),
        executablePath: value.paths.get('x64:executable'),
      },
      {
        appImagePath: value.paths.get('arm64:appImage'),
        arch: 'arm64',
        debPath: value.paths.get('arm64:deb'),
        executablePath: value.paths.get('arm64:executable'),
      },
    ])
  })

  it('rejects an AppImage for the wrong CPU', () => {
    const value = fixture()
    writeFileSync(value.paths.get('x64:appImage')!, elf(0xb7))

    expect(() => verifyLinuxArtifacts(value.options)).toThrow('wrong CPU architecture')
  })

  it('rejects a non-DEB archive before invoking dpkg-deb', () => {
    const value = fixture()
    writeFileSync(value.paths.get('x64:deb')!, 'not a deb')

    expect(() => verifyLinuxArtifacts(value.options)).toThrow('does not have an ar archive header')
  })

  it('rejects mismatched DEB metadata', () => {
    const value = fixture()
    const options: LinuxArtifactVerificationOptions = {
      ...value.options,
      run: (_command, args) => args[2] === 'Package' ? 'another-package\n' : 'unused\n',
    }

    expect(() => verifyLinuxArtifacts(options)).toThrow('unexpected package name')
  })
})
