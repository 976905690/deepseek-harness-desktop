/**
 * Threerouter sidebar shell: replaces the upstream SidebarRoot with
 * Threerouter-branded logo/wordmark while keeping the same layout,
 * collapse/expand animation, and child slot delegation.
 *
 * The slot contract is identical to the upstream SidebarRoot — the same
 * children (sidebar.workspaces, sidebar.settings, sidebar.footer.action)
 * are rendered via renderSlot(), declared by the upstream plugin.
 */

import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  IconNewChatOutline16, IconPanelLeftOutline16,
  Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { ThreerouterIcon, ThreerouterWordmark } from './threerouter-logo.tsx'

/** Wide-content unmount delay; matches the upstream 150ms fade-out. */
const COLLAPSE_SETTLE_MS = 150

/**
 * Sidebar column shell with Threerouter branding.
 *
 * Props composition mirrors the upstream SidebarRootComponentProps:
 *   collapsed, width → runtime props from slot framework
 *   startSession, toggleSidebar → injected callbacks
 *   t → locale function
 *   renderSlot → child slot renderer (provided by slot framework)
 */
export function ThreerouterSidebar(props: any) {
  const { collapsed, width, startSession, toggleSidebar, t, renderSlot, version } = props
  // Wide content stays mounted while the collapse animates (fading via
  // .collapsed .wide), unmounts at settle, and remounts right away on expand.
  const [settled, setSettled] = useState(collapsed)
  useEffect(() => {
    if (!collapsed) { setSettled(false); return }
    const timer = window.setTimeout(() => { setSettled(true) }, COLLAPSE_SETTLE_MS)
    return () => { window.clearTimeout(timer) }
  }, [collapsed])
  const wide = !collapsed || !settled

  // Freeze the content at its expanded width while it fades out.
  const lastWideWidth = useRef(width)
  if (!collapsed) lastWideWidth.current = width

  // Rail-in only crossfades a live collapse.
  const everWide = useRef(!collapsed)
  if (!collapsed) everWide.current = true

  return (
    <div
      className={clsx(
        'trSidebarRoot',
        !wide && 'trSidebarCollapsed',
        !wide && everWide.current && 'trSidebarRailIn',
        collapsed && wide && 'trSidebarFading',
      )}
      style={wide ? { width: collapsed ? lastWideWidth.current : width } : undefined}
    >
      {/* Logo row: Threerouter wordmark when expanded, icon toggle when collapsed */}
      <div className="trSidebarLogoRow">
        {wide && (
          <button
            type="button"
            className={clsx('trSidebarBrand', 'trSidebarWide')}
            aria-label={t('session.new.label')}
            onClick={() => { startSession() }}
          >
            <ThreerouterWordmark />
          </button>
        )}
        <Tooltip label={collapsed ? t('toggle.open') : t('toggle.collapse')} delayMs={500}>
          <button
            type="button"
            className={clsx('trSidebarIconButton', 'trSidebarToggle')}
            aria-label={collapsed ? t('toggle.open') : t('toggle.collapse')}
            onClick={() => { toggleSidebar() }}
          >
            {!wide && <ThreerouterIcon className="trSidebarRailIcon" size={24} />}
            <IconPanelLeftOutline16 className="trSidebarPanelIcon" size={wide ? 16 : 18} />
          </button>
        </Tooltip>
      </div>

      {/* New Session button */}
      <Tooltip label={t('session.new.label')} delayMs={500} disabled={wide}>
        <button
          type="button"
          className="trSidebarNewSession"
          aria-label={t('session.new.label')}
          onClick={() => { startSession() }}
        >
          <IconNewChatOutline16 size={wide ? 14 : 18} />
          {wide && <span className={clsx('trSidebarNewSessionLabel', 'trSidebarWide')}>{t('session.new')}</span>}
        </button>
      </Tooltip>

      {/* Workspace/session browsing region */}
      <div className="trSidebarRegionArea">
        {renderSlot('sidebar.workspaces', {
          wide,
          expandSidebar: () => { if (collapsed) toggleSidebar() },
        })}
      </div>

      {/* Footer: footer actions + Settings + version */}
      <div className="trSidebarFootArea">
        <div className="trSidebarFooterActions">
          {renderSlot('sidebar.footer.action', { wide })}
        </div>
        <div className="trSidebarSettingsArea">
          {renderSlot('sidebar.settings', { wide })}
        </div>
        {wide && <div className="trSidebarVersionLabel">Deepseek Harness for Threerouter  v{version}</div>}
      </div>
    </div>
  )
}
