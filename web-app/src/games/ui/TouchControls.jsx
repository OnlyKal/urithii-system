import { ArrowBigUp, Footprints, Hand } from 'lucide-react'
import { useRef, useState } from 'react'
import { g } from '../i18n.js'

// Commandes tactiles : manette virtuelle (déplacement), saut, course,
// interaction. La caméra se tourne en glissant sur la scène.

export function TouchControls({ input, canInteract, onInteract }) {
  const base = useRef()
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const [running, setRunning] = useState(false)
  const pointer = useRef(null)

  const update = (e) => {
    const rect = base.current.getBoundingClientRect()
    const r = rect.width / 2
    let x = (e.clientX - rect.left - r) / r
    let y = (e.clientY - rect.top - r) / r
    const len = Math.hypot(x, y)
    if (len > 1) {
      x /= len
      y /= len
    }
    input.stick.x = x
    input.stick.y = -y
    setKnob({ x: x * r * 0.6, y: y * r * 0.6 })
  }
  const release = () => {
    pointer.current = null
    input.stick.x = 0
    input.stick.y = 0
    setKnob({ x: 0, y: 0 })
  }

  return (
    <div className="touch-controls">
      <div
        ref={base}
        className="touch-stick"
        onPointerDown={(e) => {
          pointer.current = e.pointerId
          e.currentTarget.setPointerCapture(e.pointerId)
          update(e)
        }}
        onPointerMove={(e) => pointer.current === e.pointerId && update(e)}
        onPointerUp={release}
        onPointerCancel={release}
        aria-label={g('cmdDeplacer')}
        role="application"
      >
        <span className="touch-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
      <div className="touch-actions">
        <button
          type="button"
          className={`touch-button ${running ? 'is-on' : ''}`}
          aria-pressed={running}
          aria-label={g('cmdCourir')}
          onClick={() => {
            input.runToggle = !running
            setRunning(!running)
          }}
        >
          <Footprints size={22} aria-hidden="true" />
        </button>
        <button type="button" className="touch-button" aria-label={g('cmdSauter')} onPointerDown={() => (input.jumpQueued = true)}>
          <ArrowBigUp size={24} aria-hidden="true" />
        </button>
        <button type="button" className={`touch-button is-main ${canInteract ? 'is-ready' : ''}`} aria-label={g('cmdInteragir')} onClick={onInteract} disabled={!canInteract}>
          <Hand size={24} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
