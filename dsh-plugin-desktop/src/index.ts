/** DSH Desktop Host plugin: owns the selected native shell generation. */

import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-cmdline'
import type {} from '@deepseek-ai/dsh-host-webserver'
import pkg from '../package.json' with { type: 'json' }
import {
  THEME_SETTINGS_NAMESPACE,
  type ThemeSettings,
} from '@deepseek-ai/dsh-client-ui-theme'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import {
  handleRendererBootRequest,
  RENDERER_BOOT_REPORT_PATH,
} from './renderer-boot.ts'
import { createThreerouterAuthHandler } from './threerouter-auth.ts'
import type { DesktopShellMode } from './runtime.ts'
import type {} from './runtime.ts'

/** Stable Cordis plugin name. */
export const name = 'desktop-shell'

/** Product brand shown in the native window, tray, and desktop caption row. */
export const PRODUCT_NAME = 'Threerouter Harness'

/** Services required before the shell can register its renderer generation. */
/** Services required by the desktop shell; `desktopRuntime` is probed, not required. */
export const inject = ['webServer', 'webRuntime', 'appExit', 'settings']

/** Standard settings namespace shared by tray and configuration surfaces. */
export const DESKTOP_SETTINGS_NAMESPACE = settingsNamespace('dsh-desktop')

const UI_THEME_SETTINGS_NAMESPACE = settingsNamespace(THEME_SETTINGS_NAMESPACE)

/** Desktop settings presented by the standard settings service. */
export interface DesktopSettings {
  /** Native presentation selected for the next application generation. */
  mode: DesktopShellMode
}

/** Schema registered with the standard settings service. */
export const DesktopSettingsSchema: z<DesktopSettings> = z.object({
  mode: z.union(['compatibility', 'advanced'] as const).default('compatibility'),
})

/** Native window configuration. */
export interface Config {
  /** Native presentation mode selected before BrowserWindow construction. */
  mode: DesktopShellMode
  /** Initial window width in CSS pixels. */
  width: number
  /** Initial window height in CSS pixels. */
  height: number
  /** Minimum window width in CSS pixels. */
  minWidth: number
  /** Minimum window height in CSS pixels. */
  minHeight: number
}

/** Validated native window configuration. */
export const Config: z<Config> = z.object({
  mode: z.union(['compatibility', 'advanced'] as const).default('compatibility'),
  width: z.number().step(1).min(800).default(1280),
  height: z.number().step(1).min(600).default(840),
  minWidth: z.number().step(1).min(640).default(900),
  minHeight: z.number().step(1).min(480).default(640),
})

/**
 * Construct the unmodified upstream Web root URL.
 * @param port - active loopback Web server port.
 * @param mode - active native presentation mode.
 * @param platform - active Electron platform.
 * @param windowTitle - product title surfaced by the advanced caption row.
 * @returns the URL loaded by the BrowserWindow.
 */
export function desktopRendererUrl(
  port: number,
  mode: DesktopShellMode,
  platform: Context['desktopRuntime']['platform'],
  windowTitle: string,
): string {
  const url = new URL(`http://127.0.0.1:${String(port)}/`)
  url.searchParams.set('dsh-desktop-mode', mode)
  url.searchParams.set('dsh-desktop-platform', platform)
  url.searchParams.set('dsh-desktop-version', pkg.version)
  url.searchParams.set('dsh-desktop-title', windowTitle)
  return url.href
}

/**
 * Register the Electron shell from active Web carrier values.
 * @param ctx - Host context carrying the Electron adapter and Web carrier.
 * @param config - validated native window values.
 */
export function apply(ctx: Context, config: Config): void {
  const runtime = ctx.get('desktopRuntime')
  if (runtime === undefined) {
    process.stderr.write(
      'dsh-plugin-desktop: this profile is composed with the DSH Desktop shell, which requires the desktop launcher (desktopRuntime).\n'
      + 'Start it with `dsh-desktop`, or select this profile inside the packaged DSH Desktop application.\n'
      + 'The desktop terminal, profile, and update rows stay inactive in an ordinary DSH boot.\n',
    )
    return
  }
  const appExit = ctx.get('appExit')
  if (appExit === undefined) {
    throw new Error('dsh-plugin-desktop: the launcher did not provide ctx.appExit')
  }
  if (ctx.webServer.host !== '127.0.0.1') {
    throw new Error('dsh-plugin-desktop: desktop shell requires a loopback Web server')
  }
  const iconFilename = runtime.platform === 'darwin'
    ? 'app-icon-mac.png'
    : 'app-icon.png'
  const iconPath = fileURLToPath(new URL(`../build/${iconFilename}`, import.meta.url))
  const trayIcons = {
    templatePath: fileURLToPath(new URL('../build/tray-iconTemplate.png', import.meta.url)),
    bluePath: fileURLToPath(new URL('../build/tray-icon-blue.png', import.meta.url)),
  }
  const settings = ctx.settings.register(
    DESKTOP_SETTINGS_NAMESPACE,
    DesktopSettingsSchema,
    {
      applies: 'restart',
      validate: (value) => {
        if (value.mode === 'advanced' && runtime.platform === 'linux') {
          throw new Error('dsh-plugin-desktop: advanced shell mode is supported on macOS and Windows')
        }
      },
    },
  )
  const rendererOrigin = `http://127.0.0.1:${String(ctx.webServer.port)}`
  ctx.effect(
    () => ctx.webServer.register({
      kind: 'exact',
      path: RENDERER_BOOT_REPORT_PATH,
      handler: (req, res) => handleRendererBootRequest(
        req,
        res,
        rendererOrigin,
        report => { runtime.reportRendererBoot(report) },
      ),
    }),
    'dsh-plugin-desktop: renderer boot report route',
  )
  /* Serve the brand icon so the advanced-shell renderer can <img> it. */
  const trayIconSvgPath = fileURLToPath(new URL('../build/tray-icon.svg', import.meta.url))
  const trayIconSvgBuffer = readFileSync(trayIconSvgPath)
  ctx.effect(
    () => ctx.webServer.register({
      kind: 'exact',
      path: '/assets/tray-icon.svg',
      handler: (_req, res) => {
        res.writeHead(200, {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=3600',
        })
        res.end(trayIconSvgBuffer)
      },
    }),
    'dsh-plugin-desktop: tray-icon.svg static asset route',
  )
  ctx.effect(() => {
    let pending: ReturnType<typeof setImmediate> | undefined
    const stopWatching = settings.watch((next) => {
      if (next.mode === config.mode) {
        if (pending !== undefined) clearImmediate(pending)
        pending = undefined
        return
      }
      pending ??= setImmediate(() => {
        pending = undefined
        void runtime.requestRestart().catch((cause: unknown) => {
          ctx.logger.error('dsh-plugin-desktop: failed to restart after mode change')
          ctx.logger.error(cause)
        })
      })
    })
    return () => {
      stopWatching()
      if (pending !== undefined) clearImmediate(pending)
    }
  }, 'dsh-plugin-desktop: restart after mode change')
  if (config.mode === 'advanced') {
    ctx.on('settings/updated', (namespace, next) => {
      if (namespace !== UI_THEME_SETTINGS_NAMESPACE) return
      runtime.setThemeSource((next as ThemeSettings).preference)
    })
  }
  ctx.inject(['settings'], settingsCtx => {
    const localeNamespace = settingsNamespace('locale')
    void settingsCtx.settings.mutate(localeNamespace, [
      { op: 'set', path: ['preference'], value: 'en' },
    ]).catch((err: unknown) => {
      ctx.logger.warn('dsh-plugin-desktop: failed to set default locale to English', err)
    })
  })
  ctx.effect(() => {
    const authHandler = createThreerouterAuthHandler(ctx)
    let removeRpc: (() => Promise<void>) | undefined
    const register = () => {
      removeRpc?.()
      const connection = ctx.get('connection')
      if (connection === undefined) return
      removeRpc = connection.rpc.handle('/threerouter-auth', authHandler.handler, {
        authority: 'loopback',
      })
    }
    register()
    return () => {
      void removeRpc?.()
      removeRpc = undefined
    }
  }, 'threerouter-auth: register RPC handler')

  ctx.effect(
    () => runtime.schedule({
      ...config,
      url: desktopRendererUrl(ctx.webServer.port, config.mode, runtime.platform, PRODUCT_NAME),
      productName: PRODUCT_NAME,
      windowTitle: PRODUCT_NAME,
      iconPath,
      trayIcons,
      readThemeSource: () => {
        const theme = ctx.settings.get(UI_THEME_SETTINGS_NAMESPACE) as ThemeSettings | undefined
        if (theme === undefined) {
          throw new Error('dsh-plugin-desktop: advanced shell requires the ui-theme settings namespace')
        }
        return theme.preference
      },
      requestQuit: appExit,
      requestModeChange: async mode => settings.update({ mode }),
    }),
    'dsh-plugin-desktop: native shell generation',
  )
}
