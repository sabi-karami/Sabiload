import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleAlert, CircleCheck, FolderOpen, LoaderCircle, Plus, X, Zap } from 'lucide-react'
import type { ProbeResult, StreamsMode } from '../../../shared/types'
import { useStore } from '../store'
import { useLang, useT } from '../useT'
import { bytes, num } from '../format'
import { errorText } from '../i18n'
import { NET_ICON } from './icons'

const URL_RE = /https?:\/\/[^\s"'<>]+/gi

export function NewDownloadDialog(): React.JSX.Element | null {
  const t = useT()
  const lang = useLang()
  const dialog = useStore((s) => s.dialog)
  const close = useStore((s) => s.closeDialog)
  const settings = useStore((s) => s.settings)
  const networks = useStore((s) => s.networks)
  const toast = useStore((s) => s.toast)
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [dir, setDir] = useState('')
  const [nets, setNets] = useState<string[]>([])
  const [streams, setStreams] = useState<StreamsMode>('auto')
  const [probe, setProbe] = useState<ProbeResult | null>(null)
  const [probing, setProbing] = useState(false)
  const [free, setFree] = useState<number | null>(null)
  const ta = useRef<HTMLTextAreaElement>(null)

  const urls = useMemo(() => [...new Set(text.match(URL_RE) ?? [])], [text])
  const prefill = dialog.prefill

  useEffect(() => {
    if (!dialog.open) return
    setDir(settings?.downloadDir ?? '')
    setNets(networks.filter((n) => n.enabled && !n.capped).map((n) => n.id))
    setStreams(settings?.streamsMode ?? 'auto')
    setProbe(null)
    setName(prefill?.fileName ?? '')
    if (prefill?.url) setText(prefill.url)
    else {
      setText('')
      void window.sabi.readClipboard().then((c) => {
        if (/^https?:\/\//i.test(c.trim())) setText(c.trim())
      })
    }
    setTimeout(() => ta.current?.focus(), 50)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog.open])

  useEffect(() => {
    if (!dialog.open || !dir) return
    void window.sabi.diskFree(dir).then(setFree)
  }, [dialog.open, dir])

  useEffect(() => {
    if (!dialog.open || urls.length !== 1) {
      setProbe(null)
      return
    }
    let stale = false
    setProbing(true)
    const timer = setTimeout(() => {
      void window.sabi.probe(urls[0], prefill?.headers).then((r) => {
        if (stale) return
        setProbe(r)
        setProbing(false)
        if (r.ok && !prefill?.fileName) setName(r.fileName)
      })
    }, 350)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [urls, dialog.open, prefill])

  if (!dialog.open) return null

  const submit = async (start: boolean): Promise<void> => {
    if (!urls.length) return
    const ids = await window.sabi.add({
      urls,
      dir,
      fileName: urls.length === 1 ? name : undefined,
      networks: nets.length === networks.filter((n) => n.enabled).length ? null : nets,
      streamsMode: streams,
      start,
      headers: prefill?.headers,
      referrer: prefill?.referrer
    })
    toast({ kind: 'success', text: t('added', { n: num(lang, ids.length) }) })
    close()
  }

  const usable = networks.filter((n) => n.enabled)

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div
        className="dialog glass"
        onKeyDown={(e) => {
          if (e.key === 'Escape') close()
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void submit(true)
        }}
      >
        <h2>
          <Plus size={20} />
          {t('newTitle')}
          <div style={{ flex: 1 }} />
          <button className="btn sm icon ghost" onClick={close}>
            <X size={16} />
          </button>
        </h2>
        <div className="field">
          <label>
            {t('urlsLabel')} {urls.length > 1 && <span className="chip accent">{t('linksCount', { n: num(lang, urls.length) })}</span>}
          </label>
          <textarea ref={ta} className="input ltr mono" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('urlsPlaceholder')} spellCheck={false} />
        </div>
        {urls.length === 1 && (
          <div className="probe">
            {probing ? (
              <>
                <LoaderCircle size={16} className="spin" />
                {t('checking')}
              </>
            ) : probe?.ok ? (
              <>
                {probe.resumable ? <Zap size={16} style={{ color: 'var(--good)' }} /> : <CircleAlert size={16} style={{ color: 'var(--warn)' }} />}
                <span>{probe.resumable ? t('parallelOk') : t('parallelNo')}</span>
                <div style={{ flex: 1 }} />
                <span className="chip num">{probe.size ? bytes(lang, probe.size) : t('unknownSize')}</span>
              </>
            ) : probe && !probe.ok ? (
              <>
                <CircleAlert size={16} style={{ color: 'var(--bad)' }} />
                {t('probeFailed', { e: errorText(lang, probe.error) })}
              </>
            ) : null}
          </div>
        )}
        {urls.length <= 1 && (
          <div className="field">
            <label>{t('fileName')}</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} dir="auto" />
          </div>
        )}
        <div className="field">
          <label>
            {t('saveTo')} {free !== null && <span className="faint num">· {t('freeSpace', { s: bytes(lang, free) })}</span>}
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input ltr" value={dir} onChange={(e) => setDir(e.target.value)} />
            <button
              className="btn"
              onClick={async () => {
                const d = await window.sabi.chooseFolder(dir)
                if (d) setDir(d)
              }}
            >
              <FolderOpen size={16} />
              {t('change')}
            </button>
          </div>
        </div>
        <div className="field">
          <label>{t('useNetworks')}</label>
          <div className="chooser">
            {usable.map((n) => {
              const Icon = NET_ICON[n.kind]
              const on = nets.includes(n.id)
              return (
                <button
                  key={n.id}
                  className={on ? 'on' : ''}
                  style={{ '--c': n.color } as React.CSSProperties}
                  onClick={() => setNets(on ? nets.filter((x) => x !== n.id) : [...nets, n.id])}
                  disabled={n.capped}
                >
                  {on ? <CircleCheck size={15} style={{ color: n.color }} /> : <Icon size={15} />}
                  {n.name}
                  {n.latency !== null && <span className="faint num">{num(lang, n.latency)}ms</span>}
                </button>
              )
            })}
          </div>
        </div>
        <div className="field">
          <label title={t('autoHint')}>{t('streamsLabel')}</label>
          <div className="seg">
            {(['auto', 4, 8, 16, 32] as StreamsMode[]).map((v) => (
              <button key={String(v)} className={streams === v ? 'on' : ''} onClick={() => setStreams(v)}>
                {v === 'auto' ? t('auto') : num(lang, v as number)}
              </button>
            ))}
          </div>
        </div>
        <div className="dialog-foot">
          <button className="btn" disabled={!urls.length || !nets.length} onClick={() => void submit(false)}>
            {t('addToQueue')}
          </button>
          <button className="btn primary" disabled={!urls.length || !nets.length} onClick={() => void submit(true)}>
            <Zap size={16} />
            {t('downloadNow')}
            <kbd>Ctrl ↵</kbd>
          </button>
        </div>
      </div>
    </div>
  )
}
