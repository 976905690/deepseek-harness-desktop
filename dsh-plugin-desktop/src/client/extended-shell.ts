/** Extended compatibility shell with a visible cross-platform command bar. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from './contracts.ts'
import { createDesktopSettingsApi } from './desktop-settings-api.ts'
import { DESKTOP_SETTINGS_LOCALE_NAMESPACE } from './desktop-settings.ts'
import type { DesktopClientEnvironment } from './environment.ts'
import {
  ExtendedTitlebar,
  ExtendedTitlebarNativeActions,
} from './ExtendedTitlebar.tsx'
import { installExtendedStyles } from './extended-styles.ts'

export function applyExtendedShell(ctx: ClientContext, environment: DesktopClientEnvironment): void {
  if (environment.mode !== 'extended') {
    throw new Error(`dsh-plugin-desktop: extended shell received mode ${JSON.stringify(environment.mode)}`)
  }
  const api = createDesktopSettingsApi()

  ctx.effect(() => {
    document.body.dataset.dshDesktopMode = 'extended'
    document.body.dataset.dshDesktopPlatform = environment.platform
    document.body.dataset.dshDesktopMaterial = environment.material
    const removeStyles = installExtendedStyles()
    return () => {
      removeStyles()
      delete document.body.dataset.dshDesktopMode
      delete document.body.dataset.dshDesktopPlatform
      delete document.body.dataset.dshDesktopMaterial
    }
  }, 'desktop: extended inverted-L shell styles')

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'desktop-extended-titlebar',
    order: -1000,
    children: {
      'desktop.titlebar.action': { kind: 'list', scope: 'root' },
    },
    locale: DESKTOP_SETTINGS_LOCALE_NAMESPACE,
    inject: () => ({ environment }),
  }, ExtendedTitlebar))

  ctx.slots.inject('desktop.titlebar.action', () => ctx.slots.register({
    name: 'desktop.titlebar.action',
    id: 'desktop-native-actions',
    order: 0,
    locale: DESKTOP_SETTINGS_LOCALE_NAMESPACE,
    inject: () => ({ api }),
  }, ExtendedTitlebarNativeActions))
}
