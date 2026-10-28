import { CircleAlert, CircleCheck, Download, Info, X } from 'lucide-react'
import { useStore } from '../store'
import { useT } from '../useT'

export function Toasts(): React.JSX.Element {
  const t = useT()
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)
  const openDialog = useStore((s) => s.openDialog)
  return (
    <div className="toasts">
      {toasts.map((x) => {
        const Icon = x.kind === 'success' ? CircleCheck : x.kind === 'error' ? CircleAlert : x.kind === 'link' ? Download : Info
        return (
          <div key={x.id} className={`toast glass ${x.kind}`}>
            <Icon size={18} className="ti" />
            <div style={{ flex: 1, minWidth: 0 }}>
              {x.kind === 'link' ? (
                <>
                  <div style={{ fontWeight: 700 }}>{t('clipboardFound')}</div>
                  <div className="mono ltr faint" style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {x.text}
                  </div>
                </>
              ) : (
                x.text
              )}
            </div>
            {x.kind === 'link' && (
              <button
                className="btn sm primary"
                onClick={() => {
                  dismiss(x.id)
                  openDialog(x.link)
                }}
              >
                {t('download')}
              </button>
            )}
            <button className="btn sm icon ghost" onClick={() => dismiss(x.id)}>
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
