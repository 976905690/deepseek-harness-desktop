/**
 * Deepseek Harness for Threerouter : isolated Client plugin.
 *
 * Registers the Threerouter-branded sidebar (replacing the upstream
 * SidebarRoot with priority -1) and the top-right account/balance/invite
 * overlay inside the advanced shell. Designed to compose alongside
 * `dsh-plugin-desktop` without depending on its client source — the desktop
 * shell owns the root frame, this plugin owns only the Threerouter surfaces.
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { ThreerouterAuthUI } from './threerouter-auth-ui.tsx'
import { ThreerouterSidebar } from './threerouter-sidebar.tsx'
import { threerouterLocale } from './locale.ts'
import { parseThreerouterClientEnvironment } from './environment.ts'
import { installThreerouterStyles } from './styles.ts'

/** Services required by the Threerouter client surfaces. */
export const inject = ['slots', 'locale', 'connection', 'sessions', 'workspaces']

/**
 * Register the Threerouter sidebar and auth overlay for the advanced shell.
 *
 * Stays inert outside the desktop advanced shell — the environment markers are
 * only injected by the Electron Host for advanced mode, so this plugin does
 * nothing in compatibility/extended mode or the upstream Web bundle.
 * @param ctx - browser Cordis context.
 */
export function apply(ctx: ClientContext): void {
  const environment = parseThreerouterClientEnvironment(window.location.search)
  if (environment === undefined) return
  if (environment.mode !== 'advanced') return

  ctx.effect(() => installThreerouterStyles(), 'threerouter: owned styles')

  // Threerouter-branded sidebar (replaces upstream SidebarRoot).
  // Priority -1 shadows the upstream priority 0 registration (lowest renders).
  // Children slots are NOT re-declared — the upstream plugin owns those; we
  // only consume them via renderSlot() in ThreerouterSidebar.
  //
  // NOTE: use ctx.slots.inject() instead of bare ctx.slots.register() here
  // because registration order is unconstrained across client plugins — the
  // desktop shell declares 'sidebar' as a child of its root entry, but this
  // contribution may apply before that declaration is materialized.
  // slots.inject waits on the actual declaration, installs the contribution,
  // and rolls it back when the declaration collapses.
  ctx.effect(() => {
    const injectProps = () => ({
      startSession: (workspaceId?: string) => { (ctx.workspaces as any).startSession(workspaceId) },
      toggleSidebar: () => { (ctx as any).layout?.toggleSidebar?.() },
      version: environment.version,
    })
    return (ctx.slots.inject as any)('sidebar', () => (
      (ctx.slots.register as any)({
        name: 'sidebar',
        priority: -1,
        locale: 'sidebar',
        inject: injectProps,
      }, ThreerouterSidebar)
    ))
  }, 'threerouter: sidebar slot')

  // Top-right account/balance/invite/model-switch overlay.
  // Registered against the threerouter locale namespace so its strings resolve
  // through this plugin's own dictionary, independent of the desktop shell.
  // Same slots.inject caveat as above — 'shell.overlay' is declared by the
  // desktop shell's root entry and may not exist when this apply runs.
  ctx.effect(() => {
    const disposeLocale = ctx.locale.register('threerouter', threerouterLocale)
    const disposeSlot = (ctx.slots.inject as any)('shell.overlay', () => (
      (ctx.slots.register as any)({
        name: 'shell.overlay',
        id: 'threerouter-auth-ui',
        locale: 'threerouter',
        inject: () => ({
          connection: ctx.get('connection')!,
          sessions: ctx.get('sessions')!,
          platform: environment.platform,
          version: environment.version,
        }),
      }, ThreerouterAuthUI)
    ))
    return () => {
      void disposeSlot()
      disposeLocale()
    }
  }, 'threerouter: auth UI slot')
}
