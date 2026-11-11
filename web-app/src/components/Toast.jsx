import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import { createContext, useCallback, useContext, useState } from 'react'
import { t } from '../i18n/index.js'

const ToastContext = createContext(null)

// Notifications brèves, annoncées aux lecteurs d'écran (aria-live).
// Usage : const toast = useToast(); toast.success('Enregistré')
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => setToasts((list) => list.filter((tx) => tx.id !== id)), [])

  const push = useCallback(
    (kind, message) => {
      const id = Math.random().toString(36).slice(2)
      setToasts((list) => [...list.slice(-2), { id, kind, message }])
      setTimeout(() => dismiss(id), 4500)
    },
    [dismiss],
  )

  const api = { success: (m) => push('success', m), error: (m) => push('error', m) }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((tx) => (
          <div key={tx.id} className={`toast toast-${tx.kind}`} role={tx.kind === 'error' ? 'alert' : 'status'}>
            {tx.kind === 'success' ? (
              <CheckCircle2 size={18} className="icon" aria-hidden="true" />
            ) : (
              <AlertCircle size={18} className="icon" aria-hidden="true" />
            )}
            <span>{tx.message}</span>
            <button type="button" className="ghost icon-button" onClick={() => dismiss(tx.id)} aria-label={t('toast.fermerLaNotification')}>
              <X size={16} className="icon" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
