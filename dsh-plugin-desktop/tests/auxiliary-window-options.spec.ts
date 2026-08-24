import { describe, expect, it } from 'vitest'
import { auxiliaryWindowChromeOptions } from '../src/auxiliary-window-options.ts'

describe('Desktop auxiliary window chrome', () => {
  it('uses an empty 44px inset frame on macOS', () => {
    expect(auxiliaryWindowChromeOptions('darwin')).toEqual({
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 16 },
    })
  })

  it('uses native caption controls over an empty 44px frame on Windows', () => {
    expect(auxiliaryWindowChromeOptions('win32')).toEqual({
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        color: '#00000000',
        symbolColor: '#7f858f',
        height: 44,
      },
      hasShadow: true,
      roundedCorners: true,
      thickFrame: true,
    })
  })

  it('does not fake native controls on Linux', () => {
    expect(auxiliaryWindowChromeOptions('linux')).toEqual({})
  })
})
