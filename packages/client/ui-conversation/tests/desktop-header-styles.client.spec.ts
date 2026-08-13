/** Frameless desktop header hit regions remain isolated from Web presentation. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  fileURLToPath(new URL('../src/client/skeleton/ConversationRoot.module.css', import.meta.url)),
  'utf8',
)

describe('conversation desktop header', () => {
  it('keeps the resident blank-page titlebar seat below the Session header', () => {
    expect(css).toMatch(/\.desktopTitlebarDragRegion\s*\{[^}]*display: none;/s)
    expect(css).toMatch(
      /:global\(html\[data-dsh-desktop='true'\]\) \.desktopTitlebarDragRegion\s*\{[^}]*z-index: 1;[^}]*-webkit-app-region: drag;/s,
    )
    expect(css).toMatch(/\.header\s*\{[^}]*z-index: 2;/s)
  })

  it('uses the full header as a desktop drag region', () => {
    expect(css).toMatch(
      /:global\(html\[data-dsh-desktop='true'\]\) \.header\s*\{[^}]*-webkit-app-region: drag;/s,
    )
    expect(css).not.toMatch(/(?:^|\n)\.header\s*\{[^}]*-webkit-app-region/s)
  })

  it.each([
    'button:not(:disabled)',
    'a',
    'input',
    'select',
    'textarea',
    "[role='button']",
    "[role='link']",
    "[role='tab']",
    "[contenteditable='true']",
  ])('keeps header %s interactions outside the drag region', (selector) => {
    expect(css).toContain(
      `:global(html[data-dsh-desktop='true']) .header ${selector}`,
    )
    expect(css).toMatch(/-webkit-app-region: no-drag;/)
  })
})
