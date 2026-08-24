/** Visible inverted-L glass presentation for the extended window mode. */

import {
  EXTENDED_INNER_CORNER_RADIUS,
  EXTENDED_TITLEBAR_HEIGHT,
  MACOS_TRAFFIC_LIGHT_SAFE_WIDTH,
  WINDOWS_CAPTION_CONTROLS_WIDTH,
} from '../window-chrome.ts'

const STYLE_ID = 'dsh-desktop-extended-styles'

const CSS = `
html:has(body[data-dsh-desktop-mode="extended"]),
body[data-dsh-desktop-mode="extended"],
body[data-dsh-desktop-mode="extended"] #root { width: 100%; height: 100%; }
body[data-dsh-desktop-mode="extended"] { margin: 0; overflow: hidden; background: transparent !important; }
body[data-dsh-desktop-mode="extended"] #root {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding-top: ${EXTENDED_TITLEBAR_HEIGHT}px;
}
body[data-dsh-desktop-mode="extended"] #root > :has(> [data-shell-overlay]) {
  --dsw-specific-sidebar-fill: var(--dsh-desktop-extended-glass-fill);
  background: transparent !important;
}
body[data-dsh-desktop-mode="extended"] #root > :has(> [data-shell-overlay]) > :first-child {
  background: var(--dsh-desktop-extended-glass-fill) !important;
}
body[data-dsh-desktop-mode="extended"] #root > :has(> [data-shell-overlay]) > :nth-child(2) {
  overflow: hidden;
  border-top-left-radius: ${EXTENDED_INNER_CORNER_RADIUS}px;
  background: var(--dsw-alias-bg-base);
}
body[data-dsh-desktop-mode="extended"][data-dsh-desktop-material="off"] {
  --dsh-desktop-extended-glass-fill: var(--dsw-alias-bg-layer-1);
}
body[data-dsh-desktop-mode="extended"]:not([data-dsh-desktop-material="off"]) {
  --dsh-desktop-extended-glass-fill: color-mix(in srgb, var(--dsw-alias-bg-base) 54%, transparent);
}
.dshDesktopExtendedTitlebar {
  position: fixed;
  z-index: 2147483000;
  top: 0;
  right: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
  height: ${EXTENDED_TITLEBAR_HEIGHT}px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsh-desktop-extended-glass-fill);
  color: var(--dsw-alias-label-primary);
  user-select: none;
  -webkit-app-region: drag;
}
.dshDesktopExtendedTitlebar[data-platform="darwin"] {
  padding: 0 14px 0 ${MACOS_TRAFFIC_LIGHT_SAFE_WIDTH + 12}px;
}
.dshDesktopExtendedTitlebar[data-platform="win32"] {
  padding: 0 ${WINDOWS_CAPTION_CONTROLS_WIDTH + 12}px 0 16px;
}
.dshDesktopExtendedIdentity { display: flex; align-items: center; gap: 9px; min-width: 0; }
.dshDesktopExtendedProduct { font-size: 13px; font-weight: 600; white-space: nowrap; }
.dshDesktopExtendedMode {
  padding: 2px 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  white-space: nowrap;
}
.dshDesktopExtendedActions { display: flex; align-items: center; min-width: 0; -webkit-app-region: no-drag; }
.dshDesktopNativeActions { display: flex; align-items: center; gap: 8px; -webkit-app-region: no-drag; }
.dshDesktopNativeActions[data-placement="titlebar"] .dshDesktopSettingsHeaderButton {
  background: color-mix(in srgb, var(--dsw-alias-bg-base) 34%, transparent);
}
.dshDesktopNativeActionError {
  max-width: 260px;
  color: var(--dsw-alias-state-error-primary);
  font-size: 11px;
  line-height: 1.4;
}
`

export function installExtendedStyles(): () => void {
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.dataset.plugin = 'dsh-plugin-desktop'
  style.dataset.pluginCss = 'dsh-plugin-desktop/extended-shell'
  style.textContent = CSS
  document.head.appendChild(style)
  return () => { style.remove() }
}
