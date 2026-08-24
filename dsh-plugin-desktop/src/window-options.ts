/** BrowserWindow construction for compatibility and advanced shells. */

import type { BrowserWindowConstructorOptions, NativeImage } from 'electron'
import type { DesktopPlatform, DesktopShellSpec } from './runtime.ts'
import { EXTENDED_TITLEBAR_HEIGHT, WINDOWS_TITLEBAR_HEIGHT } from './window-chrome.ts'

/**
 * Build a secure BrowserWindow while preserving the operating system frame.
 * @param spec - shell values resolved from the active Cordis row.
 * @param icon - validated application icon.
 * @param platform - current Electron platform.
 * @returns options with a native frame and no custom materials.
 */
export function compatibilityWindowOptions(
  spec: DesktopShellSpec,
  icon: NativeImage,
  platform: DesktopPlatform,
  preload: string,
): BrowserWindowConstructorOptions {
  if (spec.mode !== 'compatibility') {
    throw new Error(`dsh-plugin-desktop: unsupported compatibility window mode ${spec.mode}`)
  }
  const options: BrowserWindowConstructorOptions = {
    title: platform === 'win32' ? spec.windowTitle : '',
    width: spec.width,
    height: spec.height,
    minWidth: spec.minWidth,
    minHeight: spec.minHeight,
    show: false,
    icon,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  }
  if (platform === 'win32') options.autoHideMenuBar = true
  return options
}

/**
 * Build the native material window used by the desktop-owned advanced shell.
 * @param spec - shell values resolved from the active Cordis row.
 * @param icon - validated application icon.
 * @param platform - current Electron platform.
 * @returns platform-native glass and window-control options.
 */
export function advancedWindowOptions(
  spec: DesktopShellSpec,
  icon: NativeImage,
  platform: DesktopPlatform,
  preload: string,
): BrowserWindowConstructorOptions {
  if (spec.mode !== 'advanced') {
    throw new Error(`dsh-plugin-desktop: unsupported advanced window mode ${spec.mode}`)
  }
  return customChromeWindowOptions(spec, icon, platform, preload, WINDOWS_TITLEBAR_HEIGHT)
}

/** Build the visible command-bar window used by extended mode. */
export function extendedWindowOptions(
  spec: DesktopShellSpec,
  icon: NativeImage,
  platform: DesktopPlatform,
  preload: string,
): BrowserWindowConstructorOptions {
  if (spec.mode !== 'extended') {
    throw new Error(`dsh-plugin-desktop: unsupported extended window mode ${spec.mode}`)
  }
  return customChromeWindowOptions(spec, icon, platform, preload, EXTENDED_TITLEBAR_HEIGHT)
}

function customChromeWindowOptions(
  spec: DesktopShellSpec,
  icon: NativeImage,
  platform: DesktopPlatform,
  preload: string,
  titlebarHeight: number,
): BrowserWindowConstructorOptions {
  const options: BrowserWindowConstructorOptions = {
    title: platform === 'win32' ? spec.windowTitle : '',
    width: spec.width,
    height: spec.height,
    minWidth: spec.minWidth,
    minHeight: spec.minHeight,
    show: false,
    icon,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  }
  if (platform === 'darwin') {
    const custom: BrowserWindowConstructorOptions = {
      ...options,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 16 },
    }
    return spec.material === 'transparent'
      ? {
          ...custom,
          transparent: true,
          backgroundColor: '#00000000',
          vibrancy: 'sidebar',
          visualEffectState: 'followWindow',
        }
      : custom
  }
  if (platform === 'win32') {
    return {
      ...options,
      autoHideMenuBar: true,
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        color: '#00000000',
        symbolColor: '#7f858f',
        height: titlebarHeight,
      },
      ...(spec.material === 'off' ? {} : { backgroundColor: '#00000000' }),
      ...(spec.material === 'acrylic' ? { transparent: true } : {}),
      ...(spec.material === 'mica' ? { backgroundMaterial: 'mica' as const } : {}),
      hasShadow: true,
      roundedCorners: true,
      thickFrame: true,
    }
  }
  throw new Error('dsh-plugin-desktop: custom desktop shell modes are supported on macOS and Windows')
}

/**
 * Select the BrowserWindow options for the active presentation mode.
 * @param spec - active shell generation.
 * @param icon - validated application icon.
 * @param platform - current Electron platform.
 * @returns mode-specific BrowserWindow options.
 */
export function desktopWindowOptions(
  spec: DesktopShellSpec,
  icon: NativeImage,
  platform: DesktopPlatform,
  preload: string,
): BrowserWindowConstructorOptions {
  if (spec.mode === 'compatibility') return compatibilityWindowOptions(spec, icon, platform, preload)
  if (spec.mode === 'extended') return extendedWindowOptions(spec, icon, platform, preload)
  return advancedWindowOptions(spec, icon, platform, preload)
}
