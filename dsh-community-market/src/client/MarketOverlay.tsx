import { useEffect, useRef } from 'react'
import {
  Button,
  IconCloseOutline16,
  Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import { MarketSurface, type MarketView } from './MarketSettingsTab.js'
import type { createMarketViewStore } from './market-view-store.js'

export type MarketOverlayProps = PropsRuntime<'shell.overlay'>
  & PropsStore<ReturnType<typeof createMarketViewStore>>
  & PropsLocale<'community-market'>
  & { readLocale: () => string; initialView?: MarketView }

export function MarketOverlay({ useStore, actions, readLocale, t, initialView }: MarketOverlayProps) {
  const open = useStore(state => state.open)
  const panel = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (document.querySelectorAll('[role="dialog"]').length > 1) return
      actions.close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [actions, open])

  if (!open) return null
  return (
    <div className="dshMarketOverlay" role="dialog" aria-modal="true" aria-label={t('title')}>
      <button className="dshMarketOverlayMask" type="button" aria-label={t('closeMarket')} onClick={() => actions.close()} />
      <section ref={panel} className="dshMarketOverlayPanel">
        <header className="dshMarketOverlayHeader">
          <div>
            <h1>{t('title')}</h1>
            <p>{t('subtitle')}</p>
          </div>
          <Tooltip label={t('closeMarket')}>
            <Button
              variant="ghost"
              size="sm"
              aria-label={t('closeMarket')}
              icon={<IconCloseOutline16 />}
              onClick={() => actions.close()}
            />
          </Tooltip>
        </header>
        <div className="dshMarketOverlayBody">
          <MarketSurface
            {...(initialView === undefined ? {} : { initialView })}
            readLocale={readLocale}
            showHeader={false}
            t={t}
          />
        </div>
      </section>
    </div>
  )
}
<<<<<<< HEAD

function SourceRow({ source, onToggle, onRemove, t }: { source: MarketSourceView; onToggle: () => void; onRemove: () => void; t: MarketOverlayProps['t'] }) {
  return (
    <div className="dshMarketSource">
      <div><h3>{source.name}{source.partnership && <span className="dshMarketPartner">{t('partner')}</span>}</h3><p>{source.partnership ? t('partnerCatalogDescription') : (source.description ?? source.endpoint)}</p></div>
      <div className="dshMarketSourceActions">
        <span className="dshMarketStatus" data-enabled={source.enabled}><span className="dshMarketStatusDot" />{source.enabled ? t('enabled') : t('disabled')}</span>
        <Button variant="outline" size="sm" icon={source.enabled ? <IconCheckOutline16 /> : undefined} onClick={onToggle}>{source.enabled ? t('disable') : t('enable')}</Button>
        <Tooltip label={t('remove')}><button type="button" className="dshMarketIconButton" aria-label={t('remove')} onClick={onRemove}><IconTrashOutline16 /></button></Tooltip>
      </div>
    </div>
  )
}

function AvailableSource({ provider, onAdd, t }: { provider: MarketBuiltInProvider; onAdd: () => void; t: MarketOverlayProps['t'] }) {
  return (
    <div className="dshMarketSource">
      <div><h3>{provider.name}{provider.partnership && <span className="dshMarketPartner">{t('partner')}</span>}</h3><p>{provider.partnership ? t('partnerCatalogDescription') : provider.description}</p></div>
      <Button variant="outline" size="sm" icon={<IconPlusOutline16 />} onClick={onAdd}>{t('add')}</Button>
    </div>
  )
}

function DetailsDrawer({ value, onClose, t }: { value: VisibleItem; onClose: () => void; t: MarketOverlayProps['t'] }) {
  return <>
    <button type="button" className="dshMarketDrawerMask" aria-label={t('close')} onClick={onClose} />
    <aside className="dshMarketDrawer" aria-label={t('details')}>
      <div className="dshMarketDrawerHead"><h2>{t('details')}</h2><button type="button" className="dshMarketIconButton" aria-label={t('close')} onClick={onClose}><IconCloseOutline16 /></button></div>
      <div className="dshMarketDrawerBody">
        <h3>{value.item.displayName}</h3>
        <div className="dshMarketDrawerMeta">{t('source')}: {value.source.name}</div>
        <div className="dshMarketDrawerSummary">{value.item.description ?? value.item.summary}</div>
        {value.item.repository !== undefined && <Button variant="outline" icon={<IconRightUpOutline16 />} onClick={() => window.open(value.item.repository!.url, '_blank', 'noopener,noreferrer')}>{t('repository')}</Button>}
        <div className="dshMarketDrawerNotice">{t('readOnly')}</div>
      </div>
    </aside>
  </>
}
=======
>>>>>>> upstream/master
