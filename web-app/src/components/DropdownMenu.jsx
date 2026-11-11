import { ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

// Menu déroulant accessible au clavier : Entrée ou flèche bas pour ouvrir,
// flèches pour naviguer, Échap pour fermer.
export function DropdownMenu({ label, buttonClassName = '', align = 'left', active = false, children, showChevron = true, ariaLabel }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onClick = (e) => !ref.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        ref.current?.querySelector('button')?.focus()
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const items = [...ref.current.querySelectorAll('.dropdown-item')]
        const index = items.indexOf(document.activeElement)
        const next = e.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length
        items[next]?.focus()
      }
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    ref.current?.querySelector('.dropdown-item')?.focus()
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="dropdown" ref={ref}>
      <button
        type="button"
        className={`${buttonClassName} ${active ? 'active' : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={menuId}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === 'ArrowDown' && setOpen(true)}
      >
        {label}
        {showChevron && <ChevronDown size={15} className="icon" aria-hidden="true" />}
      </button>
      {open && (
        <div id={menuId} className={`dropdown-menu elevated ${align === 'right' ? 'align-right' : ''}`} onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  )
}
