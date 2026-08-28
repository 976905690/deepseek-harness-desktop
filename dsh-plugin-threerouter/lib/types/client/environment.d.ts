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
export type ThreerouterClientPlatform = 'darwin' | 'win32' | 'linux';
/** Renderer modes accepted from the Electron-owned page URL. */
export type ThreerouterClientMode = 'compatibility' | 'extended' | 'advanced';
/** Validated Threerouter renderer environment sourced from the page URL. */
export interface ThreerouterClientEnvironment {
    /** Active shell mode for this BrowserWindow lifetime. */
    mode: ThreerouterClientMode;
    /** Electron Host platform used for native spacing and drag regions. */
    platform: ThreerouterClientPlatform;
    /** Installed product version supplied by the Electron Host. */
    version: string;
    /** Product title surfaced by the advanced shell's desktop caption row. */
    windowTitle?: string;
}
/**
 * Resolve the Threerouter renderer environment from the page URL search string.
 * @param search - URL search string, including or omitting the leading `?`.
 * @returns the validated environment, or undefined outside the desktop shell.
 */
export declare function parseThreerouterClientEnvironment(search: string): ThreerouterClientEnvironment | undefined;
