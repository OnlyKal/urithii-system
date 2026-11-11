// Outils de présentation des médias (durées, tailles, formats).

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const s = Math.floor(seconds % 60)
  const m = Math.floor((seconds / 60) % 60)
  const h = Math.floor(seconds / 3600)
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

export function formatSize(bytes) {
  if (!bytes) return null
  const units = ['o', 'Ko', 'Mo', 'Go']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i += 1
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

// Extension lisible (PDF, MP3…) à partir du type MIME.
export function formatLabel(mimeType) {
  if (!mimeType) return ''
  const known = { 'application/pdf': 'PDF', 'text/plain': 'TXT', 'audio/mpeg': 'MP3', 'audio/mp4': 'M4A', 'audio/x-m4a': 'M4A', 'video/quicktime': 'MOV' }
  if (known[mimeType]) return known[mimeType]
  const sub = mimeType.split('/')[1] ?? ''
  return sub.replace(/^x-/, '').split(/[.+;-]/)[0].toUpperCase().slice(0, 5)
}
