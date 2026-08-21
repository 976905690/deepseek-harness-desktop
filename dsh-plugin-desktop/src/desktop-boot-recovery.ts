/** Desktop-only controls injected into the framework-free upstream boot page. */

import type { IndexInjection } from '@deepseek-ai/dsh-host-webserver'

/** The only request made by the early-boot terminal button. */
export const DESKTOP_TERMINAL_OPEN_REQUEST = Object.freeze({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: '{}',
  credentials: 'same-origin',
})

export const DESKTOP_BOOT_TERMINAL_STYLE = `
[data-dsh-desktop-terminal] {
  margin-top: 16px;
  padding: 8px 14px;
  border: 1px solid currentColor;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
}
[data-dsh-desktop-terminal]:disabled { cursor: progress; opacity: 0.6; }
`

/**
 * Add a terminal action after the upstream boot page reports a plugin failure.
 * This runs before the Client Loader starts and deliberately uses only the
 * loopback, same-origin empty-body Desktop endpoint. Ordinary Web launches do
 * not receive this row because the Desktop Host is the only subscriber.
 */
export const DESKTOP_BOOT_TERMINAL_SCRIPT = `(() => {
  const endpoint = '/api/desktop/terminal/open';
  const label = '打开 DSH 终端 / Open DSH Terminal';
  const attach = () => {
    const root = document.querySelector('[data-dsh-boot]');
    if (!root || root.querySelector('[data-dsh-desktop-terminal]')) return;
    const title = [...root.querySelectorAll('div')].find((node) =>
      node.childElementCount === 0 && node.textContent?.trim() === 'Failed to load plugins'
    );
    const report = title?.parentElement;
    if (!report) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.dshDesktopTerminal = '';
    button.textContent = label;
    button.addEventListener('click', () => {
      button.disabled = true;
      fetch(endpoint, ${JSON.stringify(DESKTOP_TERMINAL_OPEN_REQUEST)})
        .then((response) => { if (!response.ok) throw new Error('terminal request failed'); })
        .catch(() => {})
        .finally(() => { button.disabled = false; });
    });
    report.append(button);
  };
  new MutationObserver(attach).observe(document.documentElement, { childList: true, subtree: true });
  attach();
})();`

/** Structured rows consumed by both the loopback server and static boot renderer. */
export function desktopBootRecoveryInjections(): readonly IndexInjection[] {
  return [
    { kind: 'style', text: DESKTOP_BOOT_TERMINAL_STYLE },
    { kind: 'script', placement: 'body', text: DESKTOP_BOOT_TERMINAL_SCRIPT },
  ]
}
