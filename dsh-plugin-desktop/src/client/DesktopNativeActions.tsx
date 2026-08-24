/** Shared launcher-backed actions rendered in settings and extended title bars. */

import { Bug, RefreshCw, RotateCw, SquareTerminal, Wrench } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { DesktopSettingsApi } from './desktop-settings-api.ts'
import type { DesktopSettingsLocaleKey } from './desktop-settings-locales.ts'

export interface DesktopNativeActionsProps {
  readonly api: Pick<DesktopSettingsApi, 'openTerminal' | 'restart'>
    & Partial<Pick<DesktopSettingsApi, 'reloadRenderer' | 'toggleDeveloperTools'>>
  readonly t: (key: DesktopSettingsLocaleKey) => string
  readonly placement: 'settings' | 'titlebar'
}

export function DesktopNativeActions({ api, t, placement }: DesktopNativeActionsProps) {
  const [opening, setOpening] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [developerAction, setDeveloperAction] = useState<'reload' | 'devtools'>()
  const [developerMenuOpen, setDeveloperMenuOpen] = useState(false)
  const [failed, setFailed] = useState<'terminal' | 'restart' | 'reload' | 'devtools'>()
  const developerMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!developerMenuOpen) return
    const dismiss = (event: MouseEvent): void => {
      if (!developerMenuRef.current?.contains(event.target as Node)) setDeveloperMenuOpen(false)
    }
    const escape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setDeveloperMenuOpen(false)
    }
    document.addEventListener('mousedown', dismiss)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [developerMenuOpen])

  const busy = opening || restarting || developerAction !== undefined

  const open = (): void => {
    if (busy) return
    setOpening(true)
    setFailed(undefined)
    void api.openTerminal()
      .catch(() => { setFailed('terminal') })
      .finally(() => { setOpening(false) })
  }

  const restart = (): void => {
    if (busy) return
    setRestarting(true)
    setFailed(undefined)
    void api.restart().catch(() => {
      setFailed('restart')
      setRestarting(false)
    })
  }

  const runDeveloperAction = (action: 'reload' | 'devtools'): void => {
    if (busy) return
    const operation = action === 'reload' ? api.reloadRenderer : api.toggleDeveloperTools
    if (operation === undefined) return
    setDeveloperAction(action)
    setDeveloperMenuOpen(false)
    setFailed(undefined)
    void operation().catch(() => {
      setFailed(action)
    }).finally(() => {
      setDeveloperAction(undefined)
    })
  }

  const failureKey = failed === 'terminal'
    ? 'openTerminalError'
    : failed === 'restart'
      ? 'restartDesktopError'
      : failed === 'reload'
        ? 'reloadRendererError'
        : 'toggleDeveloperToolsError'

  if (placement === 'settings') {
    return (
      <div className="dshDesktopNativeActions" data-placement={placement}>
        {failed !== undefined && (
          <span className="dshDesktopNativeActionError" role="alert">{t(failureKey)}</span>
        )}
        <button
          type="button"
          className="dshDesktopSettingsHeaderButton"
          disabled={busy}
          onClick={open}
        >
          {t(opening ? 'openingTerminal' : 'openTerminal')}
        </button>
        <button
          type="button"
          className="dshDesktopSettingsHeaderButton"
          disabled={busy}
          onClick={restart}
        >
          {t(restarting ? 'restartingDesktop' : 'restartDesktop')}
        </button>
      </div>
    )
  }

  return (
    <div className="dshDesktopNativeActions" data-placement={placement}>
      {failed !== undefined && (
        <span className="dshDesktopNativeActionError" role="alert">{t(failureKey)}</span>
      )}
      <button
        type="button"
        className="dshDesktopTitlebarIconButton"
        aria-label={t('openTerminal')}
        title={t('openTerminal')}
        disabled={busy}
        onClick={open}
      >
        <SquareTerminal aria-hidden="true" />
      </button>
      <button
        type="button"
        className="dshDesktopTitlebarIconButton"
        aria-label={t('restartDesktop')}
        title={t('restartDesktop')}
        disabled={busy}
        onClick={restart}
      >
        <RotateCw aria-hidden="true" />
      </button>
      <div ref={developerMenuRef}>
        <button
          type="button"
          className="dshDesktopTitlebarIconButton"
          aria-label={t('developerOptions')}
          aria-expanded={developerMenuOpen}
          aria-haspopup="menu"
          title={t('developerOptions')}
          disabled={busy}
          onClick={() => { setDeveloperMenuOpen(value => !value) }}
        >
          <Wrench aria-hidden="true" />
        </button>
        {developerMenuOpen && (
          <div className="dshDesktopDeveloperMenu" role="menu">
            <button
              type="button"
              className="dshDesktopDeveloperMenuItem"
              role="menuitem"
              disabled={busy}
              onClick={() => { runDeveloperAction('reload') }}
            >
              <RefreshCw aria-hidden="true" />
              <span>{t('reloadRenderer')}</span>
            </button>
            <button
              type="button"
              className="dshDesktopDeveloperMenuItem"
              role="menuitem"
              disabled={busy}
              onClick={() => { runDeveloperAction('devtools') }}
            >
              <Bug aria-hidden="true" />
              <span>{t('toggleDeveloperTools')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
