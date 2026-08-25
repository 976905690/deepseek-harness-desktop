/** Independent Desktop frame portalled above the upstream content viewport. */

import { createPortal } from 'react-dom'
import type {
  InjectFace, PropsLocale, PropsRuntime,
} from '@deepseek-ai/dsh-client-ui-slots'
import type { DesktopSettingsApi } from './desktop-settings-api.ts'
import type { DesktopClientEnvironment } from './environment.ts'
import { DesktopNativeActions } from './DesktopNativeActions.tsx'

export interface DesktopFrameTitlebarInjected {
  readonly environment: DesktopClientEnvironment
  readonly api: Pick<
    DesktopSettingsApi,
    'openTerminal' | 'restart' | 'restartToRecovery' | 'reloadRenderer' | 'toggleDeveloperTools'
  >
}

export type DesktopFrameTitlebarProps = PropsRuntime<'shell.overlay'>
  & PropsLocale<'desktop.settings'>
  & InjectFace<DesktopFrameTitlebarInjected>

/** Horizontal frame surface; the unrelated upstream content starts below it. */
export function DesktopFrameTitlebar({ api, environment, t }: DesktopFrameTitlebarProps) {
  return createPortal((
    <header
      className="dshDesktopFrameTitlebar"
      data-dsh-desktop-frame="titlebar"
      data-platform={environment.platform}
      data-material={environment.material}
    >
      <div className="dshDesktopFrameIdentity">
        <span className="dshDesktopFrameProduct">DSH Desktop</span>
        <span className="dshDesktopFrameMode">
          {t(environment.mode === 'compatibility' ? 'compatibilityMode' : 'extendedMode')}
        </span>
      </div>
      <div className="dshDesktopFrameActions">
        <DesktopNativeActions api={api} t={t} placement="titlebar" />
      </div>
    </header>
  ), document.body)
}
