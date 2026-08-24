/** Desktop renderer modes accepted from the Electron-owned page URL. */
export type DesktopClientMode = 'compatibility' | 'extended' | 'advanced'

/** Host platforms whose native chrome has a desktop presentation. */
export type DesktopClientPlatform = 'darwin' | 'win32' | 'linux'

/** Native material selected for the current renderer generation. */
export type DesktopClientMaterial = 'off' | 'transparent' | 'acrylic' | 'mica'

/** Validated renderer environment supplied by the Electron Host. */
export interface DesktopClientEnvironment {
  /** Active shell mode for this BrowserWindow lifetime. */
  mode: DesktopClientMode
  /** Electron Host platform used for native spacing and drag regions. */
  platform: DesktopClientPlatform
  /** Capability-gated native material active behind this renderer. */
  material: DesktopClientMaterial
  /** Whether Windows exposes its supported Mica system backdrop. */
  micaSupported: boolean
}

const MODES = new Set<DesktopClientMode>(['compatibility', 'extended', 'advanced'])
const PLATFORMS = new Set<DesktopClientPlatform>(['darwin', 'win32', 'linux'])
const MATERIALS = new Set<DesktopClientMaterial>(['off', 'transparent', 'acrylic', 'mica'])

/**
 * Validate the Electron-owned query marker before any desktop client effects run.
 * @param search - URL search string, including or omitting the leading question mark.
 * @returns the validated desktop renderer environment, or undefined outside the desktop shell.
 */
export function parseDesktopClientEnvironment(search: string): DesktopClientEnvironment | undefined {
  const params = new URLSearchParams(search)
  const mode = params.get('dsh-desktop-mode')
  const platform = params.get('dsh-desktop-platform')
  const material = params.get('dsh-desktop-material')
  if (mode === null && platform === null) return undefined
  if (!MODES.has(mode as DesktopClientMode)) {
    throw new Error(`dsh-plugin-desktop: invalid or missing dsh-desktop-mode ${JSON.stringify(mode)}`)
  }
  if (!PLATFORMS.has(platform as DesktopClientPlatform)) {
    throw new Error(`dsh-plugin-desktop: invalid or missing dsh-desktop-platform ${JSON.stringify(platform)}`)
  }
  if (!MATERIALS.has(material as DesktopClientMaterial)) {
    throw new Error(`dsh-plugin-desktop: invalid or missing dsh-desktop-material ${JSON.stringify(material)}`)
  }
  const micaMarker = params.get('dsh-desktop-mica')
  const micaSupported = platform === 'win32'
    ? micaMarker === '1' ? true : micaMarker === '0' ? false : undefined
    : micaMarker === null ? false : undefined
  if (micaSupported === undefined) {
    throw new Error(`dsh-plugin-desktop: invalid dsh-desktop-mica ${JSON.stringify(micaMarker)}`)
  }
  if ((mode === 'compatibility' && material !== 'off')
    || (platform === 'darwin' && material !== 'off' && material !== 'transparent')
    || (platform === 'win32' && material === 'transparent')
    || (platform === 'linux' && material !== 'off')
    || (material === 'mica' && !micaSupported)) {
    throw new Error('dsh-plugin-desktop: renderer material is incompatible with its mode or platform')
  }
  return {
    mode: mode as DesktopClientMode,
    platform: platform as DesktopClientPlatform,
    material: material as DesktopClientMaterial,
    micaSupported,
  }
}
