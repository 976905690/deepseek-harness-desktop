/** Shared custom frame options for Desktop-owned auxiliary windows. */

import type { BrowserWindowConstructorOptions } from 'electron'
import { DESKTOP_FRAME_HEIGHT } from './window-chrome.ts'

/** Hide the ordinary OS title row while retaining native window controls. */
export function auxiliaryWindowChromeOptions(
  platform: NodeJS.Platform = process.platform,
): BrowserWindowConstructorOptions {
  if (platform === 'darwin') {
    return {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 16 },
    }
  }
  if (platform === 'win32') {
    return {
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        color: '#00000000',
        symbolColor: '#7f858f',
        height: DESKTOP_FRAME_HEIGHT,
      },
      hasShadow: true,
      roundedCorners: true,
      thickFrame: true,
    }
  }
  return {}
}
