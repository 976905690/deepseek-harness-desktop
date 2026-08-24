type NativePlatform = 'darwin' | 'win32' | 'linux'

function nativePlatform(): NativePlatform {
  const value = new URLSearchParams(window.location.search).get('platform')
  return value === 'darwin' || value === 'win32' ? value : 'linux'
}

/** Independent 44px drag frame shared by Desktop-owned utility surfaces. */
export function DesktopFrame(): JSX.Element {
  return <header aria-hidden="true" className="dshNativeFrame" data-platform={nativePlatform()} />
}
