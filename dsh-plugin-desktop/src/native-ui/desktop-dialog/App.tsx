import { AlertCircle, AlertTriangle, HelpCircle, Info } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { Button } from '../components/ui/button.tsx'
import { DesktopFrame } from '../shared/DesktopFrame.tsx'

const SCHEME = 'dsh-desktop-dialog:'

interface DesktopDialogState {
  readonly type: 'none' | 'info' | 'error' | 'question' | 'warning'
  readonly title: string
  readonly message: string
  readonly detail?: string
  readonly buttons: readonly string[]
  readonly defaultId: number
  readonly cancelId: number
}

function decodeState(): DesktopDialogState | undefined {
  const encoded = new URLSearchParams(window.location.search).get('state')
  if (encoded === null || encoded.length > 64_000) return undefined
  try {
    const normalized = encoded.replaceAll('-', '+').replaceAll('_', '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const value: unknown = JSON.parse(new TextDecoder().decode(
      Uint8Array.from(atob(padded), character => character.charCodeAt(0)),
    ))
    if (value !== null && typeof value === 'object') return value as DesktopDialogState
  } catch { /* The bounded fallback below remains actionable. */ }
  return undefined
}

function respond(response: number): void {
  const url = new URL(`${SCHEME}//response`)
  url.searchParams.set('id', String(response))
  window.location.assign(url.href)
}

function reportLayout(height: number): void {
  const url = new URL(`${SCHEME}//layout`)
  url.searchParams.set('height', String(height))
  window.location.assign(url.href)
}

function ToneIcon({ type }: Pick<DesktopDialogState, 'type'>): JSX.Element {
  const className = type === 'error'
    ? 'text-destructive'
    : type === 'warning'
      ? 'text-amber-500'
      : 'text-muted-foreground'
  if (type === 'error') return <AlertCircle aria-hidden="true" className={className} />
  if (type === 'warning') return <AlertTriangle aria-hidden="true" className={className} />
  if (type === 'question') return <HelpCircle aria-hidden="true" className={className} />
  return <Info aria-hidden="true" className={className} />
}

export function DesktopDialogApp(): JSX.Element {
  const state = decodeState()
  const contentRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (state === undefined) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') respond(state.cancelId)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown) }
  }, [state])
  useLayoutEffect(() => {
    const content = contentRef.current
    if (content === null) return
    let frame: number | undefined
    let lastHeight = 0
    const measure = (): void => {
      frame = undefined
      const height = Math.ceil(content.getBoundingClientRect().height)
      if (height <= 0 || height === lastHeight) return
      lastHeight = height
      reportLayout(height)
    }
    const observer = new ResizeObserver(() => {
      frame ??= requestAnimationFrame(measure)
    })
    observer.observe(content)
    measure()
    return () => {
      observer.disconnect()
      if (frame !== undefined) cancelAnimationFrame(frame)
    }
  }, [])

  if (state === undefined) return <><DesktopFrame /><main ref={contentRef} className="dshNativeContent flex items-center justify-center p-5"><p className="text-sm text-destructive">Desktop dialog state is unavailable.</p></main></>
  return <><DesktopFrame /><main ref={contentRef} className="dshNativeContent flex flex-col overflow-hidden p-5">
    <section className="flex gap-4" role="dialog" aria-labelledby="desktop-dialog-title" aria-describedby={state.detail === undefined ? undefined : 'desktop-dialog-detail'}>
      <div className="mt-0.5 shrink-0"><ToneIcon type={state.type} /></div>
      <div className="min-w-0">
        <h1 className="text-base font-semibold leading-tight" id="desktop-dialog-title">{state.message}</h1>
        {state.detail === undefined ? null : <p className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground" id="desktop-dialog-detail">{state.detail}</p>}
      </div>
    </section>
    <footer className="mt-5 flex shrink-0 flex-wrap justify-end gap-2">
      {state.buttons.map((label, index) => <Button autoFocus={index === state.defaultId} key={`${String(index)}:${label}`} onClick={() => { respond(index) }} type="button" variant={index === state.defaultId ? 'default' : index === state.cancelId ? 'outline' : 'secondary'}>{label}</Button>)}
    </footer>
  </main></>
}
