import { X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { t } from '../i18n/index.js'

// Boîte de dialogue accessible : fermeture par Échap ou clic sur le fond,
// focus placé dans la boîte puis restitué à la fermeture. Elle est rendue
// dans <body> : un ancêtre animé (transformation) la positionnerait sinon
// par rapport à la page au lieu de l'écran, et son bas deviendrait
// inaccessible.
export function Modal({ title, onClose, children, actions, wide = false }) {
  const ref = useRef(null)

  useEffect(() => {
    const previous = document.activeElement
    const first = ref.current?.querySelector('input, textarea, select, button:not(.modal-close)')
    ;(first ?? ref.current)?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab') {
        const focusable = ref.current.querySelectorAll('a[href], button:not(:disabled), input, textarea, select')
        if (!focusable.length) return
        const [firstEl, lastEl] = [focusable[0], focusable[focusable.length - 1]]
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault()
          lastEl.focus()
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault()
          firstEl.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previous?.focus?.()
    }
  }, [onClose])

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`modal elevated ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1}>
        <div className="modal-head">
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="ghost icon-button modal-close" onClick={onClose} aria-label={t('common.close')}>
            <X size={18} className="icon" aria-hidden="true" />
          </button>
        </div>
        {children}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>,
    document.body,
  )
}

const DialogContext = createContext(null)

// Remplace confirm() et prompt() du navigateur par des boîtes de dialogue
// cohérentes avec l'interface. Usage : const { confirm, prompt } = useDialog()
export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null)
  const [value, setValue] = useState('')

  const open = useCallback(
    (options) =>
      new Promise((resolve) => {
        setValue('')
        setDialog({ ...options, resolve })
      }),
    [],
  )

  const confirm = useCallback((options) => open({ ...options, kind: 'confirm' }), [open])
  const prompt = useCallback((options) => open({ ...options, kind: 'prompt' }), [open])

  const close = (result) => {
    dialog.resolve(result)
    setDialog(null)
  }

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      {dialog && (
        <Modal
          title={dialog.title}
          onClose={() => close(dialog.kind === 'prompt' ? null : false)}
          actions={
            <>
              <button type="button" className="secondary" onClick={() => close(dialog.kind === 'prompt' ? null : false)}>{t('common.cancel')}</button>
              <button
                type="submit"
                form="dialog-form"
                className={dialog.danger ? 'danger' : ''}
                disabled={dialog.kind === 'prompt' && !value.trim()}
              >
                {dialog.confirmLabel ?? t('common.confirm')}
              </button>
            </>
          }
        >
          <form
            id="dialog-form"
            className="form"
            onSubmit={(e) => {
              e.preventDefault()
              close(dialog.kind === 'prompt' ? value.trim() : true)
            }}
          >
            {dialog.message && <p className="muted" style={{ margin: 0 }}>{dialog.message}</p>}
            {dialog.kind === 'prompt' && (
              <label>
                {dialog.label ?? t('common.reason')}
                <textarea rows={3} required value={value} onChange={(e) => setValue(e.target.value)} />
              </label>
            )}
          </form>
        </Modal>
      )}
    </DialogContext.Provider>
  )
}

export function useDialog() {
  return useContext(DialogContext)
}
