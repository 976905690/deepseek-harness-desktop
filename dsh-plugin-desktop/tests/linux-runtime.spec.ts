import { join, resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  LINUX_NATIVE_ENTRIES,
  linuxNativeEntries,
  prepareLinuxRuntime,
} from '../scripts/linux-runtime.ts'

describe('Linux native runtime preparation', () => {
  it('owns a complete native inventory for x64 and arm64', () => {
    expect(linuxNativeEntries('x64')).toHaveLength(7)
    expect(linuxNativeEntries('arm64')).toHaveLength(7)
    expect(LINUX_NATIVE_ENTRIES.map(entry => entry.path)).toEqual(expect.arrayContaining([
      'node_modules/@deepseek-ai/node-addon-landlock-run-linux-x64/bin/landlock-run',
      'node_modules/@img/sharp-linux-arm64/lib/sharp-linux-arm64-0.35.3.node',
      'node_modules/@vscode/ripgrep-linux-x64/bin/rg',
      'node_modules/node-pty/prebuilds/linux-arm64/pty.node',
    ]))
  })

  it('validates both CPU trees and restores executable tools', () => {
    const root = '/repo/dsh-plugin-desktop'
    const chmod = vi.fn()

    prepareLinuxRuntime({ desktopRoot: root, exists: () => true, chmod })

    expect(chmod.mock.calls).toEqual(
      LINUX_NATIVE_ENTRIES
        .filter(entry => 'executable' in entry && entry.executable)
        .map(entry => [join(resolve(root), entry.path), 0o755]),
    )
  })

  it('fails before packaging when a native file is absent', () => {
    const root = '/repo/dsh-plugin-desktop'
    const missing = LINUX_NATIVE_ENTRIES[0]!.path

    expect(() => prepareLinuxRuntime({
      desktopRoot: root,
      exists: path => path !== join(resolve(root), missing),
      chmod: () => undefined,
    })).toThrow(join(resolve(root), missing))
  })
})
