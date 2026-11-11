// Commandes du joueur : clavier (positions physiques des touches, donc
// valables en AZERTY comme en QWERTY), souris, et commandes tactiles qui
// écrivent dans le même état.

export function createInput() {
  const input = {
    keys: new Set(),
    // Déplacement analogique (manette tactile) : x à droite, y en avant.
    stick: { x: 0, y: 0 },
    runToggle: false,
    jumpQueued: false,
    interactQueued: false,
    look: { yaw: 0, pitch: 0.32, distance: 6.5 },
    // Dernier réglage manuel de la caméra (souris, doigt ou flèches).
    lastLook: 0,
    enabled: true,
  }
  const FORWARD = ['KeyW', 'ArrowUp']
  const BACK = ['KeyS', 'ArrowDown']
  const LEFT = ['KeyA']
  const RIGHT = ['KeyD']
  const has = (codes) => codes.some((c) => input.keys.has(c))

  input.axis = () => {
    let x = (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0) + input.stick.x
    let y = (has(FORWARD) ? 1 : 0) - (has(BACK) ? 1 : 0) + input.stick.y
    const len = Math.hypot(x, y)
    if (len > 1) {
      x /= len
      y /= len
    }
    return { x, y }
  }
  // Rotation de la caméra au clavier (flèches gauche et droite).
  input.turn = () => (input.keys.has('ArrowRight') ? 1 : 0) - (input.keys.has('ArrowLeft') ? 1 : 0)
  input.running = () => input.runToggle || input.keys.has('ShiftLeft') || input.keys.has('ShiftRight') || Math.hypot(input.stick.x, input.stick.y) > 0.92

  const typing = (e) => e.target instanceof HTMLElement && (e.target.closest('input, textarea, select') || e.target.isContentEditable)

  const down = (e) => {
    if (!input.enabled || typing(e)) return
    input.keys.add(e.code)
    if (e.code === 'Space') {
      input.jumpQueued = true
      e.preventDefault()
    }
    if (e.code === 'KeyE' || e.code === 'Enter') input.interactQueued = true
    if (e.code.startsWith('Arrow')) e.preventDefault()
  }
  const up = (e) => input.keys.delete(e.code)
  const blur = () => input.keys.clear()
  // Écoute du clavier, à brancher dans un effet (renvoie la fonction de retrait).
  input.attach = () => {
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }
  input.reset = () => {
    input.keys.clear()
    input.stick.x = 0
    input.stick.y = 0
    input.jumpQueued = false
    input.interactQueued = false
  }
  return input
}

// Rotation de la caméra par glissement (souris ou doigt) sur la scène, zoom
// à la molette ou au pincement.
export function attachLook(element, input) {
  const pointers = new Map()
  let pinch = 0
  const onDown = (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    element.setPointerCapture?.(e.pointerId)
  }
  const onMove = (e) => {
    const prev = pointers.get(e.pointerId)
    if (!prev) return
    if (pointers.size === 2) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const [a, b] = [...pointers.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (pinch) input.look.distance = Math.min(12, Math.max(3, input.look.distance * (pinch / d)))
      pinch = d
      return
    }
    input.look.yaw -= (e.clientX - prev.x) * 0.006
    input.lastLook = performance.now()
    input.look.pitch = Math.min(1.2, Math.max(-0.05, input.look.pitch + (e.clientY - prev.y) * 0.004))
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }
  const onUp = (e) => {
    pointers.delete(e.pointerId)
    pinch = 0
  }
  const onWheel = (e) => {
    e.preventDefault()
    input.look.distance = Math.min(12, Math.max(3, input.look.distance * (1 + Math.sign(e.deltaY) * 0.08)))
  }
  element.addEventListener('pointerdown', onDown)
  element.addEventListener('pointermove', onMove)
  element.addEventListener('pointerup', onUp)
  element.addEventListener('pointercancel', onUp)
  element.addEventListener('wheel', onWheel, { passive: false })
  return () => {
    element.removeEventListener('pointerdown', onDown)
    element.removeEventListener('pointermove', onMove)
    element.removeEventListener('pointerup', onUp)
    element.removeEventListener('pointercancel', onUp)
    element.removeEventListener('wheel', onWheel)
  }
}
