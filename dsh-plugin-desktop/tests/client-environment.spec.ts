import { describe, expect, it, vi } from 'vitest'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { apply } from '../src/client/index.ts'
import { AdvancedFrame } from '../src/client/AdvancedFrame.tsx'
import { applyAdvancedShell } from '../src/client/advanced-shell.ts'
import { provideDesktopLayout } from '../src/client/layout-service.ts'
import { parseDesktopClientEnvironment } from '../src/client/environment.ts'
import { ExtendedFrame } from '../src/client/ExtendedFrame.tsx'
import { applyExtendedShell } from '../src/client/extended-shell.ts'
import { installExtendedStyles } from '../src/client/extended-styles.ts'
import {
  computeDesktopColumns, DesktopLayoutState, MACOS_SIDEBAR_COLLAPSED, SIDEBAR_COLLAPSED,
} from '../src/client/layout-state.ts'
import { installDesktopOwnedStyles } from '../src/client/styles.ts'
import { desktopWindowService, provideDesktopWindow } from '../src/client/window-service.ts'
import {
  ADVANCED_MACOS_CONTENT_INSET,
  ADVANCED_MACOS_DRAG_REGION_HEIGHT,
  ADVANCED_WINDOWS_TITLEBAR_HEIGHT,
  DESKTOP_FRAME_HEIGHT,
  MACOS_TRAFFIC_LIGHT_SAFE_WIDTH,
  WINDOWS_CAPTION_CONTROLS_WIDTH,
} from '../src/window-chrome.ts'

describe('desktop client environment', () => {
  it('does not activate desktop effects for an ordinary browser URL', () => {
    vi.stubGlobal('window', { location: { search: '' } })
    const effect = vi.fn()

    try {
      expect(parseDesktopClientEnvironment('')).toBeUndefined()
      apply({ effect } as unknown as ClientContext)
      expect(effect).not.toHaveBeenCalled()
    }
    finally {
      vi.unstubAllGlobals()
    }
  })

  it('accepts the Electron-owned kebab query markers', () => {
    expect(parseDesktopClientEnvironment('?dsh-desktop-mode=advanced&dsh-desktop-platform=darwin&dsh-desktop-material=transparent'))
      .toEqual({ mode: 'advanced', platform: 'darwin', material: 'transparent', micaSupported: false })
    expect(parseDesktopClientEnvironment('?dsh-desktop-platform=win32&dsh-desktop-mode=compatibility&dsh-desktop-material=off&dsh-desktop-mica=0'))
      .toEqual({ mode: 'compatibility', platform: 'win32', material: 'off', micaSupported: false })
    expect(parseDesktopClientEnvironment('?dsh-desktop-mode=extended&dsh-desktop-platform=win32&dsh-desktop-material=mica&dsh-desktop-mica=1'))
      .toEqual({ mode: 'extended', platform: 'win32', material: 'mica', micaSupported: true })
  })

  it.each([
    ['?dsh-desktop-mode=glass&dsh-desktop-platform=darwin', 'dsh-desktop-mode'],
    ['?dsh-desktop-mode=advanced', 'dsh-desktop-platform'],
    ['?dsh-desktop-platform=darwin', 'dsh-desktop-mode'],
    ['?dsh-desktop-mode=advanced&dsh-desktop-platform=android', 'dsh-desktop-platform'],
    ['?dsh-desktop-mode=advanced&dsh-desktop-platform=darwin', 'dsh-desktop-material'],
    ['?dsh-desktop-mode=advanced&dsh-desktop-platform=win32&dsh-desktop-material=mica&dsh-desktop-mica=0', 'incompatible'],
  ])('fails loud for malformed marker %s', (search, field) => {
    expect(() => parseDesktopClientEnvironment(search)).toThrow(field)
  })
})

describe('advanced desktop layout', () => {
  it('owns native caption geometry and extends macOS drag handling through empty session header space', () => {
    expect(ADVANCED_MACOS_CONTENT_INSET).toBe(20)
    expect(ADVANCED_MACOS_DRAG_REGION_HEIGHT).toBe(32)
    expect(ADVANCED_MACOS_DRAG_REGION_HEIGHT).toBeGreaterThan(ADVANCED_MACOS_CONTENT_INSET)
    expect(ADVANCED_WINDOWS_TITLEBAR_HEIGHT).toBe(32)
    let css = ''
    const remove = vi.fn()
    const style = {
      dataset: {},
      get textContent() { return css },
      set textContent(value: string) { css = value },
      remove,
    }
    const appendChild = vi.fn()
    vi.stubGlobal('document', {
      createElement: () => style,
      head: { appendChild },
    })

    try {
      const dispose = installDesktopOwnedStyles()
      expect(css).toMatch(/\.dshDesktopFrame \{[^}]*transition: grid-template-columns var\(--ds-transition-duration-slow\) var\(--ds-ease-in-out\);/)
      expect(css).toMatch(/\.dshDesktopFrame\[data-dragging\] \{ transition: none; \}/)
      expect(css).toMatch(/\.dshDesktopFrame\[data-details-collapsed\] \.dshDesktopDetailsSurface \{ border-left: none; \}/)
      expect(css).toMatch(/\.dshDesktopResizeHandle \{[^}]*transition: left var\(--ds-transition-duration-slow\) var\(--ds-ease-in-out\);/)
      expect(css).toMatch(/\.dshDesktopFrame\[data-dragging\] \.dshDesktopResizeHandle \{ transition: none; \}/)
      expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.dshDesktopFrame,[\s\S]*\.dshDesktopResizeHandle \{ transition: none !important; \}/)
      expect(css).toMatch(/\.dshDesktopSidebarSurface\s*\{[^}]*--dsw-specific-sidebar-fill:\s*transparent;/)
      expect(css).toMatch(/data-desktop-platform="darwin"\]\[data-sidebar-collapsed\][^{]*\.dshDesktopUpstreamSidebar \{[^}]*width:\s*56px;[^}]*margin:\s*0 auto;/)
      expect(css).toMatch(new RegExp(`data-desktop-mode="advanced"\\]\\[data-desktop-platform="darwin"\\] \\.dshDesktopUpstreamSidebar \\{[^}]*padding-top: ${ADVANCED_MACOS_CONTENT_INSET}px;`))
      expect(css).not.toMatch(/\.dshDesktopUpstreamSidebar \{[^}]*-webkit-app-region: no-drag;/)
      expect(css).toContain(`grid-template-rows: ${ADVANCED_MACOS_CONTENT_INSET}px minmax(0, 1fr)`)
      expect(css).toMatch(/\.dshDesktopFrame\[data-desktop-mode="advanced"\]\[data-desktop-platform="darwin"\] \.dshDesktopSidebarSurface \{[^}]*grid-row: 1 \/ -1;/)
      expect(css).not.toMatch(/data-desktop-platform="darwin"\] \.dshDesktopSidebarSurface \{[^}]*-webkit-app-region: no-drag;/)
      expect(css).toMatch(/\.dshDesktopFrame\[data-desktop-mode="advanced"\]\[data-desktop-platform="darwin"\] \.dshDesktopConversationSurface,\s*\.dshDesktopFrame\[data-desktop-mode="advanced"\]\[data-desktop-platform="darwin"\] \.dshDesktopDetailsSurface \{ grid-row: 2; \}/)
      expect(css).toMatch(new RegExp(`data-desktop-platform="darwin"\\] \\.dshDesktopSidebarSurface::before \\{[^}]*left: ${MACOS_TRAFFIC_LIGHT_SAFE_WIDTH}px;[^}]*height: ${ADVANCED_MACOS_DRAG_REGION_HEIGHT}px;[^}]*-webkit-app-region: drag;`))
      expect(css).not.toMatch(/data-desktop-platform="darwin"\] \.dshDesktopSidebarSurface::before \{[^}]*z-index:/)
      expect(css).toMatch(/\.dshDesktopMacCaptionRow \{[^}]*position: relative;[^}]*grid-column: 2 \/ -1;[^}]*grid-row: 1;/)
      expect(css).toMatch(new RegExp(`\\.dshDesktopMacCaptionRow::before \\{[^}]*height: ${ADVANCED_MACOS_DRAG_REGION_HEIGHT}px;[^}]*-webkit-app-region: drag;`))
      expect(css).not.toMatch(/\.dshDesktopMacCaptionRow::before \{[^}]*z-index:/)
      expect(css).not.toMatch(/data-desktop-platform="darwin"\] \.dshDesktopSidebarSurface \{[^}]*-webkit-app-region:\s*drag;/)
      expect(css).toContain('body[data-dsh-desktop-mode="advanced"] .dshDesktopFrame[data-desktop-platform="darwin"] .dshDesktopConversationSurface [data-slot="conversation.session.header"] > header { -webkit-app-region: drag; }')
      expect(css).not.toContain('[data-phase')
      expect(css).toMatch(/\.dshDesktopNoDrag, button, input, textarea, select, label, summary, a,[^{}]*\{ -webkit-app-region: no-drag !important; \}/)
      expect(css).toContain('[contenteditable="true"]')
      expect(css).toContain('[role="switch"]')
      expect(css).not.toMatch(/html:has\(\[aria-modal="true"\]\) \.dshDesktopMacCaptionRow/)
      expect(css).not.toMatch(/html:has\(\[aria-modal="true"\]\) \.dshDesktopSidebarSurface/)
      expect(css).toContain(`grid-template-rows: ${ADVANCED_WINDOWS_TITLEBAR_HEIGHT}px minmax(0, 1fr)`)
      expect(css).toMatch(/\.dshDesktopFrame\[data-desktop-mode="advanced"\]\[data-desktop-platform="win32"\] \.dshDesktopSidebarSurface \{ grid-row: 1 \/ -1; \}/)
      expect(css).toMatch(/\.dshDesktopFrame\[data-desktop-mode="advanced"\]\[data-desktop-platform="win32"\] \.dshDesktopConversationSurface,\s*\.dshDesktopFrame\[data-desktop-mode="advanced"\]\[data-desktop-platform="win32"\] \.dshDesktopDetailsSurface \{ grid-row: 2; \}/)
      expect(css).toMatch(/\.dshDesktopWindowsCaptionRow \{[^}]*grid-column: 2 \/ -1;[^}]*grid-row: 1;/)
      expect(css).toMatch(new RegExp(`\\.dshDesktopWindowsCaptionRow::before \\{[^}]*inset: 0 ${WINDOWS_CAPTION_CONTROLS_WIDTH}px 0 0;[^}]*-webkit-app-region: drag;`))
      expect(css).toContain('html:has([aria-modal="true"]) .dshDesktopWindowsCaptionRow::before { -webkit-app-region: no-drag !important; }')
      expect(css).not.toMatch(/data-desktop-platform="win32"[^{}]*header[^{}]*\{[^}]*padding-right/)
      expect(appendChild).toHaveBeenCalledWith(style)
      dispose()
      expect(remove).toHaveBeenCalledOnce()
    }
    finally {
      vi.unstubAllGlobals()
    }
  })

  it('releases the Cordis layout service with its owning effect', () => {
    let disposed = false
    const ctx = {
      reflect: {
        provide: (name: string, value: unknown) => {
          expect(name).toBe('layout')
          expect(value).toBeInstanceOf(DesktopLayoutState)
          return () => { disposed = true }
        },
      },
    } as unknown as ClientContext

    const dispose = provideDesktopLayout(ctx, new DesktopLayoutState())
    expect(disposed).toBe(false)
    dispose()
    expect(disposed).toBe(true)
  })

  it('keeps the enhanced root registration independent from the extended frame', () => {
    const registrations: Array<Record<string, unknown>> = []
    const occupants: unknown[] = []
    const disposers: Array<() => void> = []
    const dataset: Record<string, string> = {}
    vi.stubGlobal('document', {
      body: {
        dataset,
        removeAttribute: vi.fn(),
        setAttribute: vi.fn(),
        style: { setProperty: vi.fn(), removeProperty: vi.fn() },
      },
      documentElement: { style: { colorScheme: '', removeProperty: vi.fn() } },
      createElement: vi.fn(() => ({
        content: '',
        dataset: {},
        isConnected: false,
        name: '',
        remove: vi.fn(),
        style: { setProperty: vi.fn(), removeProperty: vi.fn() },
        textContent: '',
      })),
      head: { appendChild: vi.fn() },
    })
    vi.stubGlobal('getComputedStyle', () => ({ backgroundColor: 'rgb(0, 0, 0)' }))
    const ctx = {
      effect: vi.fn((mount: () => void | (() => void)) => {
        const dispose = mount()
        if (typeof dispose === 'function') disposers.push(dispose)
      }),
      reflect: { provide: vi.fn(() => () => {}) },
      theme: {
        getTheme: vi.fn(() => ({ active: { colorScheme: 'dark', tokens: {} } })),
      },
      on: vi.fn(() => () => {}),
      slots: {
        register: vi.fn((options: Record<string, unknown>, occupant: unknown) => {
          registrations.push(options)
          occupants.push(occupant)
          return () => {}
        }),
      },
    } as unknown as ClientContext

    try {
      applyAdvancedShell(ctx, {
        mode: 'advanced',
        platform: 'darwin',
        material: 'transparent',
        micaSupported: false,
      })
      expect(registrations).toHaveLength(1)
      expect(occupants).toEqual([AdvancedFrame])
      const rootInject = (registrations[0]?.inject as () => Record<string, unknown>)()
      expect(rootInject).toMatchObject({ platform: 'darwin' })
      expect(rootInject).not.toHaveProperty('mode')
      expect(dataset).toMatchObject({
        dshDesktopMode: 'advanced',
        dshDesktopPlatform: 'darwin',
        dshDesktopMaterial: 'transparent',
      })
      disposers.forEach(dispose => { dispose() })
      expect(dataset).toEqual({})
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('reports generation-stable safe areas and drag geometry to client plugins', () => {
    expect(desktopWindowService({
      mode: 'compatibility', platform: 'darwin', material: 'off', micaSupported: false,
    })).toEqual({
      mode: 'compatibility',
      platform: 'darwin',
      material: 'off',
      micaSupported: false,
      availableMaterials: ['off', 'transparent'],
      safeAreaInsets: { top: DESKTOP_FRAME_HEIGHT, right: 0, bottom: 0, left: 0 },
      dragRegion: {
        height: DESKTOP_FRAME_HEIGHT,
        leftInset: MACOS_TRAFFIC_LIGHT_SAFE_WIDTH,
        rightInset: 0,
      },
    })
    const mac = desktopWindowService({
      mode: 'advanced', platform: 'darwin', material: 'transparent', micaSupported: false,
    })
    expect(mac).toEqual({
      mode: 'advanced',
      platform: 'darwin',
      material: 'transparent',
      micaSupported: false,
      availableMaterials: ['off', 'transparent'],
      safeAreaInsets: { top: ADVANCED_MACOS_CONTENT_INSET, right: 0, bottom: 0, left: 0 },
      dragRegion: {
        height: ADVANCED_MACOS_DRAG_REGION_HEIGHT,
        leftInset: MACOS_TRAFFIC_LIGHT_SAFE_WIDTH,
        rightInset: 0,
      },
    })
    expect(Object.isFrozen(mac)).toBe(true)
    expect(Object.isFrozen(mac.safeAreaInsets)).toBe(true)
    expect(Object.isFrozen(mac.dragRegion)).toBe(true)
    expect(desktopWindowService({
      mode: 'advanced', platform: 'win32', material: 'acrylic', micaSupported: false,
    })).toEqual({
      mode: 'advanced',
      platform: 'win32',
      material: 'acrylic',
      micaSupported: false,
      availableMaterials: ['off', 'acrylic'],
      safeAreaInsets: { top: ADVANCED_WINDOWS_TITLEBAR_HEIGHT, right: 0, bottom: 0, left: 0 },
      dragRegion: {
        height: ADVANCED_WINDOWS_TITLEBAR_HEIGHT,
        leftInset: 0,
        rightInset: WINDOWS_CAPTION_CONTROLS_WIDTH,
      },
    })
    expect(desktopWindowService({
      mode: 'extended', platform: 'win32', material: 'mica', micaSupported: true,
    })).toEqual({
      mode: 'extended',
      platform: 'win32',
      material: 'mica',
      micaSupported: true,
      availableMaterials: ['off', 'acrylic', 'mica'],
      safeAreaInsets: { top: DESKTOP_FRAME_HEIGHT, right: 0, bottom: 0, left: 0 },
      dragRegion: {
        height: DESKTOP_FRAME_HEIGHT,
        leftInset: 0,
        rightInset: WINDOWS_CAPTION_CONTROLS_WIDTH,
      },
    })

    let disposed = false
    const ctx = {
      reflect: {
        provide: (name: string, value: unknown) => {
          expect(name).toBe('desktopWindow')
          expect(value).toBe(mac)
          return () => { disposed = true }
        },
      },
    } as unknown as ClientContext
    const dispose = provideDesktopWindow(ctx, mac)
    expect(disposed).toBe(false)
    dispose()
    expect(disposed).toBe(true)
  })

  it('uses the compatibility rail on Windows and the wider desktop rail on macOS', () => {
    expect(computeDesktopColumns(1440, 0, 0)).toEqual({ sidebar: SIDEBAR_COLLAPSED, center: 1384, details: 0 })
    expect(computeDesktopColumns(1440, 0, 0, MACOS_SIDEBAR_COLLAPSED))
      .toEqual({ sidebar: MACOS_SIDEBAR_COLLAPSED, center: 1350, details: 0 })
    expect(SIDEBAR_COLLAPSED).toBe(56)
    expect(MACOS_SIDEBAR_COLLAPSED).toBe(90)
  })

  it('publishes mirrored panel transitions', () => {
    const layout = new DesktopLayoutState()
    const snapshots: object[] = []
    layout.subscribe(() => { snapshots.push(layout.getSnapshot()) })
    layout.toggleSidebar()
    layout.openDetails()
    layout.closeDetails()
    expect(snapshots).toEqual([
      { sidebar: 0, details: 0, narrow: false, narrowExpanded: false },
      { sidebar: 0, details: 360, narrow: false, narrowExpanded: false },
      { sidebar: 0, details: 0, narrow: false, narrowExpanded: false },
    ])
  })

  it('lets the rail re-expand without losing its wide preference on narrow windows', () => {
    const layout = new DesktopLayoutState()
    layout.setNarrow(true)
    expect(layout.getSnapshot()).toMatchObject({ sidebar: 280, narrow: true, narrowExpanded: false })
    layout.toggleSidebar()
    expect(layout.getSnapshot()).toMatchObject({ sidebar: 280, narrow: true, narrowExpanded: true })
    layout.setNarrow(false)
    expect(layout.getSnapshot()).toMatchObject({ sidebar: 280, narrow: false, narrowExpanded: false })
  })
})

describe('independent Desktop frame', () => {
  it('reserves a command bar for both framed modes and limits the inverted-L surface to extended mode', () => {
    let css = ''
    const remove = vi.fn()
    const style = {
      dataset: {},
      get textContent() { return css },
      set textContent(value: string) { css = value },
      remove,
    }
    const appendChild = vi.fn()
    vi.stubGlobal('document', {
      createElement: () => style,
      head: { appendChild },
    })

    try {
      const dispose = installExtendedStyles()
      expect(css).toContain(`padding-top: ${DESKTOP_FRAME_HEIGHT}px`)
      expect(DESKTOP_FRAME_HEIGHT).toBe(36)
      expect(css).toMatch(/\[role="presentation"\]:has\(> \[aria-modal="true"\]\),[\s\S]*> \[aria-modal="true"\] \{[\s\S]*top: var\(--dsh-desktop-frame-height\) !important;/)
      expect(css).not.toContain('#root > :has(> [data-shell-overlay])')
      expect(css).toMatch(/body\[data-dsh-desktop-mode="extended"\] \.dshDesktopSidebarSurface \{[^}]*--dsw-specific-sidebar-fill: transparent;[^}]*border-right-color: transparent;[^}]*background: var\(--dsh-desktop-frame-fill\)/)
      expect(css).toMatch(/body\[data-dsh-desktop-mode="extended"\] \.dshDesktopConversationSurface \{[^}]*border-top: 1px solid var\(--dsw-alias-border-l1\);[^}]*border-left: 1px solid var\(--dsw-alias-border-l1\);[^}]*border-top-left-radius: 10px;/)
      expect(css).toContain('body:is([data-dsh-desktop-mode="compatibility"], [data-dsh-desktop-mode="extended"]) #root')
      expect(css).toMatch(/\.dshDesktopFrameTitlebar \{[^}]*-webkit-app-region: drag;/)
      expect(css).toMatch(/\.dshDesktopFrameIdentity \{[^}]*left: 50%;[^}]*transform: translateX\(-50%\);/)
      expect(css).toMatch(/\.dshDesktopFrameActions \{[^}]*-webkit-app-region: no-drag;/)
      expect(css).toContain('[data-platform="darwin"] .dshDesktopFrameActions { margin-left: auto; }')
      expect(css).toContain('[data-platform="win32"] .dshDesktopFrameActions { margin-right: auto; }')
      expect(css).toMatch(/\.dshDesktopTitlebarIconButton \{[^}]*-webkit-app-region: no-drag;/)
      expect(css).toMatch(/\.dshDesktopTitlebarIconButton \{[^}]*width: 26px;[^}]*height: 26px;[^}]*border-radius: 7px;/)
      expect(css).toMatch(/\.dshDesktopTitlebarIconButton svg,[^}]*width: 14px;[^}]*height: 14px;/)
      expect(css).toContain('.dshDesktopActionMenu')
      expect(css).toContain(`padding: 0 ${WINDOWS_CAPTION_CONTROLS_WIDTH + 8}px 0 8px`)
      expect(css).toContain(`padding: 0 8px 0 ${MACOS_TRAFFIC_LIGHT_SAFE_WIDTH + 8}px`)
      expect(appendChild).toHaveBeenCalledWith(style)
      dispose()
      expect(remove).toHaveBeenCalledOnce()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('owns the extended root and exposes its independent frame action seat', () => {
    const registrations: Array<Record<string, unknown>> = []
    const occupants: unknown[] = []
    const disposers: Array<() => void> = []
    const dataset: Record<string, string> = {}
    const rootDataset: Record<string, string> = {}
    const bodyStyle = { setProperty: vi.fn(), removeProperty: vi.fn() }
    const documentElementStyle = { colorScheme: '', removeProperty: vi.fn() }
    const createElement = vi.fn(() => ({
      content: '',
      dataset: {},
      id: '',
      isConnected: false,
      name: '',
      remove: vi.fn(),
      style: { setProperty: vi.fn(), removeProperty: vi.fn() },
      textContent: '',
    }))
    vi.stubGlobal('document', {
      body: {
        dataset,
        removeAttribute: vi.fn(),
        setAttribute: vi.fn(),
        style: bodyStyle,
      },
      documentElement: { style: documentElementStyle },
      getElementById: (id: string) => id === 'root' ? { dataset: rootDataset } : null,
      createElement,
      head: { appendChild: vi.fn() },
    })
    vi.stubGlobal('getComputedStyle', () => ({ backgroundColor: 'rgb(0, 0, 0)' }))
    const ctx = {
      effect: vi.fn((mount: () => void | (() => void)) => {
        const dispose = mount()
        if (typeof dispose === 'function') disposers.push(dispose)
      }),
      reflect: { provide: vi.fn(() => () => {}) },
      theme: {
        getTheme: vi.fn(() => ({ active: { colorScheme: 'dark', tokens: {} } })),
      },
      on: vi.fn(() => () => {}),
      slots: {
        inject: vi.fn((_name: string, mount: () => unknown) => mount()),
        register: vi.fn((options: Record<string, unknown>, occupant: unknown) => {
          registrations.push(options)
          occupants.push(occupant)
          return () => {}
        }),
      },
    } as unknown as ClientContext

    try {
      applyExtendedShell(ctx, {
        mode: 'extended',
        platform: 'win32',
        material: 'acrylic',
        micaSupported: false,
      })
      expect(registrations[0]).toMatchObject({
        name: 'root',
        children: {
          sidebar: { kind: 'single', scope: 'root' },
          conversation: { kind: 'single', scope: 'session-maybe' },
          details: { kind: 'single', scope: 'session' },
          'shell.overlay': { kind: 'list', scope: 'root' },
        },
      })
      expect(registrations[0]?.inject).toBeTypeOf('function')
      const rootInject = (registrations[0]?.inject as () => Record<string, unknown>)()
      expect(rootInject).toMatchObject({
        platform: 'win32',
      })
      expect(rootInject).not.toHaveProperty('mode')
      expect(occupants[0]).toBe(ExtendedFrame)
      expect(registrations[1]).toMatchObject({
        name: 'shell.overlay',
        id: 'desktop-frame-titlebar',
        children: { 'desktop.titlebar.action': { kind: 'list', scope: 'root' } },
      })
      expect(registrations[2]).toMatchObject({
        name: 'desktop.titlebar.action',
        id: 'desktop-native-actions',
      })
      expect(dataset).toMatchObject({
        dshDesktopMode: 'extended',
        dshDesktopPlatform: 'win32',
        dshDesktopMaterial: 'acrylic',
      })
      expect(rootDataset).toEqual({ dshDesktopContentViewport: '' })
      disposers.forEach(dispose => { dispose() })
      expect(dataset).toEqual({})
      expect(rootDataset).toEqual({})
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
