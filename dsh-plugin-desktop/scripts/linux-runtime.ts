/** Shared preparation and verification inventory for Linux packages. */

import { chmodSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

export type LinuxPackageArch = 'arm64' | 'x64'

/** Native runtime files required by each supported Linux CPU. */
export const LINUX_NATIVE_ENTRIES = [
  {
    arch: 'arm64',
    executable: true,
    path: 'node_modules/@deepseek-ai/node-addon-landlock-run-linux-arm64/bin/landlock-run',
  },
  {
    arch: 'arm64',
    path: 'node_modules/@img/sharp-linux-arm64/lib/sharp-linux-arm64-0.35.3.node',
  },
  {
    arch: 'arm64',
    path: 'node_modules/@img/sharp-libvips-linux-arm64/lib/libvips-cpp.so.8.18.3',
  },
  {
    arch: 'arm64',
    path: 'node_modules/@koromix/koffi-linux-arm64/linux_arm64/koffi.node',
  },
  {
    arch: 'arm64',
    executable: true,
    path: 'node_modules/@vscode/ripgrep-linux-arm64/bin/rg',
  },
  {
    arch: 'arm64',
    path: 'node_modules/node-addon-require-builtin-linux-arm64-gnu/prebuilt/linux-arm64-gnu-napi-v9.node',
  },
  {
    arch: 'arm64',
    path: 'node_modules/node-pty/prebuilds/linux-arm64/pty.node',
  },
  {
    arch: 'x64',
    executable: true,
    path: 'node_modules/@deepseek-ai/node-addon-landlock-run-linux-x64/bin/landlock-run',
  },
  {
    arch: 'x64',
    path: 'node_modules/@img/sharp-linux-x64/lib/sharp-linux-x64-0.35.3.node',
  },
  {
    arch: 'x64',
    path: 'node_modules/@img/sharp-libvips-linux-x64/lib/libvips-cpp.so.8.18.3',
  },
  {
    arch: 'x64',
    path: 'node_modules/@koromix/koffi-linux-x64/linux_x64/koffi.node',
  },
  {
    arch: 'x64',
    executable: true,
    path: 'node_modules/@vscode/ripgrep-linux-x64/bin/rg',
  },
  {
    arch: 'x64',
    path: 'node_modules/node-addon-require-builtin-linux-x64-gnu/prebuilt/linux-x64-gnu-napi-v9.node',
  },
  {
    arch: 'x64',
    path: 'node_modules/node-pty/prebuilds/linux-x64/pty.node',
  },
] as const satisfies readonly {
  readonly arch: LinuxPackageArch
  readonly executable?: boolean
  readonly path: string
}[]

/** Return the physical native files required by one Linux architecture. */
export function linuxNativeEntries(arch: LinuxPackageArch): readonly (typeof LINUX_NATIVE_ENTRIES)[number][] {
  return LINUX_NATIVE_ENTRIES.filter(entry => entry.arch === arch)
}

/** Injectable filesystem boundary for source-runtime preparation. */
export interface LinuxRuntimePreparationOptions {
  readonly desktopRoot: string
  readonly exists: (path: string) => boolean
  readonly chmod: (path: string, mode: number) => void
}

/** Validate both Linux CPU trees and restore executable bits disabled by Yarn. */
export function prepareLinuxRuntime(options: LinuxRuntimePreparationOptions): void {
  const root = resolve(options.desktopRoot)
  const missing = LINUX_NATIVE_ENTRIES
    .map(entry => join(root, entry.path))
    .filter(path => !options.exists(path))
  if (missing.length > 0) {
    throw new Error(
      `Linux runtime is missing ${String(missing.length)} native file(s): ${missing.join(', ')}`,
    )
  }

  for (const entry of LINUX_NATIVE_ENTRIES) {
    if ('executable' in entry && entry.executable) options.chmod(join(root, entry.path), 0o755)
  }
}

/** Prepare the installed workspace dependency tree for Linux packaging. */
export function prepareInstalledLinuxRuntime(desktopRoot: string): void {
  prepareLinuxRuntime({ desktopRoot, exists: existsSync, chmod: chmodSync })
}
