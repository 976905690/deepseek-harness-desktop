/** Shared launcher-backed actions rendered in settings and extended title bars. */

import { useState } from 'react'
import type { DesktopSettingsApi } from './desktop-settings-api.ts'
import type { DesktopSettingsLocaleKey } from './desktop-settings-locales.ts'

export interface DesktopNativeActionsProps {
  readonly api: Pick<DesktopSettingsApi, 'openTerminal' | 'restart'>
  readonly t: (key: DesktopSettingsLocaleKey) => string
  readonly placement: 'settings' | 'titlebar'
}

export function DesktopNativeActions({ api, t, placement }: DesktopNativeActionsProps) {
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
    <div className="dshDesktopNativeActions" data-placement={placement}>
      {failed !== undefined && (
        <span className="dshDesktopNativeActionError" role="alert">
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
