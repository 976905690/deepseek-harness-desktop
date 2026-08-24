/** Settings-header actions backed by the Desktop launcher. */

import { useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { DesktopSettingsApi } from './desktop-settings-api.ts'

/** Registration-side capabilities for native Desktop actions. */
export interface DesktopTerminalSettingsActionInjected {
  readonly api: Pick<DesktopSettingsApi, 'openTerminal' | 'restart'>
}

/** Renderer-composed terminal action props. */
export type DesktopTerminalSettingsActionProps =
  PropsRuntime<'settings.action'>
  & PropsLocale<'desktop.settings'>
  & InjectFace<DesktopTerminalSettingsActionInjected>

/** Open DSH Terminal or restart without exposing launcher details to the renderer. */
export function DesktopTerminalSettingsAction({ api, t }: DesktopTerminalSettingsActionProps) {
  const [opening, setOpening] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [failed, setFailed] = useState<'terminal' | 'restart'>()

  const open = (): void => {
    if (opening || restarting) return
    setOpening(true)
    setFailed(undefined)
    void api.openTerminal()
      .catch(() => { setFailed('terminal') })
      .finally(() => { setOpening(false) })
  }

  const restart = (): void => {
    if (opening || restarting) return
    setRestarting(true)
    setFailed(undefined)
    void api.restart().catch(() => {
      setFailed('restart')
      setRestarting(false)
    })
  }

  return (
    <div className="dshDesktopSettingsTerminalAction">
      {failed !== undefined && (
        <span className="dshDesktopSettingsTerminalError" role="alert">
          {t(failed === 'terminal' ? 'openTerminalError' : 'restartDesktopError')}
        </span>
      )}
      <button
        type="button"
        className="dshDesktopSettingsHeaderButton"
        disabled={opening || restarting}
        onClick={open}
      >
        {t(opening ? 'openingTerminal' : 'openTerminal')}
      </button>
      <button
        type="button"
        className="dshDesktopSettingsHeaderButton"
        disabled={opening || restarting}
        onClick={restart}
      >
        {t(restarting ? 'restartingDesktop' : 'restartDesktop')}
      </button>
    </div>
  )
}
