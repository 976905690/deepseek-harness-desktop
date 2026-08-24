/** Shared launcher-backed actions rendered in settings and extended title bars. */

import { Bug, LifeBuoy, RefreshCw, RotateCw, SquareTerminal, Wrench } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { DesktopSettingsApi } from './desktop-settings-api.ts'
import type { DesktopSettingsLocaleKey } from './desktop-settings-locales.ts'

export interface DesktopNativeActionsProps {
  readonly api: Pick<DesktopSettingsApi, 'openTerminal' | 'restart'>
    & Partial<Pick<DesktopSettingsApi, 'restartToRecovery' | 'reloadRenderer' | 'toggleDeveloperTools'>>
  readonly t: (key: DesktopSettingsLocaleKey) => string
  readonly placement: 'settings' | 'titlebar'
}

export function DesktopNativeActions({ api, t, placement }: DesktopNativeActionsProps) {
  const [opening, setOpening] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [developerAction, setDeveloperAction] = useState<'reload' | 'devtools'>()
  const [restartMenuOpen, setRestartMenuOpen] = useState(false)
  const [developerMenuOpen, setDeveloperMenuOpen] = useState(false)
  const [failed, setFailed] = useState<'terminal' | 'restart' | 'reload' | 'devtools'>()
  const developerMenuRef = useRef<HTMLDivElement>(null)
  const restartMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!developerMenuOpen && !restartMenuOpen) return
    const dismiss = (event: MouseEvent): void => {
      if (!developerMenuRef.current?.contains(event.target as Node)) setDeveloperMenuOpen(false)
      if (!restartMenuRef.current?.contains(event.target as Node)) setRestartMenuOpen(false)
    }
    const escape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setDeveloperMenuOpen(false)
        setRestartMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', dismiss)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [developerMenuOpen, restartMenuOpen])

  const busy = opening || restarting || developerAction !== undefined

  const open = (): void => {
    if (busy) return
    setOpening(true)
    setFailed(undefined)
    void api.openTerminal()
      .catch(() => { setFailed('terminal') })
      .finally(() => { setOpening(false) })
  }

  const restart = (recovery = false): void => {
    if (busy) return
    setRestarting(true)
    setRestartMenuOpen(false)
    setFailed(undefined)
    const operation = recovery ? api.restartToRecovery : api.restart
    if (operation === undefined) {
      setFailed('restart')
      setRestarting(false)
      return
    }
    void operation().catch(() => {
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
          onClick={() => { restart() }}
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
      <div className="dshDesktopNativeActionMenuAnchor" ref={restartMenuRef}>
        <button
          type="button"
          className="dshDesktopTitlebarIconButton"
          aria-label={t('restartOptions')}
          aria-expanded={restartMenuOpen}
          aria-haspopup="menu"
          title={t('restartOptions')}
          disabled={busy}
          onClick={() => {
            setDeveloperMenuOpen(false)
            setRestartMenuOpen(value => !value)
          }}
        >
          <RotateCw aria-hidden="true" />
        </button>
        {restartMenuOpen && (
          <div className="dshDesktopActionMenu" role="menu">
            <button type="button" className="dshDesktopActionMenuItem" role="menuitem" disabled={busy} onClick={() => { restart() }}>
              <RotateCw aria-hidden="true" /><span>{t('restartDesktop')}</span>
            </button>
            <button type="button" className="dshDesktopActionMenuItem" role="menuitem" disabled={busy} onClick={() => { restart(true) }}>
              <LifeBuoy aria-hidden="true" /><span>{t('restartToRecovery')}</span>
            </button>
          </div>
        )}
      </div>
      <div className="dshDesktopNativeActionMenuAnchor" ref={developerMenuRef}>
        <button
          type="button"
          className="dshDesktopTitlebarIconButton"
          aria-label={t('developerOptions')}
          aria-expanded={developerMenuOpen}
          aria-haspopup="menu"
          title={t('developerOptions')}
          disabled={busy}
          onClick={() => {
            setRestartMenuOpen(false)
            setDeveloperMenuOpen(value => !value)
          }}
        >
          <Wrench aria-hidden="true" />
        </button>
        {developerMenuOpen && (
          <div className="dshDesktopActionMenu" role="menu">
            <button
              type="button"
              className="dshDesktopActionMenuItem"
              role="menuitem"
              disabled={busy}
              onClick={() => { runDeveloperAction('reload') }}
            >
              <RefreshCw aria-hidden="true" />
              <span>{t('reloadRenderer')}</span>
            </button>
            <button
              type="button"
              className="dshDesktopActionMenuItem"
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
