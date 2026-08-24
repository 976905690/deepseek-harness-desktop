/** Independent Desktop frame shared by compatibility and extended modes. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from './contracts.ts'
import { applyDesktopOwnedShell } from './advanced-shell.ts'
import { createDesktopSettingsApi } from './desktop-settings-api.ts'
import { DESKTOP_SETTINGS_LOCALE_NAMESPACE } from './desktop-settings.ts'
import type { DesktopClientEnvironment } from './environment.ts'
import {
  DesktopFrameTitlebar,
  DesktopFrameTitlebarNativeActions,
} from './ExtendedTitlebar.tsx'
import { installExtendedStyles } from './extended-styles.ts'

export function applyFramedShell(ctx: ClientContext, environment: DesktopClientEnvironment): void {
  if (environment.mode !== 'compatibility' && environment.mode !== 'extended') {
    throw new Error(`dsh-plugin-desktop: framed shell received mode ${JSON.stringify(environment.mode)}`)
  }
  const api = createDesktopSettingsApi()

  ctx.effect(() => {
    const contentViewport = document.getElementById('root')
    if (contentViewport === null) {
      throw new Error('dsh-plugin-desktop: framed shell requires the upstream root')
    }
    document.body.dataset.dshDesktopMode = environment.mode
    document.body.dataset.dshDesktopPlatform = environment.platform
    document.body.dataset.dshDesktopMaterial = environment.material
    contentViewport.dataset.dshDesktopContentViewport = ''
    const removeStyles = installExtendedStyles()
    return () => {
      removeStyles()
      delete contentViewport.dataset.dshDesktopContentViewport
      delete document.body.dataset.dshDesktopMode
      delete document.body.dataset.dshDesktopPlatform
      delete document.body.dataset.dshDesktopMaterial
    }
  }, `desktop: independent ${environment.mode} frame styles`)

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'desktop-frame-titlebar',
    order: -1000,
    children: {
      'desktop.titlebar.action': { kind: 'list', scope: 'root' },
    },
    locale: DESKTOP_SETTINGS_LOCALE_NAMESPACE,
    inject: () => ({ environment }),
  }, DesktopFrameTitlebar))

  ctx.slots.inject('desktop.titlebar.action', () => ctx.slots.register({
    name: 'desktop.titlebar.action',
    id: 'desktop-native-actions',
    order: 0,
    locale: DESKTOP_SETTINGS_LOCALE_NAMESPACE,
    inject: () => ({ api }),
  }, DesktopFrameTitlebarNativeActions))
}

/** Backward-compatible named entry that now delegates to the shared frame. */
export function applyExtendedShell(ctx: ClientContext, environment: DesktopClientEnvironment): void {
  if (environment.mode !== 'extended') {
    throw new Error(`dsh-plugin-desktop: extended shell received mode ${JSON.stringify(environment.mode)}`)
  }
  applyDesktopOwnedShell(ctx, environment)
  applyFramedShell(ctx, environment)
}
