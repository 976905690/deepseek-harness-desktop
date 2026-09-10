/** Same-origin browser client for launcher-owned Desktop settings operations. */

const SETTINGS_PATH = '/api/desktop/settings'
const PROFILE_CREATE_PATH = '/api/desktop/profiles/create'
const PROFILE_SELECT_PATH = '/api/desktop/profiles/select'
const PROFILE_DELETE_PATH = '/api/desktop/profiles/delete'
const MARKET_SELECT_PATH = '/api/desktop/market/select'
const TERMINAL_OPEN_PATH = '/api/desktop/terminal/open'
const RESTART_PATH = '/api/desktop/restart'
const RECOVERY_RESTART_PATH = '/api/desktop/restart/recovery'
const RENDERER_RELOAD_PATH = '/api/desktop/developer/reload'
const DEVELOPER_TOOLS_TOGGLE_PATH = '/api/desktop/developer/devtools'
const UPDATE_CHECK_PATH = '/api/desktop/updates/check'
const DIAGNOSTICS_EXPORT_PATH = '/api/desktop/diagnostics/export'
const IMAGE_VIDEO_CONFIG_PATH = '/api/desktop/image-video/config'
const IMAGE_VIDEO_CONFIG_SELECT_PATH = '/api/desktop/image-video/config/select'
const MAX_PROFILES = 256
const MAX_PROFILE_NAME_LENGTH = 255

/** Launcher-supported plugin market implementations. */
export type DesktopMarketProvider = 'disabled' | 'community-market' | 'dsh-market'

/** Safe profile projection returned to the renderer. */
export interface DesktopProfileView {
  readonly name: string
  readonly exists: boolean
  readonly webCapable: boolean
  readonly selectable: boolean
  readonly deletable: boolean
}

/** Market selection fixed for the running generation. */
export interface DesktopMarketView {
  readonly requested: DesktopMarketProvider
  readonly effective: DesktopMarketProvider
  readonly legacyDefaulted: boolean
}

/** Complete launcher-owned settings projection. */
export interface DesktopSettingsView {
  readonly current: string
  readonly profiles: readonly DesktopProfileView[]
  readonly market: DesktopMarketView
}

/** A persisted selection that requires a new Desktop generation. */
export interface DesktopRestartAcceptance {
  readonly accepted: true
  readonly restartRequired: boolean
}

/** Generation-scoped providers for dsh-image-video. */
export type DesktopImageVideoProvider = 'threerouter' | 'wanx' | 'seedance'

/** Credentials for one dsh-image-video provider. */
export interface DesktopImageVideoCredentials {
  readonly apiKey: string
  readonly baseURL: string
}

/** Browser view of one persisted dsh-image-video configuration. */
export interface DesktopImageVideoConfigView {
  readonly provider: DesktopImageVideoProvider
  readonly threerouter: DesktopImageVideoCredentials
  readonly wanx: DesktopImageVideoCredentials
  readonly seedance: DesktopImageVideoCredentials
  readonly defaultImageModel: string
  readonly defaultVideoModel: string
  readonly defaultImageSize: string
  readonly defaultVideoDuration: number
  readonly timeoutMs: number
  readonly pollIntervalMs: number
  readonly pollTimeoutMs: number
  readonly retryTimes: number
  readonly outputsDir: string
}

/** Browser operations consumed by the Desktop settings section. */
export interface DesktopSettingsApi {
  read(): Promise<DesktopSettingsView>
  createProfile(name: string): Promise<DesktopSettingsView>
  selectProfile(name: string): Promise<DesktopRestartAcceptance>
  deleteProfile(name: string): Promise<DesktopSettingsView>
  selectMarket(provider: DesktopMarketProvider): Promise<DesktopRestartAcceptance>
  openTerminal(): Promise<void>
  restart(): Promise<void>
  restartToRecovery(): Promise<void>
  reloadRenderer(): Promise<void>
  toggleDeveloperTools(): Promise<void>
  checkForUpdates(): Promise<void>
  exportDiagnostics(): Promise<void>
  readImageVideoConfig(): Promise<DesktopImageVideoConfigView>
  writeImageVideoConfig(next: DesktopImageVideoConfigView): Promise<DesktopRestartAcceptance>
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isMarketProvider(value: unknown): value is DesktopMarketProvider {
  return value === 'disabled' || value === 'community-market' || value === 'dsh-market'
}

function parseProfile(value: unknown): DesktopProfileView {
  if (!isObject(value)
    || typeof value.name !== 'string'
    || value.name.length === 0
    || value.name.length > MAX_PROFILE_NAME_LENGTH
    || typeof value.exists !== 'boolean'
    || typeof value.webCapable !== 'boolean'
    || typeof value.selectable !== 'boolean'
    || typeof value.deletable !== 'boolean') {
    throw new Error('dsh-plugin-desktop: invalid profile settings response')
  }
  return Object.freeze({
    name: value.name,
    exists: value.exists,
    webCapable: value.webCapable,
    selectable: value.selectable,
    deletable: value.deletable,
  })
}

/** Validate the bounded settings projection before it reaches React state. */
export function parseDesktopSettingsView(value: unknown): DesktopSettingsView {
  if (!isObject(value)
    || typeof value.current !== 'string'
    || value.current.length === 0
    || value.current.length > MAX_PROFILE_NAME_LENGTH
    || !Array.isArray(value.profiles)
    || value.profiles.length > MAX_PROFILES
    || !isObject(value.market)
    || !isMarketProvider(value.market.requested)
    || !isMarketProvider(value.market.effective)
    || typeof value.market.legacyDefaulted !== 'boolean') {
    throw new Error('dsh-plugin-desktop: invalid Desktop settings response')
  }
  const profiles = value.profiles.map(parseProfile)
  if (new Set(profiles.map(profile => profile.name)).size !== profiles.length) {
    throw new Error('dsh-plugin-desktop: duplicate profile in settings response')
  }
  return Object.freeze({
    current: value.current,
    profiles: Object.freeze(profiles),
    market: Object.freeze({
      requested: value.market.requested,
      effective: value.market.effective,
      legacyDefaulted: value.market.legacyDefaulted,
    }),
  })
}

/** Validate restart acknowledgement returned before the Host generation exits. */
export function parseDesktopRestartAcceptance(value: unknown): DesktopRestartAcceptance {
  if (!isObject(value) || value.accepted !== true || typeof value.restartRequired !== 'boolean') {
    throw new Error('dsh-plugin-desktop: invalid Desktop restart response')
  }
  return Object.freeze({ accepted: true, restartRequired: value.restartRequired })
}

/** Validate the exact acknowledgement returned by a Desktop side effect. */
export function parseDesktopActionAcceptance(value: unknown): void {
  if (!isObject(value)
    || Object.keys(value).length !== 1
    || value.accepted !== true) {
    throw new Error('dsh-plugin-desktop: invalid Desktop action response')
  }
}

function isImageVideoProvider(value: unknown): value is DesktopImageVideoProvider {
  return value === 'threerouter' || value === 'wanx' || value === 'seedance'
}

function parseImageVideoCredentials(value: unknown): DesktopImageVideoCredentials {
  if (!isObject(value) || typeof value.apiKey !== 'string' || typeof value.baseURL !== 'string') {
    throw new Error('dsh-plugin-desktop: invalid image-video credentials response')
  }
  return Object.freeze({ apiKey: value.apiKey, baseURL: value.baseURL })
}

/** Validate the bounded dsh-image-video configuration before it reaches React state. */
export function parseDesktopImageVideoConfigView(value: unknown): DesktopImageVideoConfigView {
  if (!isObject(value)
    || !isImageVideoProvider(value.provider)
    || typeof value.defaultImageModel !== 'string'
    || typeof value.defaultVideoModel !== 'string'
    || typeof value.defaultImageSize !== 'string'
    || typeof value.defaultVideoDuration !== 'number'
    || typeof value.timeoutMs !== 'number'
    || typeof value.pollIntervalMs !== 'number'
    || typeof value.pollTimeoutMs !== 'number'
    || typeof value.retryTimes !== 'number'
    || typeof value.outputsDir !== 'string') {
    throw new Error('dsh-plugin-desktop: invalid image-video configuration response')
  }
  return Object.freeze({
    provider: value.provider,
    threerouter: parseImageVideoCredentials(value.threerouter),
    wanx: parseImageVideoCredentials(value.wanx),
    seedance: parseImageVideoCredentials(value.seedance),
    defaultImageModel: value.defaultImageModel,
    defaultVideoModel: value.defaultVideoModel,
    defaultImageSize: value.defaultImageSize,
    defaultVideoDuration: value.defaultVideoDuration,
    timeoutMs: value.timeoutMs,
    pollIntervalMs: value.pollIntervalMs,
    pollTimeoutMs: value.pollTimeoutMs,
    retryTimes: value.retryTimes,
    outputsDir: value.outputsDir,
  })
}

async function readResponse(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new Error(`dsh-plugin-desktop: Desktop settings request failed (${String(response.status)})`)
  }
  try {
    return await response.json() as unknown
  } catch {
    throw new Error('dsh-plugin-desktop: Desktop settings response was not JSON')
  }
}

function post(fetcher: FetchLike, path: string, body: object): Promise<Response> {
  return fetcher(path, {
    method: 'POST',
    credentials: 'same-origin',
    redirect: 'error',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

/** Construct the default same-origin API, with a fetch seam for focused tests. */
export function createDesktopSettingsApi(fetcher: FetchLike = globalThis.fetch.bind(globalThis)): DesktopSettingsApi {
  return Object.freeze({
    async read() {
      const response = await fetcher(SETTINGS_PATH, {
        method: 'GET',
        credentials: 'same-origin',
        redirect: 'error',
        cache: 'no-store',
        headers: { 'Accept': 'application/json' },
      })
      return parseDesktopSettingsView(await readResponse(response))
    },
    async createProfile(name: string) {
      return parseDesktopSettingsView(await readResponse(await post(fetcher, PROFILE_CREATE_PATH, { name })))
    },
    async selectProfile(name: string) {
      return parseDesktopRestartAcceptance(await readResponse(await post(fetcher, PROFILE_SELECT_PATH, { name })))
    },
    async deleteProfile(name: string) {
      return parseDesktopSettingsView(await readResponse(await post(fetcher, PROFILE_DELETE_PATH, { name })))
    },
    async selectMarket(provider: DesktopMarketProvider) {
      return parseDesktopRestartAcceptance(await readResponse(await post(fetcher, MARKET_SELECT_PATH, { provider })))
    },
    async openTerminal() {
      parseDesktopActionAcceptance(await readResponse(await post(fetcher, TERMINAL_OPEN_PATH, {})))
    },
    async restart() {
      parseDesktopActionAcceptance(await readResponse(await post(fetcher, RESTART_PATH, {})))
    },
    async restartToRecovery() {
      parseDesktopActionAcceptance(await readResponse(await post(fetcher, RECOVERY_RESTART_PATH, {})))
    },
    async reloadRenderer() {
      parseDesktopActionAcceptance(await readResponse(await post(fetcher, RENDERER_RELOAD_PATH, {})))
    },
    async toggleDeveloperTools() {
      parseDesktopActionAcceptance(await readResponse(await post(fetcher, DEVELOPER_TOOLS_TOGGLE_PATH, {})))
    },
    async checkForUpdates() {
      parseDesktopActionAcceptance(await readResponse(await post(fetcher, UPDATE_CHECK_PATH, {})))
    },
    async exportDiagnostics() {
      parseDesktopActionAcceptance(await readResponse(await post(fetcher, DIAGNOSTICS_EXPORT_PATH, {})))
    },
    async readImageVideoConfig() {
      const response = await fetcher(IMAGE_VIDEO_CONFIG_PATH, {
        method: 'GET',
        credentials: 'same-origin',
        redirect: 'error',
        cache: 'no-store',
        headers: { 'Accept': 'application/json' },
      })
      return parseDesktopImageVideoConfigView(await readResponse(response))
    },
    async writeImageVideoConfig(next: DesktopImageVideoConfigView) {
      return parseDesktopRestartAcceptance(await readResponse(await post(fetcher, IMAGE_VIDEO_CONFIG_SELECT_PATH, next)))
    },
  })
}

export const desktopSettingsPaths = Object.freeze({
  settings: SETTINGS_PATH,
  profileCreate: PROFILE_CREATE_PATH,
  profileSelect: PROFILE_SELECT_PATH,
  profileDelete: PROFILE_DELETE_PATH,
  marketSelect: MARKET_SELECT_PATH,
  terminalOpen: TERMINAL_OPEN_PATH,
  restart: RESTART_PATH,
  recoveryRestart: RECOVERY_RESTART_PATH,
  rendererReload: RENDERER_RELOAD_PATH,
  developerToolsToggle: DEVELOPER_TOOLS_TOGGLE_PATH,
  updateCheck: UPDATE_CHECK_PATH,
  diagnosticsExport: DIAGNOSTICS_EXPORT_PATH,
  imageVideoConfig: IMAGE_VIDEO_CONFIG_PATH,
  imageVideoConfigSelect: IMAGE_VIDEO_CONFIG_SELECT_PATH,
})
