import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  nativeImage,
  nativeTheme,
  Notification,
  shell,
  Tray,
} from 'electron'
import { formatDesktopExitCode } from './desktop-logger.ts'
import { applicationNeedsReveal, revealApplication } from './electron-reveal.ts'
import type { ElectronPlatformStrategy } from './electron-platform.ts'
import type { DesktopNotification, DesktopShellSpec } from './runtime.ts'
import { prepareTrayIcon } from './tray-icons.ts'
import { desktopWindowOptions } from './window-options.ts'
import { setWindowsAcrylic } from './windows-acrylic.ts'

const MIN_ZOOM_LEVEL = -4
const MAX_ZOOM_LEVEL = 4

function clampedZoomLevel(level: number): number {
  return Math.min(MAX_ZOOM_LEVEL, Math.max(MIN_ZOOM_LEVEL, level))
}

function isZoomShortcut(input: Electron.Input): 'in' | 'out' | 'reset' | undefined {
  if (input.type !== 'keyDown' || input.alt || (!input.control && !input.meta)) return undefined
  if (input.key === '+' || input.key === '=') return 'in'
  if (input.key === '-' || input.key === '_') return 'out'
  if (input.key === '0') return 'reset'
  return undefined
}

export interface ElectronShellGenerationOptions {
  readonly platform: ElectronPlatformStrategy
  readonly spec: DesktopShellSpec
  readonly preloadPath: string
  readonly buildApplicationMenuItems: () => readonly Electron.MenuItemConstructorOptions[]
  readonly isQuitting: () => boolean
  readonly buildTrayTemplate: () => Electron.MenuItemConstructorOptions[]
  readonly stopRendererBootMonitoring: () => void
  readonly abortRendererBootMonitoring: (cause: unknown) => void
  readonly failRendererBoot: (error: string) => void
  readonly logError: (message: string) => void
}

/** Own one BrowserWindow and Tray generation, including every native listener. */
export class ElectronShellGeneration {
  private window: BrowserWindow | undefined
  private tray: Tray | undefined
  private mounted = false
  private released = false
  private attentionCount = 0
  private prepareFullscreenReveal: (() => void) | undefined
  private refreshNativeMaterial: (() => void) | undefined
  private cleanupListeners: (() => void) | undefined

  constructor(private readonly options: ElectronShellGenerationOptions) {}

  async mount(beforeInteractive?: () => void): Promise<void> {
    if (this.mounted || this.window !== undefined) {
      throw new Error('dsh-plugin-desktop: native shell generation is already mounted')
    }

    const { platform, spec } = this.options
    const icon = nativeImage.createFromPath(spec.iconPath)
    if (icon.isEmpty()) {
      throw new Error(`dsh-plugin-desktop: failed to load application icon ${spec.iconPath}`)
    }
    platform.configureApplication(icon, spec.productName, this.options.buildApplicationMenuItems())
    const origin = new URL(spec.url).origin
    if (spec.mode !== 'compatibility') nativeTheme.themeSource = spec.readThemeSource()
    const window = new BrowserWindow(desktopWindowOptions(spec, icon, platform.platform, this.options.preloadPath))
    window.accessibleTitle = spec.windowTitle
    platform.configureWindow(window)
    const refreshNativeMaterial = (): void => {
      if (platform.platform === 'win32' && spec.material === 'acrylic') {
        try {
          if (!setWindowsAcrylic(window, true, nativeTheme.shouldUseDarkColors)) {
            this.options.logError('dsh-plugin-desktop: Windows rejected the acrylic backdrop request')
          }
        } catch (cause) {
          this.options.logError(`dsh-plugin-desktop: failed to apply Windows acrylic backdrop: ${cause instanceof Error ? cause.message : String(cause)}`)
        }
        return
      }
      platform.refreshThemeMaterial(window, spec.material)
    }
    this.refreshNativeMaterial = refreshNativeMaterial
    refreshNativeMaterial()
    this.window = window

    const show = (): void => { this.show() }
    const activate = (): void => {
      if (applicationNeedsReveal(window, platform.platform)) this.show()
    }
    const clearAttention = (): void => { this.clearAttention() }
    let fullscreenExitPending = false
    let hideAfterFullscreenExit = false
    let restoreAfterFullscreenExit = false
    let restoreFullscreenOnShow = false
    const finishFullscreenExit = (): void => {
      if (!fullscreenExitPending) return
      fullscreenExitPending = false
      const shouldHide = hideAfterFullscreenExit
      const shouldRestore = restoreAfterFullscreenExit
      hideAfterFullscreenExit = false
      restoreAfterFullscreenExit = false
      if (window.isDestroyed()) return
      if (shouldHide) {
        window.hide()
        return
      }
      if (shouldRestore) {
        restoreFullscreenOnShow = false
        window.setFullScreen(true)
      }
    }
    const prepareFullscreenReveal = (): void => {
      if (!restoreFullscreenOnShow || window.isDestroyed()) return
      if (fullscreenExitPending) {
        hideAfterFullscreenExit = false
        restoreAfterFullscreenExit = true
        return
      }
      if (window.isFullScreen()) {
        restoreFullscreenOnShow = false
        return
      }
      restoreFullscreenOnShow = false
      window.setFullScreen(true)
    }
    const cleanupFullscreenTransition = (): void => {
      if (fullscreenExitPending) window.off('leave-full-screen', finishFullscreenExit)
      fullscreenExitPending = false
      hideAfterFullscreenExit = false
      restoreAfterFullscreenExit = false
      restoreFullscreenOnShow = false
    }
    this.prepareFullscreenReveal = prepareFullscreenReveal
    const close = (event: Electron.Event): void => {
      if (this.options.isQuitting()) return
      event.preventDefault()
      if (platform.platform === 'darwin' && fullscreenExitPending) {
        hideAfterFullscreenExit = true
        restoreAfterFullscreenExit = false
        return
      }
      if (platform.platform === 'darwin' && window.isFullScreen()) {
        fullscreenExitPending = true
        hideAfterFullscreenExit = true
        restoreFullscreenOnShow = true
        window.once('leave-full-screen', finishFullscreenExit)
        window.setFullScreen(false)
        return
      }
      window.hide()
    }
    const preserveBlankTitle = (event: Electron.Event): void => { event.preventDefault() }
    const handleZoomShortcut = (event: Electron.Event, input: Electron.Input): void => {
      const action = isZoomShortcut(input)
      if (action === undefined) return
      event.preventDefault()
      if (action === 'reset') {
        window.webContents.setZoomLevel(0)
        return
      }
      const step = action === 'in' ? 1 : -1
      window.webContents.setZoomLevel(clampedZoomLevel(window.webContents.getZoomLevel() + step))
    }
    const navigate = (event: Electron.Event<Electron.WebContentsWillFrameNavigateEventParams>): void => {
      if (!event.isMainFrame) return
      let targetOrigin: string | undefined
      try {
        targetOrigin = new URL(event.url).origin
      } catch {
        targetOrigin = undefined
      }
      if (targetOrigin !== origin) event.preventDefault()
    }
    const redirect = (
      event: Electron.Event,
      url: string,
      _isInPlace: boolean,
      isMainFrame: boolean,
    ): void => {
      if (!isMainFrame) return
      let targetOrigin: string | undefined
      try {
        targetOrigin = new URL(url).origin
      } catch {
        targetOrigin = undefined
      }
      if (targetOrigin !== origin) event.preventDefault()
    }
    const rendererGone = (_event: Electron.Event, details: Electron.RenderProcessGoneDetails): void => {
      const detail = `renderer process gone (reason: ${details.reason}, exitCode: ${formatDesktopExitCode(details.exitCode)})`
      this.options.logError(`dsh-plugin-desktop: ${detail}`)
      this.options.failRendererBoot(detail)
    }
    const loadFailed = (
      _event: Electron.Event,
      errorCode: number,
      errorDescription: string,
      _validatedUrl: string,
      isMainFrame: boolean,
    ): void => {
      this.options.logError(`dsh-plugin-desktop: renderer failed to load (${errorCode}: ${errorDescription})`)
      if (isMainFrame === true && errorCode !== -3) {
        this.options.failRendererBoot(
          `renderer main frame failed to load (${String(errorCode)}: ${errorDescription})`,
        )
      }
    }

    app.on('activate', activate)
    if (platform.platform === 'darwin') app.on('did-become-active', activate)
    window.on('close', close)
    window.on('focus', clearAttention)
    window.on('page-title-updated', preserveBlankTitle)
    window.webContents.on('before-input-event', handleZoomShortcut)
    window.webContents.on('will-frame-navigate', navigate)
    window.webContents.on('will-redirect', redirect)
    window.webContents.on('render-process-gone', rendererGone)
    window.webContents.on('did-fail-load', loadFailed)
    window.webContents.setWindowOpenHandler(({ url }) => {
      try {
        const target = new URL(url)
        if (target.protocol === 'https:' || target.protocol === 'http:' || target.protocol === 'mailto:') {
          void shell.openExternal(target.href).catch((cause: unknown) => {
            this.options.logError(`dsh-plugin-desktop: failed to open external link: ${cause instanceof Error ? cause.message : String(cause)}`)
          })
        }
      } catch {
        // A malformed target is rejected with the same deny result.
      }
      return { action: 'deny' }
    })
    window.once('ready-to-show', show)
    let tray: Tray | undefined
    this.cleanupListeners = () => {
      app.off('activate', activate)
      if (platform.platform === 'darwin') app.off('did-become-active', activate)
      window.off('close', close)
      window.off('focus', clearAttention)
      window.off('page-title-updated', preserveBlankTitle)
      window.off('ready-to-show', show)
      cleanupFullscreenTransition()
      window.webContents.off('before-input-event', handleZoomShortcut)
      window.webContents.off('will-frame-navigate', navigate)
      window.webContents.off('will-redirect', redirect)
      window.webContents.off('render-process-gone', rendererGone)
      window.webContents.off('did-fail-load', loadFailed)
      tray?.off('click', show)
    }

    try {
      await window.loadURL(spec.url)
      tray = new Tray(prepareTrayIcon(spec.trayIcons, platform.platform))
      this.tray = tray
      tray.setToolTip(spec.productName)
      this.refreshTrayMenu()
      tray.on('click', show)
      beforeInteractive?.()
      this.mounted = true
    } catch (cause) {
      this.options.abortRendererBootMonitoring(cause)
      await this.release()
      throw cause
    }
  }

  show(): void {
    const window = this.window
    if (window === undefined || window.isDestroyed()) return
    this.clearAttention()
    revealApplication(window, this.options.platform.platform)
    this.prepareFullscreenReveal?.()
  }

  notifyAttention(notification: DesktopNotification): void {
    const window = this.window
    if (window === undefined || window.isDestroyed() || window.isFocused()) return

    this.attentionCount += 1
    if (this.options.platform.platform === 'win32') window.flashFrame(true)
    else app.setBadgeCount(this.attentionCount)

    if (!Notification.isSupported()) return
    const nativeNotification = new Notification(notification)
    nativeNotification.once('click', () => { this.show() })
    nativeNotification.show()
  }

  async showOpenDialog(options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue> {
    const window = this.window
    return window === undefined || window.isDestroyed()
      ? await dialog.showOpenDialog(options)
      : await dialog.showOpenDialog(window, options)
  }

  async showMessageBox(options: Electron.MessageBoxOptions): Promise<Electron.MessageBoxReturnValue> {
    const window = this.window
    return window === undefined || window.isDestroyed()
      ? await dialog.showMessageBox(options)
      : await dialog.showMessageBox(window, options)
  }

  async showSaveDialog(options: Electron.SaveDialogOptions): Promise<Electron.SaveDialogReturnValue> {
    const window = this.window
    return window === undefined || window.isDestroyed()
      ? await dialog.showSaveDialog(options)
      : await dialog.showSaveDialog(window, options)
  }

  refreshTrayMenu(): void {
    if (this.tray === undefined) return
    this.tray.setContextMenu(Menu.buildFromTemplate(this.options.buildTrayTemplate()))
  }

  refreshThemeMaterial(): void {
    if (this.window !== undefined && !this.window.isDestroyed()) this.refreshNativeMaterial?.()
  }

  async release(): Promise<void> {
    if (this.released) return
    this.released = true
    this.options.stopRendererBootMonitoring()

    const window = this.window
    const tray = this.tray
    this.clearAttention()
    this.window = undefined
    this.tray = undefined
    this.prepareFullscreenReveal = undefined
    this.refreshNativeMaterial = undefined
    if (window === undefined) return

    this.cleanupListeners?.()
    this.cleanupListeners = undefined
    tray?.destroy()
    if (!window.isDestroyed()) window.destroy()
  }

  private clearAttention(): void {
    if (this.attentionCount === 0) return
    this.attentionCount = 0
    if (this.options.platform.platform === 'win32') {
      const window = this.window
      if (window !== undefined && !window.isDestroyed()) window.flashFrame(false)
    } else {
      app.setBadgeCount(0)
    }
  }
}
