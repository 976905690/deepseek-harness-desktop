/** Visible extended-window command bar portalled above the upstream root. */

import { createPortal } from 'react-dom'
import type {
  InjectFace, PropsLocale, PropsRenderSlots, PropsRuntime,
} from '@deepseek-ai/dsh-client-ui-slots'
import type { DesktopSettingsApi } from './desktop-settings-api.ts'
import type { DesktopClientEnvironment } from './environment.ts'
import { DesktopNativeActions } from './DesktopNativeActions.tsx'

export interface ExtendedTitlebarInjected {
  readonly environment: DesktopClientEnvironment
}

export type ExtendedTitlebarProps = PropsRuntime<'shell.overlay'>
  & PropsLocale<'desktop.settings'>
  & PropsRenderSlots<'desktop.titlebar.action'>
  & InjectFace<ExtendedTitlebarInjected>

/** Inverted-L horizontal command surface; the upstream root starts below it. */
export function ExtendedTitlebar({ environment, renderSlot, t }: ExtendedTitlebarProps) {
  return createPortal((
    <header
      className="dshDesktopExtendedTitlebar"
      data-platform={environment.platform}
      data-material={environment.material}
    >
      <div className="dshDesktopExtendedIdentity">
        <span className="dshDesktopExtendedProduct">DSH Desktop</span>
        <span className="dshDesktopExtendedMode">{t('extendedMode')}</span>
      </div>
      <div className="dshDesktopExtendedActions">
        {renderSlot('desktop.titlebar.action', {})}
      </div>
    </header>
  ), document.body)
}

export interface ExtendedTitlebarNativeActionsInjected {
  readonly api: Pick<DesktopSettingsApi, 'openTerminal' | 'restart'>
}

export type ExtendedTitlebarNativeActionsProps = PropsRuntime<'desktop.titlebar.action'>
  & PropsLocale<'desktop.settings'>
  & InjectFace<ExtendedTitlebarNativeActionsInjected>

export function ExtendedTitlebarNativeActions({ api, t }: ExtendedTitlebarNativeActionsProps) {
  return <DesktopNativeActions api={api} t={t} placement="titlebar" />
}
