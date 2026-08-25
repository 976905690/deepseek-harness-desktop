/** Desktop renderer modes accepted from the Electron-owned page URL. */
export type DesktopClientMode = 'compatibility' | 'advanced'

/** Host platforms whose native chrome has a desktop presentation. */
export type DesktopClientPlatform = 'darwin' | 'win32' | 'linux'

/** Validated renderer environment supplied by the Electron Host. */
export interface DesktopClientEnvironment {
  /** Active shell mode for this BrowserWindow lifetime. */
  mode: DesktopClientMode
  /** Electron Host platform used for native spacing and drag regions. */
  platform: DesktopClientPlatform
  /** Desktop package version from dsh-plugin-desktop/package.json. */
  version: string
  /** Product title surfaced by the advanced shell's desktop caption row. */
  windowTitle: string
}

const MODES = new Set<DesktopClientMode>(['compatibility', 'advanced'])
const PLATFORMS = new Set<DesktopClientPlatform>(['darwin', 'win32', 'linux'])

/**
 * Validate the Electron-owned query marker before any desktop client effects run.
 * @param search - URL search string, including or omitting the leading question mark.
 * @returns the validated desktop renderer environment.
 */
export function parseDesktopClientEnvironment(search: string): DesktopClientEnvironment {
  const params = new URLSearchParams(search)
  const mode = params.get('dsh-desktop-mode')
  const platform = params.get('dsh-desktop-platform')
  const version = params.get('dsh-desktop-version')
  const windowTitle = params.get('dsh-desktop-title')
  if (!MODES.has(mode as DesktopClientMode)) {
    throw new Error(`dsh-plugin-desktop: invalid or missing dsh-desktop-mode ${JSON.stringify(mode)}`)
  }
  if (!PLATFORMS.has(platform as DesktopClientPlatform)) {
    throw new Error(`dsh-plugin-desktop: invalid or missing dsh-desktop-platform ${JSON.stringify(platform)}`)
  }
  if (version === null || version === '') {
    throw new Error('dsh-plugin-desktop: invalid or missing dsh-desktop-version')
  }
  if (windowTitle === null || windowTitle === '') {
    throw new Error('dsh-plugin-desktop: invalid or missing dsh-desktop-title')
  }
  return { mode: mode as DesktopClientMode, platform: platform as DesktopClientPlatform, version, windowTitle }
}
