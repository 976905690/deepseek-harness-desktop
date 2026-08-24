/** Host-independent Electron recovery window for profile startup failures. */

import { app, BrowserWindow, screen, shell } from 'electron'
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  auxiliaryWindowChromeOptions,
  auxiliaryWindowHasCustomFrame,
} from './auxiliary-window-options.ts'
import { showDesktopMessageBox } from './desktop-dialog-window.ts'
import type { DesktopLocale } from './runtime.ts'
import { applicationNeedsReveal, revealApplication } from './electron-reveal.ts'
import { desktopRestartConfirmationCopy } from './tray-locale.ts'
import {
  DesktopStartupRecoveryController,
  type DesktopStartupRecoveryCheckpointPreview,
  type DesktopStartupRecoveryDisablePreview,
  type DesktopStartupRecoverySnapshot,
} from './startup-recovery-controller.ts'

const RECOVERY_SCHEME = 'dsh-recovery:'
const RECOVERY_DOCUMENT = fileURLToPath(new URL('./native-ui/recovery.html', import.meta.url))
const DEFAULT_RECOVERY_WIDTH = 800
const DEFAULT_RECOVERY_HEIGHT = 760
const DEFAULT_RECOVERY_MIN_WIDTH = 680
const DEFAULT_RECOVERY_MIN_HEIGHT = 560
const RECOVERY_WORK_AREA_INSET = 48

type RecoveryWindowResult = 'restart' | 'quit'
type RecoveryNoticeTone = 'info' | 'success' | 'warning' | 'error'

/** Stable launcher stage used to route and explain one startup failure. */
export type DesktopStartupFailureStage =
  | 'electron-ready'
  | 'shell-environment'
  | 'runtime-bootstrap'
  | 'profile-selection'
  | 'profile-composition'
  | 'host-boot'
  | 'renderer-startup'
  | 'health-commit'

interface RecoveryNotice {
  readonly tone: RecoveryNoticeTone
  readonly title: string
  readonly body: string
}

type RecoveryTab = 'plugins' | 'rollback' | 'profiles' | 'diagnostics'

interface RecoveryDiagnosticsState {
  readonly status: 'saving' | 'saved' | 'failed'
  readonly filename?: string
}

export interface DesktopStartupRecoveryWindowOptions {
  readonly controller?: DesktopStartupRecoveryController
  /** Fixed active-profile paths selected by the main process. */
  readonly configurationPaths?: DesktopStartupRecoveryConfigurationPaths
  readonly locale: DesktopLocale
  readonly failureStage: DesktopStartupFailureStage
  readonly failureDetail: string
  /** True when the user intentionally entered recovery before Host boot. */
  readonly requested?: boolean
  readonly exportDiagnostics: (signal: AbortSignal) => Promise<string>
  /** Open the launcher-owned terminal even when the Host did not start. */
  readonly openTerminal?: () => void | Promise<void>
  /** Main-process validated actions available from the failure generation. */
  readonly profileActions?: DesktopStartupRecoveryProfileActions
}

export interface DesktopStartupRecoveryProfile {
  readonly name: string
  readonly current: boolean
  readonly selectable: boolean
}

export interface DesktopStartupRecoveryProfileActions {
  /** Opaque per-window capability token; the main process must re-check it. */
  readonly token: string
  readonly list: () => readonly DesktopStartupRecoveryProfile[]
  readonly switchProfile: (name: string, token: string) => void | Promise<void>
  /** Open the isolated native creator; it accepts no filesystem path. */
  readonly openCreator: () => void | Promise<void>
}

export interface DesktopStartupRecoveryConfigurationPaths {
  readonly settingsDocument: string
  readonly profilePatch: string
  readonly profileManifest: string
  readonly profileDirectory: string
}

export interface DesktopStartupRecoveryScreenApi {
  getCursorScreenPoint(): { readonly x: number; readonly y: number }
  getDisplayNearestPoint(point: { readonly x: number; readonly y: number }): {
    readonly workAreaSize: { readonly width: number; readonly height: number }
  }
  getPrimaryDisplay(): {
    readonly workAreaSize: { readonly width: number; readonly height: number }
  }
}

export interface DesktopStartupRecoveryWindowBounds {
  readonly width: number
  readonly height: number
  readonly minWidth: number
  readonly minHeight: number
}

function validWorkAreaSize(
  value: { readonly width: number; readonly height: number } | undefined,
): { readonly width: number; readonly height: number } | undefined {
  if (value === undefined
    || !Number.isFinite(value.width)
    || !Number.isFinite(value.height)
    || value.width < 1
    || value.height < 1) return undefined
  return { width: Math.floor(value.width), height: Math.floor(value.height) }
}

function currentWorkAreaSize(
  screenApi: DesktopStartupRecoveryScreenApi,
): { readonly width: number; readonly height: number } | undefined {
  try {
    const current = validWorkAreaSize(
      screenApi.getDisplayNearestPoint(screenApi.getCursorScreenPoint()).workAreaSize,
    )
    if (current !== undefined) return current
  } catch {
    // Electron's screen API can be unavailable during an early-ready failure.
  }
  try {
    return validWorkAreaSize(screenApi.getPrimaryDisplay().workAreaSize)
  } catch {
    return undefined
  }
}

/** Clamp recovery dimensions to the current display, with the primary display as fallback. */
export function desktopStartupRecoveryWindowBounds(
  screenApi: DesktopStartupRecoveryScreenApi = screen,
): DesktopStartupRecoveryWindowBounds {
  const workArea = currentWorkAreaSize(screenApi)
  const width = workArea === undefined
    ? DEFAULT_RECOVERY_WIDTH
    : Math.min(DEFAULT_RECOVERY_WIDTH, Math.max(1, workArea.width - RECOVERY_WORK_AREA_INSET))
  const height = workArea === undefined
    ? DEFAULT_RECOVERY_HEIGHT
    : Math.min(DEFAULT_RECOVERY_HEIGHT, Math.max(1, workArea.height - RECOVERY_WORK_AREA_INSET))
  return {
    width,
    height,
    minWidth: Math.min(DEFAULT_RECOVERY_MIN_WIDTH, width),
    minHeight: Math.min(DEFAULT_RECOVERY_MIN_HEIGHT, height),
  }
}

export interface DesktopStartupRecoveryViewModel {
  readonly locale: DesktopLocale
  readonly failureStage: DesktopStartupFailureStage
  readonly failureDetail: string
  readonly requested?: boolean
  readonly snapshot?: DesktopStartupRecoverySnapshot
  readonly snapshotError?: string
  readonly diagnostics: RecoveryDiagnosticsState
  readonly notice?: RecoveryNotice
  readonly busy: boolean
  readonly restartReady: boolean
  readonly activeTab: RecoveryTab
  readonly configurationAvailable: boolean
  readonly profiles?: readonly DesktopStartupRecoveryProfile[]
  readonly profileActionToken?: string
  readonly terminalAvailable?: boolean
  readonly profileCreatorAvailable?: boolean
}

interface RecoveryCopy {
  readonly title: string
  readonly lead: string
  readonly currentProfile: string
  readonly startupError: string
  readonly startupStage: string
  readonly stageLabels: Readonly<Record<DesktopStartupFailureStage, string>>
  readonly recentInstall: string
  readonly rollbackBody: string
  readonly rollback: string
  readonly retry: string
  readonly retryBody: string
  readonly plugins: string
  readonly pluginsBody: string
  readonly core: string
  readonly managed: string
  readonly external: string
  readonly disabled: string
  readonly disable: string
  readonly diagnostics: string
  readonly savingDiagnostics: string
  readonly diagnosticsSaved: string
  readonly diagnosticsFailed: string
  readonly saveDiagnostics: string
  readonly showDiagnostics: string
  readonly privacy: string
  readonly restart: string
  readonly quit: string
  readonly cancel: string
  readonly confirmDisable: string
  readonly confirmDisableBody: string
  readonly confirmRollback: string
  readonly confirmRollbackBody: string
  readonly confirmRetry: string
  readonly confirmRetryBody: string
  readonly working: string
  readonly disabledSuccess: string
  readonly disabledPending: string
  readonly rollbackSuccess: string
  readonly retrySuccess: string
  readonly manualRequired: string
  readonly diagnosticsRequired: string
  readonly manualConfiguration: string
  readonly manualConfigurationBody: string
  readonly openSettingsDocument: string
  readonly openProfilePatch: string
  readonly openProfileManifest: string
  readonly openProfileDirectory: string
}

const COPY: Record<DesktopLocale, RecoveryCopy> = {
  en: {
    title: 'DSH Desktop Recovery',
    lead: 'The active Profile could not start. Inspect diagnostics, restore an exact healthy checkpoint, switch Profile, or disable a mutable plugin.',
    currentProfile: 'Active profile',
    startupError: 'Startup error',
    startupStage: 'Failure stage',
    stageLabels: {
      'electron-ready': 'Electron initialization',
      'shell-environment': 'Shell environment',
      'runtime-bootstrap': 'Desktop runtime preparation',
      'profile-selection': 'Profile selection',
      'profile-composition': 'Plugin profile composition',
      'host-boot': 'Plugin Host startup',
      'renderer-startup': 'Desktop interface startup',
      'health-commit': 'Startup health confirmation',
    },
    recentInstall: 'Healthy-start checkpoints',
    rollbackBody: 'Choose one of three exact healthy-start slots for the active Profile.',
    rollback: 'Restore checkpoint',
    retry: 'Restart',
    retryBody: 'Restart the selected Profile without changing it automatically.',
    plugins: 'Temporarily disable a plugin',
    pluginsBody: 'Disabling skips that plugin bundle on the next start. It does not uninstall files or isolate plugin code.',
    core: 'Built in',
    managed: 'Installed by Plugin Market',
    external: 'Installed another way',
    disabled: 'Disabled',
    disable: 'Disable',
    diagnostics: 'Diagnostics',
    savingDiagnostics: 'Saving a local diagnostic archive…',
    diagnosticsSaved: 'Diagnostics were saved locally and will not be uploaded automatically.',
    diagnosticsFailed: 'Diagnostics could not be saved. You can retry the export.',
    saveDiagnostics: 'Save diagnostics',
    showDiagnostics: 'Show in folder',
    privacy: 'Diagnostic archives may contain local paths, logs, system information, and crash-memory fragments. Review the archive before sharing it.',
    restart: 'Restart DSH Desktop',
    quit: 'Quit',
    cancel: 'Cancel',
    confirmDisable: 'Confirm plugin disable',
    confirmDisableBody: 'This plugin will be skipped in the active profile after restart. Its files will remain installed.',
    confirmRollback: 'Confirm configuration restore',
    confirmRollbackBody: 'The active Profile will be restored from the exact selected healthy checkpoint.',
    confirmRetry: 'Confirm restart',
    confirmRetryBody: 'Restart the active Profile without automatic recovery mutation.',
    working: 'Applying recovery action…',
    disabledSuccess: 'The plugin is now marked disabled. Restart Desktop to apply the change.',
    disabledPending: 'The plugin is now marked disabled. Restart Desktop to apply the change.',
    rollbackSuccess: 'The checkpoint was restored. Restart Desktop to continue.',
    retrySuccess: 'Restart Desktop to continue.',
    manualRequired: 'Desktop did not overwrite the active Profile automatically.',
    diagnosticsRequired: 'Diagnostics were not saved.',
    manualConfiguration: 'Edit configuration manually',
    manualConfigurationBody: 'Use the system editor for patch overrides or the plugin manifest for duplicate bundle entries. This recovery page cannot choose an arbitrary path.',
    openSettingsDocument: 'Open configuration file',
    openProfilePatch: 'Edit configuration patch',
    openProfileManifest: 'Edit plugin manifest',
    openProfileDirectory: 'Open configuration folder',
  },
  zh: {
    title: 'DSH Desktop 恢复',
    lead: '当前 Profile 无法启动。你可以检查诊断、恢复明确的健康 checkpoint、切换 Profile，或禁用一个可管理插件。',
    currentProfile: '当前配置',
    startupError: '启动错误',
    startupStage: '失败阶段',
    stageLabels: {
      'electron-ready': 'Electron 初始化',
      'shell-environment': 'Shell 环境恢复',
      'runtime-bootstrap': '桌面运行时准备',
      'profile-selection': '配置选择',
      'profile-composition': '插件配置组合',
      'host-boot': '插件 Host 启动',
      'renderer-startup': '桌面界面启动',
      'health-commit': '启动健康状态确认',
    },
    recentInstall: '健康启动 Checkpoint',
    rollbackBody: '从三个健康启动槽位中明确选择一个恢复当前 Profile。',
    rollback: '恢复 Checkpoint',
    retry: '重新启动',
    retryBody: '不自动修改当前 Profile，直接重新启动。',
    plugins: '暂时禁用插件',
    pluginsBody: '禁用后，下次启动会跳过该插件的加载配置；不会卸载插件文件，也不会隔离插件代码。',
    core: '内置组件',
    managed: '通过插件市场安装',
    external: '通过其他方式安装',
    disabled: '已禁用',
    disable: '禁用',
    diagnostics: '诊断信息',
    savingDiagnostics: '正在保存本地诊断包…',
    diagnosticsSaved: '诊断信息已保存在本地，不会自动上传。',
    diagnosticsFailed: '无法保存诊断信息，可以重新尝试导出。',
    saveDiagnostics: '保存诊断信息',
    showDiagnostics: '在文件夹中显示',
    privacy: '诊断包可能包含本地路径、日志、系统信息和崩溃内存片段，分享前请先检查。',
    restart: '重新启动 DSH Desktop',
    quit: '退出',
    cancel: '取消',
    confirmDisable: '确认禁用插件',
    confirmDisableBody: '重启后，当前配置将跳过这个插件；插件文件仍会保留。',
    confirmRollback: '确认恢复配置',
    confirmRollbackBody: '当前 Profile 将从明确选择的健康 Checkpoint 恢复。',
    confirmRetry: '确认重启',
    confirmRetryBody: '不执行自动恢复修改，重新启动当前 Profile。',
    working: '正在执行恢复操作…',
    disabledSuccess: '插件已标记为禁用。请重新启动 Desktop 使改动生效。',
    disabledPending: '插件已标记为禁用。请重新启动 Desktop 使改动生效。',
    rollbackSuccess: 'Checkpoint 已恢复。请重新启动 Desktop。',
    retrySuccess: '请重新启动 Desktop。',
    manualRequired: 'Desktop 没有自动覆盖当前 Profile。',
    diagnosticsRequired: '诊断信息尚未保存。',
    manualConfiguration: '手动编辑配置',
    manualConfigurationBody: '配置覆盖错误请编辑补丁文件；插件重复加载请编辑插件加载清单。恢复页面不能选择任意路径。',
    openSettingsDocument: '打开配置文件',
    openProfilePatch: '编辑配置补丁',
    openProfileManifest: '编辑插件加载清单',
    openProfileDirectory: '打开配置目录',
  },
}

/** Parse only the fixed action origin used by the local shadcn recovery document. */
export function parseDesktopStartupRecoveryAction(
  href: string,
): { readonly action: string; readonly id?: string; readonly name?: string } | undefined {
  let url: URL
  try { url = new URL(href) } catch { return undefined }
  if (url.protocol !== RECOVERY_SCHEME
    || url.username.length > 0
    || url.password.length > 0
    || url.port.length > 0
    || url.pathname !== ''
    || url.hash.length > 0) return undefined
  const action = url.hostname
  const allowed = new Set([
    'preview-disable',
    'preview-checkpoint',
    'open-checkpoint',
    'export-diagnostics',
    'show-diagnostics',
    'open-settings-document',
    'open-profile-patch',
    'open-profile-manifest',
    'open-profile-directory',
    'open-terminal',
    'open-profile-creator',
    'switch-profile',
    'restart',
    'quit',
  ])
  if (!allowed.has(action)) return undefined
  const keys = [...url.searchParams.keys()]
  if (keys.some(key => key !== 'id' && key !== 'name') || url.searchParams.getAll('id').length > 1 || url.searchParams.getAll('name').length > 1) return undefined
  const id = url.searchParams.get('id') ?? undefined
  const needsId = action.startsWith('preview-') || action === 'switch-profile' || action === 'open-checkpoint'
  if (needsId !== (id !== undefined)) return undefined
  if (id !== undefined && (action === 'preview-checkpoint' || action === 'open-checkpoint')) {
    if (!/^slot-[123]$/u.test(id)) return undefined
  } else if (id !== undefined && (id.length < 8 || id.length > 160)) return undefined
  const name = url.searchParams.get('name') ?? undefined
  if (action === 'switch-profile') {
    if (name === undefined || name.length === 0 || Buffer.byteLength(name, 'utf8') > 255 || name.includes('/') || name.includes('\\') || /[\0\r\n]/u.test(name)) return undefined
  } else if (name !== undefined) return undefined
  return { action, ...(id === undefined ? {} : { id }), ...(name === undefined ? {} : { name }) }
}

/** One native recovery window whose renderer has no Node, IPC, or network capability. */
export class DesktopStartupRecoveryWindow {
  private window: BrowserWindow | undefined
  private snapshot: DesktopStartupRecoverySnapshot | undefined
  private snapshotError: string | undefined
  private diagnostics: RecoveryDiagnosticsState = { status: 'saving' }
  private diagnosticPath: string | undefined
  private diagnosticTask: Promise<string> | undefined
  private readonly diagnosticAbort = new AbortController()
  private notice: RecoveryNotice | undefined
  private busy = false
  private restartReady = false
  private activeTab: RecoveryTab = 'plugins'
  private profiles: readonly DesktopStartupRecoveryProfile[] | undefined
  private resolveResult: ((result: RecoveryWindowResult) => void) | undefined
  private settled = false

  constructor(private readonly options: DesktopStartupRecoveryWindowOptions) {}

  /** Open the local recovery document and settle only on explicit restart, quit, or close. */
  async run(): Promise<RecoveryWindowResult> {
    const result = new Promise<RecoveryWindowResult>(resolve => { this.resolveResult = resolve })
    try {
      this.snapshot = await this.options.controller?.snapshot()
    } catch (cause) {
      this.snapshotError = cause instanceof Error ? cause.message : String(cause)
    }
    this.refreshProfiles()
    const window = new BrowserWindow({
      title: COPY[this.options.locale].title,
      ...auxiliaryWindowChromeOptions(),
      ...desktopStartupRecoveryWindowBounds(),
      show: false,
      autoHideMenuBar: true,
      backgroundColor: '#202124',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        nodeIntegrationInSubFrames: false,
        sandbox: true,
        webSecurity: true,
        webviewTag: false,
        spellcheck: false,
        partition: 'dsh-recovery',
      },
    })
    this.window = window
    window.accessibleTitle = COPY[this.options.locale].title
    window.removeMenu()
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    window.webContents.on('will-attach-webview', event => { event.preventDefault() })
    const navigate = (event: Electron.Event, href: string): void => {
      const action = parseDesktopStartupRecoveryAction(href)
      event.preventDefault()
      if (action !== undefined) void this.handleAction(action)
    }
    window.webContents.on('will-navigate', navigate)
    window.webContents.on('will-redirect', navigate)
    const show = (): void => { revealApplication(window) }
    const activate = (): void => {
      if (applicationNeedsReveal(window)) show()
    }
    app.on('activate', activate)
    if (process.platform === 'darwin') app.on('did-become-active', activate)
    window.once('ready-to-show', show)
    window.on('closed', () => {
      app.off('activate', activate)
      if (process.platform === 'darwin') app.off('did-become-active', activate)
      this.window = undefined
      this.finish('quit')
    })
    await this.render()
    void this.startDiagnosticExport().catch(() => {})
    return await result
  }

  /** Bring an already open recovery window to the foreground. */
  show(): void {
    if (this.window === undefined || this.window.isDestroyed()) return
    revealApplication(this.window)
  }

  private async handleAction(action: { readonly action: string; readonly id?: string; readonly name?: string }): Promise<void> {
    if (this.busy || this.settled) return
    try {
      if (action.action === 'preview-disable' && action.id !== undefined) {
        this.activeTab = 'plugins'
        const preview = await this.requireController().previewDisable(action.id)
        if (await this.confirmRecoveryAction('disable', preview)) {
          await this.runBusy(async () => {
            const result = await this.requireController().executeDisable(preview.previewId)
            this.notice = {
              tone: 'success',
              title: result.packageName,
              body: COPY[this.options.locale].disabledSuccess,
            }
            this.restartReady = true
            await this.refreshSnapshot()
          })
        }
      } else if (action.action === 'preview-checkpoint' && action.id !== undefined) {
        this.activeTab = 'rollback'
        const preview = await this.requireController().previewCheckpointRestore(action.id as `slot-${1 | 2 | 3}`)
        if (await this.confirmRecoveryAction('checkpoint', preview)) {
          await this.runBusy(async () => {
            const result = await this.requireController().executeCheckpointRestore(preview.previewId)
            this.notice = {
              tone: 'success',
              title: result.slotId,
              body: this.options.locale === 'zh'
                ? 'Checkpoint 已恢复。下一次健康启动会保留现有三个槽位；请重新启动 DSH Desktop。'
                : 'The checkpoint was restored. The next healthy startup will preserve all three slots. Restart DSH Desktop to continue.',
            }
            this.restartReady = true
            await this.refreshSnapshot()
          })
        }
      } else if (action.action === 'open-checkpoint' && action.id !== undefined) {
        this.activeTab = 'rollback'
        await this.requireController().openCheckpoint(action.id as `slot-${1 | 2 | 3}`)
      } else if (action.action === 'export-diagnostics') {
        this.activeTab = 'diagnostics'
        await this.startDiagnosticExport().catch(() => {})
      } else if (action.action === 'show-diagnostics' && this.diagnosticPath !== undefined) {
        this.activeTab = 'diagnostics'
        shell.showItemInFolder(this.diagnosticPath)
      } else if (action.action === 'open-terminal') {
        this.activeTab = 'diagnostics'
        if (this.options.openTerminal === undefined) throw new Error('DSH Terminal is unavailable for this startup stage.')
        await this.options.openTerminal()
      } else if (action.action === 'open-profile-creator') {
        this.activeTab = 'profiles'
        if (this.options.profileActions === undefined) throw new Error('Profile creation is unavailable for this startup stage.')
        await this.options.profileActions.openCreator()
      } else if (action.action === 'switch-profile' && action.id !== undefined && action.name !== undefined) {
        this.activeTab = 'profiles'
        const actions = this.options.profileActions
        if (actions === undefined) throw new Error('Profile switching is unavailable for this startup stage.')
        const profileName = action.name
        const actionToken = action.id
        await this.runBusy(async () => {
          await actions.switchProfile(profileName, actionToken)
          this.notice = {
            tone: 'success',
            title: profileName,
            body: this.options.locale === 'zh'
              ? '配置选择已保存。请重新启动 DSH Desktop。'
              : 'Profile selection saved. Restart DSH Desktop to apply it.',
          }
          this.restartReady = true
          this.refreshProfiles()
        })
      } else if (action.action === 'open-settings-document') {
        this.activeTab = 'diagnostics'
        await this.openConfigurationPath('settingsDocument')
      } else if (action.action === 'open-profile-patch') {
        this.activeTab = 'diagnostics'
        await this.openConfigurationPath('profilePatch')
      } else if (action.action === 'open-profile-manifest') {
        this.activeTab = 'diagnostics'
        await this.openConfigurationPath('profileManifest')
      } else if (action.action === 'open-profile-directory') {
        this.activeTab = 'diagnostics'
        await this.openConfigurationPath('profileDirectory')
      } else if (action.action === 'restart') {
        const copy = desktopRestartConfirmationCopy(this.options.locale)
        const window = this.window
        if (window === undefined || window.isDestroyed()) return
        const result = await showDesktopMessageBox({
          type: 'question',
          title: copy.title,
          message: copy.message,
          detail: copy.detail,
          buttons: [copy.confirm, copy.cancel],
          defaultId: 1,
          cancelId: 1,
          noLink: true,
        }, window)
        if (result.response === 0) this.finish('restart')
        return
      } else if (action.action === 'quit') {
        await this.ensureDiagnostics()
        this.finish('quit')
        return
      }
    } catch (cause) {
      this.notice = {
        tone: 'error',
        title: COPY[this.options.locale].title,
        body: cause instanceof Error ? cause.message : String(cause),
      }
    }
    await this.render()
  }

  private async confirmRecoveryAction(
    kind: 'disable' | 'checkpoint',
    preview: DesktopStartupRecoveryDisablePreview | DesktopStartupRecoveryCheckpointPreview,
  ): Promise<boolean> {
    const window = this.window
    if (window === undefined || window.isDestroyed()) return false
    const copy = COPY[this.options.locale]
    const message = 'packageName' in preview ? preview.packageName : preview.slotId
    const checkpointTime = 'capturedAt' in preview ? preview.capturedAt : undefined
    const result = await showDesktopMessageBox({
      type: kind === 'disable' ? 'warning' : 'question',
      title: kind === 'disable'
        ? copy.confirmDisable
        : this.options.locale === 'zh' ? '确认恢复 Checkpoint' : 'Confirm checkpoint restore',
      message,
      detail: kind === 'disable'
        ? copy.confirmDisableBody
        : this.options.locale === 'zh'
          ? `将当前 Profile 恢复到 ${checkpointTime} 的健康启动状态。此操作需要重启。`
          : `Restore the active Profile to its healthy state from ${checkpointTime}. A restart is required.`,
      buttons: [
        kind === 'disable' ? copy.disable : this.options.locale === 'zh' ? '恢复' : 'Restore',
        copy.cancel,
      ],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    }, window)
    return result.response === 0
  }
  private async runBusy(operation: () => Promise<void>): Promise<void> {
    this.busy = true
    await this.render()
    try { await operation() } finally { this.busy = false }
  }

  private async refreshSnapshot(): Promise<void> {
    try {
      this.snapshot = await this.requireController().snapshot()
      this.snapshotError = undefined
    } catch (cause) {
      this.snapshotError = cause instanceof Error ? cause.message : String(cause)
    }
  }

  private refreshProfiles(): void {
    try {
      this.profiles = this.options.profileActions?.list()
    } catch {
      this.profiles = undefined
    }
  }

  private async ensureDiagnostics(): Promise<boolean> {
    try {
      await this.startDiagnosticExport()
      return true
    } catch {
      return false
    }
  }

  private startDiagnosticExport(): Promise<string> {
    if (this.diagnostics.status === 'saved' && this.diagnosticPath !== undefined) {
      return Promise.resolve(this.diagnosticPath)
    }
    if (this.diagnosticTask !== undefined) return this.diagnosticTask

    const task = this.saveDiagnostics()
    this.diagnosticTask = task
    void task.catch(() => {
      if (this.diagnosticTask === task) this.diagnosticTask = undefined
    })
    return task
  }

  private async saveDiagnostics(): Promise<string> {
    this.diagnostics = { status: 'saving' }
    await this.render()
    try {
      const path = await this.options.exportDiagnostics(this.diagnosticAbort.signal)
      this.diagnosticPath = path
      this.diagnostics = { status: 'saved', filename: basename(path) }
      await this.render()
      return path
    } catch (cause) {
      this.diagnostics = { status: 'failed' }
      this.notice = {
        tone: 'error',
        title: COPY[this.options.locale].diagnostics,
        body: cause instanceof Error ? cause.message : String(cause),
      }
      await this.render()
      throw cause
    }
  }

  private async render(): Promise<void> {
    const window = this.window
    if (window === undefined || window.isDestroyed()) return
    const model: DesktopStartupRecoveryViewModel = {
      locale: this.options.locale,
      failureStage: this.options.failureStage,
      failureDetail: this.options.failureDetail,
      ...(this.options.requested === true ? { requested: true } : {}),
      ...(this.snapshot === undefined ? {} : { snapshot: this.snapshot }),
      ...(this.snapshotError === undefined ? {} : { snapshotError: this.snapshotError }),
      diagnostics: this.diagnostics,
      ...(this.notice === undefined ? {} : { notice: this.notice }),
      busy: this.busy,
      restartReady: this.restartReady,
      activeTab: this.activeTab,
      configurationAvailable: this.options.configurationPaths !== undefined,
      ...(this.profiles === undefined ? {} : { profiles: this.profiles }),
      ...(this.options.profileActions === undefined ? {} : { profileActionToken: this.options.profileActions.token }),
      ...(this.options.openTerminal === undefined ? {} : { terminalAvailable: true }),
      ...(this.options.profileActions === undefined ? {} : { profileCreatorAvailable: true }),
    }
    const state = Buffer.from(JSON.stringify(model), 'utf8').toString('base64url')
    await window.loadFile(RECOVERY_DOCUMENT, {
      query: {
        state,
        platform: process.platform,
        frame: String(auxiliaryWindowHasCustomFrame()),
      },
    })
  }

  private finish(result: RecoveryWindowResult): void {
    if (this.settled) return
    this.settled = true
    this.diagnosticAbort.abort(new DOMException('Recovery window closed.', 'AbortError'))
    const window = this.window
    this.window = undefined
    if (window !== undefined && !window.isDestroyed()) window.destroy()
    this.resolveResult?.(result)
    this.resolveResult = undefined
  }

  private requireController(): DesktopStartupRecoveryController {
    if (this.options.controller === undefined) {
      throw new Error('Desktop plugin recovery actions are unavailable for this startup stage.')
    }
    return this.options.controller
  }

  private async openConfigurationPath(
    kind: keyof DesktopStartupRecoveryConfigurationPaths,
  ): Promise<void> {
    const path = this.options.configurationPaths?.[kind]
    if (path === undefined) throw new Error('Desktop profile configuration is unavailable for this startup stage.')
    if (kind === 'settingsDocument') {
      await mkdir(dirname(path), { recursive: true, mode: 0o700 })
      try {
        await writeFile(path, '', { flag: 'wx', mode: 0o600 })
      } catch (cause) {
        if ((cause as NodeJS.ErrnoException).code !== 'EEXIST') throw cause
      }
    }
    if (kind === 'settingsDocument' && process.platform === 'darwin') {
      await new Promise<void>((resolve, reject) => {
        execFile('/usr/bin/open', ['-t', path], { windowsHide: true }, cause => {
          if (cause === null) resolve()
          else reject(cause)
        })
      })
      return
    }
    const error = await shell.openPath(path)
    if (error.length > 0) throw new Error(error)
  }
}

export default DesktopStartupRecoveryWindow
