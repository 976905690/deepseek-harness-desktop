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

  it('creates a parented modal shadcn window and returns its explicit response', async () => {
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
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 16 },
    }))
    expect(window?.loadFile).toHaveBeenCalledWith(
      expect.stringMatching(/[\\/]native-ui[\\/]desktop-dialog\.html$/u),
      expect.objectContaining({ query: expect.objectContaining({ platform: process.platform }) }),
    )
    const navigate = window?.webListeners.get('will-navigate')
    const event = { preventDefault: vi.fn() }
    navigate?.(event, 'dsh-desktop-dialog://response?id=0')

    await expect(result).resolves.toEqual({ response: 0 })
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(window?.destroy).toHaveBeenCalledOnce()
  })

  it('maps window close to the configured cancel response', async () => {
    const result = new DesktopDialogWindow({
      title: 'Confirm',
      message: 'Continue?',
      buttons: ['Continue', 'Cancel'],
      cancelId: 1,
    }).run()
    await vi.waitFor(() => { expect(electron.windows).toHaveLength(1) })
    electron.windows[0]?.listeners.get('closed')?.()
    await expect(result).resolves.toEqual({ response: 1 })
  })
})
