import { beforeEach, describe, expect, it, vi } from 'vitest'

const electron = vi.hoisted(() => {
  type Listener = (...args: unknown[]) => void
  const windows: BrowserWindow[] = []
  class BrowserWindow {
    readonly onceListeners = new Map<string, Listener>()
    readonly listeners = new Map<string, Listener>()
    readonly webListeners = new Map<string, Listener>()
    readonly webContents = {
      setWindowOpenHandler: vi.fn(),
      on: vi.fn((event: string, listener: Listener) => { this.webListeners.set(event, listener) }),
    }
    accessibleTitle = ''
    readonly isDestroyed = vi.fn(() => false)
    readonly isMinimized = vi.fn(() => false)
    readonly show = vi.fn()
    readonly focus = vi.fn()
    readonly restore = vi.fn()
    readonly removeMenu = vi.fn()
    readonly destroy = vi.fn()
    readonly loadFile = vi.fn(async () => {})
    readonly once = vi.fn((event: string, listener: Listener) => { this.onceListeners.set(event, listener) })
    readonly on = vi.fn((event: string, listener: Listener) => { this.listeners.set(event, listener) })
    constructor(readonly options: Electron.BrowserWindowConstructorOptions) { windows.push(this) }
  }
  return {
    app: { isHidden: vi.fn(() => false), show: vi.fn() },
    BrowserWindow,
    windows,
  }
})

vi.mock('electron', () => ({ app: electron.app, BrowserWindow: electron.BrowserWindow }))

import {
  desktopDialogWindowHeight,
  DesktopDialogWindow,
  parseDesktopDialogResponse,
} from '../src/desktop-dialog-window.ts'

describe('DesktopDialogWindow', () => {
  beforeEach(() => {
    electron.windows.length = 0
    vi.clearAllMocks()
  })

  it('accepts only bounded local response navigation', () => {
    expect(parseDesktopDialogResponse('dsh-desktop-dialog://response?id=1', 2)).toBe(1)
    expect(parseDesktopDialogResponse('dsh-desktop-dialog://response?id=2', 2)).toBeUndefined()
    expect(parseDesktopDialogResponse('dsh-desktop-dialog://response?id=-1', 2)).toBeUndefined()
    expect(parseDesktopDialogResponse('dsh-desktop-dialog://response?id=1&command=bad', 2)).toBeUndefined()
    expect(parseDesktopDialogResponse('https://response/?id=1', 2)).toBeUndefined()
  })

  it('sizes short confirmations to their content instead of leaving a fixed blank body', () => {
    const short = desktopDialogWindowHeight({
      title: 'Restart DSH Desktop',
      message: '现在重启 DSH Desktop？',
      detail: '正在运行的操作和未发送的输入可能会中断。如果取消，已保存的设置会继续等待下次重启生效。',
      buttons: ['重启', '取消'],
    })
    const long = desktopDialogWindowHeight({
      title: 'Plugin Recovery',
      message: 'DSH Desktop could not load all plugins.',
      detail: 'Failed plugins:\n- dsh-vision-router\n\nThe client Loader failed while starting the plugin. Open DSH Terminal to update or remove it, then restart DSH Desktop.',
      buttons: ['Open DSH Terminal', 'Restart DSH Desktop', 'Dismiss'],
    })

    expect(short).toBeLessThan(210)
    expect(long).toBeGreaterThan(short)
    expect(long).toBeLessThanOrEqual(360)
  })

  it('creates a frameless parented modal shadcn window and returns its explicit response', async () => {
    const parent = new electron.BrowserWindow({})
    const dialog = new DesktopDialogWindow({
      type: 'question',
      title: 'Restart DSH Desktop',
      message: 'Restart now?',
      detail: 'Running operations may be interrupted.',
      buttons: ['Restart', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
    }, parent as unknown as Electron.BrowserWindow)
    const result = dialog.run()
    await vi.waitFor(() => { expect(electron.windows).toHaveLength(2) })
    const window = electron.windows[1]
    expect(window?.options).toEqual(expect.objectContaining({
      parent,
      modal: true,
      frame: false,
      closable: false,
      resizable: false,
      height: desktopDialogWindowHeight({
        type: 'question',
        title: 'Restart DSH Desktop',
        message: 'Restart now?',
        detail: 'Running operations may be interrupted.',
        buttons: ['Restart', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
      }),
    }))
    expect(window?.options).not.toHaveProperty('titleBarStyle')
    expect(window?.loadFile).toHaveBeenCalledWith(
      expect.stringMatching(/[\\/]native-ui[\\/]desktop-dialog\.html$/u),
      expect.objectContaining({ query: expect.objectContaining({ platform: process.platform, frame: 'false' }) }),
    )
    const navigate = window?.webListeners.get('will-navigate')
    const event = { preventDefault: vi.fn() }
    navigate?.(event, 'dsh-desktop-dialog://response?id=0')

    await expect(result).resolves.toEqual({ response: 0 })
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(window?.destroy).toHaveBeenCalledOnce()
  })

  it('maps window close to the configured cancel response', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin')
    const result = new DesktopDialogWindow({
      title: 'Confirm',
      message: 'Continue?',
      buttons: ['Continue', 'Cancel'],
      cancelId: 1,
    }).run()
    await vi.waitFor(() => { expect(electron.windows).toHaveLength(1) })
    expect(electron.windows[0]?.options).toEqual(expect.objectContaining({
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 12 },
    }))
    expect(electron.windows[0]?.loadFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ query: expect.objectContaining({ frame: 'true' }) }),
    )
    electron.windows[0]?.listeners.get('closed')?.()
    await expect(result).resolves.toEqual({ response: 1 })
  })
})
