import {
  ADVANCED_MACOS_CONTENT_INSET,
  ADVANCED_MACOS_DRAG_LAYER_Z_INDEX,
  ADVANCED_MACOS_DRAG_REGION_HEIGHT,
  ADVANCED_WINDOWS_TITLEBAR_HEIGHT,
  MACOS_TRAFFIC_LIGHT_SAFE_WIDTH,
  WINDOWS_CAPTION_CONTROLS_WIDTH,
} from '../window-chrome.ts'
import { SIDEBAR_COLLAPSED } from './layout-state.ts'

/** Desktop-owned shell stylesheet kept as a plain string so the client bundle stays self-contained. */
const DESKTOP_OWNED_STYLES = `
html, body, #root { width: 100%; height: 100%; }
body:is([data-dsh-desktop-mode="extended"], [data-dsh-desktop-mode="advanced"]) { margin: 0; background: transparent !important; }
.dshDesktopFrame { position: relative; display: grid; grid-template-rows: 100%; width: 100%; height: 100%; overflow: hidden; background: transparent; transition: grid-template-columns var(--ds-transition-duration-slow) var(--ds-ease-in-out); }
.dshDesktopSidebarSurface { --dsw-specific-sidebar-fill: transparent; position: relative; grid-column: 1; grid-row: 1; min-width: 0; overflow: hidden; background: transparent; border-right: 1px solid var(--dsw-alias-border-l1); }
body:is([data-dsh-desktop-mode="extended"], [data-dsh-desktop-mode="advanced"])[data-dsh-desktop-material="off"] .dshDesktopSidebarSurface { --dsw-specific-sidebar-fill: var(--dsw-alias-bg-layer-1); background: var(--dsw-alias-bg-layer-1); }
.dshDesktopUpstreamSidebar { box-sizing: border-box; width: 100%; height: 100%; }
body:is([data-dsh-desktop-mode="extended"], [data-dsh-desktop-mode="advanced"]) [data-slot="sidebar.footer.action"] { display: flex !important; flex-direction: column; gap: 6px; min-width: 0; width: 100%; max-height: min(40vh, 240px); overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
body:is([data-dsh-desktop-mode="extended"], [data-dsh-desktop-mode="advanced"]) [data-slot="sidebar.footer.action"] > * { flex: none; min-width: 0; }
.dshDesktopFrame[data-dragging] { transition: none; }
.dshDesktopFrame[data-desktop-mode="advanced"][data-desktop-platform="darwin"] .dshDesktopUpstreamSidebar { padding-top: ${ADVANCED_MACOS_CONTENT_INSET}px; }
.dshDesktopFrame[data-desktop-mode="advanced"][data-desktop-platform="darwin"][data-sidebar-collapsed] .dshDesktopUpstreamSidebar { width: ${SIDEBAR_COLLAPSED}px; margin: 0 auto; }
.dshDesktopFrame[data-desktop-mode="advanced"][data-desktop-platform="darwin"] { grid-template-rows: ${ADVANCED_MACOS_CONTENT_INSET}px minmax(0, 1fr); }
.dshDesktopFrame[data-desktop-mode="advanced"][data-desktop-platform="darwin"] .dshDesktopSidebarSurface { grid-row: 1 / -1; }
.dshDesktopFrame[data-desktop-mode="advanced"][data-desktop-platform="darwin"] .dshDesktopConversationSurface,
.dshDesktopFrame[data-desktop-mode="advanced"][data-desktop-platform="darwin"] .dshDesktopDetailsSurface { grid-row: 2; }
.dshDesktopFrame[data-desktop-mode="advanced"][data-desktop-platform="darwin"] .dshDesktopSidebarSurface::before { content: ""; position: absolute; z-index: ${ADVANCED_MACOS_DRAG_LAYER_Z_INDEX}; top: 0; right: 0; left: ${MACOS_TRAFFIC_LIGHT_SAFE_WIDTH}px; height: ${ADVANCED_MACOS_DRAG_REGION_HEIGHT}px; user-select: none; -webkit-app-region: drag; }
.dshDesktopMacCaptionRow { position: absolute; z-index: ${ADVANCED_MACOS_DRAG_LAYER_Z_INDEX}; grid-column: 2 / -1; grid-row: 1; top: 0; right: 0; left: 0; height: ${ADVANCED_MACOS_DRAG_REGION_HEIGHT}px; background: var(--dsw-alias-bg-base); user-select: none; -webkit-app-region: drag; }
.dshDesktopSidebarCaption { position: absolute; top: 0; left: 0; right: 0; height: ${ADVANCED_WINDOWS_TITLEBAR_HEIGHT}px; display: flex; align-items: center; gap: 6px; padding: 0 12px; z-index: 10; pointer-events: none; user-select: none; color: var(--dsw-alias-label-secondary); -webkit-app-region: drag; }
.dshDesktopSidebarCaption > svg,
.dshDesktopSidebarCaption > span { pointer-events: auto; -webkit-app-region: no-drag; }
.dshDesktopSidebarCaptionTitle { font-size: 12px; line-height: 1; font-weight: 500; color: var(--dsw-alias-label-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dshDesktopCaptionTitle { position: absolute; top: 0; left: 12px; height: 100%; display: inline-flex; align-items: center; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-family: inherit; font-size: 12px; line-height: 1; font-weight: 500; color: var(--dsw-alias-label-secondary); user-select: none; pointer-events: none; }
.dshDesktopMacCaptionRow .dshDesktopCaptionTitle { max-width: calc(100% - 24px); }
.dshDesktopWindowsCaptionRow .dshDesktopCaptionTitle { max-width: calc(100% - ${WINDOWS_CAPTION_CONTROLS_WIDTH}px - 12px); }
.dshDesktopConversationSurface { grid-column: 2; grid-row: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; background: var(--dsw-alias-bg-base); }
.dshDesktopDetailsSurface { grid-column: 3; grid-row: 1; min-width: 0; min-height: 0; overflow: hidden; background: var(--dsw-alias-bg-base); border-left: 1px solid var(--dsw-alias-border-l2); }
.dshDesktopFrame[data-details-collapsed] .dshDesktopDetailsSurface { border-left: none; }
.dshDesktopFrame[data-desktop-mode="advanced"][data-desktop-platform="win32"] { grid-template-rows: ${ADVANCED_WINDOWS_TITLEBAR_HEIGHT}px minmax(0, 1fr); }
.dshDesktopFrame[data-desktop-mode="advanced"][data-desktop-platform="win32"] .dshDesktopSidebarSurface { grid-row: 1 / -1; }
.dshDesktopFrame[data-desktop-mode="advanced"][data-desktop-platform="win32"] .dshDesktopConversationSurface,
.dshDesktopFrame[data-desktop-mode="advanced"][data-desktop-platform="win32"] .dshDesktopDetailsSurface { grid-row: 2; }
.dshDesktopWindowsCaptionRow { position: relative; grid-column: 2 / -1; grid-row: 1; min-width: 0; background: var(--dsw-alias-bg-base); }
.dshDesktopWindowsCaptionRow::before { content: ""; position: absolute; inset: 0 ${WINDOWS_CAPTION_CONTROLS_WIDTH}px 0 0; user-select: none; -webkit-app-region: drag; }
.dshDesktopFrame[data-dragging] { transition: none; }

/* ---- Threerouter account / balance / invite / model-switch (shell.overlay) ---- */
.dshDesktopOverlay { position: absolute; z-index: 1000; inset: 0; pointer-events: none; }
.dshDesktopOverlay > * { pointer-events: auto; }
.dshDesktopResizeHandle { position: absolute; z-index: 50; top: 0; bottom: 0; width: 8px; margin-left: -4px; cursor: col-resize; touch-action: none; -webkit-app-region: no-drag; transition: left var(--ds-transition-duration-slow) var(--ds-ease-in-out); }
.dshDesktopFrame[data-dragging] .dshDesktopResizeHandle { transition: none; }
.dshDesktopNoDrag, button, input, textarea, select, label, summary, a, [contenteditable="true"], [role="button"], [role="checkbox"], [role="dialog"], [role="menuitem"], [role="option"], [role="switch"], [role="tab"] { -webkit-app-region: no-drag !important; }
html:has([aria-modal="true"]) .dshDesktopWindowsCaptionRow::before { -webkit-app-region: no-drag !important; }
html:has([aria-modal="true"]) .dshDesktopMacCaptionRow::before,
html:has([aria-modal="true"]) .dshDesktopSidebarSurface,
html:has([aria-modal="true"]) .dshDesktopSidebarSurface::before { -webkit-app-region: no-drag !important; }
@media (prefers-reduced-motion: reduce) { .dshDesktopFrame { transition: none !important; } }

/* ---- Threerouter account / balance / invite / model-switch (shell.overlay) ---- */
.trAuth { position: absolute; top: 48px; right: 180px; z-index: 1100; font-family: inherit; }
.trAuthPill { display: inline-flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px 0 4px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 999px; background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-primary); cursor: pointer; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12); transition: background var(--ds-transition-duration-fast) var(--ds-ease), border-color var(--ds-transition-duration-fast) var(--ds-ease); }
.trAuthPill:hover { background: var(--dsw-alias-interactive-bg-hover); border-color: var(--dsw-alias-border-l3); }
.trAuthAvatar { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: var(--dsw-alias-button-primary-fill); color: var(--dsw-alias-label-primary-foreground); font-size: 12px; font-weight: 600; }
.trAuthBalance { font-size: 12px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.trAuthLabel { font-size: 12px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.trAuthDialog { position: absolute; top: 40px; right: 0; width: 300px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px; background: var(--dsw-alias-bg-layer-3); box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18); color: var(--dsw-alias-label-primary); overflow: hidden; }
.trAuthDialogHeader { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-primary); font-size: 13px; font-weight: 600; }
.trAuthClose { border: none; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; font-size: 13px; line-height: 1; padding: 4px; }
.trAuthClose:hover { color: var(--dsw-alias-label-primary); }
.trAuthError { margin: 10px 14px 0; padding: 8px 10px; border-radius: 8px; background: var(--dsw-alias-state-error-secondary); color: #fff; font-size: 12px; }
.trAuthNotice { margin: 10px 14px 0; padding: 8px 10px; border-radius: 8px; background: var(--dsw-alias-state-success-tertiary); color: var(--dsw-alias-label-primary); font-size: 12px; }
.trAuthLogin, .trAuthProfile { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
.trAuthLogin label { display: flex; flex-direction: column; gap: 4px; color: var(--dsw-alias-label-primary); font-size: 12px; }
.trAuthLogin input { height: 32px; padding: 0 10px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-specific-login-input, var(--dsw-alias-bg-layer-2, rgba(127, 133, 143, 0.08))); color: var(--dsw-alias-label-primary); font-size: 13px; outline: none; color-scheme: inherit; }
.trAuthLogin input::placeholder { color: var(--dsw-alias-label-tertiary, #98a2b3); opacity: 1; }
.trAuthLogin input:focus { border-color: var(--dsw-alias-state-business-primary); }
.trAuthHint { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 1.5; }
.trAuthPrimary { height: 34px; border: none; border-radius: 8px; background: var(--dsw-alias-button-primary-fill); color: var(--dsw-alias-label-primary-foreground); font-size: 13px; font-weight: 600; cursor: pointer; }
.trAuthPrimary:hover { background: var(--dsw-alias-button-primary-hover); }
.trAuthPrimary:disabled { background: var(--dsw-alias-button-primary-dimmed); cursor: default; }
.trAuthRegister { height: 34px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: transparent; color: var(--dsw-alias-label-primary); font-size: 13px; font-weight: 600; cursor: pointer; }
.trAuthRegister:hover { background: var(--dsw-alias-interactive-bg-hover); }
.trAuthCloseBtn { height: 32px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: transparent; color: var(--dsw-alias-label-secondary); font-size: 13px; font-weight: 500; cursor: pointer; }
.trAuthCloseBtn:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.trAuthProfileRow { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.trAuthEmail { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.trAuthBalanceBig { font-size: 15px; font-weight: 700; color: var(--dsw-alias-label-primary); }
.trAuthFieldLabel { font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.trAuthCopyHint { font-size: 12px; color: var(--dsw-alias-state-success-primary); }
.trAuthSection { display: flex; flex-direction: column; gap: 6px; }
.trAuthSectionTitle { font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.trAuthSelect { height: 32px; padding: 0 8px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-specific-login-input); color: var(--dsw-alias-label-primary); font-size: 13px; outline: none; }
.trAuthActions { display: flex; gap: 8px; }
.trAuthSecondary { flex: 1; height: 32px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: transparent; color: var(--dsw-alias-label-primary); font-size: 12px; font-weight: 600; cursor: pointer; }
.trAuthSecondary:hover { background: var(--dsw-alias-interactive-bg-hover); }
.trAuthDanger { height: 32px; padding: 0 12px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: var(--dsw-alias-state-error-primary); font-size: 12px; font-weight: 600; cursor: pointer; }
.trAuthDanger:hover { background: var(--dsw-alias-interactive-bg-hover-danger); }
.trAuthVersionBadge { margin-top: 4px; padding: 2px 8px; font-size: 10px; line-height: 14px; color: var(--dsw-alias-label-secondary); text-align: center; white-space: nowrap; }
.trAuthVersion { padding: 8px 14px 12px; font-size: 11px; color: var(--dsw-alias-label-tertiary); text-align: center; border-top: 1px solid var(--dsw-alias-border-l1); }

/* ---- Threerouter sidebar (replaces upstream SidebarRoot) ---- */
.trSidebarRoot {
  --dsh-sidebar-inline-padding: 12px;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 6px var(--dsh-sidebar-inline-padding);
  box-sizing: border-box;
  background: var(--dsw-specific-sidebar-fill);
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);
}
.trSidebarCollapsed {
  padding: 18px 10px 6px;
}
.trSidebarFading > * {
  opacity: 0;
  transition: opacity 150ms var(--ds-ease-in-out);
}
.trSidebarWide {
  animation: trSidebarWideIn 200ms var(--ds-ease-in-out);
}
@keyframes trSidebarWideIn {
  from { opacity: 0; }
}
.trSidebarRailIn .trSidebarIconButton,
.trSidebarRailIn .trSidebarNewSession,
.trSidebarRailIn .trSidebarRegionArea {
  animation: trSidebarRailIn 150ms var(--ds-ease-in-out) backwards;
}
.trSidebarRailIn .trSidebarFootArea {
  animation: trSidebarFadeIn 150ms var(--ds-ease-in-out) backwards;
}
@keyframes trSidebarRailIn {
  from { opacity: 0; transform: translateX(49px); }
}
@keyframes trSidebarFadeIn {
  from { opacity: 0; }
}
.trSidebarLogoRow {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  height: 60px;
  padding: 8px 0 8px 4px;
  margin-bottom: 8px;
  box-sizing: border-box;
  overflow: hidden;
}
.trSidebarCollapsed .trSidebarLogoRow {
  height: 36px;
  padding: 0;
  margin-bottom: 12px;
  justify-content: flex-start;
}
.trSidebarBrand {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  overflow: hidden;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.trSidebarIconButton {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  padding: 0;
  background: transparent;
  cursor: pointer;
  color: var(--dsw-alias-label-secondary);
}
.trSidebarIconButton:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
.trSidebarCollapsed .trSidebarIconButton {
  width: 36px;
  height: 36px;
}
.trSidebarCollapsed .trSidebarToggle .trSidebarPanelIcon {
  display: none;
}
.trSidebarCollapsed .trSidebarToggle:hover .trSidebarPanelIcon {
  display: inline;
}
.trSidebarCollapsed .trSidebarToggle:hover .trSidebarRailIcon {
  display: none;
}
.trSidebarCollapsed .trSidebarIconButton {
  color: var(--dsw-alias-label-primary);
}
.trSidebarNewSession {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 38px;
  padding: 8px 16px;
  margin: 0 2px 8px;
  box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-button-elevated-fill);
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
  cursor: pointer;
  overflow: hidden;
}
.trSidebarNewSession:hover {
  background: var(--dsw-alias-button-floating-hover);
}
.trSidebarCollapsed .trSidebarNewSession {
  align-self: flex-start;
  width: 36px;
  height: 36px;
  padding: 0;
  margin: 0 0 12px;
  gap: 0;
  border-color: transparent;
  background: transparent;
}
.trSidebarCollapsed .trSidebarNewSession:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
.trSidebarNewSessionLabel {
  max-width: 200px;
  overflow: hidden;
  white-space: nowrap;
}
.trSidebarCollapsed .trSidebarNewSessionLabel {
  max-width: 0;
}
.trSidebarRegionArea {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin-left: -4px;
  margin-right: calc(-1 * var(--dsh-sidebar-inline-padding));
  padding-left: 4px;
  overflow: hidden;
}
.trSidebarCollapsed .trSidebarRegionArea {
  margin-left: 0;
  margin-right: 0;
  padding-left: 0;
}
.trSidebarFootArea {
  flex: none;
  display: flex;
  flex-direction: column;
}
.trSidebarSettingsArea,
.trSidebarFooterActions {
  flex: none;
  min-width: 0;
  width: 100%;
}
.trSidebarFooterActions {
  display: flex;
}
.trSidebarCollapsed .trSidebarFootArea {
  align-items: center;
}
.trSidebarCollapsed .trSidebarSettingsArea,
.trSidebarCollapsed .trSidebarFooterActions {
  display: flex;
  justify-content: center;
  width: auto;
}
.trSidebarVersionLabel {
  flex: none;
  padding: 8px 4px 4px;
  font-size: 11px;
  line-height: 1.4;
  color: var(--dsw-alias-label-tertiary);
  text-align: center;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
@media (prefers-reduced-motion: reduce) {
  .trSidebarWide,
  .trSidebarFading > *,
  .trSidebarRailIn .trSidebarIconButton,
  .trSidebarRailIn .trSidebarNewSession,
  .trSidebarRailIn .trSidebarFootArea,
  .trSidebarRailIn .trSidebarRegionArea {
    transition: none;
    animation: none;
  }
}
html:has([aria-modal="true"]) .dshDesktopWindowsCaptionRow::before { -webkit-app-region: no-drag !important; }
@media (prefers-reduced-motion: reduce) {
  .dshDesktopFrame,
  .dshDesktopResizeHandle { transition: none !important; }
}
`

/** Install shared panel styles; mode selectors keep enhanced and extended chrome independent. */
export function installDesktopOwnedStyles(): () => void {
  const style = document.createElement('style')
  style.dataset.plugin = 'dsh-plugin-desktop'
  style.dataset.pluginCss = 'dsh-plugin-desktop/desktop-owned-layout'
  style.textContent = DESKTOP_OWNED_STYLES
  document.head.appendChild(style)
  return () => { style.remove() }
}