/**
 * Threerouter client environment parser.
 *
 * Reads the `dsh-desktop-*` URL markers injected by the Electron Host so the
 * Threerouter client plugin can resolve its renderer mode, platform, version,
 * and window title without depending on `dsh-plugin-desktop`'s runtime. The
 * parser is intentionally lenient: any missing/invalid marker leaves the
 * plugin unregistered instead of crashing the renderer.
 */

/** Native platforms whose chrome the Threerouter overlay must align with. */
export type ThreerouterClientPlatform = 'darwin' | 'win32' | 'linux'

/** Renderer modes accepted from the Electron-owned page URL. */
export type ThreerouterClientMode = 'compatibility' | 'extended' | 'advanced'

/** Validated Threerouter renderer environment sourced from the page URL. */
export interface ThreerouterClientEnvironment {
  /** Active shell mode for this BrowserWindow lifetime. */
  mode: ThreerouterClientMode
  /** Electron Host platform used for native spacing and drag regions. */
  platform: ThreerouterClientPlatform
  /** Installed product version supplied by the Electron Host. */
  version: string
  /** Product title surfaced by the advanced shell's desktop caption row. */
  windowTitle?: string
}

const MODES = new Set<ThreerouterClientMode>(['compatibility', 'extended', 'advanced'])
const PLATFORMS = new Set<ThreerouterClientPlatform>(['darwin', 'win32', 'linux'])

/**
 * Resolve the Threerouter renderer environment from the page URL search string.
 * @param search - URL search string, including or omitting the leading `?`.
 * @returns the validated environment, or undefined outside the desktop shell.
 */
export function parseThreerouterClientEnvironment(search: string): ThreerouterClientEnvironment | undefined {
  const params = new URLSearchParams(search)
  const mode = params.get('dsh-desktop-mode')
  const platform = params.get('dsh-desktop-platform')
  const version = params.get('dsh-desktop-version')
  const windowTitle = params.get('dsh-desktop-title')
  if (mode === null && platform === null) return undefined
  if (!MODES.has(mode as ThreerouterClientMode)) return undefined
  if (!PLATFORMS.has(platform as ThreerouterClientPlatform)) return undefined
  if (version === null) return undefined
  const title = windowTitle === null || windowTitle === '' ? undefined : windowTitle
  return {
    mode: mode as ThreerouterClientMode,
    platform: platform as ThreerouterClientPlatform,
    version,
    ...(title === undefined ? {} : { windowTitle: title }),
  }
}
